import { useNavigate } from "react-router-dom";
import { setDemoUser } from "@app/ui/demo";
import { trpc } from "@/lib/trpc";

// Demo "sign in as…". Plain on purpose: the real sign-in screen arrives with auth (ticket 05) and
// its look with the design system (tickets 10–13).
export default function Login() {
  const navigate = useNavigate();
  const users = trpc.demo.users.useQuery(undefined, { retry: false });

  return (
    <main style={{ maxWidth: 480, margin: "10vh auto", padding: 16 }}>
      <h1>Bell Tax Prep · admin</h1>
      {users.isLoading && <p>Loading…</p>}
      {users.error && <p>Sign-in arrives with auth. There is no demo sign-in in live mode.</p>}
      {users.data && (
        <>
          <p>Demo mode: choose who to sign in as. Everything here is invented.</p>
          <ul>
            {users.data.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => {
                    setDemoUser("admin", u.id);
                    navigate("/pipeline");
                  }}
                >
                  {u.label} ({u.email})
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
