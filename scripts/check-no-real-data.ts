// The two-data-worlds rule, enforced by a machine: fail if anything tracked by git looks like real
// client data. Runs in CI on every push (bun run check:data locally). It can't prove data is fake;
// it catches the likely accidents: a database, a backup, an upload, a secrets file, a scanned PDF,
// or a Social Security number that could be real.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export type Finding = { file: string; why: string };

// Paths that should never be in the repository at all.
const PATH_RULES: [RegExp, string][] = [
  [/\.(db|db-wal|db-shm|sqlite|sqlite3)$/i, "a database file"],
  [/\.btpbak(\.partial)?$/i, "a backup file"],
  [/(^|\/)(data|live-data|uploads)\//, "a data or uploads folder"],
  [/(^|\/)\.env(\.(?!example$)[^/]+)?$/, "a secrets file (only .env.example belongs in git)"],
  [/\.(pdf|heic)$/i, "a document or phone photo (demo PDFs are generated, never committed)"],
];

// A full SSN in text. Area numbers 900–999 are never issued, which is why the demo uses them;
// anything else could belong to a real person.
const SSN = /\b(?!9)(\d{3})-(\d{2})-(\d{4})\b/g;
const TEXT = /\.(ts|tsx|js|mjs|json|md|sql|html|css|ya?ml|txt|csv)$/i;

export function checkPaths(files: string[]): Finding[] {
  const out: Finding[] = [];
  for (const file of files) {
    const hit = PATH_RULES.find(([re]) => re.test(file)); // one finding per file, the first reason
    if (hit) out.push({ file, why: hit[1] });
  }
  return out;
}

export function checkText(file: string, text: string): Finding[] {
  const out: Finding[] = [];
  for (const m of text.matchAll(SSN)) {
    const [area, group, serial] = [m[1]!, m[2]!, m[3]!];
    if (area === "000" || area === "666" || group === "00" || serial === "0000") continue; // never valid SSNs
    const line = text.slice(0, m.index).split("\n").length;
    out.push({ file: `${file}:${line}`, why: "something shaped like a real SSN (demo SSNs start with 9)" });
  }
  return out;
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, "..");
  const git = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: root });
  if (git.exitCode !== 0) throw new Error("git ls-files failed");
  const files = new TextDecoder().decode(git.stdout).split("\0").filter(Boolean);
  const findings = [
    ...checkPaths(files),
    ...files.filter((f) => TEXT.test(f) && f !== "bun.lock").flatMap((f) => checkText(f, readFileSync(resolve(root, f), "utf8"))),
  ];
  if (findings.length) {
    console.error("✖ The repository must never hold real client data (docs/two-data-worlds.md):");
    for (const f of findings) console.error(`  ${f.file}: ${f.why}`);
    process.exit(1);
  }
  console.log(`✔ no real-looking data in ${files.length} tracked files`);
}
