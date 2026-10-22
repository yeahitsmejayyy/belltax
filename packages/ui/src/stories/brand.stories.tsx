import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { BellMark, Logo, MarkLoader, Wordmark as WordmarkSvg } from "../components/logo";

// The belltax. brand: the b. mark (charcoal tile in light, chartreuse in dark) and the belltax. wordmark, whose period
// is the accent. Toggle Light / Dark in the toolbar to see both.

const meta: Meta = { title: "Admin/Brand" };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { BellMark, Logo, MarkLoader, Wordmark as WordmarkSvg } from \"@app/ui/components/logo\";" };
export default meta;
type Story = StoryObj;

export const Wordmark: Story = {
  render: () => (
    <div className="grid gap-6">
      <Logo size="sm" />
      <Logo subtitle="Preparer admin" />
      <Logo size="lg" />
    </div>
  )
};
export const WordmarkTest: Story = {
  ...Wordmark,
  name: "Wordmark · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("img", { name: "belltax." })).toHaveLength(3);
  },
};


// The mark at app-icon and favicon sizes, and the wordmark on its own.
export const Mark: Story = {
  render: () => (
    <div className="grid justify-items-center gap-6">
      <div className="flex items-end gap-4">
        {[96, 64, 32, 16].map((px) => (
          <BellMark key={px} style={{ width: px, height: px }} />
        ))}
      </div>
      <WordmarkSvg className="h-12" />
    </div>
  ),
};

// "The sign-in loader pulses the b. mark."
export const Loader: Story = {
  render: () => <MarkLoader label="Signing you in" />
};
export const LoaderTest: Story = {
  ...Loader,
  name: "Loader · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Signing you in");
  },
};

