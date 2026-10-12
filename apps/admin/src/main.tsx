import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@app/ui/components/theme-provider";
import { Toaster } from "@app/ui/components/sonner";
import { clearDemoUser } from "@app/ui/demo";

import "@app/ui/tokens.css";
import "@/index.css";
import App from "@/App";
import { trpc } from "@/lib/trpc";
import { BASE, at } from "@/lib/base";

// Signed out under us (a remembered demo identity that no longer exists after a re-seed; later, an expired
// session): forget it and go back to sign in.
const signedOut = (error: unknown) => {
  if ((error as { data?: { code?: string } })?.data?.code !== "UNAUTHORIZED" || location.pathname === at("/login")) return;
  clearDemoUser("admin");
  location.assign(at("/login"));
};
const queryClient = new QueryClient({ queryCache: new QueryCache({ onError: signedOut }), mutationCache: new MutationCache({ onError: signedOut }) });

// Same origin in every setup: Vite's dev proxy, or the admin listener serving this build.
// The demo identity rides along as a cookie.
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: at("/trpc") })] });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="system" storageKey="btp-admin-theme">
          <BrowserRouter basename={BASE}>
            <NuqsAdapter>
              <App />
              <Toaster />
            </NuqsAdapter>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
