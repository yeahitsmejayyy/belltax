import { z } from "zod";

// demo: seeded, invented households — public repo, deployed demo, walkthroughs.
// live: real clients — one local instance, never pushed, deployed or screen-shared.
export const RunMode = z.enum(["demo", "live"]);
export type RunMode = z.infer<typeof RunMode>;
