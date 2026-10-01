import { Skeleton } from "@app/ui/components/skeleton";

import { ContactCard } from "@/components/settings/contact-card";
import { RemindersCard } from "@/components/settings/reminders-card";
import { AppearanceCard, SignInCard } from "@/components/settings/sign-in-card";
import { usePageTitle } from "@/lib/return";
import { trpc } from "@/lib/trpc";

// Settings (portal 21-documents-letter-and-invoice-settings): contact details, reminders, sign-in, theme.

export default function Settings() {
  usePageTitle("Settings");
  const me = trpc.me.get.useQuery(undefined, { staleTime: 60_000 });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity });
  const preparer = practice.data?.preparerName.trim().split(/\s+/)[0] ?? "your preparer";

  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-1 animate-page gap-6">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">How {preparer} reaches you, and how you sign in.</p>
      </header>
      {me.data && practice.data ? (
        <>
          <ContactCard key={`${me.data.email}|${me.data.phone}`} me={me.data} preparer={preparer} />
          <RemindersCard me={me.data} />
          <SignInCard signIn={me.data.signIn} />
          <AppearanceCard />
        </>
      ) : (
        <div className="grid gap-6" aria-busy="true" aria-label="Loading your settings">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      )}
    </div>
  );
}
