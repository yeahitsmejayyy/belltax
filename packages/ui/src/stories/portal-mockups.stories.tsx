import type { Meta, StoryObj } from "@storybook/react-vite";

import { Float } from "../components/float";
import { DesktopHome, PhoneDocuments, PhoneFrame, PhoneHome, PhoneLetterSigned, PortalPhones } from "../components/portal-mockups";

// The portal screens the site draws in HTML (hero phones, the splash page, the solution screenshot) with invented
// data. They're pictures of the portal, not the portal: decorative on the page, and built from the design system's
// pieces. Moved here from apps/site (ticket 53) so every site page uses design-system components only.
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
          <PhoneHome agent="your tax agent" year={2025} />
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
      <DesktopHome agent="your tax agent" year={2025} />
    </div>
  ),
};

// The splash page's three drifting phones (ticket 53). Narrow the canvas: on phones only the middle one stays.
export const ThreePhones: Story = { name: "Three phones (splash)", render: () => <PortalPhones agent="your tax agent" year={2025} /> };

// A slow 6s drift; it never starts when the visitor asks for reduced motion.
export const Drifting: Story = {
  render: () => (
    <Float className="w-[220px]">
      <PhoneFrame>
        <PhoneLetterSigned />
      </PhoneFrame>
    </Float>
  ),
};
