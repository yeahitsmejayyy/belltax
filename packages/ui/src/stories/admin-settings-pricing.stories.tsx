import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { PriceDialog, PricingSettings, type PriceAddon, type PriceEditing, type PricePackage } from "../components/pricing-settings";
import { ADDONS, PACKAGES } from "./admin-settings.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-settings-pricing.stories?raw";

// Settings › Services & pricing (admin 32-settings-settings-pricing): packages and add-ons, how many of this year's
// returns used each, the Active switch, and the pencil's dialog. Invented data.
const meta: Meta<typeof PricingSettings> = { title: "Admin/Settings/PricingSettings", component: PricingSettings };
meta.parameters = { ...meta.parameters, usage: 'import { PriceDialog, PricingSettings } from "@app/ui/components/pricing-settings";' };
export default meta;
type Story = StoryObj<typeof PricingSettings>;

const saved = fn();
const toggled = fn();

// The admin's side: the lists, the dialog for whichever price is being edited, and saves that land a moment later.
function Pricing() {
  const [packages, setPackages] = useState<PricePackage[]>(PACKAGES);
  const [addons, setAddons] = useState<PriceAddon[]>(ADDONS);
  const [editing, setEditing] = useState<PriceEditing | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <PricingSettings
      packages={packages}
      addons={addons}
      onToggle={(kind, item, active) => {
        toggled(kind, item.code, active);
        if (kind === "package") setPackages((ps) => ps.map((p) => (p.code === item.code ? { ...p, active } : p)));
        else setAddons((xs) => xs.map((a) => (a.code === item.code ? { ...a, active } : a)));
      }}
      onEdit={setEditing}
    >
      <PriceDialog
        editing={editing}
        busy={busy}
        onSave={(price) => {
          saved(price);
          setBusy(true);
          setTimeout(() => {
            const code = price.code ?? `new-${Date.now()}`;
            if (price.kind === "package") {
              const { kind: _, ...p } = price;
              setPackages((ps) => (ps.some((x) => x.code === code) ? ps.map((x) => (x.code === code ? { ...x, ...p, code } : x)) : [...ps, { ...p, code, usedThisYear: 0 }]));
            } else {
              const { kind: _, ...a } = price;
              setAddons((xs) => (xs.some((x) => x.code === code) ? xs.map((x) => (x.code === code ? { ...x, ...a, code } : x)) : [...xs, { ...a, code, usedThisYear: 0 }]));
            }
            setBusy(false);
            setEditing(null);
          }, 200);
        }}
        onRemove={(item) => {
          setPackages((ps) => ps.filter((p) => p.code !== item.code));
          setAddons((xs) => xs.filter((a) => a.code !== item.code));
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </PricingSettings>
  );
}

export const Default: Story = { name: "Services & pricing", render: () => <Pricing />, parameters: { docs: { source: { code: fnSource(raw, "Pricing") } } } };
export const Empty: Story = { name: "Nothing priced yet", args: { packages: [], addons: [], onToggle: fn(), onEdit: fn() } };
export const Loading: Story = { name: "Loading", args: { onToggle: fn(), onEdit: fn() } };
export const LoadFailed: Story = { name: "Couldn't load", args: { loadError: "The server didn't answer.", onToggle: fn(), onEdit: fn() } };

export const PricingSettingsTest: Story = {
  ...Default,
  name: "Services & pricing · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    saved.mockClear();
    toggled.mockClear();
    const c = within(canvasElement);
    // The Active switch reports the flip.
    await userEvent.click(c.getByRole("switch", { name: "Rush turnaround active" }));
    await expect(toggled).toHaveBeenCalledWith("addon", "add-rush", true);
    // The pencil opens the package with its price in dollars; a bad price stops the save.
    await userEvent.click(c.getByRole("button", { name: "Edit Single" }));
    const d = within(await screen.findByRole("dialog", { name: "Edit Single" }));
    const price = d.getByLabelText("Price");
    await expect(price).toHaveValue("225.00");
    await userEvent.clear(price);
    await userEvent.type(price, "abc");
    await userEvent.click(d.getByRole("button", { name: "Save changes" }));
    await expect(await d.findByText("Enter a price in dollars, like 225 or 225.00.")).toBeInTheDocument();
    await expect(saved).not.toHaveBeenCalled();
    // A good one sends the whole package in cents, and the table shows it.
    await userEvent.clear(price);
    await userEvent.type(price, "$240");
    await userEvent.click(d.getByRole("button", { name: "Save changes" }));
    await expect(saved).toHaveBeenCalledWith({
      kind: "package",
      code: "pkg-single",
      filingStatus: "single",
      name: "Single",
      description: "One filer, W-2 and the usual forms.",
      unitAmountCents: 24000,
      active: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(c.getByText("$240.00")).toBeInTheDocument();
  },
};
