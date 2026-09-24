import { Navigate, Route, Routes } from "react-router-dom";
import { demoUser } from "@app/ui/demo";
import { Home } from "./routes/home";
import { SignIn } from "./routes/sign-in";

// Plain HTML until the design system lands (tickets 10–12). This proves the wiring only.
function RequireIdentity({ children }: { children: React.ReactNode }) {
  return demoUser("portal") ? children : <Navigate to="/sign-in" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignIn />} />
      <Route
        path="/"
        element={
          <RequireIdentity>
            <Home />
          </RequireIdentity>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
