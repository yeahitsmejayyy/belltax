import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { PreparerSignIn, type PreparerSignInMethods } from "../components/admin-settings";
import { NEW_CODES, SIGN_IN, SIGN_IN_LOW } from "./admin-settings.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-settings-sign-in.stories?raw";

// Settings › Sign-in (ticket 05b): the preparer's passkeys, authenticator app and recovery codes. A new set of codes is
// shown once, in a dialog only Done closes, and the old set stops working. Invented data.
const meta: Meta<typeof PreparerSignIn> = { title: "Admin/Settings/PreparerSignIn", component: PreparerSignIn };
meta.parameters = { ...meta.parameters, usage: 'import { PreparerSignIn } from "@app/ui/components/admin-settings";' };
export default meta;
type Story = StoryObj<typeof PreparerSignIn>;

const made = fn();
const idle = { onAddPasskey: async () => undefined, onRemovePasskey: async () => undefined, onMakeCodes: fn(), onCodesDone: fn() };

// The admin's side: making a new set takes a moment, then it's shown once and the count starts again.
function SignIn() {
  const [methods, setMethods] = useState<PreparerSignInMethods>(SIGN_IN_LOW);
  const [making, setMaking] = useState(false);
  const [codes, setCodes] = useState<string[] | null>(null);
  return (
    <PreparerSignIn
      methods={methods}
      onAddPasskey={async () => undefined}
      onRemovePasskey={async (id) => setMethods((m) => ({ ...m, passkeys: m.passkeys.filter((p) => p.id !== id) }))}
      makingCodes={making}
      onMakeCodes={() => {
        made();
        setMaking(true);
        setTimeout(() => {
          setMaking(false);
          setCodes(NEW_CODES);
          setMethods((m) => ({ ...m, recoveryCodesLeft: NEW_CODES.length }));
        }, 200);
      }}
      codes={codes}
      onCodesDone={() => setCodes(null)}
    />
  );
}

export const Default: Story = { name: "Sign-in", args: { methods: SIGN_IN, ...idle } };
export const RunningLow: Story = { name: "Running low on codes", render: () => <SignIn />, parameters: { docs: { source: { code: fnSource(raw, "SignIn") } } } };
export const NoCodes: Story = { name: "No codes left", args: { methods: { ...SIGN_IN, recoveryCodesLeft: 0 }, ...idle } };
export const CodesFailed: Story = { name: "New codes failed", args: { methods: SIGN_IN, codesError: "That didn't save. Try again.", ...idle } };
export const Loading: Story = { name: "Loading", args: { ...idle } };

export const PreparerSignInTest: Story = {
  ...RunningLow,
  name: "New recovery codes · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    made.mockClear();
    const c = within(canvasElement);
    await expect(c.getByText("You're running low.")).toBeInTheDocument();
    await expect(c.getByText("Authenticator app: not set up")).toBeInTheDocument();
    await userEvent.click(c.getByRole("button", { name: "Make new codes" }));
    await expect(made).toHaveBeenCalledOnce();
    await expect(c.getByRole("button", { name: "Making new codes…" })).toBeDisabled();
    // Shown once: Done waits until they say the codes are saved.
    const d = within(await screen.findByRole("dialog", { name: "New recovery codes" }));
    await expect(d.getByText(NEW_CODES[0]!)).toBeInTheDocument();
    await expect(d.getByRole("button", { name: "Done" })).toBeDisabled();
    await userEvent.click(d.getByRole("checkbox"));
    await userEvent.click(d.getByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await expect(c.getByText("10 of 10 left")).toBeInTheDocument();
    await expect(c.queryByText("You're running low.")).not.toBeInTheDocument();
  },
};
