// Which page the site shows (ticket 53): the full landing page, or the splash page while the practice gets ready.
// Set per deploy with VITE_SITE_PAGE=splash|landing (default landing); ?page=splash|landing previews the other one
// without a redeploy. Anything else falls back to the default.

export type SitePage = "landing" | "splash";

const isPage = (v: unknown): v is SitePage => v === "landing" || v === "splash";

export function sitePage(search = typeof window === "undefined" ? "" : window.location.search, env = import.meta.env.VITE_SITE_PAGE as string | undefined): SitePage {
  const asked = new URLSearchParams(search).get("page");
  if (isPage(asked)) return asked;
  return isPage(env) ? env : "landing";
}
