import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./app-router";

// AppRouter drives all client-side types. It's a generated file: `bun run sync:types` at the repo root.
export const trpc = createTRPCReact<AppRouter>();
