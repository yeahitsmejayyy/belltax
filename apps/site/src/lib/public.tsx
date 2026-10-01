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

// Names the copy uses, with neutral fallbacks while loading or if the portal can't be reached.
export function useNames() {
  const { practice } = usePublic();
  const preparer = practice?.preparerName ?? "your preparer";
  return {
    practice: practice?.practiceName ?? "BellTaxPrep",
    preparer,
    preparerFirst: practice ? preparer.split(/\s+/)[0]! : "your preparer",
    city: practice?.city ?? null,
    state: practice?.state ?? null,
    email: practice?.replyToEmail ?? null,
  };
}
