import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { demoUser } from "@app/ui/demo";

import Login from "@/pages/login";
import { HeaderTitleProvider } from "@/shell/header-slots";
import { Shell } from "@/shell/shell";
import { TaxYearProvider } from "@/lib/tax-year";

// Each screen is its own chunk; the shell shows a skeleton while one loads.
const Activity = lazy(() => import("@/pages/activity"));
const Clients = lazy(() => import("@/pages/clients"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Household = lazy(() => import("@/pages/household"));
const Inbox = lazy(() => import("@/pages/inbox"));
const Invoices = lazy(() => import("@/pages/invoices"));
const Pipeline = lazy(() => import("@/pages/pipeline"));
const ReturnPage = lazy(() => import("@/pages/return/return-page"));
const Season = lazy(() => import("@/pages/season"));
const Settings = lazy(() => import("@/pages/settings"));

// Until auth (ticket 05), "signed in" means a demo identity cookie is set.
function RequireIdentity({ children }: { children: React.ReactNode }) {
  return demoUser("admin") ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireIdentity>
            <TaxYearProvider>
              <HeaderTitleProvider>
                <Shell />
              </HeaderTitleProvider>
            </TaxYearProvider>
          </RequireIdentity>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/returns/:id/:tab?" element={<ReturnPage />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:id" element={<Household />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings/:tab?" element={<Settings />} />
        <Route path="/season" element={<Season />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
