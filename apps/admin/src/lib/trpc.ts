import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "./app-router";

// AppRouter drives all client-side types. It is a generated file: `bun run sync:types`.
export const trpc = createTRPCReact<AppRouter>();
