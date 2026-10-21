import { sitePage } from "@/lib/page";
import Landing from "@/pages/landing";
import Splash from "@/pages/splash";

// One site, two pages (ticket 53): the landing page, or the splash page while the practice gets ready. Which one is
// a deploy setting (VITE_SITE_PAGE), and ?page=… previews the other (lib/page.ts).
export default function App() {
  return <div className="site-root min-h-svh bg-background text-foreground">{sitePage() === "splash" ? <Splash /> : <Landing />}</div>;
}
