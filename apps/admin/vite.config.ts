import path from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The preparer admin. In dev, Vite proxies the API to the server's admin listener (ADMIN_PORT, 3001),
// so the browser sees one origin and the demo identity cookie just works. Built output is served by
// that same listener from apps/admin/dist.
const ADMIN = `http://127.0.0.1:${process.env.ADMIN_PORT ?? 3001}`;

// Built at "/" for the admin listener; the hosted public demo builds with ADMIN_BASE=/admin/ and mounts it
// there on its one port (apps/server/src/http.ts withAdminMounted, docs/demo-deploy.md).
const base = process.env.ADMIN_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  server: { port: 5174, strictPort: true, proxy: { "/trpc": ADMIN, "/api": ADMIN, "/health": ADMIN } },
});
