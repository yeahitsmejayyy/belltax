import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@app/ui/components/theme-provider";

import "@app/ui/tokens.css";
import "@/index.css";
import App from "@/App";
import { PublicProvider } from "@/lib/public";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="btp-site-theme">
      <PublicProvider>
        <App />
      </PublicProvider>
    </ThemeProvider>
  </StrictMode>,
);
