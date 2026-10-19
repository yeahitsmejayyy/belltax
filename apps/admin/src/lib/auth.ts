import { makeAuthClient } from "@app/ui/auth-client";

import { at } from "@/lib/base";

// Signing in over REST (tickets 05, 05b): the shared client, under /admin/ on the public demo.
export type { AuthResult, LinkInfo, LinkOptions } from "@app/ui/auth-client";
export const auth = makeAuthClient(at);
export const { signOut } = auth;
