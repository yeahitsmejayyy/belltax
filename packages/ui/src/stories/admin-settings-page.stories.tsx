import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { AdminSettingsPage, PracticeSettings, PreparerSignIn, type SettingsTab } from "../components/admin-settings";
import { LetterTemplateEditor, LetterTemplateSettings } from "../components/letter-template";
import { PricingSettings } from "../components/pricing-settings";
import { ADDONS, LETTER_CURRENT, LETTER_VERSIONS, MERGE_FIELDS, PACKAGES, PRACTICE, REQUIRED_FIELDS, SIGN_IN, samplePreview } from "./admin-settings.fixtures";
import { fnSource } from "./fixtures";
import raw from "./admin-settings-page.stories?raw";

// The preparer's Settings page (admin 31/32/33-settings), as apps/admin renders it: one tab per section, from a config
// array. The admin keeps the tab in the URL; here it's state. Each section has its own stories. Invented data.
const meta: Meta<typeof AdminSettingsPage> = { title: "Admin/Settings/AdminSettingsPage", component: AdminSettingsPage };
meta.parameters = { ...meta.parameters, usage: 'import { AdminSettingsPage } from "@app/ui/components/admin-settings";' };
export default meta;
type Story = StoryObj<typeof AdminSettingsPage>;

const TABS: SettingsTab[] = [
  { id: "practice", label: "Practice", content: <PracticeSettings practice={PRACTICE} onSave={fn()} renderSeasonLink={(children) => <a href="#season">{children}</a>} /> },
  { id: "pricing", label: "Services & pricing", content: <PricingSettings packages={PACKAGES} addons={ADDONS} onToggle={fn()} onEdit={fn()} /> },
  {
    id: "letter",
    label: "Engagement letter",
    content: (
      <LetterTemplateSettings current={LETTER_CURRENT} versions={LETTER_VERSIONS}>
        <LetterTemplateEditor version={LETTER_CURRENT.version} body={LETTER_CURRENT.body} mergeFields={MERGE_FIELDS} requiredFields={REQUIRED_FIELDS} preview={samplePreview(LETTER_CURRENT.body)} onPreview={fn()} onPublish={fn()} />
      </LetterTemplateSettings>
    ),
  },
  { id: "sign-in", label: "Sign-in", content: <PreparerSignIn methods={SIGN_IN} onAddPasskey={async () => undefined} onRemovePasskey={async () => undefined} onMakeCodes={fn()} onCodesDone={fn()} /> },
];

// The page's side: which tab shows (the admin's URL segment).
function Settings() {
  const [tab, setTab] = useState("practice");
  return <AdminSettingsPage tabs={TABS} value={tab} onValueChange={setTab} />;
}

export const Default: Story = { name: "Settings", render: () => <Settings />, parameters: { docs: { source: { code: fnSource(raw, "Settings") } } } };
export const Pricing: Story = { name: "Services & pricing tab", args: { tabs: TABS, value: "pricing", onValueChange: fn() } };

export const AdminSettingsPageTest: Story = {
  ...Default,
  name: "Settings · test",
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(c.getByRole("tablist", { name: "Settings" })).toBeInTheDocument();
    await expect(c.getByLabelText("Practice name")).toHaveValue(PRACTICE.practiceName);
    await userEvent.click(c.getByRole("tab", { name: "Services & pricing" }));
    await expect(c.getByRole("tab", { name: "Services & pricing" })).toHaveAttribute("aria-selected", "true");
    await expect(await c.findByRole("table", { name: "Packages" })).toBeInTheDocument();
    await userEvent.click(c.getByRole("tab", { name: "Sign-in" }));
    await expect(await c.findByRole("heading", { name: "Recovery codes" })).toBeInTheDocument();
  },
};
