import type { InboxKind } from "@app/schema";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { InboxEmpty, InboxFilteredEmpty, InboxFilters, InboxHeader, InboxList, InboxLoading } from "../components/inbox-list";
import { INBOX_ITEMS, inboxCounts, type InboxFixture } from "./admin-lists.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-inbox.stories?raw";

// The preparer's Inbox (admin 10-inbox-inbox, 11-inbox-inbox-empty, 36-phone-m-inbox), put together from the same
// components apps/admin/src/pages/inbox.tsx renders: the count, the kind chips and one row per item. "Mark read" takes
// the answer off the list here; the other actions only report themselves. j/k or ↑/↓ move, Enter runs. Invented data.
const meta: Meta = { title: "Admin/Inbox/InboxList" };
meta.parameters = {
  ...meta.parameters,
  usage: 'import { InboxEmpty, InboxFilteredEmpty, InboxFilters, InboxHeader, InboxList, InboxLoading } from "@app/ui/components/inbox-list";',
};
export default meta;
type Story = StoryObj;

const ran = fn();

function InboxScreen() {
  const [all, setAll] = useState(INBOX_ITEMS);
  const [kind, setKind] = useState<InboxKind | null>(null);
  const items = all.filter((i) => !kind || i.kind === kind);
  const run = (i: InboxFixture) => {
    ran(i.action, i.subjectId);
    if (i.action === "acknowledge_answer") setAll((xs) => xs.filter((x) => x.id !== i.id));
  };
  if (!all.length) return <InboxEmpty />;
  return (
    <div className="grid w-[56rem] max-w-full grid-cols-1 animate-page gap-4">
      <InboxHeader total={all.length} />
      <InboxFilters total={all.length} counts={inboxCounts(all)} value={kind} onChange={setKind} />
      {items.length === 0 ? <InboxFilteredEmpty onShowAll={() => setKind(null)} /> : <InboxList items={items} onRun={run} />}
    </div>
  );
}

export const Screen: Story = { render: () => <InboxScreen />, parameters: { docs: { source: { code: fnSource(raw, "InboxScreen") } } } };

export const Pending: Story = {
  name: "Action in flight",
  render: () => <InboxList items={INBOX_ITEMS.slice(0, 2)} onRun={() => {}} pending={(i) => i.action === "acknowledge_answer"} />,
};

export const FilteredEmpty: Story = { name: "Nothing of this kind", render: () => <InboxFilteredEmpty onShowAll={() => {}} /> };
export const Empty: Story = { name: "All caught up", render: () => <InboxEmpty /> };
export const Loading: Story = { render: () => <InboxLoading /> };

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("heading", { name: "6 waiting for review" })).toBeInTheDocument();
    await step("a kind chip shows only that kind; pressing it again shows all", async () => {
      const chip = c.getByRole("button", { name: /Failed payments/ });
      await userEvent.click(chip);
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await expect(c.getAllByRole("listitem")).toHaveLength(1);
      await userEvent.click(chip);
      await expect(c.getAllByRole("listitem")).toHaveLength(6);
    });
    await step("Mark read runs the action and the answer leaves the list", async () => {
      await userEvent.click(c.getByRole("button", { name: "Mark read" }));
      await expect(ran).toHaveBeenCalledWith("acknowledge_answer", "req-move");
      await expect(c.getByRole("heading", { name: "5 waiting for review" })).toBeInTheDocument();
      await expect(c.queryByRole("button", { name: /Answers/ })).toBeNull();
    });
    await step("j moves to the first row and Enter runs it", async () => {
      ran.mockClear();
      (document.activeElement as HTMLElement | null)?.blur();
      await userEvent.keyboard("j");
      await expect(c.getAllByRole("listitem")[0]).toHaveFocus();
      await userEvent.keyboard("{Enter}");
      await expect(ran).toHaveBeenCalledWith("review_document", "doc-w2");
    });
  },
};
