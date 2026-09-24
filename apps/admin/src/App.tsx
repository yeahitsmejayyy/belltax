import { Navigate, Route, Routes } from "react-router-dom";
import { demoUser } from "@app/ui/demo";
import { AppLayout } from "./components/layout/app-layout";
import { Dashboard } from "./routes/dashboard";
import Login from "./routes/login";
import { Pipeline } from "./routes/pipeline";
import { Settings } from "./routes/settings";

// Until auth (ticket 05), "signed in" means a demo identity cookie is set.
function RequireIdentity({ children }: { children: React.ReactNode }) {
  return demoUser("admin") ? children : <Navigate to="/login" replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/pipeline" replace />} />
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireIdentity>
            <AppLayout />
          </RequireIdentity>
        }
      >
        <Route path="/pipeline" element={<Pipeline />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/pipeline" replace />} />
    </Routes>
  );
}

export default App;
