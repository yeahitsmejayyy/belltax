import { Button } from "./button";

// "Load more" under a cursor-paged list (admin Activity, Invoices). Shown only while there is a next page; the app
// owns the paging.
export function LoadMore({ hasMore, loading = false, onLoadMore, label = "Load more", loadingLabel = "Loading…" }: { hasMore: boolean; loading?: boolean; onLoadMore: () => void; label?: string; loadingLabel?: string }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center">
      <Button variant="outline" className="h-11 md:h-9" disabled={loading} onClick={onLoadMore}>
        {loading ? loadingLabel : label}
      </Button>
    </div>
  );
}
