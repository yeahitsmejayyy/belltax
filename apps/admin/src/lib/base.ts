// Where this build is served from: "" at the admin listener's root, "/admin" when the hosted public demo
// mounts it on its one port (vite.config.ts ADMIN_BASE). Every absolute URL the admin makes goes through at().
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
export const at = (path: string) => `${BASE}${path}`;
