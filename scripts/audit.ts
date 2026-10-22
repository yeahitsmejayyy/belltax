// The dependency audit CI trusts: fail on any high or critical vulnerability in an installed package, and never
// mistake "the advisory service didn't answer" for either a pass or a finding.
//
//   1. `bun audit --audit-level=high` (npm's advisory service), retried when the service doesn't answer.
//   2. If npm's service stays down, the same packages (every name@version in bun.lock) against OSV (osv.dev, Google
//      and the OpenSSF), which carries the same GitHub advisories with their severity.
//   3. If neither answers, fail and say so: an audit nobody could run isn't a pass.
//
// Exit 0: clean. Exit 1: vulnerable, or couldn't check. `bun run audit`; CI runs it on every push.

const LOCK = new URL("../bun.lock", import.meta.url);
const NETWORK = /audit request failed|Timeout|ConnectionClosed|ECONNRESET|ENOTFOUND|EAI_AGAIN|fetch failed|socket/i;
const RETRIES = [0, 10_000, 20_000]; // waits before each npm attempt
const ATTEMPT_MS = 60_000;
const BLOCKING = new Set(["HIGH", "CRITICAL"]);

type Outcome = { kind: "clean" } | { kind: "vulnerable"; report: string } | { kind: "unreachable"; detail: string };

async function npmAudit(): Promise<Outcome> {
  let last = "";
  for (const wait of RETRIES) {
    if (wait) {
      console.log(`npm's advisory service didn't answer; trying again in ${wait / 1000}s.`);
      await Bun.sleep(wait);
    }
    const p = Bun.spawn(["bun", "audit", "--audit-level=high"], { stdout: "pipe", stderr: "pipe" });
    // npm's service can hang for minutes before giving up; a minute is plenty for an answer.
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      p.kill();
    }, ATTEMPT_MS);
    const out = (await new Response(p.stdout).text()) + (await new Response(p.stderr).text());
    const code = await p.exited;
    clearTimeout(timer);
    if (timedOut) {
      last = `no answer in ${ATTEMPT_MS / 1000}s`;
      continue;
    }
    if (code === 0) return { kind: "clean" };
    if (/vulnerabilit/i.test(out) && !NETWORK.test(out)) return { kind: "vulnerable", report: out };
    last = out.trim().split("\n").slice(-2).join(" ");
  }
  return { kind: "unreachable", detail: last };
}

/** Every installed npm package as name@version, from bun.lock (workspaces and git/file sources skipped). */
export function lockedPackages(lock: string) {
  const found = new Map<string, { name: string; version: string }>();
  for (const m of lock.matchAll(/^\s+"[^"]+": \["((?:@[^@"/]+\/)?[^@"]+)@([^"]+)"/gm)) {
    const [, name, version] = m;
    if (!name || !version || /^(workspace|file|link|git|github|https?):/.test(version)) continue;
    found.set(`${name}@${version}`, { name, version });
  }
  return [...found.values()];
}

type OsvVuln = { id: string; summary?: string; aliases?: string[]; database_specific?: { severity?: string } };

export async function osvAudit(lock?: string): Promise<Outcome> {
  const pkgs = lockedPackages(lock ?? (await Bun.file(LOCK).text()));
  const hits = new Map<string, Set<string>>(); // advisory id → name@version
  try {
    for (let i = 0; i < pkgs.length; i += 500) {
      const batch = pkgs.slice(i, i + 500);
      const res = await fetch("https://api.osv.dev/v1/querybatch", {
        method: "POST",
        body: JSON.stringify({ queries: batch.map((p) => ({ package: { name: p.name, ecosystem: "npm" }, version: p.version })) }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) return { kind: "unreachable", detail: `OSV answered ${res.status}` };
      const body = (await res.json()) as { results: { vulns?: { id: string }[] }[] };
      body.results.forEach((r, j) => {
        for (const v of r.vulns ?? []) hits.set(v.id, (hits.get(v.id) ?? new Set()).add(`${batch[j]!.name}@${batch[j]!.version}`));
      });
    }
    const blocking: string[] = [];
    for (const [id, where] of hits) {
      const res = await fetch(`https://api.osv.dev/v1/vulns/${id}`, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) return { kind: "unreachable", detail: `OSV answered ${res.status} for ${id}` };
      const v = (await res.json()) as OsvVuln;
      const severity = v.database_specific?.severity?.toUpperCase();
      // An advisory without a GitHub severity can't be ranked; count it, rather than let it slip through.
      if (!severity || BLOCKING.has(severity)) blocking.push(`${severity ?? "UNRATED"}: ${id} ${v.summary ?? ""}\n  in ${[...where].join(", ")}`);
    }
    return blocking.length ? { kind: "vulnerable", report: blocking.join("\n") } : { kind: "clean" };
  } catch (e) {
    return { kind: "unreachable", detail: `OSV: ${(e as Error).message}` };
  }
}

if (import.meta.main) {
  const npm = await npmAudit();
  if (npm.kind === "clean") {
    console.log("✔ no high or critical vulnerabilities (npm's advisory service)");
    process.exit(0);
  }
  if (npm.kind === "vulnerable") {
    console.error(npm.report);
    process.exit(1);
  }
  console.log(`npm's advisory service is unreachable (${npm.detail}). Checking the same packages against OSV instead.`);
  const osv = await osvAudit();
  if (osv.kind === "clean") {
    console.log(`✔ no high or critical vulnerabilities (OSV, ${lockedPackages(await Bun.file(LOCK).text()).length} packages from bun.lock)`);
    process.exit(0);
  }
  if (osv.kind === "vulnerable") {
    console.error(`✘ high or critical vulnerabilities (OSV):\n${osv.report}`);
    process.exit(1);
  }
  console.error(`✘ couldn't run the audit: npm (${npm.detail}) and OSV (${osv.detail}) are both unreachable. Re-run when either is back.`);
  process.exit(1);
}
