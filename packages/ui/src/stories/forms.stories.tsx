import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, screen, userEvent, waitFor, within } from "storybook/test";

import { Checkbox } from "../components/checkbox";
import { Input } from "../components/input";
import { Label } from "../components/label";
import { RadioCard, RadioGroup, RadioGroupItem } from "../components/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/select";
import { Switch } from "../components/switch";
import { Textarea } from "../components/textarea";

const meta: Meta = { title: "Primitives/Form controls" };
export default meta;
type Story = StoryObj;

export const TextInput: Story = {
  name: "Input",
  render: () => (
    <div className="w-full grid max-w-sm gap-4">
      <div className="grid gap-1.5"><Label htmlFor="i1">Email</Label><Input id="i1" type="email" placeholder="you@example.com" /></div>
      <div className="grid gap-1.5"><Label htmlFor="i2">Invalid</Label><Input id="i2" aria-invalid defaultValue="dana@" /></div>
      <div className="grid gap-1.5"><Label htmlFor="i3">Disabled</Label><Input id="i3" disabled defaultValue="Read only" /></div>
    </div>
  ),
};

const onReason = fn();
export const TextArea: Story = {
  name: "Textarea",
  render: () => (
    <div className="w-full grid max-w-md gap-1.5">
      <Label htmlFor="t1">Why is this moving back?</Label>
      <Textarea id="t1" placeholder="The client sent a corrected W-2." onChange={(e) => onReason(e.target.value)} />
      <p className="text-xs text-muted-foreground">Required. It's logged on the return.</p>
    </div>
  )
};
export const TextAreaTest: Story = {
  ...TextArea,
  name: "Textarea · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    await userEvent.type(within(canvasElement).getByLabelText("Why is this moving back?"), "Corrected W-2");
    await expect(onReason).toHaveBeenLastCalledWith("Corrected W-2");
  },
};


export const Checkboxes: Story = {
  render: () => (
    <fieldset className="grid gap-3">
      <legend className="mb-2 text-sm font-medium">Add-ons on this invoice</legend>
      {["Side work or gig income", "Covered California (1095-A)", "Each additional state"].map((l, i) => (
        <div key={l} className="flex items-center gap-3">
          <Checkbox id={`c${i}`} defaultChecked={i === 0} />
          <Label htmlFor={`c${i}`}>{l}</Label>
        </div>
      ))}
      <div className="flex items-center gap-3"><Checkbox id="cd" disabled /><Label htmlFor="cd">Amended return (off)</Label></div>
    </fieldset>
  )
};
export const CheckboxesTest: Story = {
  ...Checkboxes,
  name: "Checkboxes · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const box = c.getByLabelText("Covered California (1095-A)");
    await expect(box).not.toBeChecked();
    await userEvent.click(c.getByText("Covered California (1095-A)")); // the label toggles it too
    await expect(box).toBeChecked();
    await userEvent.keyboard(" ");
    await expect(box).not.toBeChecked();
  },
};


export const Radios: Story = {
  render: () => (
    <RadioGroup defaultValue="mfj" aria-label="Filing status (compact)">
      {[["single", "Single"], ["mfj", "Married filing jointly"], ["hoh", "Head of household"]].map(([v, l]) => (
        <div key={v} className="flex items-center gap-3"><RadioGroupItem value={v} id={`r${v}`} /><Label htmlFor={`r${v}`}>{l}</Label></div>
      ))}
    </RadioGroup>
  ),
};

// The portal's choice cards (portal 09-intake-intake-household).
export const ChoiceCards: Story = {
  name: "Radio cards (portal)",
  render: () => {
    const [v, setV] = useState("single");
    return (
      <div className="w-full grid max-w-sm gap-3">
        <RadioGroup value={v} onValueChange={setV} aria-label="How are you filing this year?" className="gap-2">
          <RadioCard value="single"><span className="font-medium">Single</span><span className="text-xs text-muted-foreground">Not married on December 31</span></RadioCard>
          <RadioCard value="mfj"><span className="font-medium">Married, filing together</span><span className="text-xs text-muted-foreground">One return for both of you</span></RadioCard>
          <RadioCard value="mfs"><span className="font-medium">Married, filing separately</span><span className="text-xs text-muted-foreground">We'll talk it through with you</span></RadioCard>
        </RadioGroup>
        <p className="text-sm" data-testid="chosen">Chosen: {v}</p>
      </div>
    );
  }
};
export const ChoiceCardsTest: Story = {
  ...ChoiceCards,
  name: "Radio cards (portal) · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await userEvent.click(c.getByRole("radio", { name: /Married, filing together/ }));
    await expect(c.getByTestId("chosen")).toHaveTextContent("mfj");
    // Radix moves focus on the next tick and checks the item only while the arrow key is down, so hold it
    // like a person would (an instant keyup in a test lands before the move).
    await userEvent.keyboard("{ArrowDown>}");
    await waitFor(() => expect(c.getByTestId("chosen")).toHaveTextContent("mfs"));
    await userEvent.keyboard("{/ArrowDown}");
    await expect(c.getByRole("radio", { name: /Married, filing separately/ }).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  },
};


export const SelectMenu: Story = {
  name: "Select",
  render: () => {
    const [v, setV] = useState<string>();
    return (
      <div className="w-full grid max-w-xs gap-1.5">
        <Label htmlFor="s1">Document type</Label>
        <Select value={v} onValueChange={setV}>
          <SelectTrigger id="s1" className="w-full"><SelectValue placeholder="Choose a document" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="w2">W-2 · wages</SelectItem>
            <SelectItem value="1099nec">1099-NEC · side work</SelectItem>
            <SelectItem value="1095a">1095-A · Covered California</SelectItem>
            <SelectItem value="id">Photo ID</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
};
export const SelectMenuTest: Story = {
  ...SelectMenu,
  name: "Select · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole("combobox", { name: "Document type" });
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "1095-A · Covered California" }));
    await waitFor(() => expect(trigger).toHaveTextContent("1095-A · Covered California"));
  },
};


export const Switches: Story = {
  name: "Switch",
  render: () => (
    <div className="grid gap-3">
      <div className="flex items-center gap-3"><Switch id="sw1" defaultChecked /><Label htmlFor="sw1">Married filing jointly package is active</Label></div>
      <div className="flex items-center gap-3"><Switch id="sw2" /><Label htmlFor="sw2">Amended return add-on is active</Label></div>
    </div>
  )
};
export const SwitchesTest: Story = {
  ...Switches,
  name: "Switch · test",
  tags: ["!dev"],
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getByRole("switch", { name: /Amended/ });
    await userEvent.click(sw);
    await expect(sw).toBeChecked();
  },
};

