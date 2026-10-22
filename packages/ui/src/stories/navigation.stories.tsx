import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText, Receipt, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/breadcrumb";
import { Button } from "../components/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "../components/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs";
import { fnSource } from "./fixtures";
import raw from "./navigation.stories?raw";

const meta: Meta = { title: "Primitives/Navigation" };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from \"@app/ui/components/breadcrumb\";\nimport { Button } from \"@app/ui/components/button\";\nimport { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from \"@app/ui/components/command\";\nimport { Tabs, TabsContent, TabsList, TabsTrigger } from \"@app/ui/components/tabs\";" };
export default meta;
type Story = StoryObj;

// Admin 12-18: the return detail's tabs.
export const ReturnTabs: Story = {
  name: "Tabs",
  render: () => (
    <Tabs defaultValue="overview" className="w-full max-w-xl">
      <TabsList>
        {["Overview", "Intake", "Documents", "Letter", "Billing", "Activity"].map((t) => (
          <TabsTrigger key={t} value={t.toLowerCase()}>{t}</TabsTrigger>
        ))}
      </TabsList>
      {["overview", "intake", "documents", "letter", "billing", "activity"].map((t) => (
        <TabsContent key={t} value={t} className="text-sm text-muted-foreground">The {t} panel.</TabsContent>
      ))}
    </Tabs>
  )
};
export const ReturnTabsTest: Story = {
  ...ReturnTabs,
  name: "Tabs · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("tab", { name: "Documents" }));
    await expect(c.getByRole("tabpanel")).toHaveTextContent("The documents panel.");
    await userEvent.keyboard("{ArrowRight}");
    await expect(c.getByRole("tab", { name: "Letter" })).toHaveAttribute("aria-selected", "true");
  },
};


export const Crumbs: Story = {
  name: "Breadcrumb",
  render: () => (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink href="#">Pipeline</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink href="#">Marigold</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>TY 2026</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  ),
};

// Admin 26-dialogs-and-sheets-cmdk. ⌘K opens it; typing filters; Enter jumps.
const onJump = fn();
function Palette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);
  const go = (to: string) => {
    onJump(to);
    setOpen(false);
  };
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Search clients, returns, invoices <kbd className="ml-2 font-mono text-xs">⌘K</kbd></Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search clients, returns, invoices" />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>
          <CommandGroup heading="Clients">
            <CommandItem onSelect={() => go("household:marigold")}><Users /> Dana & Sam Marigold</CommandItem>
            <CommandItem onSelect={() => go("household:kestrel")}><Users /> Sidney Kestrel</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Returns">
            <CommandItem onSelect={() => go("return:marigold-2026")}><FileText /> Marigold · TY 2026 <CommandShortcut>Preparing</CommandShortcut></CommandItem>
          </CommandGroup>
          <CommandGroup heading="Invoices">
            <CommandItem onSelect={() => go("invoice:2026-0014")}><Receipt /> 2026-0014 · $340.00</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export const CommandPalette: Story = {
  name: "Command palette (⌘K)",
  render: () => <Palette />, parameters: { docs: { source: { code: fnSource(raw, "Palette") } } }
};
export const CommandPaletteTest: Story = {
  ...CommandPalette,
  name: "Command palette (⌘K) · test",
  tags: ["!dev", "!autodocs"],
  play: async () => {
    await userEvent.keyboard("{Meta>}k{/Meta}");
    const input = await screen.findByPlaceholderText("Search clients, returns, invoices");
    await userEvent.type(input, "kestrel");
    await waitFor(() => expect(screen.queryByText("Dana & Sam Marigold")).toBeNull());
    await userEvent.keyboard("{Enter}");
    await expect(onJump).toHaveBeenCalledWith("household:kestrel");
  },
};

