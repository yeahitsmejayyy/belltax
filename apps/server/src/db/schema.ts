import type { Database } from "bun:sqlite";

const SCHEMA_PATH = new URL("./schema.sql", import.meta.url);

// Foreign keys are off by default in SQLite, per connection. Every connection must go through here.
export async function applySchema(db: Database) {
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(await Bun.file(SCHEMA_PATH).text());
}
