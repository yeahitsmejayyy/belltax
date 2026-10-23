import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { NeedsCard } from "../components/client-home";
import { HOME_NEEDS, storyLink } from "./client-home.fixtures";

// Home's first card (ticket 57): each thing waiting on the client links to the screen that settles it, and one button
// starts the first. With nothing waiting, it says what happens next at this stage. Invented data.
const meta: Meta<typeof NeedsCard> = {
  title: "Portal/Home/NeedsCard",
  component: NeedsCard,
  parameters: { usage: 'import { NeedsCard } from "@app/ui/components/client-home";' },
  args: { needs: HOME_NEEDS, stage: "documents", preparer: "Morgan", renderLink: storyLink },
  decorators: [(Story) => <div className="max-w-xl">{Story()}</div>],
};
export default meta;
type Story = StoryObj<typeof NeedsCard>;

export const ThingsWaiting: Story = { name: "Things waiting" };
export const NothingWaiting: Story = { name: "Nothing waiting", args: { needs: [], stage: "preparing" } };
export const OwnWords: Story = {
  name: "Own words for a stage",
  args: { needs: [], stage: "filed", messages: { filed: () => "Sent to the IRS and the Oregon Department of Revenue." } },
};

export const NeedsCardTest: Story = {
  name: "NeedsCard · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("link", { name: /Upload documents/ })).toHaveAttribute("href", "#/documents");
    await expect(c.getByText("Sign your engagement letter")).toBeInTheDocument();
  },
};
