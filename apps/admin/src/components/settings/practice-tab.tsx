import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PracticeSettings, type PracticeValues } from "@app/ui/components/admin-settings";

import { trpc } from "@/lib/trpc";

import { serverMessage } from "./server-error";

// Settings › Practice (admin 31-settings-settings-practice): the details clients see in the portal, emails and
// letters. The form is the design system's; this loads and saves it.
export function PracticeTab() {
  const q = trpc.settings.practice.get.useQuery();
  const utils = trpc.useUtils();
  const save = trpc.settings.practice.update.useMutation();
  const [error, setError] = React.useState<string | null>(null);

  const onSave = async (values: PracticeValues) => {
    try {
      await save.mutateAsync(values);
      await utils.invalidate();
      toast.success("Practice details saved");
    } catch (err) {
      setError(serverMessage(err));
    }
  };

  return (
    <PracticeSettings
      practice={q.data}
      loadError={q.error?.message}
      pending={save.isPending}
      error={error}
      onSave={(v) => void onSave(v)}
      onClearError={() => setError(null)}
      renderSeasonLink={(children) => <Link to="/season">{children}</Link>}
    />
  );
}
