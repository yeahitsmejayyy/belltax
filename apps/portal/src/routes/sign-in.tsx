import { useNavigate } from "react-router-dom";
import { setDemoUser } from "@app/ui/demo";
import { trpc } from "@/lib/trpc";

// Demo "sign in as…" a seeded client. Real sign-in (invite link, password) arrives with auth (ticket 05).
export function SignIn() {
  const navigate = useNavigate();
  const users = trpc.demo.users.useQuery(undefined, { retry: false });

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: 16 }}>
      <h1>Bell Tax Prep</h1>
      {users.isLoading && <p>Loading…</p>}
      {users.error && <p>Sign-in arrives with auth. There is no demo sign-in in live mode.</p>}
      {users.data && (
        <>
          <p>Demo mode: choose a client to sign in as. Every name here is invented.</p>
          <ul>
            {users.data.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDemoUser("portal", u.id);
                    navigate("/");
                  }}
                >
                  {u.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
