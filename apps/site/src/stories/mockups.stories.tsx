import type { Meta, StoryObj } from "@storybook/react-vite";

import { DesktopHome, PhoneDocuments, PhoneFrame, PhoneHome, PhoneLetterSigned } from "@/components/marketing/portal-mockups";
import { AGENT } from "@/lib/public";

// The portal screens the site draws in HTML (hero phones, the solution screenshot) with invented data. They're
// pictures of the portal, not the portal: decorative on the page, and built from the design system's pieces.
const meta: Meta = { title: "Site/Portal mockups" };
export default meta;
type Story = StoryObj;

export const Phones: Story = {
  render: () => (
    <div className="flex flex-wrap items-start justify-center gap-6">
      <div className="w-[220px]">
        <PhoneFrame>
          <PhoneDocuments />
        </PhoneFrame>
      </div>
      <div className="w-[270px]">
        <PhoneFrame>
          <PhoneHome agent={AGENT} year={2025} />
        </PhoneFrame>
      </div>
      <div className="w-[220px]">
        <PhoneFrame>
          <PhoneLetterSigned />
        </PhoneFrame>
      </div>
    </div>
  ),
};

// Laid out at a fixed desktop width and scaled to its column, like a screenshot.
export const Desktop: Story = {
  parameters: { fill: true },
  render: () => (
    <div className="mx-auto w-full max-w-3xl">
      <DesktopHome agent={AGENT} year={2025} />
    </div>
  ),
};
