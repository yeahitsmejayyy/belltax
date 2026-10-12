import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./config";
import { useRuntime } from "./db/client";
import { demoPdf } from "./db/seed/pdf";
import { ADMIN_MOUNT, withAdminMounted } from "./http";
import { DEMO_USER_HEADER } from "./identity";
import { PUBLIC_DEMO_UPLOADS_OFF } from "./rest/documents";
import { demoWorld, ORIGIN } from "./test-harness";

// The hosted public demo (ticket 15, docs/demo-deploy.md): one public port with the admin under /admin/,
// uploads refused, and none of it possible in live mode.

let w: Awaited<ReturnType<typeof demoWorld>>;
let site: ReturnType<typeof withAdminMounted>;
beforeAll(async () => {
  w = await demoWorld();
  site = withAdminMounted(w.portal, w.handler);
});
const asPublicDemo = (publicDemo = true, mode: "demo" | "live" = "demo") => useRuntime({ db: w.db, storage: w.storage, mode, publicDemo });
beforeEach(() => asPublicDemo());
afterAll(() => w.cleanup());

const query = (base: string, path: string, as?: string) => site(new Request(`${ORIGIN}${base}/trpc/${path}`, { headers: as ? { [DEMO_USER_HEADER]: as } : {} }));
const anyReturn = () => w.get<{ id: string }>("SELECT id FROM engagements WHERE tax_year = 2025 LIMIT 1").id;
const upload = (path: string, as: string) => {
  const form = new FormData();
  form.set("engagementId", anyReturn());
  form.set("kind", "other");
  form.set("file", new File([demoPdf(["x"])], "x.pdf"));
  return site(new Request(`${ORIGIN}${path}`, { method: "POST", headers: { [DEMO_USER_HEADER]: as, origin: ORIGIN }, body: form }));
};

describe("the admin mounted at /admin/", () => {
  test("preparer procedures answer under /admin, and stay 404 on the portal paths beside it", async () => {
    expect((await query(ADMIN_MOUNT, "engagement.list", w.preparerId)).status).toBe(200);
    expect((await query("", "engagement.list", w.preparerId)).status).toBe(404);
  });

  test("mutations get their body through the mount", async () => {
    const res = await site(
      new Request(`${ORIGIN}${ADMIN_MOUNT}/trpc/engagement.advanceStage`, {
        method: "POST",
        headers: { [DEMO_USER_HEADER]: w.preparerId, "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ engagementId: "not-a-uuid", to: "intake" }),
      }),
    );
    expect(res.status).toBe(400); // parsed and validated, so the body arrived
  });

  test("/admin redirects to /admin/, and a lookalike path is just the portal", async () => {
    const bare = await site(new Request(`${ORIGIN}${ADMIN_MOUNT}`));
    expect(bare.status).toBe(308);
    expect(bare.headers.get("location")).toBe(`${ADMIN_MOUNT}/`);
    expect((await query("/administrator", "engagement.list", w.preparerId)).status).not.toBe(200);
  });

  test("never in live mode: the mount answers 404 with no identity at all", async () => {
    asPublicDemo(true, "live");
    const res = await query(ADMIN_MOUNT, "engagement.list", w.preparerId);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("Not found");
  });
});

describe("the front door's tour", () => {
  const tour = async (surface: "portal" | "admin") => {
    const res = await (surface === "admin" ? w.handler : w.portal)(new Request(`${ORIGIN}/trpc/demo.tour`));
    return { status: res.status, body: (await res.json()) as { result?: { data: { publicDemo: boolean; client: { id: string; name: string } | null } } } };
  };

  test("names a client whose return shows a rejected document and an unsigned letter", async () => {
    const { status, body } = await tour("portal");
    expect(status).toBe(200);
    const t = body.result!.data;
    expect(t.publicDemo).toBe(true);
    const row = w.get<{ rejected: number; letter: string }>(
      `SELECT (SELECT COUNT(*) FROM documents d WHERE d.engagement_id = e.id AND d.status = 'rejected') AS rejected, l.status AS letter
         FROM users u JOIN return_people rp ON rp.person_id = u.person_id AND rp.role = 'primary'
         JOIN engagements e ON e.id = rp.engagement_id AND e.stage = 'documents'
         LEFT JOIN engagement_letters l ON l.id = e.letter_id WHERE u.id = ?`,
      t.client!.id,
    );
    expect(row.rejected).toBeGreaterThan(0);
    expect(row.letter).toBe("sent");
  });

  test("says when it isn't the public demo, and doesn't exist in live mode", async () => {
    asPublicDemo(false);
    expect((await tour("admin")).body.result!.data.publicDemo).toBe(false);
    asPublicDemo(true, "live");
    expect((await tour("portal")).status).toBe(404);
  });
});

describe("uploads in the public demo", () => {
  test("are refused on both surfaces before the file is read", async () => {
    const client = w.get<{ id: string }>("SELECT id FROM users WHERE role = 'client' LIMIT 1").id;
    const before = w.get<{ n: number }>("SELECT COUNT(*) AS n FROM documents").n;
    for (const [path, as] of [["/api/documents", client], [`${ADMIN_MOUNT}/api/documents`, w.preparerId]] as const) {
      const res = await upload(path, as);
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ error: PUBLIC_DEMO_UPLOADS_OFF });
    }
    expect(w.get<{ n: number }>("SELECT COUNT(*) AS n FROM documents").n).toBe(before);
  });

  test("still work in the local demo", async () => {
    asPublicDemo(false);
    const res = await upload(`${ADMIN_MOUNT}/api/documents`, w.preparerId);
    expect(res.status).not.toBe(403);
  });
});

describe("the deploy files", () => {
  const read = (p: string) => readFileSync(join(REPO_ROOT, p), "utf8");

  test("the image runs the public demo and nothing else", () => {
    const docker = read("Dockerfile");
    expect(docker).toMatch(/^ENV RUN_MODE=demo$/m);
    expect(docker).toMatch(/^ENV DEMO_PUBLIC=1$/m);
    expect(docker).not.toMatch(/RUN_MODE=live|LIVE_DATA_DIR/);
    expect(read("render.yaml").replace(/^\s*#.*$/gm, "")).not.toMatch(/RUN_MODE|LIVE_DATA_DIR|DEMO_PUBLIC/); // the image decides; the host can't override it here
  });

  test("nothing that could hold real data is copied into the image", () => {
    expect(existsSync(join(REPO_ROOT, ".dockerignore"))).toBe(true);
    const ignored = read(".dockerignore").split("\n").map((l) => l.trim());
    for (const p of ["data", "live-data", "uploads", ".env*", "**/*.db", "**/*.sqlite", ".assets", ".docs", "node_modules"]) expect(ignored).toContain(p);
  });
});
