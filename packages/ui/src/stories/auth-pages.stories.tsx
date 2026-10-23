import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { DemoClientPicker, DemoSignInOption, LinkPage, ServerUnreachable, SignInPage } from "../components/auth-pages";
import { LinkGone } from "../components/auth-cards";
import { SignInSteps } from "../components/sign-in-flows";
import { fnSource } from "./fixtures";
import { DEMO_CLIENTS } from "./portal-settings.fixtures";
import raw from "./auth-pages.stories?raw";

// The portal's sign-in page (portal 03-access-signin, tickets 05, 05b) around the sign-in form: the logo and demo badge,
// "Sign in as a demo client" and its picker of invented households, the server-not-answering note, and the frame of
// the page a setup link opens. Invented data.
const meta: Meta = { title: "Portal/Sign in/Pages", parameters: { layout: "fullscreen" } };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { DemoClientPicker, DemoSignInOption, LinkPage, ServerUnreachable, SignInPage } from "@app/ui/components/auth-pages";' };
export default meta;
type Story = StoryObj;

const picked = fn();
const steps = { signIn: async () => ({ done: true as const }), onPasskey: async () => undefined, recover: async () => undefined, onDone: fn(), onSetup: fn() };

// The demo's sign-in page: the form, then "or" and the picker.
function DemoSignIn() {
  const [picking, setPicking] = useState(false);
  return (
    <SignInPage
      demo
      overlay={
        <DemoClientPicker
          open={picking}
          onOpenChange={setPicking}
          clients={DEMO_CLIENTS}
          onPick={(id) => {
            picked(id);
            setPicking(false);
          }}
        />
      }
    >
      <SignInSteps description="See where your return stands and what's needed from you." {...steps} />
      <DemoSignInOption onPick={() => setPicking(true)} />
    </SignInPage>
  );
}

export const Live: Story = {
  name: "Sign in",
  render: () => (
    <SignInPage>
      <SignInSteps description="See where your return stands and what's needed from you." {...steps} />
    </SignInPage>
  ),
};
export const Demo: Story = { name: "Sign in · demo", render: () => <DemoSignIn />, parameters: { docs: { source: { code: fnSource(raw, "DemoSignIn") } } } };
export const Unreachable: Story = {
  name: "Sign in · server not answering",
  render: () => (
    <SignInPage>
      <SignInSteps description="See where your return stands and what's needed from you." {...steps} />
      <ServerUnreachable onRetry={fn()} />
    </SignInPage>
  ),
};
export const SetupLink: Story = {
  name: "Setup link · gone",
  render: () => (
    <LinkPage>
      <LinkGone onSignIn={fn()} />
    </LinkPage>
  ),
};

export const DemoTest: Story = {
  ...Demo,
  name: "Sign in · demo · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    picked.mockClear();
    const c = within(canvasElement);
    await expect(c.getByText("Demo · sample data")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Sign in as a demo client" }));
    const d = within(await screen.findByRole("dialog", { name: "Choose a demo client" }));
    await expect(d.getByText("Kestrel household")).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: /Toni Wren/ }));
    await expect(picked).toHaveBeenCalledWith("p-wren");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  },
};

const retried = fn();
export const UnreachableTest: Story = {
  name: "Server not answering · test",
  tags: ["!dev", "!autodocs"],
  render: () => <ServerUnreachable onRetry={retried} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Try again" }));
    await expect(retried).toHaveBeenCalledOnce();
  },
};
