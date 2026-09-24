import type { Database } from "bun:sqlite";
import { migrate } from "./migrate";

// Build the schema on a fresh database (demo boot, tests): every migration, in order.
// Foreign keys are off by default in SQLite, per connection; every connection must go through here
// or through connect() in open.ts.
export async function applySchema(db: Database) {
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
}
