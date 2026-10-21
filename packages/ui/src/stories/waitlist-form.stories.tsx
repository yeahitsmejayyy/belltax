import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { WaitlistForm } from "../components/waitlist-form";

// "Join the list" (the splash page, ticket 53). What joining does is the page's business (the site opens an email to
// the practice); the form checks the address, asks about reminders and confirms. Invented addresses only.
const meta: Meta = { title: "Site/Waitlist form" };
export default meta;
type Story = StoryObj;

const joined = fn();
export const Join: Story = { render: () => <WaitlistForm onJoin={(email, reminders) => joined(email, reminders)} /> };
export const JoinTest: Story = {
  ...Join,
  name: "Join · test",
  tags: ["!dev"],
  play: async ({ canvasElement, step }) => {
    const c = within(canvasElement);
    const field = () => c.getByLabelText("Email address");
    await step("Empty, then not an email: each says what's wrong", async () => {
      await userEvent.click(c.getByRole("button", { name: "Join the list" }));
      await expect(await c.findByRole("alert")).toHaveTextContent("Enter your email address.");
      await userEvent.type(field(), "jordan@");
      await expect(c.getByRole("alert")).toHaveTextContent("Enter a valid email, like m@example.com.");
      await expect(field()).toHaveAttribute("aria-invalid", "true");
      await expect(joined).not.toHaveBeenCalled();
    });
    await step("A good address, reminders off: joined, and the form gives way to the confirmation", async () => {
      await userEvent.type(field(), "example.com");
      await userEvent.click(c.getByRole("checkbox"));
      await userEvent.click(c.getByRole("button", { name: "Join the list" }));
      await waitFor(() => expect(joined).toHaveBeenCalledWith("jordan@example.com", false));
      await expect(await c.findByRole("status")).toHaveTextContent("You're on the list.");
    });
    await step("Use a different email brings the form back, empty", async () => {
      await userEvent.click(c.getByRole("button", { name: "Use a different email" }));
      await expect(c.getByLabelText("Email address")).toHaveValue("");
    });
  },
};

// What the site says: joining opened an email, so sending it is the last step.
export const EmailThePractice: Story = {
  name: "Joined · email the practice",
  render: () => (
    <WaitlistForm
      onJoin={() => undefined}
      confirmation={(email) => ({ title: "Almost there.", body: `Your email app opened with a note asking us to add ${email}. Send it and you're on the list: we'll write when booking opens, and nothing else.` })}
    />
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText("Email address"), "jordan@example.com");
    await userEvent.click(c.getByRole("button", { name: "Join the list" }));
  },
};

export const JoinFails: Story = {
  name: "Join · fails",
  render: () => (
    <WaitlistForm
      onJoin={async () => {
        throw new Error("Can't reach the server. Check your connection and try again.");
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.type(c.getByLabelText("Email address"), "jordan@example.com");
    await userEvent.click(c.getByRole("button", { name: "Join the list" }));
  },
};
