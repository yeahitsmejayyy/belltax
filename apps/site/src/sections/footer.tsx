import { Logo } from "@app/ui/components/logo";

import { portalUrl, useNames, usePublic } from "@/lib/public";

// The footer (marketing 12): who and where, then the three links a client looks for.

export function Footer() {
  const { preparer, city, state, email, practice } = useNames();
  const loaded = usePublic().practice !== null;
  const place = [city, state].filter(Boolean).join(", ");
  const link = "inline-flex min-h-11 items-center rounded-sm hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";
  return (
    <footer className="border-t pb-20 md:pb-0">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted-foreground md:px-6 md:py-8">
        <Logo className="text-foreground" />
        <span>
          {loaded ? preparer : practice}
          {place ? <> · {place}</> : null}
        </span>
        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-6 md:ml-auto">
          <a href={portalUrl("/sign-in")} className={link}>
            Client sign in
          </a>
          <a href="#faq" className={link}>
            FAQ
          </a>
          {email ? (
            <a href={`mailto:${email}`} className={link}>
              {email}
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
