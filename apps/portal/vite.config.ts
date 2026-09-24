import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The client portal. In dev, Vite proxies the API to the server's portal listener (PORT, 3000): the
// same listener a tunnel forwards in live mode, where preparer procedures don't exist. Built output is
// served by that listener from apps/portal/dist.
const PORTAL = `http://127.0.0.1:${process.env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5173, strictPort: true, proxy: { "/trpc": PORTAL, "/api": PORTAL, "/health": PORTAL } },
});
