import { makeAuthClient } from "@app/ui/auth-client";

// Signing in over REST (tickets 05, 05b): the shared client, served from the portal's own address.
export type { AuthResult, LinkInfo, LinkOptions } from "@app/ui/auth-client";
export const auth = makeAuthClient();
export const { signOut } = auth;
