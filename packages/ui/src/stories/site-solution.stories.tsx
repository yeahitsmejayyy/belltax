import type { Meta, StoryObj } from "@storybook/react-vite";

import { SolutionSection } from "../components/marketing";
import { DesktopHome } from "../components/portal-mockups";
import { BRAND, PORTAL_SAMPLE, SOLUTION_POINTS } from "./site-sections.fixtures";

// The marketing site's solution (marketing 04): the heading and checked points beside a picture of the portal (any
// node; here the portal home drawn with an invented household), read out as one image.
const meta: Meta = { title: "Site/SolutionSection", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { SolutionSection } from "@app/ui/components/marketing";' };
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <SolutionSection
      eyebrow="The solution"
      title="Your personal tax agent, and one place to see it all"
      lead={`${BRAND} pairs you with a personal tax agent, and your private portal shows you exactly where it stands.`}
      points={SOLUTION_POINTS}
      figure={<DesktopHome data={PORTAL_SAMPLE} />}
      figureLabel="A sample client portal home: what the client still needs to do, an invoice, and where the return stands."
    />
  ),
};
