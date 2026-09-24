import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { NuqsAdapter } from "nuqs/adapters/react-router/v7";
import { BrowserRouter } from "react-router-dom";

import "@app/ui/tokens.css";
import App from "@/App";
import { trpc } from "@/lib/trpc";

const queryClient = new QueryClient();

// Same origin in every setup: Vite's dev proxy, or the portal listener serving this build.
const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/trpc" })] });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <NuqsAdapter>
            <App />
          </NuqsAdapter>
        </BrowserRouter>
      </QueryClientProvider>
    </trpc.Provider>
  </StrictMode>,
);
