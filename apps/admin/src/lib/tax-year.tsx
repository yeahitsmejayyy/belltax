import * as React from "react";
import { trpc } from "./trpc";

// The tax year every page shows (the sidebar's switcher). Remembered per browser; defaults to the newest.

const KEY = "btp-admin-tax-year";
type Ctx = { taxYear: number | undefined; years: number[]; setTaxYear: (y: number) => void };
const TaxYearContext = React.createContext<Ctx>({ taxYear: undefined, years: [], setTaxYear: () => {} });

export function TaxYearProvider({ children }: { children: React.ReactNode }) {
  const list = trpc.engagement.list.useQuery(undefined, { staleTime: 60_000 });
  const years = list.data?.years ?? [];
  const [chosen, setChosen] = React.useState<number | undefined>(() => {
    try {
      const v = Number(localStorage.getItem(KEY));
      return Number.isInteger(v) && v > 2000 ? v : undefined;
    } catch {
      return undefined;
    }
  });
  const taxYear = chosen && years.includes(chosen) ? chosen : years[0];
  const setTaxYear = React.useCallback((y: number) => {
    setChosen(y);
    try {
      localStorage.setItem(KEY, String(y));
    } catch {
      /* the choice lasts for this page only */
    }
  }, []);
  return <TaxYearContext.Provider value={{ taxYear, years, setTaxYear }}>{children}</TaxYearContext.Provider>;
}

export const useTaxYear = () => React.useContext(TaxYearContext);
