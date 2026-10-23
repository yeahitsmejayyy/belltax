import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { AdminAuthPage, AdminSignInPage, DemoPreparerOption } from "../components/admin-auth-pages";
import { LinkGone } from "../components/auth-cards";
import { MarkLoader } from "../components/logo";
import { SignInSteps } from "../components/sign-in-flows";
import { DEMO_PREPARERS } from "./admin-settings.fixtures";

// The admin's sign-in page (admin 01-access-signin, tickets 05, 05b) around the sign-in form: the logo in one card on a
// muted page, and in demo mode a button per invented preparer. The setup-link page sits on the same backdrop. Invented data.
const meta: Meta = { title: "Admin/Sign in/Pages", parameters: { layout: "fullscreen" } };
meta.parameters = { ...meta.parameters, usage: 'import { AdminAuthPage, AdminSignInPage, DemoPreparerOption } from "@app/ui/components/admin-auth-pages";' };
export default meta;
type Story = StoryObj;

const picked = fn();
const steps = { signIn: async () => ({ done: true as const }), onPasskey: async () => undefined, recover: async () => undefined, onDone: fn(), onSetup: fn() };

export const Live: Story = {
  name: "Sign in",
  render: () => (
    <AdminSignInPage>
      <SignInSteps title="Sign in" description="The back office for your practice." {...steps} />
    </AdminSignInPage>
  ),
};
export const Demo: Story = {
  name: "Sign in · demo",
  render: () => (
    <AdminSignInPage>
      <SignInSteps title="Sign in" description="The back office for your practice." {...steps}>
        <DemoPreparerOption preparers={DEMO_PREPARERS} onPick={picked} />
      </SignInSteps>
    </AdminSignInPage>
  ),
};
export const CheckingLink: Story = {
  name: "Setup link · checking",
  render: () => (
    <AdminAuthPage>
      <MarkLoader label="Checking your link" />
    </AdminAuthPage>
  ),
};
export const LinkGoneStory: Story = {
  name: "Setup link · gone",
  render: () => (
    <AdminAuthPage>
      <LinkGone onSignIn={fn()} />
    </AdminAuthPage>
  ),
};

export const DemoTest: Story = {
  ...Demo,
  name: "Sign in · demo · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    picked.mockClear();
    const c = within(canvasElement);
    await expect(c.getByText("or, in the demo")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Continue as Morgan Hale (preparer)" }));
    await expect(picked).toHaveBeenCalledWith("u-morgan");
  },
};
