import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { ClientsPage, type AdminLink } from "@app/ui/components/admin-clients";

import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// Clients (admin 27-clients-invoices-and-activity-clients): every household, newest activity first, from
// household.list. ?invite=pending (the dashboard's health check) narrows to households nobody can sign in to yet.
// The screen is ClientsPage from the design system; this keeps the fetching, the debounce and the URL.

const renderLink: AdminLink = (to, children, className, onClick) => (
  <Link to={to} className={className} onClick={onClick}>
    {children}
  </Link>
);

function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function Clients() {
  usePageTitle("Clients");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const pendingOnly = params.get("invite") === "pending";
  const [search, setSearch] = React.useState("");
  const [includeArchived, setIncludeArchived] = React.useState(false);
  const q = useDebounced(search.trim());
  const list = trpc.household.list.useQuery({ search: q || undefined, includeArchived }, { placeholderData: (prev) => prev });

  const rows = React.useMemo(() => (list.data ?? []).filter((h) => !pendingOnly || h.logins === 0), [list.data, pendingOnly]);

  return (
    <ClientsPage
      rows={list.data ? rows : undefined}
      noClients={!!list.data && !list.data.length && !q && !includeArchived}
      search={search}
      onSearchChange={setSearch}
      query={q}
      includeArchived={includeArchived}
      onIncludeArchivedChange={setIncludeArchived}
      pendingOnly={pendingOnly}
      onShowAll={() => setParams({})}
      onOpen={(r) => navigate(`/clients/${r.id}`)}
      renderLink={renderLink}
    />
  );
}
