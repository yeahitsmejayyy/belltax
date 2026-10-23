import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { LetterBody, LetterScreen, LetterSigned, LetterSigners, SignLetterForm } from "../components/letter";
import { fnSource } from "./fixtures";
import raw from "./portal-letter.stories?raw";
import { letter, PREPARER, signedByAll, signedByMe } from "./portal-letter-invoice.fixtures";

// The client portal's engagement letter (portal 14-letter, 15-letter-errors, 16-letter-signed): the same components
// apps/portal renders. The app fetches the letter and owns the letter.sign mutation; these get data and callbacks.
// Invented household and practice.
const meta: Meta = {
  title: "Portal/Letter",
  parameters: { usage: 'import { LetterBody, LetterScreen, LetterSigned, LetterSigners, SignLetterForm } from "@app/ui/components/letter";' },
};
export default meta;
type Story = StoryObj;

const phone = { viewport: { value: "phone", isRotated: false } };
const first = PREPARER.split(" ")[0]!;

// The screen as the portal wires it: signing turns the letter into "signed", a name the server refuses shows its error.
function SignTheLetter({ onSign = () => {} }: { onSign?: (typedName: string) => void }) {
  const [current, setCurrent] = useState(letter());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <LetterScreen
      letter={current}
      preparer={first}
      renderSignForm={(l) => (
        <SignLetterForm
          key={l.bodySha256}
          consentText={l.consentText}
          pending={pending}
          error={error}
          onSubmitStart={() => setError(null)}
          onSign={(typedName) => {
            onSign(typedName);
            if (typedName === "Nobody") return setError("That name doesn't match anyone filing these returns.");
            setPending(true);
            setTimeout(() => {
              setPending(false);
              setCurrent({ ...l, canSign: false, signers: l.signers.map((s) => (s.isMe ? { ...s, signedAt: new Date().toISOString() } : s)) });
            }, 400);
          }}
        />
      )}
    />
  );
}

export const ReadyToSign: Story = {
  name: "Ready to sign",
  render: () => <SignTheLetter />,
  globals: phone,
  parameters: { docs: { source: { code: fnSource(raw, "SignTheLetter") } } },
};
export const ReadyToSignDesktop: Story = { ...ReadyToSign, name: "Ready to sign · desktop", globals: {} };
export const SignedWaitingOnOthers: Story = {
  name: "Signed · waiting on a spouse",
  render: () => <LetterScreen letter={signedByMe} preparer={first} renderSignForm={() => null} />,
  globals: phone,
};
export const EveryoneSigned: Story = { name: "Everyone signed", render: () => <LetterScreen letter={signedByAll} preparer={first} renderSignForm={() => null} />, globals: phone };
export const NotSentYet: Story = { name: "Not sent yet", render: () => <LetterScreen letter={letter({ status: "draft" })} preparer={first} renderSignForm={() => null} /> };
export const Withdrawn: Story = { name: "Withdrawn", render: () => <LetterScreen letter={letter({ status: "void" })} preparer={first} renderSignForm={() => null} /> };
export const NotASigner: Story = { name: "Not a signer", render: () => <LetterScreen letter={letter({ canSign: false })} preparer={first} renderSignForm={() => null} /> };
export const NoReturn: Story = { name: "No return yet", render: () => <LetterScreen noReturn preparer={first} renderSignForm={() => null} /> };
export const Loading: Story = { name: "Loading", render: () => <LetterScreen loading preparer={first} renderSignForm={() => null} /> };

export const Body: Story = { name: "LetterBody", render: () => <LetterBody body={letter().body} /> };
export const Signers: Story = { name: "LetterSigners", render: () => <LetterSigners signers={signedByMe.signers} /> };
export const Signed: Story = { name: "LetterSigned", render: () => <LetterSigned letter={signedByAll} me={signedByAll.signers[0]!} /> };
export const Form: Story = {
  name: "SignLetterForm",
  render: () => <SignLetterForm consentText={letter().consentText} onSign={fn()} />,
};
export const FormRefused: Story = {
  name: "SignLetterForm · refused",
  render: () => <SignLetterForm consentText={letter().consentText} onSign={fn()} error="This letter changed since you opened it. Read the new one, then sign." />,
};

const signed = fn();
export const SignTest: Story = {
  name: "Sign · test",
  tags: ["!dev", "!autodocs"],
  render: () => <SignTheLetter onSign={signed} />,
  globals: phone,
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    signed.mockClear();
    // Too early: both errors, the name field focused, nothing sent.
    await userEvent.click(c.getByRole("button", { name: /Sign the letter/ }));
    await expect(c.getByText("Type your full legal name to sign.")).toBeInTheDocument();
    await expect(c.getByText(/Check the box to agree/)).toBeInTheDocument();
    await expect(c.getByLabelText("Type your full legal name")).toHaveFocus();
    await expect(signed).not.toHaveBeenCalled();
    // The server refuses a name: its error shows, and goes on the next try.
    await userEvent.type(c.getByLabelText("Type your full legal name"), "Nobody");
    await userEvent.click(c.getByRole("checkbox"));
    await userEvent.click(c.getByRole("button", { name: /Sign the letter/ }));
    await expect(c.getByText("The letter wasn't signed")).toBeInTheDocument();
    await userEvent.clear(c.getByLabelText("Type your full legal name"));
    await userEvent.type(c.getByLabelText("Type your full legal name"), "  Ada Okafor-Lindqvist ");
    await userEvent.click(c.getByRole("button", { name: /Sign the letter/ }));
    await expect(signed).toHaveBeenLastCalledWith("Ada Okafor-Lindqvist");
    await expect(c.queryByText("The letter wasn't signed")).not.toBeInTheDocument();
    await waitFor(() => expect(c.getByRole("heading", { name: "Letter signed" })).toBeInTheDocument());
    await expect(c.getByText(/complete once Tobias signs too/)).toBeInTheDocument();
  },
};
