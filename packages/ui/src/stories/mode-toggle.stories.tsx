import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, screen, userEvent, waitFor, within } from "storybook/test";

import { ModeToggle } from "../components/mode-toggle";
import { ThemeProvider } from "../components/theme-provider";

// Three ways to switch theme. Try them: they change the canvas for real.
const meta: Meta<typeof ModeToggle> = {
  title: "Primitives/ModeToggle",
  component: ModeToggle,
  // Starts from the toolbar's theme and remembers nothing, so every story (and test) begins in step with the canvas.
  decorators: [(Story, ctx) => <ThemeProvider storageKey={null} defaultTheme={ctx.globals.theme === "dark" ? "dark" : "light"}><Story /></ThemeProvider>],
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: "import { ModeToggle } from \"@app/ui/components/mode-toggle\";\nimport { ThemeProvider } from \"@app/ui/components/theme-provider\";" };
export default meta;
type Story = StoryObj<typeof ModeToggle>;

export const Icon: Story = { name: "Icon (ghost)", args: { variant: "icon" } };
export const Slide: Story = { name: "Slide toggle", args: { variant: "switch" } };
export const Menu: Story = { name: "Menu (with System)", args: { variant: "menu" } };

const dark = () => document.documentElement.classList.contains("dark");

export const IconTest: Story = {
  name: "Icon · test",
  tags: ["!dev", "!autodocs"],
  args: { variant: "icon" },
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    const before = dark();
    await userEvent.click(c.getByRole("button", { name: before ? "Switch to light mode" : "Switch to dark mode" }));
    await waitFor(() => expect(dark()).toBe(!before));
    await expect(c.getByRole("button", { name: before ? "Switch to dark mode" : "Switch to light mode" })).toBeInTheDocument();
  },
};

export const SlideTest: Story = {
  name: "Slide toggle · test",
  tags: ["!dev", "!autodocs"],
  args: { variant: "switch" },
  play: async ({ canvasElement }) => {
    const sw = within(canvasElement).getByRole("switch", { name: "Dark mode" });
    const before = sw.getAttribute("aria-checked") === "true";
    await userEvent.click(sw);
    await waitFor(() => expect(dark()).toBe(!before));
    await userEvent.keyboard(" ");
    await waitFor(() => expect(dark()).toBe(before));
  },
};

export const MenuTest: Story = {
  name: "Menu · test",
  tags: ["!dev", "!autodocs"],
  args: { variant: "menu" },
  play: async ({ canvasElement }) => {
    const choose = async (label: "Dark" | "Light") => {
      await userEvent.click(within(canvasElement).getByRole("button", { name: "Theme" }));
      const item = await screen.findByRole("menuitemradio", { name: label });
      await waitFor(() => expect(item).toBeVisible()); // after the open animation
      await userEvent.click(item);
      await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    };
    await choose("Dark");
    await waitFor(() => expect(dark()).toBe(true));
    await choose("Light");
    await waitFor(() => expect(dark()).toBe(false));
  },
};
