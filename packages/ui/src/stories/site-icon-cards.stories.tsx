import type { Meta, StoryObj } from "@storybook/react-vite";

import { IconCardsSection } from "../components/marketing";
import { FEATURES, PROBLEMS } from "./site-sections.fixtures";

// A heading over a grid of icon cards: the marketing site's problem (three, muted icons) and features (six, brand icons).
// The cards are a config array: icon, title, body. Invented copy.
const meta: Meta = { title: "Site/IconCardsSection", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { IconCards, IconCardsSection } from "@app/ui/components/marketing";' };
export default meta;
type Story = StoryObj;

export const Problem: Story = {
  render: () => <IconCardsSection id="problem" eyebrow="The problem" title="Getting your taxes done shouldn’t feel like a second job" lead="Most people are worn out by everything around their taxes." items={PROBLEMS} />,
};
export const Features: Story = {
  render: () => <IconCardsSection id="features" tone="brand" eyebrow="Features" title="Built for people with busy lives" items={FEATURES} />,
};
