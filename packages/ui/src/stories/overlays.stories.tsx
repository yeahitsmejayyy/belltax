import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "../components/alert-dialog";
import { Button } from "../components/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "../components/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../components/dropdown-menu";
import { Label } from "../components/label";
import { Popover, PopoverContent, PopoverTrigger } from "../components/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "../components/sheet";
import { Textarea } from "../components/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip";

const meta: Meta = { title: "Primitives/Overlays", parameters: { layout: "padded" } };
export default meta;
type Story = StoryObj;

// Admin 20-dialogs-and-sheets-dlg-back: moving backward always asks why.
const onMoveBack = fn();
function MoveBack() {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Move back to Documents</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move back to Documents?</DialogTitle>
          <DialogDescription>The client sees the return waiting on them again. Say why; it's logged.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="why">Reason</Label>
          <Textarea id="why" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="A corrected 1099 is on its way." />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button disabled={reason.trim().length < 3} onClick={() => { onMoveBack(reason); setOpen(false); }}>Move back</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const DialogWithReason: Story = {
  name: "Dialog: reason required",
  render: () => <MoveBack />,
  play: async ({ canvasElement, step }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Move back to Documents" }));
    const dialog = await screen.findByRole("dialog", { name: "Move back to Documents?" });
    await step("the action waits for a reason", async () => {
      await expect(within(dialog).getByRole("button", { name: "Move back" })).toBeDisabled();
      await userEvent.type(within(dialog).getByLabelText("Reason"), "Corrected 1099 coming");
      await userEvent.click(within(dialog).getByRole("button", { name: "Move back" }));
      await expect(onMoveBack).toHaveBeenCalledWith("Corrected 1099 coming");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
    await step("Escape closes a reopened dialog", async () => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Move back to Documents" }));
      await screen.findByRole("dialog");
      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });
  },
};

const onVoid = fn();
export const Confirm: Story = {
  name: "AlertDialog: irreversible",
  render: () => (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="destructive">Void invoice</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void invoice 2026-0014?</AlertDialogTitle>
          <AlertDialogDescription>The client can no longer pay it. This can't be undone; issue a new invoice instead.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onVoid}>Void invoice</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Void invoice" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Void invoice" }));
    await expect(onVoid).toHaveBeenCalledOnce();
  },
};

// Admin 22-dialogs-and-sheets-sheet-request.
export const SideSheet: Story = {
  name: "Sheet",
  render: () => (
    <Sheet>
      <SheetTrigger asChild><Button>Request a document</Button></SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Request a document</SheetTitle>
          <SheetDescription>Dana and Sam will see it on their portal.</SheetDescription>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Request a document" }));
    await expect(await screen.findByRole("dialog", { name: "Request a document" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
};

export const Menu: Story = {
  name: "Dropdown menu",
  render: () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline">Dana Marigold</Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem>Settings</DropdownMenuItem>
        <DropdownMenuItem>Theme</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
  play: async ({ canvasElement }) => {
    within(canvasElement).getByRole("button", { name: "Dana Marigold" }).focus();
    await userEvent.keyboard("{Enter}");
    await expect(await screen.findByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  },
};

export const PopoverAndTooltip: Story = {
  name: "Popover and tooltip",
  render: () => (
    <TooltipProvider delayDuration={0}>
      <div className="flex gap-3">
        <Popover>
          <PopoverTrigger asChild><Button variant="outline">What's a 1095-A?</Button></PopoverTrigger>
          <PopoverContent className="text-sm">The form Covered California sends if you had a plan through them.</PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild><Button variant="ghost">Days in stage</Button></TooltipTrigger>
          <TooltipContent>Over 7 days is flagged as stale</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("button", { name: "What's a 1095-A?" }));
    const pop = await screen.findByText(/Covered California sends/);
    await waitFor(() => expect(pop).toBeVisible());
    await userEvent.keyboard("{Escape}");
    await userEvent.hover(c.getByRole("button", { name: "Days in stage" }));
    await expect(await screen.findByRole("tooltip")).toHaveTextContent("Over 7 days is flagged as stale");
  },
};
