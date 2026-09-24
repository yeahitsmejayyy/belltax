import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

// Where uploaded file bytes live. The database only ever holds the key.
// Demo: <repo>/data/demo/uploads (gitignored). Live: <LIVE_DATA_DIR>/uploads, outside the repo.
// config.ts decides the root; this module only refuses keys that could escape it.

const KEY = /^uploads\/[0-9a-f-]{36}\.[a-z0-9]{1,5}$/;

export type Storage = ReturnType<typeof createStorage>;

export function createStorage(root: string) {
  const pathFor = (key: string) => {
    if (!KEY.test(key)) throw new Error(`invalid storage key: ${key}`);
    return join(root, key);
  };
  return {
    keyFor: (id: string, ext: string) => `uploads/${id}.${ext}`,
    put(key: string, bytes: Uint8Array) {
      const path = pathFor(key);
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
      writeFileSync(path, bytes, { mode: 0o600 });
    },
    get: (key: string) => new Uint8Array(readFileSync(pathFor(key))),
    remove: (key: string) => rmSync(pathFor(key), { force: true }),
  };
}
