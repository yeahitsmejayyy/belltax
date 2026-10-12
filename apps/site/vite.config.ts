import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { shareMeta } from "../../scripts/vite-share-meta";

// The marketing site: one static page. It reads the practice's public details and prices from the portal
// (pricing.public, practice.public) so they're never copied here. In dev, Vite proxies /trpc to the portal
// listener; a deployed site points VITE_PORTAL_ORIGIN at the portal instead.
const PORTAL = `http://127.0.0.1:${process.env.PORTAL_API_PORT ?? 3000}`;

export default defineConfig({
  plugins: [react(), tailwindcss(), shareMeta()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5175, strictPort: true, proxy: { "/trpc": PORTAL } },
});
