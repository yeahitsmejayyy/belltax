import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";

import { BoardCard } from "../components/board";
import { DeviceFrame } from "../components/device-frame";
import { cards } from "./pipeline.fixtures";

// A phone to show phone-only UI in (ticket 56): real device sizes, the camera cut-out and the home bar, with the
// screen as the containing block for fixed bars and a home-bar strip they stay clear of. Invented data.
const meta: Meta<typeof DeviceFrame> = {
  title: "Primitives/DeviceFrame",
  component: DeviceFrame,
  parameters: { usage: 'import { DeviceFrame } from "@app/ui/components/device-frame";' },
  args: { device: "iphone-16-pro" },
  argTypes: { device: { control: "select", options: ["iphone-16-pro", "iphone-16-pro-max", "pixel-9"] } },
};
export default meta;
type Story = StoryObj<typeof DeviceFrame>;

const Screen = () => (
  <div className="grid gap-3 p-4">
    <h1 className="text-2xl font-semibold tracking-tight">Pipeline</h1>
    {cards.map((c) => (
      <BoardCard key={c.id} {...c} />
    ))}
  </div>
);

export const IPhone16Pro: Story = {
  name: "iPhone 16 Pro",
  render: (args) => (
    <DeviceFrame {...args}>
      <Screen />
    </DeviceFrame>
  ),
  parameters: { docs: { source: { code: `<DeviceFrame device="iphone-16-pro">\n  <YourScreen />\n</DeviceFrame>` } } },
};
export const IPhone16ProMax: Story = { ...IPhone16Pro, name: "iPhone 16 Pro Max", args: { device: "iphone-16-pro-max" } };
export const Pixel9: Story = { ...IPhone16Pro, name: "Pixel 9", args: { device: "pixel-9" } };

export const SizeTest: Story = {
  ...IPhone16Pro,
  name: "iPhone 16 Pro · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const screen = canvasElement.querySelector('[data-slot="device-screen"]') as HTMLElement;
    await expect(screen.getBoundingClientRect().width).toBe(402);
    await expect(screen.style.getPropertyValue("--safe-bottom")).toBe("34px");
    await expect(within(canvasElement).getByRole("heading", { name: "Pipeline" })).toBeInTheDocument();
  },
};
