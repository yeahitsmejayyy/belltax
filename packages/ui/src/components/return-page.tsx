import { FileQuestion } from "lucide-react";
import type * as React from "react";

import { adminAnchor, type AdminLink } from "./admin-clients";
import { Button } from "./button";
import { EmptyState } from "./empty-state";
import { Skeleton } from "./skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

// One return in the preparer admin (admin 12–18-return-detail, 37-phone-m-return), the frame apps/admin renders and
// Storybook shows (ticket 59): the header, then a tab per job. The tabs are a config array (label, an optional count or
// alert, and the tab's content); which one is open and what happens on a switch belong to the app (URL segments there).

/** One tab of the return. `count` shows a pill when above zero (`countLabel` is its screen-reader words); `alert` shows a "!" with that text. */
export type ReturnTab<V extends string = string> = {
  value: V;
  label: string;
  count?: number;
  countLabel?: string;
  alert?: string | null;
  content: React.ReactNode;
};

/** The count pill on a tab: "3", read as "3 to review". */
export function TabCount({ count, label }: { count: number; label?: string }) {
  return (
    <span className="rounded-full bg-brand-subtle px-1.5 text-xs font-semibold text-brand-subtle-foreground tabular-nums">
      {count}
      {label ? <span className="sr-only">{` ${label}`}</span> : null}
    </span>
  );
}

/** The danger "!" on a tab, with what it means as hover and screen-reader text. */
export function TabAlert({ label }: { label: string }) {
  return (
    <span className="flex size-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white" title={label}>
      !<span className="sr-only">{label}</span>
    </span>
  );
}

export type ReturnPageProps<V extends string = string> = {
  /** The header (ReturnHeader). */
  header: React.ReactNode;
  tabs: readonly ReturnTab<V>[];
  /** The open tab. */
  value: V;
  onValueChange: (value: V) => void;
  /** After the tabs: the page's sheets and dialogs. */
  children?: React.ReactNode;
};

/** The return's page: header, tab bar and the open tab. */
export function ReturnPage<V extends string = string>({ header, tabs, value, onValueChange, children }: ReturnPageProps<V>) {
  return (
    <div className="grid grid-cols-1 animate-page gap-6">
      {header}

      <Tabs value={value} onValueChange={(v) => onValueChange(v as V)} className="min-w-0">
        <TabsList className="max-md:h-12 max-md:[&>button]:min-h-11">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {t.count ? <TabCount count={t.count} label={t.countLabel} /> : null}
              {t.alert ? <TabAlert label={t.alert} /> : null}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {t.content}
          </TabsContent>
        ))}
      </Tabs>

      {children}
    </div>
  );
}

/** While the return loads. */
export function ReturnLoading() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the return">
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-5 w-96 max-w-full" />
      <Skeleton className="h-10 w-[28rem] max-w-full" />
      <div className="grid gap-4 lg:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-80 rounded-xl" />)}</div>
    </div>
  );
}

/** A return that can't be found, with the way back to the pipeline. */
export function ReturnNotFound({ renderLink = adminAnchor, backHref = "/pipeline" }: { renderLink?: AdminLink; backHref?: string }) {
  return (
    <EmptyState
      icon={FileQuestion}
      title="This return isn't here"
      description="It may have been removed, or the link is wrong."
      action={
        <Button variant="outline" asChild>
          {renderLink(backHref, "Back to the pipeline")}
        </Button>
      }
    />
  );
}
