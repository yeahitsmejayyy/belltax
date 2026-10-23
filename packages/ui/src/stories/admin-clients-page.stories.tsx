import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { ClientsPage } from "../components/admin-clients";
import { CLIENTS } from "./admin-clients.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-clients-page.stories?raw";

// The preparer admin's Clients screen (admin 27), the same component apps/admin/src/pages/clients.tsx renders. The
// search and "Show archived" filter the invented rows here; the app asks household.list instead. Invented data.
const meta: Meta = { title: "Admin/Clients/ClientsPage" };
meta.parameters = { ...meta.parameters, usage: 'import { ClientsPage } from "@app/ui/components/admin-clients";' };
export default meta;
type Story = StoryObj;

const opened = fn();

function ClientsScreen({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const [search, setSearch] = useState("");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [pending, setPending] = useState(pendingOnly);
  const q = search.trim().toLowerCase();
  const rows = CLIENTS.filter((h) => (includeArchived || !h.archivedAt) && (!q || h.displayName.toLowerCase().includes(q)) && (!pending || h.logins === 0));
  return (
    <ClientsPage
      rows={rows}
      search={search}
      onSearchChange={setSearch}
      query={search.trim()}
      includeArchived={includeArchived}
      onIncludeArchivedChange={setIncludeArchived}
      pendingOnly={pending}
      onShowAll={() => setPending(false)}
      onOpen={(r) => opened(r.id)}
    />
  );
}

const source = { docs: { source: { code: fnSource(raw, "ClientsScreen") } } };

export const Screen: Story = { render: () => <ClientsScreen />, parameters: source };
export const PendingInvites: Story = { name: "Nobody can sign in yet", render: () => <ClientsScreen pendingOnly />, parameters: source };
export const NoClients: Story = {
  name: "No clients yet",
  render: () => <ClientsPage rows={[]} noClients search="" onSearchChange={() => {}} includeArchived={false} onIncludeArchivedChange={() => {}} />,
};
export const Loading: Story = { render: () => <ClientsPage search="" onSearchChange={() => {}} includeArchived={false} onIncludeArchivedChange={() => {}} /> };

export const ScreenTest: Story = {
  ...Screen,
  name: "Screen · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    await expect(c.getByText("4 households")).toBeInTheDocument();
    await step("searching narrows the table, and a miss says so", async () => {
      const box = c.getByRole("searchbox", { name: "Search households" });
      await userEvent.type(box, "wren");
      await expect(c.getByText("1 household")).toBeInTheDocument();
      await expect(c.getByRole("link", { name: "Wren household" })).toHaveAttribute("href", "/clients/hh-wren");
      await userEvent.clear(box);
      await userEvent.type(box, "zzz");
      await expect(c.getByText("No household matches “zzz”.")).toBeInTheDocument();
      await userEvent.clear(box);
    });
    await step("Show archived brings archived households back", async () => {
      await userEvent.click(c.getByRole("switch", { name: "Show archived" }));
      await expect(c.getByText("5 households")).toBeInTheDocument();
      await expect(c.getByText("Archived")).toBeInTheDocument();
    });
    await step("clicking a row opens it", async () => {
      await userEvent.click(c.getByText("Kestrel household").closest("tr")!);
      await expect(opened).toHaveBeenCalledWith("hh-kestrel");
    });
  },
};

export const PendingInvitesTest: Story = {
  ...PendingInvites,
  name: "Nobody can sign in yet · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("Households nobody can sign in to yet")).toBeInTheDocument();
    await expect(c.getByText("2 households")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Show all" }));
    await expect(c.queryByText("Households nobody can sign in to yet")).toBeNull();
    await expect(c.getByText("4 households")).toBeInTheDocument();
  },
};
