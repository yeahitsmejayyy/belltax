import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, within } from "storybook/test";

import { ScreenStage, TapDot, WalkthroughPhone, WalkthroughScreen, type WalkthroughView } from "../components/walkthrough";
import { WALKTHROUGH_PORTAL } from "./site-walkthrough.fixtures";

// The mini portal screens the walkthrough plays (portal mobile 01-02, 05, 13, 14, 17, 19), one per state, in the
// walkthrough's phone. Static pictures of the portal: every word and number is the `portal` config. Invented data.
const meta: Meta<typeof WalkthroughScreen> = {
  title: "Site/WalkthroughScreen",
  component: WalkthroughScreen,
  parameters: { usage: 'import { WalkthroughPhone, WalkthroughScreen, ScreenStage, TapDot } from "@app/ui/components/walkthrough";' },
  args: { portal: WALKTHROUGH_PORTAL, view: { screen: "home" } },
  render: (args) => (
    <WalkthroughPhone>
      <ScreenStage>
        <WalkthroughScreen {...args} />
      </ScreenStage>
    </WalkthroughPhone>
  ),
};
export default meta;
type Story = StoryObj<typeof WalkthroughScreen>;

const at = (view: WalkthroughView): Story => ({ args: { view } });

export const Invite = at({ screen: "invite" });
export const Password = at({ screen: "password", filled: true });
export const CreatingAccount = at({ screen: "password", filled: true, pending: true });
export const Home = at({ screen: "home" });
export const Documents = at({ screen: "documents", upload: "idle" });
export const Uploading = at({ screen: "documents", upload: "uploading" });
export const Uploaded = at({ screen: "documents", upload: "done" });
export const Letter = at({ screen: "letter", signed: false });
export const LetterSigned = at({ screen: "letter", signed: true });
export const InvoiceDue = at({ screen: "invoice", paid: "no" });
export const InvoicePaid = at({ screen: "invoice", paid: "yes", saved: true });

// The dot the walkthrough taps with, landing on an element marked data-tap (here, Set up my account).
function Tapping() {
  const screenRef = React.useRef<HTMLDivElement>(null);
  return (
    <WalkthroughPhone>
      <div ref={screenRef} className="absolute inset-0">
        <WalkthroughScreen view={{ screen: "invite" }} portal={WALKTHROUGH_PORTAL} />
        <TapDot target="setup" screenRef={screenRef} />
      </div>
    </WalkthroughPhone>
  );
}
export const Tap: Story = { render: () => <Tapping /> };

// The screens show the config's words: the upload marks the asked-for request Uploaded and the toast says so.
export const UploadedTest: Story = {
  ...Uploaded,
  name: "Uploaded · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const d = WALKTHROUGH_PORTAL.documents;
    await expect(c.getByText(d.summary.after)).toBeInTheDocument();
    await expect(c.getByText(d.toast)).toBeInTheDocument();
    const row = c.getByText(d.requests[d.uploads]!.title).closest("li")!;
    await expect(within(row as HTMLElement).getByText("Uploaded")).toBeInTheDocument();
  },
};
