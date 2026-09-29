import { Stage } from "@app/schema";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, rectIntersection, useDraggable, useDroppable, useSensor, useSensors,
  type Announcements, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter, type UniqueIdentifier,
} from "@dnd-kit/core";
import { CircleDollarSign, FileWarning, GripVertical, MoreHorizontal } from "lucide-react";
import * as React from "react";

import { cn } from "../utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "./dropdown-menu";
import { STAGE_META, StagePill } from "./stage-pill";

// The pipeline board (admin 05-pipeline-pipeline-board): a column per stage, a card per return. Cards drag
// between columns with a pointer or the keyboard (focus the grip, Space, ←/→, Space), and every card also
// has a "Move to…" menu: dragging is never the only way (WCAG 2.5.7).
//
// The board is controlled. It reports a move through `onMove` and draws whatever `cards` it's given, so the
// app decides: advance straight away, ask for a reason when moving back, or refuse when a gate blocks it.

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
  onMove: (id: string, from: Stage, to: Stage) => void;
  onOpen?: (id: string) => void;
  staleAfterDays?: number;
  className?: string;
};

const label = (s: Stage) => STAGE_META[s].label;

export function PipelineBoard({ cards, stages = Stage.options, onMove, onOpen, staleAfterDays = 7, className }: PipelineBoardProps) {
  const [activeId, setActiveId] = React.useState<UniqueIdentifier | null>(null);
  const byId = React.useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const active = activeId ? byId.get(String(activeId)) : undefined;

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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // a click still opens the card
    useSensor(KeyboardSensor, { coordinateGetter }),
  );

  const announcements: Announcements = {
    onDragStart: ({ active: a }) => `Picked up ${byId.get(String(a.id))?.household ?? "return"}. Use the left and right arrows to choose a stage, Space to drop, Escape to cancel.`,
    onDragOver: ({ active: a, over }) => (over ? `${byId.get(String(a.id))?.household} is over ${label(over.id as Stage)}.` : undefined),
    onDragEnd: ({ active: a, over }) => (over ? `${byId.get(String(a.id))?.household} dropped on ${label(over.id as Stage)}.` : `${byId.get(String(a.id))?.household} dropped outside the board.`),
    onDragCancel: ({ active: a }) => `Moving ${byId.get(String(a.id))?.household} cancelled.`,
  };

  const end = ({ active: a, over }: DragEndEvent) => {
    setActiveId(null);
    const card = byId.get(String(a.id));
    const to = over?.id as Stage | undefined;
    if (card && to && to !== card.stage) onMove(card.id, card.stage, to);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={rectIntersection}
      accessibility={{ announcements, screenReaderInstructions: { draggable: "To move a return, press Space on its grip, use the arrow keys, then Space to drop." } }}
      onDragStart={({ active: a }: DragStartEvent) => setActiveId(a.id)}
      onDragCancel={() => setActiveId(null)}
      onDragEnd={end}
    >
      <div data-slot="pipeline-board" className={cn("flex gap-3 overflow-x-auto pb-2", className)}>
        {stages.map((stage) => {
          const inColumn = cards.filter((c) => c.stage === stage);
          return (
            <BoardColumn key={stage} stage={stage} count={inColumn.length}>
              {inColumn.map((c) => (
                <DraggableCard key={c.id} card={c} stages={stages} staleAfterDays={staleAfterDays} onMove={onMove} onOpen={onOpen} dimmed={c.id === activeId} />
              ))}
            </BoardColumn>
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {active ? <CardFace card={active} staleAfterDays={staleAfterDays} className="rotate-1 shadow-lg ring-2 ring-ring/40" /> : null}
      </DragOverlay>
    </DndContext>
  );
}

export function BoardColumn({ stage, count, children, className }: { stage: Stage; count: number; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  return (
    <section
      ref={setNodeRef}
      data-slot="board-column"
      data-stage={stage}
      data-over={isOver || undefined}
      aria-label={`${label(stage)}: ${count}`}
      className={cn("flex min-h-40 w-72 shrink-0 flex-col gap-2 rounded-xl bg-muted/60 p-2 transition-colors data-[over]:bg-brand-subtle data-[over]:ring-2 data-[over]:ring-ring/40", className)}
    >
      <header className="flex items-center justify-between px-1 py-1">
        <StagePill stage={stage} />
        <span className="text-xs font-medium text-muted-foreground tabular-nums">{count}</span>
      </header>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function DraggableCard({ card, stages, staleAfterDays, onMove, onOpen, dimmed }: { card: BoardCardData; stages: readonly Stage[]; staleAfterDays: number; onMove: PipelineBoardProps["onMove"]; onOpen?: (id: string) => void; dimmed: boolean }) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes } = useDraggable({ id: card.id });
  return (
    // Pointer drags start anywhere on the card; the keyboard drags from the grip.
    <div ref={setNodeRef} onPointerDown={listeners?.onPointerDown as React.PointerEventHandler<HTMLDivElement> | undefined} className={cn("touch-none", dimmed && "opacity-40")}>
      <CardFace
        card={card}
        staleAfterDays={staleAfterDays}
        onOpen={onOpen ? () => onOpen(card.id) : undefined}
        grip={
          <button
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            onKeyDown={listeners?.onKeyDown as React.KeyboardEventHandler<HTMLButtonElement> | undefined}
            aria-label={`Drag ${card.household}`}
            className="flex size-8 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing"
          >
            <GripVertical className="size-4" />
          </button>
        }
        menu={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label={`Move ${card.household} to…`} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {stages.filter((s) => s !== card.stage).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove(card.id, card.stage, s)}>
                  {label(s)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
    </div>
  );
}

function CardFace({ card, staleAfterDays, onOpen, grip, menu, className }: { card: BoardCardData; staleAfterDays: number; onOpen?: () => void; grip?: React.ReactNode; menu?: React.ReactNode; className?: string }) {
  const stale = card.daysInStage > staleAfterDays;
  const missing = card.missingDocuments ?? 0;
  return (
    <article data-slot="board-card" data-id={card.id} className={cn("grid gap-2 rounded-lg border bg-card p-2 shadow-xs", className)}>
      <div className="flex items-start gap-1">
        {grip}
        <button type="button" onClick={onOpen} className="grid min-w-0 flex-1 gap-0.5 rounded-md px-1 py-0.5 text-left hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
          <span className="truncate text-sm font-semibold">{card.household}</span>
          <span className="truncate text-xs text-muted-foreground">
            {card.filers}
            {card.filingStatus ? ` · ${card.filingStatus}` : ""}
          </span>
        </button>
        {menu}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-0.5 text-xs">
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
  return <CardFace card={{ id: card.id ?? card.household, stage: card.stage ?? "invited", ...card }} staleAfterDays={staleAfterDays} onOpen={onOpen} />;
}
