import type { Meta, StoryObj } from "@storybook/react-vite";

import { CtaBand } from "../components/marketing";
import { START } from "./site-sections.fixtures";

// The marketing site's closing call to action (marketing 11): the charcoal band in either theme, the wordmark and one
// chartreuse button. Invented copy.
const meta: Meta = { title: "Site/CtaBand", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { CtaBand } from "@app/ui/components/marketing";' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <CtaBand
      title="Hand off your taxes this year"
      lead="Start with a few questions. Your personal tax agent will reach out within one business day with your invite to the portal."
      action={{ label: "Get started", href: START }}
    />
  ),
};
