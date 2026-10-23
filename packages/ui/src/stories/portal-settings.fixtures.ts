import type { ReminderPref } from "@app/schema";

import type { DemoClient } from "../components/auth-pages";
import type { SignInMethods } from "../components/client-settings";

// Invented data for the portal's Settings and sign-in stories. Nothing here is real: .test emails, 555-01xx phones.

export const CLIENT = { name: "Renata Torres-Farouk", email: "renata@example.test", phone: "(555) 010-0142" };
export const PREPARER = "Morgan";
export const TAKEN_EMAIL = "taken@example.test";

export const REMINDERS: ReminderPref[] = [
  { kind: "requests", email: true, text: true },
  { kind: "letter", email: true, text: false },
  { kind: "invoice", email: false, text: false },
];

export const PASSKEYS: SignInMethods = {
  passkeys: [
    { id: "k1", name: "iPhone", createdAt: "2026-10-02T17:00:00.000Z", lastUsedAt: "2026-10-17T15:20:00.000Z", synced: true },
    { id: "k2", name: "Mac", createdAt: "2026-10-05T19:00:00.000Z", lastUsedAt: null, synced: true },
  ],
  authenticatorApp: false,
};
export const APP_ONLY: SignInMethods = { passkeys: [], authenticatorApp: true };
export const NOTHING_YET: SignInMethods = { passkeys: [], authenticatorApp: false };
export const ACTIVE_SINCE = "2026-09-14T16:00:00.000Z";

export const DEMO_CLIENTS: DemoClient[] = [
  { id: "p-marigold", name: "Dana Marigold", household: "Marigold" },
  { id: "p-kestrel", name: "Sidney Kestrel", household: "Kestrel" },
  { id: "p-wren", name: "Toni Wren", household: "Wren" },
];
