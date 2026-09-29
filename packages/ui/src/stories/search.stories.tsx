import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { useCommandShortcut } from "../components/app-header";
import { Button } from "../components/button";
import { CommandPalette, InlineSearch } from "../components/command-search";
import { searchGroups } from "./fixtures";

// Two ways into the same results: type in the header field and pick from the dropdown, or ⌘K for the palette.
const meta: Meta = { title: "Product/Search" };
export default meta;
type Story = StoryObj;

const go = fn();

export const Inline: Story = {
  name: "Header field",
  render: () => (
    <div className="h-[28rem]">
      <InlineSearch groups={searchGroups(go)} shortcut="⌘K" />
    </div>
  ),
};

function PaletteDemo() {
  const [open, setOpen] = useState(false);
  useCommandShortcut(() => setOpen((o) => !o));
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the palette <kbd className="ml-2 font-mono text-xs">⌘K</kbd>
      </Button>
      <CommandPalette groups={searchGroups(go)} open={open} onOpenChange={setOpen} />
    </>
  );
}
export const Palette: Story = { name: "⌘K palette", render: () => <PaletteDemo /> };

export const InlineTest: Story = {
  ...Inline,
  name: "Header field · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const input = c.getByRole("combobox", { name: "Search clients, returns, invoices" });

    await step("clicking in shows what you can reach; typing narrows it", async () => {
      await userEvent.click(input);
      await expect(c.getByRole("listbox", { name: "Search results" })).toBeInTheDocument();
      await expect(c.getAllByRole("option").length).toBeGreaterThan(5);
      await userEvent.type(input, "marigold");
      await waitFor(() => expect(c.queryByRole("option", { name: /Toni Wren/ })).toBeNull());
      await expect(c.getByRole("option", { name: /Dana & Sam Marigold/ })).toBeInTheDocument();
      await expect(c.getByRole("option", { name: /2026-0014/ })).toBeInTheDocument(); // keywords count too
    });
    await step("↓ and Enter act on a result, then the field clears and closes", async () => {
      await userEvent.keyboard("{ArrowDown}{Enter}");
      await expect(go).toHaveBeenLastCalledWith("return:marigold-2026");
      await waitFor(() => expect(c.queryByRole("listbox")).toBeNull());
      await expect(input).toHaveValue("");
    });
    await step("a click acts too", async () => {
      await userEvent.click(input);
      await userEvent.type(input, "wren");
      await userEvent.click(await c.findByRole("option", { name: /Wren · TY 2026/ }));
      await expect(go).toHaveBeenLastCalledWith("return:wren-2026");
    });
    await step("nothing matching says so", async () => {
      await userEvent.click(input);
      await userEvent.type(input, "zzz");
      await expect(c.getByText("Nothing matches “zzz”.")).toBeInTheDocument();
    });
    await step("Escape closes and clears; clicking away closes", async () => {
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(c.queryByRole("listbox")).toBeNull());
      await expect(input).toHaveValue("");
      await userEvent.click(input);
      await expect(c.getByRole("listbox")).toBeInTheDocument();
      await userEvent.click(canvasElement.ownerDocument.body);
      await waitFor(() => expect(c.queryByRole("listbox")).toBeNull());
    });
  },
};

export const PaletteTest: Story = {
  ...Palette,
  name: "⌘K palette · test",
  tags: ["!dev"],
  play: async () => {
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByPlaceholderText("Search clients, returns, invoices"), "kestrel");
    await userEvent.keyboard("{Enter}");
    await expect(go).toHaveBeenLastCalledWith("client:kestrel");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};
