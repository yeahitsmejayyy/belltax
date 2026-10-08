import type { PublicPractice, PublicPricing } from "@app/schema";
import * as React from "react";

// The practice's public details and prices, read from the portal (one source: what the admin charges is what
// the site shows). Plain fetch, no tRPC client: the site stays light. Until it answers, or if it can't, the
// page renders without prices rather than with stale ones.

export const PORTAL = (import.meta.env.VITE_PORTAL_ORIGIN as string | undefined)?.replace(/\/$/, "") ?? "";
export const portalUrl = (path: string) => `${PORTAL}${path}`;

export type Public = { practice: PublicPractice | null; pricing: PublicPricing | null; status: "loading" | "ready" | "unavailable" };

const Ctx = React.createContext<Public>({ practice: null, pricing: null, status: "loading" });

export function PublicProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = React.useState<Public>({ practice: null, pricing: null, status: "loading" });
  React.useEffect(() => {
    const ctl = new AbortController();
    fetch(portalUrl(`/trpc/practice.public,pricing.public?batch=1&input=${encodeURIComponent("{}")}`), { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(([practice, pricing]: [{ result: { data: PublicPractice } }, { result: { data: PublicPricing } }]) =>
        setValue({ practice: practice.result.data, pricing: pricing.result.data, status: "ready" }),
      )
      .catch((e: unknown) => {
        if ((e as Error).name !== "AbortError") setValue({ practice: null, pricing: null, status: "unavailable" });
      });
    return () => ctl.abort();
  }, []);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePublic = () => React.useContext(Ctx);

// What the copy calls things. The site speaks as the brand and pairs every client with "your tax agent": it never
// names the preparer or presents the practice as one person (PJ, October 2026). Only where to reach the practice
// (city, state, reply-to email) comes from the portal.
export const BRAND = "belltax.";
export const AGENT = "your tax agent";
export const Agent = "Your tax agent";

export function useNames() {
  const { practice } = usePublic();
  return {
    brand: BRAND,
    agent: AGENT,
    Agent,
    city: practice?.city ?? null,
    state: practice?.state ?? null,
    email: practice?.replyToEmail ?? null,
  };
}
