import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

import "@app/ui/tokens.css";
import "@/index.css";
import App from "@/App";
import { trpc } from "@/lib/trpc";

const queryClient = new QueryClient();

// Same origin in every setup: Vite's dev proxy, or the admin listener serving this build.
// The demo identity rides along as a cookie.
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/trpc" })] });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="dark" storageKey="btp-admin-theme">
          <BrowserRouter>
            <NuqsAdapter>
              <App />
              <Toaster richColors={false} position="top-center" />
            </NuqsAdapter>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
