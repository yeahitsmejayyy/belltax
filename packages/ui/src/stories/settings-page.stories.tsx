import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";

import { AppearanceCard, ContactCard, RemindersCard, SettingsPage, SignInCard } from "../components/client-settings";
import { ACTIVE_SINCE, CLIENT, PASSKEYS, PREPARER, REMINDERS } from "./portal-settings.fixtures";

// The client portal's Settings page, as apps/portal renders it: the frame, then contact, reminders, sign-in and
// appearance. Each card has its own stories alongside. Invented data.
const USAGE = `import { AppearanceCard, ContactCard, RemindersCard, SettingsPage, SignInCard } from "@app/ui/components/client-settings";

<SettingsPage description={\`How \${preparer} reaches you, and how you sign in.\`} loading={!me}>
  <ContactCard name={me.name} email={me.email} phone={me.phone} preparer={preparer} onSave={save} />
  <RemindersCard reminders={prefs} canText={!!me.phone} onChange={setReminders} />
  <SignInCard methods={methods} activeSince={me.signIn.activatedAt} onAddPasskey={addPasskey} onRemovePasskey={removePasskey} />
  <AppearanceCard />
</SettingsPage>`;
const meta: Meta<typeof SettingsPage> = {
  title: "Portal/Settings/SettingsPage",
  component: SettingsPage,
  parameters: { docs: { source: { code: USAGE, language: "tsx" } } },
};
// What a page imports to use these (shown at the top of the Docs page, ticket 56).
meta.parameters = { ...meta.parameters, usage: 'import { AppearanceCard, ContactCard, RemindersCard, SettingsPage, SignInCard } from "@app/ui/components/client-settings";' };
export default meta;
type Story = StoryObj<typeof SettingsPage>;

export const Default: Story = {
  name: "Settings",
  render: () => (
    <SettingsPage description={`How ${PREPARER} reaches you, and how you sign in.`}>
      <ContactCard name={CLIENT.name} email={CLIENT.email} phone={CLIENT.phone} preparer={PREPARER} onSave={fn()} />
      <RemindersCard reminders={REMINDERS} onChange={fn()} />
      <SignInCard methods={PASSKEYS} activeSince={ACTIVE_SINCE} onAddPasskey={async () => undefined} onRemovePasskey={async () => undefined} />
      <AppearanceCard />
    </SettingsPage>
  ),
};
export const Loading: Story = { name: "Loading", args: { description: `How ${PREPARER} reaches you, and how you sign in.`, loading: true } };
