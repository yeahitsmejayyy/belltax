import { parseAsStringLiteral, useQueryState } from "nuqs";
import { AppToolbar } from "@/components/layout/app-toolbar";
import { trpc } from "@/lib/trpc";

const STAGES = ["invited", "intake", "documents", "ready", "preparing", "review", "filed", "complete"] as const;

// Proves the wiring end to end: typed tRPC query, URL state via nuqs. Unstyled until ticket 13.
export function Pipeline() {
  const [stage, setStage] = useQueryState("stage", parseAsStringLiteral(STAGES));
  const list = trpc.engagement.list.useQuery(stage ? { stage } : undefined);

  return (
    <>
      <AppToolbar breadcrumbs={[{ label: "Home", href: "/" }, { label: "Pipeline" }]} />
      <main className="flex-1 p-6">
        <h1>Pipeline {list.data?.taxYear ? `· tax year ${list.data.taxYear}` : ""}</h1>
        <p>
          <button type="button" onClick={() => setStage(null)}>
            All
          </button>{" "}
          {STAGES.map((s) => (
            <button type="button" key={s} onClick={() => setStage(s)} aria-pressed={stage === s}>
              {s} ({list.data?.counts[s] ?? 0})
            </button>
          ))}
        </p>
        {list.isLoading && <p>Loading…</p>}
        {list.error && <p>{list.error.message}</p>}
        {list.data && (
          <table>
            <thead>
              <tr>
                <th>Household</th>
                <th>Filers</th>
                <th>Stage</th>
                <th>Days in stage</th>
                <th>Open requests</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {list.data.rows.map((r) => (
                <tr key={r.engagementId}>
                  <td>
                    {r.householdName}
                    {r.kind === "amended" ? " (amended)" : ""}
                  </td>
                  <td>{r.filers.join(" & ")}</td>
                  <td>{r.stage}</td>
                  <td>{r.daysInStage}</td>
                  <td>{r.openRequests}</td>
                  <td>${(r.balanceCents / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
