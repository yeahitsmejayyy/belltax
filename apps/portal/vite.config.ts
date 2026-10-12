import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { shareMeta } from "../../scripts/vite-share-meta";

// The client portal. In dev, Vite proxies the API to the server's portal listener (PORT, 3000): the
// same listener a tunnel forwards in live mode, where preparer procedures don't exist. Built output is
// served by that listener from apps/portal/dist.
// Not PORT: launchers set PORT for Vite itself, which would point the proxy at its own port.
const PORTAL = `http://127.0.0.1:${process.env.PORTAL_API_PORT ?? 3000}`;

export default defineConfig({
  plugins: [react(), tailwindcss(), shareMeta()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173, strictPort: true, proxy: { "/trpc": PORTAL, "/api": PORTAL, "/health": PORTAL } },
});
