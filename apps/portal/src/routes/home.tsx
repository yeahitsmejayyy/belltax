import { parseAsInteger, useQueryState } from "nuqs";
import { useNavigate } from "react-router-dom";
import { clearDemoUser } from "@app/ui/demo";
import { trpc } from "@/lib/trpc";

// The client's returns, filtered by tax year through the URL (nuqs). Unstyled until ticket 12.
export function Home() {
  const navigate = useNavigate();
  const [year, setYear] = useQueryState("year", parseAsInteger);
  const mine = trpc.engagement.mine.useQuery();
  const years = [...new Set(mine.data?.map((r) => r.taxYear))];
  const shown = mine.data?.filter((r) => !year || r.taxYear === year) ?? [];

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <h1>Your returns</h1>
      <p>
        <button type="button" onClick={() => setYear(null)} aria-pressed={!year}>
          All years
        </button>{" "}
        {years.map((y) => (
          <button type="button" key={y} onClick={() => setYear(y)} aria-pressed={year === y}>
            {y}
          </button>
        ))}
      </p>
      {mine.isLoading && <p>Loading…</p>}
      {mine.error && <p>{mine.error.message}</p>}
      <ul>
        {shown.map((r) => (
          <li key={r.engagementId}>
            <strong>
              Tax year {r.taxYear}
              {r.kind === "amended" ? " (amended)" : ""}
            </strong>{" "}
            · {r.householdName} · stage: {r.stage} · {r.openRequests} thing(s) we need from you · balance ${(r.balanceCents / 100).toFixed(2)}
          </li>
        ))}
      </ul>
      <p>
        <button
          type="button"
          onClick={() => {
            clearDemoUser("portal");
            navigate("/sign-in");
          }}
        >
          Sign out
        </button>
      </p>
    </main>
  );
}
