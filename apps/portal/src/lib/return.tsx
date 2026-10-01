import * as React from "react";

import { trpc, type RouterOutputs } from "@/lib/trpc";

// Which return the portal is showing. Most clients have one; someone with an amendment, several years, or a
// helper's grant has more. The newest is the default; a choice is remembered on this device.

export type MyReturn = RouterOutputs["engagement"]["mine"][number];
const KEY = "btp-portal-return";

type Value = { all: MyReturn[]; current: MyReturn | null; choose: (engagementId: string) => void; loading: boolean };
const Ctx = React.createContext<Value>({ all: [], current: null, choose: () => {}, loading: true });

export function ReturnProvider({ children }: { children: React.ReactNode }) {
  const q = trpc.engagement.mine.useQuery();
  const [chosen, setChosen] = React.useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });
  const all = q.data ?? [];
  const current = all.find((r) => r.engagementId === chosen) ?? all[0] ?? null;
  const choose = React.useCallback((id: string) => {
    setChosen(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* private window: remember for this visit only */
    }
  }, []);
  return <Ctx.Provider value={{ all, current, choose, loading: q.isLoading }}>{children}</Ctx.Provider>;
}

export const useReturn = () => React.useContext(Ctx);

// The browser tab's title for a page.
export function usePageTitle(title: string) {
  React.useEffect(() => {
    document.title = `${title} · BellTaxPrep`;
  }, [title]);
}
