import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import Invite from "@/pages/invite";
import SignIn from "@/pages/sign-in";
import { trpc } from "@/lib/trpc";
import { ReturnProvider } from "@/lib/return";
import { Shell } from "@/shell/shell";

// Each screen is its own chunk; the shell shows a skeleton while one loads.
const Home = lazy(() => import("@/pages/home"));
const Questions = lazy(() => import("@/pages/questions"));
const Documents = lazy(() => import("@/pages/documents"));
const Letter = lazy(() => import("@/pages/letter"));
const Invoice = lazy(() => import("@/pages/invoice"));
const Settings = lazy(() => import("@/pages/settings"));

// Signed in means the server knows which client this is: a session (ticket 05), or the demo identity in demo mode.
function RequireIdentity({ children }: { children: React.ReactNode }) {
  const state = trpc.auth.state.useQuery(undefined, { staleTime: 30_000 });
  if (state.isLoading) return null;
  return state.data?.user?.role === "client" ? children : <Navigate to="/sign-in" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/invite/:token" element={<Invite />} />
      <Route
        element={
          <RequireIdentity>
            <ReturnProvider>
              <Shell />
            </ReturnProvider>
          </RequireIdentity>
        }
      >
        <Route index element={<Home />} />
        <Route path="/questions" element={<Questions />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/letter" element={<Letter />} />
        <Route path="/invoice" element={<Invoice />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
