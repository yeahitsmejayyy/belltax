import { Stage } from "@app/schema";
import {
  DndContext, DragOverlay, KeyboardSensor, MeasuringStrategy, PointerSensor, closestCorners, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type CollisionDetection, type DragEndEvent, type DragOverEvent, type DragStartEvent, type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CircleDollarSign, FileWarning, MoreHorizontal } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { cn } from "../utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./dropdown-menu";
import { STAGE_META, StagePill } from "./stage-pill";

// The pipeline board (admin 05-pipeline-pipeline-board), handled like the command-center board: grab a card
// anywhere (a click still opens it), it lifts and follows the cursor while the original stays faded in place,
// the column you're aiming at lights up and the ones it can't go to fade, and on release it lands at once.
// Keyboard: focus a card, Space to lift, ←/→ a column at a time, Space to drop, Escape to cancel; Enter opens.
// Every card also has a "Move to…" menu: dragging is never the only way (WCAG 2.5.7).
//
// The board is controlled but optimistic. `onMove` may return a promise: the card sits in its new column
// while it's pending, stays there if it resolves true, and goes back if it resolves false (refused, cancelled).

export type BoardCardData = {
  id: string;
  stage: Stage;
  household: string;
  filers: string;
  filingStatus?: string | null;
  missingDocuments?: number;
  unpaid?: boolean;
  daysInStage: number;
};

type PipelineBoardProps = {
  cards: BoardCardData[];
  stages?: readonly Stage[];
  onMove: (id: string, from: Stage, to: Stage) => void | Promise<boolean>;
  // Which columns a card may be dropped on; others fade while it's held. Default: any other column.
  canMove?: (card: BoardCardData, to: Stage) => boolean;
  onOpen?: (id: string) => void;
  staleAfterDays?: number;
  className?: string;
};

const label = (s: Stage) => STAGE_META[s].label;

// The column under the pointer; failing that (between columns, or the keyboard), the nearest one.
const collision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length ? within : closestCorners(args);
};

export function PipelineBoard({ cards, stages = Stage.options, onMove, canMove, onOpen, staleAfterDays = 7, className }: PipelineBoardProps) {
  const [held, setHeld] = React.useState<BoardCardData | null>(null);
  const [target, setTarget] = React.useState<Stage | null>(null);
  // Optimistic placements: where a card shows while its move is being decided.
  const [placed, setPlaced] = React.useState<Map<string, Stage>>(new Map());
  const boardRef = React.useRef<HTMLDivElement>(null);

  const shown = React.useMemo(() => cards.map((c) => (placed.has(c.id) ? { ...c, stage: placed.get(c.id)! } : c)), [cards, placed]);
  const byId = React.useMemo(() => new Map(shown.map((c) => [c.id, c])), [shown]);
  const allowed = React.useCallback((card: BoardCardData, to: Stage) => to !== card.stage && (canMove ? canMove(card, to) : true), [canMove]);

  // Keyboard dragging jumps a whole column per arrow press instead of creeping 25px at a time.
  const coordinateGetter: KeyboardCoordinateGetter = React.useCallback(
    (event, { context: { active: a, over, droppableRects } }) => {
      if (event.code !== "ArrowRight" && event.code !== "ArrowLeft") return undefined;
      event.preventDefault();
      const from = (over?.id as Stage | undefined) ?? (a ? byId.get(String(a.id))?.stage : undefined);
      const at = from ? stages.indexOf(from) : -1;
      const next = stages[Math.min(stages.length - 1, Math.max(0, at + (event.code === "ArrowRight" ? 1 : -1)))];
      const rect = next ? droppableRects.get(next) : undefined;
      return rect ? { x: rect.left + 8, y: rect.top + 48 } : undefined;
    },
    [byId, stages],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), // a few pixels first, so a click still opens the card
    useSensor(KeyboardSensor, { coordinateGetter, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] } }),
  );

  const name = (id: unknown) => byId.get(String(id))?.household ?? "return";
  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${name(a.id)}. Use the left and right arrows to choose a stage, Space to drop, Escape to cancel.`,
    onDragOver: ({ active: a, over }) => (over ? `${name(a.id)} is over ${label(over.id as Stage)}.` : undefined),
    onDragEnd: ({ active: a, over }) => (over ? `${name(a.id)} dropped on ${label(over.id as Stage)}.` : `${name(a.id)} dropped outside the board.`),
    onDragCancel: ({ active: a }) => `Moving ${name(a.id)} cancelled.`,
  };

  const endDrag = () => {
    // Removing the overlay reflows the board; keep its horizontal scroll where it was.
    const scroll = boardRef.current?.scrollLeft ?? 0;
    setHeld(null);
    setTarget(null);
    setTimeout(() => {
      if (boardRef.current) boardRef.current.scrollLeft = scroll;
    }, 0);
  };

  const place = (id: string, stage: Stage | null) =>
    setPlaced((m) => {
      const next = new Map(m);
      if (stage) next.set(id, stage);
      else next.delete(id);
      return next;
    });

  // One path for drops and the menu: land it now, then let the app decide.
  const move = (card: BoardCardData, to: Stage) => {
    if (!allowed(card, to)) return;
    const original = cards.find((c) => c.id === card.id)?.stage ?? card.stage;
    place(card.id, to);
    const result = onMove(card.id, original, to);
    if (!result) return place(card.id, null); // the app moves it itself
    void result.then(
      (kept) => (kept ? setTimeout(() => place(card.id, null), 0) : place(card.id, null)),
      () => place(card.id, null),
    );
  };

  // Once the app's data agrees with a placement, the placement isn't needed.
  React.useEffect(() => {
    setPlaced((m) => {
      if (!m.size) return m;
      const next = new Map([...m].filter(([id, stage]) => cards.find((c) => c.id === id)?.stage !== stage));
      return next.size === m.size ? m : next;
    });
  }, [cards]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      // Cards differ in height; re-measuring keeps the drop targets honest while the board moves.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "To move a return, focus it and press Space, use the left and right arrows, then Space to drop. Enter opens it." } }}
      onDragStart={({ active: a }: DragStartEvent) => {
        const card = byId.get(String(a.id)) ?? null;
        setHeld(card);
        setTarget(card?.stage ?? null);
      }}
      onDragOver={({ over }: DragOverEvent) => setTarget((over?.id as Stage | undefined) ?? null)}
      onDragCancel={endDrag}
      onDragEnd={({ active: a, over }: DragEndEvent) => {
        const card = byId.get(String(a.id));
        endDrag();
        if (card && over) move(card, over.id as Stage);
      }}
    >
      <div ref={boardRef} data-slot="pipeline-board" className={cn("flex items-start gap-3 overflow-x-auto pb-2", className)}>
        {stages.map((stage) => {
          const inColumn = shown.filter((c) => c.stage === stage);
          const open = held ? stage === held.stage || allowed(held, stage) : true;
          return (
            <BoardColumn key={stage} stage={stage} count={inColumn.length} aimed={!!held && target === stage && open && stage !== held.stage} closed={!open}>
              {inColumn.map((c) => (
                <DraggableCard key={c.id} card={c} stages={stages} allowed={allowed} staleAfterDays={staleAfterDays} onMove={move} onOpen={onOpen} lifted={c.id === held?.id} />
              ))}
            </BoardColumn>
          );
        })}
      </div>
      {/* In document.body: the overlay is position: fixed, and any transformed ancestor (a page's entrance
          animation, a sidebar inset) would make it measure from there, so the card would float off the cursor.
          No drop animation: flying the card back to where it started, after it has already landed somewhere
          else, reads as the move failing. Releasing instantly reads as correct. */}
      {typeof document === "undefined"
        ? null
        : createPortal(
            <DragOverlay dropAnimation={null}>
              {held ? <CardFace card={held} staleAfterDays={staleAfterDays} className="rotate-2 scale-[1.02] cursor-grabbing border-ring shadow-lg" /> : null}
            </DragOverlay>,
            document.body,
          )}
    </DndContext>
  );
}

export function BoardColumn({ stage, count, aimed, closed, children, className }: { stage: Stage; count: number; aimed?: boolean; closed?: boolean; children: React.ReactNode; className?: string }) {
  const { setNodeRef } = useDroppable({ id: stage, disabled: closed });
  return (
    <section
      ref={setNodeRef}
      data-slot="board-column"
      data-stage={stage}
      data-over={aimed || undefined}
      data-closed={closed || undefined}
      aria-label={`${label(stage)}: ${count}`}
      className={cn(
        "flex min-h-40 w-72 shrink-0 flex-col gap-2 self-stretch rounded-xl bg-muted/60 p-2 outline-offset-[-1px] transition-[background-color,opacity,outline-color] duration-150",
        "data-[over]:bg-brand-subtle/70 data-[over]:outline-2 data-[over]:outline-ring",
        "data-[closed]:opacity-45",
        className,
      )}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <StagePill stage={stage} />
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2">{children}</div>
    </section>
  );
}

function DraggableCard({ card, stages, allowed, staleAfterDays, onMove, onOpen, lifted }: { card: BoardCardData; stages: readonly Stage[]; allowed: (card: BoardCardData, to: Stage) => boolean; staleAfterDays: number; onMove: (card: BoardCardData, to: Stage) => void; onOpen?: (id: string) => void; lifted: boolean }) {
  // role "group", not dnd-kit's default "button": the card holds its own buttons (open, move menu), and a button
  // can't contain buttons (axe: nested-interactive). It stays focusable, Space lifts it, Enter opens it.
  const { setNodeRef, listeners, attributes } = useDraggable({ id: card.id, attributes: { role: "group" } });
  const targets = stages.filter((s) => allowed(card, s));
  return (
    // The whole card is the handle. The original stays where it was, faded, so the board never collapses under you.
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-roledescription="draggable return"
      aria-label={`${card.household}, ${label(card.stage)}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.target === e.currentTarget) onOpen?.(card.id);
        else listeners?.onKeyDown?.(e);
      }}
      className={cn("cursor-grab touch-none rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:cursor-grabbing", lifted && "opacity-40")}
    >
      <CardFace
        card={card}
        staleAfterDays={staleAfterDays}
        onOpen={onOpen ? () => onOpen(card.id) : undefined}
        menu={
          targets.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`Move ${card.household} to…`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {targets.map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => onMove(card, s)}>
                    {label(s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />
    </div>
  );
}

function CardFace({ card, staleAfterDays, onOpen, menu, className }: { card: BoardCardData; staleAfterDays: number; onOpen?: () => void; menu?: React.ReactNode; className?: string }) {
  const stale = card.daysInStage > staleAfterDays;
  const missing = card.missingDocuments ?? 0;
  return (
    <article
      data-slot="board-card"
      data-id={card.id}
      onClick={onOpen}
      className={cn("grid gap-2 rounded-lg border bg-card p-3 shadow-xs transition-colors hover:border-ring/40", className)}
    >
      <div className="flex items-start gap-2">
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="truncate text-sm font-semibold">{card.household}</span>
          <span className="truncate text-xs text-muted-foreground">
            {card.filers}
            {card.filingStatus ? ` · ${card.filingStatus}` : ""}
          </span>
        </div>
        {menu}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {missing > 0 ? (
          <span className="inline-flex items-center gap-1 text-warning-foreground">
            <FileWarning aria-hidden="true" className="size-3.5" /> {missing} missing
          </span>
        ) : null}
        {card.unpaid ? (
          <span className="inline-flex items-center gap-1 text-danger-foreground">
            <CircleDollarSign aria-hidden="true" className="size-3.5" /> Unpaid
          </span>
        ) : null}
        <span className={cn("ml-auto tabular-nums", stale ? "font-medium text-warning-foreground" : "text-muted-foreground")}>
          {card.daysInStage === 1 ? "1 day" : `${card.daysInStage} days`}
        </span>
      </div>
    </article>
  );
}

// A single card without drag (search results, the phone list): same face, opens on click.
export function BoardCard({ onOpen, staleAfterDays = 7, ...card }: Omit<BoardCardData, "id" | "stage"> & { id?: string; stage?: Stage; onOpen?: () => void; staleAfterDays?: number }) {
  return <CardFace card={{ id: card.id ?? card.household, stage: card.stage ?? "invited", ...card }} staleAfterDays={staleAfterDays} onOpen={onOpen} className={onOpen ? "cursor-pointer" : undefined} />;
}
