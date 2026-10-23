import type { ReminderPref } from "@app/schema";
import * as React from "react";
import { toast } from "sonner";

import { AppearanceCard, ContactCard, RemindersCard, SettingsPage, SignInCard, type ContactValues } from "@app/ui/components/client-settings";

import { auth } from "@/lib/auth";
import { usePageTitle } from "@/lib/return";
import { trpc, type RouterOutputs } from "@/lib/trpc";

// Settings (portal 21-documents-letter-and-invoice-settings): contact details, reminders, sign-in, theme. The cards are
// the design system's (client-settings); this page fetches, saves and toasts.

type Me = RouterOutputs["me"]["get"];

export default function Settings() {
  usePageTitle("Settings");
  const me = trpc.me.get.useQuery(undefined, { staleTime: 60_000 });
  const practice = trpc.practice.public.useQuery(undefined, { staleTime: Infinity });
  const preparer = practice.data?.preparerName.trim().split(/\s+/)[0] ?? "your preparer";

  return (
    <SettingsPage description={`How ${preparer} reaches you, and how you sign in.`} loading={!(me.data && practice.data)}>
      {me.data ? (
        <>
          <Contact key={`${me.data.email}|${me.data.phone}`} me={me.data} preparer={preparer} />
          <Reminders me={me.data} />
          <SignIn signIn={me.data.signIn} />
          <AppearanceCard />
        </>
      ) : null}
    </SettingsPage>
  );
}

function Contact({ me, preparer }: { me: Me; preparer: string }) {
  const utils = trpc.useUtils();
  const [taken, setTaken] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<ContactValues>();

  const save = trpc.me.updateContact.useMutation({
    onSuccess: (next) => {
      utils.me.get.setData(undefined, next);
      setSaved({ email: next.email, phone: next.phone ?? "" });
      toast.success("Saved");
    },
    onError: (e) => {
      if (e.data?.code === "CONFLICT") setTaken(e.message);
      else setFailed(e.message);
    },
  });

  return (
    <ContactCard
      name={me.name}
      email={me.email}
      phone={me.phone}
      preparer={preparer}
      pending={save.isPending}
      error={failed}
      emailError={taken}
      saved={saved}
      onSave={(values) => save.mutate(values)}
      onClearError={(which) => (which === "email" ? setTaken(null) : setFailed(null))}
    />
  );
}

function Reminders({ me }: { me: Me }) {
  const utils = trpc.useUtils();
  const [prefs, setPrefs] = React.useState<ReminderPref[]>(me.reminders);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setPrefs(me.reminders), [me.reminders]);

  const save = trpc.me.setReminders.useMutation({
    onSuccess: (next) => {
      utils.me.get.setData(undefined, next);
      toast.success("Reminders saved");
    },
    onError: (e) => {
      setPrefs(me.reminders);
      setError(e.message);
    },
  });

  return (
    <RemindersCard
      reminders={prefs}
      canText={!!me.phone}
      pending={save.isPending}
      error={error}
      onChange={(next) => {
        setPrefs(next);
        setError(null);
        save.mutate({ reminders: next });
      }}
    />
  );
}

function SignIn({ signIn }: { signIn: Me["signIn"] }) {
  const methods = trpc.mfa.methods.useQuery();
  const utils = trpc.useUtils();
  const remove = trpc.mfa.removePasskey.useMutation();
  return (
    <SignInCard
      methods={methods.data}
      demo={signIn.method === "demo"}
      activeSince={signIn.activatedAt}
      canAddPasskey={auth.passkeysSupported()}
      onAddPasskey={async () => {
        await auth.addPasskey();
        await utils.mfa.methods.invalidate();
      }}
      onRemovePasskey={async (passkeyId) => {
        await remove.mutateAsync({ passkeyId });
        await utils.mfa.methods.invalidate();
      }}
    />
  );
}
