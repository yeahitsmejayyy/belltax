import type { Meta, StoryObj } from "@storybook/react-vite";

import { AppearanceCard } from "../components/client-settings";

// Settings · Appearance: light, dark, or the device's choice, through the shared ModeToggle.
const meta: Meta<typeof AppearanceCard> = { title: "Portal/Settings/AppearanceCard", component: AppearanceCard };
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { AppearanceCard } from "@app/ui/components/client-settings";' };
export default meta;
type Story = StoryObj<typeof AppearanceCard>;

export const Default: Story = { name: "Appearance" };
