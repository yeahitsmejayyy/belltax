import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "./app-router";

// AppRouter drives all client-side types. It is a generated file: `bun run sync:types`.
export const trpc = createTRPCReact<AppRouter>();

// What each procedure takes and returns, e.g. RouterOutputs["engagement"]["detail"].
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;
