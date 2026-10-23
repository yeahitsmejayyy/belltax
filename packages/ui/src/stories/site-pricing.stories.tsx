import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { PricingSection, type PricingStatus } from "../components/site-pricing";
import { ADDONS, ADDONS_EMPTY, CARD_LABELS, PACKAGES, SEPARATE_BODY, START } from "./site-sections.fixtures";

// The marketing site's pricing (marketing 07, 08 dark, 15 phone): the intro, the package cards, the add-ons and a note.
// Every amount is a prop, already formatted; the site reads them from the portal. SAMPLE prices, invented.
const meta: Meta = { title: "Site/PricingSection", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { AddonsCard, PackageCard, PricingNote, PricingSection } from "@app/ui/components/site-pricing";' };
export default meta;
type Story = StoryObj;

function Pricing({ status }: { status: PricingStatus }) {
  return (
    <PricingSection
      eyebrow="Pricing"
      title="One flat price, known up front"
      lead="You see the invoice before anything is filed, and you pay online. (Sample prices.)"
      status={status}
      unavailableMessage="Prices load from our client portal; it’s not answering right now."
      cards={PACKAGES.map(({ amount, ...p }) => ({
        ...p,
        href: START,
        labels: CARD_LABELS,
        price: status === "ready" ? { status: "ready", amount } : { status },
      }))}
      addons={{ title: "Add-ons, only if they apply", status, items: status === "ready" ? ADDONS : null, empty: ADDONS_EMPTY }}
      note={{ title: "Married and filing separately?", status, lead: status === "ready" ? "Each spouse’s return is $219." : "Each spouse files their own return, priced per return.", body: SEPARATE_BODY }}
    />
  );
}

export const Ready: Story = { render: () => <Pricing status="ready" /> };
// While the portal answers: same-size placeholders, so nothing jumps.
export const Loading: Story = { render: () => <Pricing status="loading" /> };
// The portal can't be reached: no amounts at all, never stale ones.
export const Unavailable: Story = { render: () => <Pricing status="unavailable" /> };
export const Phone: Story = { ...Ready, name: "Phone (402)", globals: { viewport: { value: "phone", isRotated: false } } };

export const ReadyTest: Story = {
  ...Ready,
  name: "Ready · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const mfj = c.getByRole("article", { name: "Married filing jointly" });
    await expect(within(mfj).getByText("Most families")).toBeInTheDocument();
    await expect(within(mfj).getByText("$299")).toBeInTheDocument();
    await expect(within(mfj).getByRole("link", { name: /Get started.*Married filing jointly/ })).toHaveAttribute("href", START);
    await expect(c.getByText("Included")).toBeInTheDocument();
    await expect(c.queryByRole("status")).toBeNull();
  },
};
export const UnavailableTest: Story = {
  ...Unavailable,
  name: "Unavailable · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("status")).toHaveTextContent("not answering");
    await expect(c.queryByText(/\$\d/)).toBeNull();
    await expect(c.getAllByText("Price shown when the portal answers")).toHaveLength(3);
  },
};
