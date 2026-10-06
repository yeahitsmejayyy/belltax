import * as React from "react";

// Pages name themselves in the header: a title, and for a detail page the list it sits under
// ("Pipeline › Dana & Sam Marigold"). Plain strings only, so a page can call this on every render.
// Page actions belong in the page body (PageHeader); the header's one action is Invite client.

export type HeaderTitle = { title: string; parent?: { label: string; to: string } };
const Ctx = React.createContext<{ value: HeaderTitle; set: (v: HeaderTitle) => void }>({ value: { title: "" }, set: () => {} });

export function HeaderTitleProvider({ children }: { children: React.ReactNode }) {
  const [value, set] = React.useState<HeaderTitle>({ title: "" });
  return <Ctx.Provider value={{ value, set }}>{children}</Ctx.Provider>;
}

export const useHeaderTitle = () => React.useContext(Ctx).value;

export function usePageTitle(title: string, parent?: { label: string; to: string }) {
  const { set } = React.useContext(Ctx);
  const pl = parent?.label;
  const pt = parent?.to;
  React.useEffect(() => {
    set({ title, parent: pl && pt ? { label: pl, to: pt } : undefined });
    document.title = `${title} · belltax. admin`;
  }, [set, title, pl, pt]);
}
