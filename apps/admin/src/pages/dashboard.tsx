import { Link, useNavigate } from "react-router-dom";

import { Dashboard as DashboardView, DashboardLoading } from "@app/ui/components/dashboard";
import { TryThis } from "@app/ui/components/demo-tour";

import { useDemoTour, useDismissed } from "@/lib/demo-tour";
import { useTaxYear } from "@/lib/tax-year";
import { trpc } from "@/lib/trpc";
import { usePageTitle } from "@/shell/header-slots";

// The dashboard (admin 03-dashboard-dashboard, 34-phone-m-dashboard): the season at a glance, from
// dashboard.summary. Every number is derived on the server; nothing here is computed from partial data.
// What it draws is Dashboard from the design system; this page fetches, routes and picks the demo tips.

// The public demo's suggestions for a first visit (ticket 45).
const AGENT_TIPS = [
  { id: "pipeline", label: "Move a return forward", detail: "Drag a card in the pipeline to its next stage.", href: "/pipeline" },
  { id: "inbox", label: "Work the inbox", detail: "New documents and answers from clients land here.", href: "/inbox" },
  { id: "clients", label: "Open a household", detail: "People, returns and history in one place.", href: "/clients" },
];

export default function Dashboard() {
  usePageTitle("Dashboard");
  const navigate = useNavigate();
  const { taxYear } = useTaxYear();
  const q = trpc.dashboard.summary.useQuery(taxYear ? { taxYear } : undefined, { enabled: !!taxYear });
  const d = q.data;
  const tour = useDemoTour();
  const [tipsHidden, hideTips] = useDismissed("admin-dashboard");

  if (!d || !taxYear) return <DashboardLoading />;

  return (
    <DashboardView
      summary={d}
      taxYear={taxYear}
      before={
        tour && !tipsHidden ? (
          <TryThis
            items={AGENT_TIPS}
            onDismiss={hideTips}
            renderLink={(item, className, children) => (
              <Link to={item.href} className={className}>
                {children}
              </Link>
            )}
          />
        ) : null
      }
      stageHref={(stage) => `/pipeline?stage=${stage}`}
      renderLink={(href, className, children) => (
        <Link to={href} className={className}>
          {children}
        </Link>
      )}
      healthAction={(h) => (h.count > 0 ? { label: h.key === "inbox" ? "Open" : "Review", onClick: () => navigate(h.link) } : undefined)}
    />
  );
}
