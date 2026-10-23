import type { Meta, StoryObj } from "@storybook/react-vite";

import { Section, SectionHeading, SectionIntro } from "../components/marketing";

// The marketing site's section frame (marketing 03-11) and its two headings: SectionHeading (left, inside a Section)
// and SectionIntro (centred, opening pricing and the FAQ). Invented copy.
const meta: Meta = { title: "Site/Section", parameters: { site: true } };
meta.parameters = { ...meta.parameters, usage: 'import { Section, SectionHeading, SectionIntro } from "@app/ui/components/marketing";' };
export default meta;
type Story = StoryObj;

export const WithHeading: Story = {
  name: "Section + SectionHeading",
  render: () => (
    <Section id="sample">
      <SectionHeading id="sample" eyebrow="The problem" title="Getting your taxes done shouldn’t feel like a second job" lead="Most people aren’t confused by their taxes. They’re worn out by everything around them." />
    </Section>
  ),
};
export const Muted: Story = {
  name: "Muted section",
  render: () => (
    <Section id="sample-muted" muted>
      <SectionHeading id="sample-muted" eyebrow="The solution" title="Your personal tax agent, and one place to see it all" />
    </Section>
  ),
};
export const Intro: Story = {
  name: "SectionIntro",
  render: () => (
    <div className="px-4 py-14">
      <SectionIntro id="intro-title" eyebrow="Pricing" title="One flat price, known up front">
        You see the invoice before anything is filed, and you pay online.
      </SectionIntro>
    </div>
  ),
};
