import type { Meta, StoryObj } from "@storybook/react-vite";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { InviteClientDialog, type InviteDraft } from "../components/invite-client-dialog";
import { SplitButton } from "../components/split-button";
import { SAMPLE } from "./fixtures";

// Admin 24/25-dialogs-and-sheets-dlg-invite: Invite client, or Add client without invite, from the header's
// split button. Invented people only.
const meta: Meta = { title: "Admin/InviteClientDialog" };
export default meta;
type Story = StoryObj;


const submitted = fn();

function Demo({ fail = false }: { fail?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InviteDraft["mode"]>("invite");
  return (
    <>
      <SplitButton
        label={<><UserPlus /> Invite client</>}
        onClick={() => { setMode("invite"); setOpen(true); }}
        menuLabel="More ways to add a client"
        items={[{ label: "Add client without invite", description: "Set them up now. Send the portal invite later.", onSelect: () => { setMode("add"); setOpen(true); } }]}
      />
      <InviteClientDialog
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        taxYear={2026}
        preparerName="Patrick J. Bell"
        sample={SAMPLE}
        onSubmit={async (d) => {
          await new Promise((r) => setTimeout(r, 300));
          if (fail) throw new Error("That email already has a login. Open the existing household instead.");
          submitted(d);
        }}
      />
    </>
  );
}

export const Invite: Story = { name: "Invite client", render: () => <Demo /> };
export const SaveFails: Story = { name: "When saving fails", render: () => <Demo fail /> };

const open = async (canvasElement: HTMLElement, add = false) => {
  const c = within(canvasElement);
  if (add) {
    await userEvent.click(c.getByRole("button", { name: "More ways to add a client" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: /Add client without invite/ }));
  } else {
    await userEvent.click(c.getByRole("button", { name: "Invite client" }));
  }
  return within(await screen.findByRole("dialog"));
};

export const InviteTest: Story = {
  ...Invite,
  name: "Invite client · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const d = await open(canvasElement);
    const cont = () => d.getByRole("button", { name: "Continue" });

    await step("Household: Continue shows what's missing, under each field", async () => {
      await expect(d.getByRole("heading", { name: "Create the household" })).toBeInTheDocument();
      await userEvent.click(cont());
      await expect(d.getByText("Enter the household surname.")).toBeInTheDocument();
      await expect(d.getByText("Enter the email the invite goes to.")).toBeInTheDocument();
      await userEvent.type(d.getByLabelText("Household surname"), "Quartz");
      await expect(d.queryByText("Enter the household surname.")).toBeNull(); // clears as you type
      await userEvent.type(d.getByLabelText("Email for the invite"), "not-an-email");
      await expect(d.getByText("Enter a valid email, like m@example.com.")).toBeInTheDocument();
      await userEvent.clear(d.getByLabelText("Email for the invite"));
      await userEvent.type(d.getByLabelText("Email for the invite"), "jo@example.test");
      await userEvent.click(cont());
    });

    await step("Members: a name for everyone, one primary, one spouse", async () => {
      await expect(d.getByRole("heading", { name: "Add household members" })).toBeInTheDocument();
      await userEvent.click(cont());
      await expect(d.getByText("Enter a first name.")).toBeInTheDocument();
      await userEvent.type(d.getByLabelText("First name, member 1"), "Jo");
      await userEvent.click(d.getByRole("button", { name: /Add someone/ })); // a spouse first
      await userEvent.type(d.getByLabelText("First name, member 2"), "Sam");
      await userEvent.click(cont());
    });

    await step("Filers: married filing jointly needs both spouses", async () => {
      await expect(d.getByRole("heading", { name: "Choose this year's filers" })).toBeInTheDocument();
      await userEvent.click(d.getByRole("radio", { name: /Married filing jointly/ }));
      await expect(d.getByRole("checkbox", { name: /Jo Quartz/ })).toBeChecked();
      await expect(d.getByRole("checkbox", { name: /Sam Quartz/ })).toBeChecked();
      await userEvent.click(d.getByRole("checkbox", { name: /Sam Quartz/ }));
      await expect(d.getByText("Married filing jointly needs both spouses as filers.")).toBeInTheDocument();
      await userEvent.click(d.getByRole("radio", { name: /Married filing separately/ }));
      await expect(d.getByText("This creates 2 separate returns.")).toBeInTheDocument();
      await userEvent.click(d.getByRole("radio", { name: /Married filing jointly/ }));
      await userEvent.click(cont());
    });

    await step("Send: the review and the email they'll get", async () => {
      await expect(d.getByRole("heading", { name: "Send the portal invite" })).toBeInTheDocument();
      await expect(d.getByText("jo@example.test")).toBeInTheDocument();
      await expect(d.getByText(/1 return · Married filing jointly · Jo Quartz and Sam Quartz/)).toBeInTheDocument();
      await expect(d.getByText(/Hi Jo, Patrick J\. Bell invited you/)).toBeInTheDocument();
      await userEvent.click(d.getByRole("button", { name: "Send invite" }));
      await waitFor(() => expect(d.getByRole("heading", { name: "Invite sent" })).toBeInTheDocument());
      await expect(submitted).toHaveBeenLastCalledWith({
        mode: "invite", surname: "Quartz", email: "jo@example.test", phone: "",
        members: [{ first: "Jo", role: "primary" }, { first: "Sam", role: "spouse" }], filing: "mfj", filers: [0, 1],
      });
    });
  },
};

export const AddWithoutInviteTest: Story = {
  ...Invite,
  name: "Add without invite · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const d = await open(canvasElement, true);
    await expect(d.getByLabelText("Email (optional for now)")).toBeInTheDocument();
    await userEvent.click(d.getByRole("button", { name: "Fill sample data" }));
    await expect(d.getByLabelText("Household surname")).toHaveValue("Example");
    for (let i = 0; i < 3; i++) await userEvent.click(d.getByRole("button", { name: "Continue" }));
    await expect(d.getByRole("heading", { name: "Review and save" })).toBeInTheDocument();
    await expect(d.queryByText(/invited you to set up/)).toBeNull(); // nothing is sent
    await userEvent.click(d.getByRole("button", { name: "Save client" }));
    await waitFor(() => expect(d.getByRole("heading", { name: "Client added" })).toBeInTheDocument());
    await expect(d.getByText(/marked Not invited yet/)).toBeInTheDocument();
    await expect(submitted.mock.lastCall?.[0]).toMatchObject({ mode: "add", surname: "Example", filing: "mfj", filers: [0, 1] });
  },
};

export const SaveFailsTest: Story = {
  ...SaveFails,
  name: "When saving fails · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const d = await open(canvasElement);
    await userEvent.click(d.getByRole("button", { name: "Fill sample data" }));
    for (let i = 0; i < 3; i++) await userEvent.click(d.getByRole("button", { name: "Continue" }));
    await userEvent.click(d.getByRole("button", { name: "Send invite" }));
    await expect(await d.findByRole("alert")).toHaveTextContent("That email already has a login.");
    await expect(d.getByRole("heading", { name: "Send the portal invite" })).toBeInTheDocument(); // it stays put
  },
};
