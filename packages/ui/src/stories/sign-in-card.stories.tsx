import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { SignInCard } from "../components/client-settings";
import { ACTIVE_SINCE, APP_ONLY, NOTHING_YET, PASSKEYS } from "./portal-settings.fixtures";

// Settings · Sign-in (ticket 05b): how the client signs in. Their passkeys (add another, remove one), or the
// authenticator app with their password. The passkey list is mfa-cards' PasskeyList.
const meta: Meta<typeof SignInCard> = {
  title: "Portal/Settings/SignInCard",
  component: SignInCard,
  args: { activeSince: ACTIVE_SINCE, onAddPasskey: async () => undefined, onRemovePasskey: async () => undefined },
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { SignInCard } from "@app/ui/components/client-settings";' };
export default meta;
type Story = StoryObj<typeof SignInCard>;

export const Passkeys: Story = { name: "With passkeys", args: { methods: PASSKEYS } };
export const AuthenticatorApp: Story = { name: "Password and app", args: { methods: APP_ONLY } };
export const Demo: Story = { name: "Demo", args: { methods: NOTHING_YET, demo: true, activeSince: null } };
export const CantAddHere: Story = { name: "Nothing yet, can't add here", args: { methods: NOTHING_YET, canAddPasskey: false } };
export const Loading: Story = { name: "Loading", args: { methods: undefined } };

const removed = fn();
export const SignInCardTest: Story = {
  ...Passkeys,
  name: "With passkeys · test",
  tags: ["!dev", "!autodocs"],
  args: { ...Passkeys.args, onRemovePasskey: async (id) => removed(id) },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByText("You sign in with a passkey: Face ID, Touch ID or your device's PIN.")).toBeInTheDocument();
    await expect(c.getByText(/Account active since/)).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Remove Mac" }));
    await userEvent.click((await screen.findByRole("alertdialog", { name: "Remove this passkey?" }), screen.getByRole("button", { name: "Remove" })));
    await waitFor(() => expect(removed).toHaveBeenCalledWith("k2"));
  },
};
