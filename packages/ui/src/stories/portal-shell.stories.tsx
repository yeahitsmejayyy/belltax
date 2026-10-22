import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditCard, FileText, FolderOpen, House, PenLine } from "lucide-react";
import { useState } from "react";
import { expect, screen, userEvent, within } from "storybook/test";

import { DemoBar } from "../components/demo-tour";
import { PortalShell, type PortalTab } from "../components/portal-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select";
import { ThemeProvider } from "../components/theme-provider";
import { ClientHome, type Need } from "../components/client-home";
import { DOCUMENT_STATUS } from "../components/status-chip";
import { CircleDashed } from "lucide-react";

// The client portal's frame, PortalShell: the same component apps/portal renders (ticket 56). The logo and demo badge,
// the account menu (theme, settings, log out), five tabs at the bottom on a phone and across the top on a desktop with
// counts for what's waiting, and a banner when the connection drops. Invented data.
const USAGE = `import { PortalShell } from "@app/ui/components/portal-shell";

<PortalShell
  tabs={tabs}                       // PortalTab[]: key, label, icon, badge
  active="documents"
  user={{ name: "Renata Torres-Farouk", email: "renata@example.test" }}
  online={online}
  onSettings={() => navigate("/settings")}
  onLogout={signOut}
  renderLink={(t, children, className) => (
    <NavLink to={t.key === "home" ? "/" : \`/\${t.key}\`} className={className} aria-current={t.current ? "page" : undefined}>{children}</NavLink>
  )}
>
  <Outlet />
</PortalShell>`;
const meta: Meta<typeof PortalShell> = {
  title: "Portal/App shell",
  component: PortalShell,
  parameters: { shell: true, docs: { source: { code: USAGE, language: "tsx" }, story: { inline: false, height: "720px" } } },
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { PortalShell } from \"@app/ui/components/portal-shell\";" };
export default meta;
type Story = StoryObj;

const TABS: PortalTab[] = [
  { key: "home", label: "Home", icon: House },
  { key: "questions", label: "Questions", icon: FileText },
  { key: "documents", label: "Documents", icon: FolderOpen, badge: 2 },
  { key: "letter", label: "Letter", icon: PenLine, badge: 1 },
  { key: "invoice", label: "Invoice", icon: CreditCard },
];

// Home's list, as the portal builds it (apps/portal/src/lib/needs.ts) for an invented household.
const NEEDS: Need[] = [
  { key: "w2", title: "Upload your W2 · Lakeside Community College", to: "/documents", cta: "Upload documents", chip: DOCUMENT_STATUS.rejected },
  { key: "childcare", title: "Upload your childcare receipt", to: "/documents", cta: "Upload documents", chip: DOCUMENT_STATUS.needed },
  { key: "letter", title: "Sign your engagement letter", to: "/letter", cta: "Sign your letter", chip: { tone: "neutral", icon: CircleDashed, label: "Not signed" } },
];

// State for the story only (which tab); everything drawn is PortalShell and ClientHome, as in the app.
function Demo({ online = true, tour = false }: { online?: boolean; tour?: boolean }) {
  const [active, setActive] = useState("home");
  return (
    <ThemeProvider storageKey={null}>
      <PortalShell
        tabs={TABS}
        active={active}
        user={{ name: "Renata Torres-Farouk", email: "renata@example.test" }}
        demoBadge={!tour}
        online={online}
        onSettings={() => setActive("settings")}
        onLogout={() => {}}
        renderLink={(t, children, className) => (
          <a
            href={`#${t.key}`}
            className={className}
            aria-current={t.current ? "page" : undefined}
            onClick={(e) => {
              e.preventDefault();
              setActive(t.key);
            }}
          >
            {children}
          </a>
        )}
        banner={tour ? <DemoBar viewingAs="client" onSwitch={() => {}} /> : null}
      >
        <div data-testid="page" data-active={active}>
          <ClientHome
            firstName="Renata"
            taxYear={2025}
            preparerName="Morgan Hale"
            stage="documents"
            reached={[
              { stage: "invited", at: "2026-10-04T17:00:00.000Z" },
              { stage: "intake", at: "2026-10-09T17:00:00.000Z" },
              { stage: "documents", at: "2026-10-12T17:00:00.000Z" },
            ]}
            needs={NEEDS}
            picker={
              <Select defaultValue="2025">
                <SelectTrigger size="touch" aria-label="Which return" className="max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">TY 2025</SelectItem>
                  <SelectItem value="2024">TY 2024</SelectItem>
                </SelectContent>
              </Select>
            }
            renderLink={(to, children, className) => (
              <a href={`#${to}`} className={className} onClick={(e) => e.preventDefault()}>
                {children}
              </a>
            )}
          />
        </div>
      </PortalShell>
    </ThemeProvider>
  );
}

export const Desktop: Story = { render: () => <Demo /> };
export const Phone: Story = { name: "Phone (402)", render: () => <Demo />, globals: { viewport: { value: "phone", isRotated: false } } };
export const PhoneDemoTour: Story = { name: "Phone · demo tour", render: () => <Demo tour />, globals: { viewport: { value: "phone", isRotated: false } } };
export const Offline: Story = { name: "Offline", render: () => <Demo online={false} />, globals: { viewport: { value: "phone", isRotated: false } } };

export const PhoneTest: Story = {
  name: "Phone · test",
  tags: ["!dev", "!autodocs"],
  render: () => <Demo />,
  globals: { viewport: { value: "phone", isRotated: false } },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const tabs = within(canvasElement.querySelector('[data-slot="bottom-tabs"]') as HTMLElement);
    await userEvent.click(tabs.getByRole("link", { name: /Documents/ }));
    await expect(c.getByTestId("page")).toHaveAttribute("data-active", "documents");
    await expect(tabs.getByRole("link", { name: /Documents/ })).toHaveAttribute("aria-current", "page");
    await userEvent.click(c.getByRole("button", { name: "Your account" }));
    await expect(await screen.findByText("renata@example.test")).toBeInTheDocument();
    await expect(screen.getByRole("menuitem", { name: /Log out/ })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
  },
};
