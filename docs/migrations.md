# Migrations

The schema lives in numbered SQL files in `apps/server/src/db/migrations/`:
`001-baseline.sql`, `002-something.sql`, … A fresh database (demo, tests) is built by running all of them in
order. The live database is moved forward by running only the new ones.

## Rules

1. **Never edit a migration that a live database has applied.** The runner stores a checksum of every applied
   file and refuses to start if one changed. Fix mistakes with a new migration.
2. **Numbers are contiguous:** 001, 002, 003. No gaps, no duplicates, names in lowercase-kebab.
3. **One migration = one transaction.** If any statement fails, the whole file rolls back and nothing is recorded.
4. **Live never migrates on boot.** If the live database is behind the code, the server refuses to start and says
   so. Back up first (ticket 18), then:

   ```bash
   RUN_MODE=live LIVE_DATA_DIR=/path/outside/repo bun run migrate --status
   RUN_MODE=live LIVE_DATA_DIR=/path/outside/repo bun run migrate
   ```

   Demo mode wipes and re-migrates on every boot, so there's nothing to run.
5. **Keep zod in step.** A migration that changes columns or enums must change `packages/schema` in the same
   commit. The drift tests in `schema.test.ts` fail until they agree.

## Adding a column, table, index or view

Plain SQL. `ALTER TABLE … ADD COLUMN` works for nullable columns and columns with a constant default.

```sql
-- 002-add-person-preferred-name.sql
ALTER TABLE people ADD COLUMN preferred_name TEXT;
```

## Changing a CHECK, a NOT NULL, a foreign key or a column type: rebuild the table

SQLite can't alter constraints in place. Rebuild the table using SQLite's documented
[12-step procedure](https://www.sqlite.org/lang_altertable.html#otheralter). Mark the file so the runner turns
foreign keys off around it. The runner then checks `PRAGMA foreign_key_check` before committing and rolls back
if anything is left dangling.

```sql
-- migrate: foreign-keys-off
-- 00N-payments-allow-card.sql: allow 'card' as a manual payment method.

-- 1. Views that read the table (directly or through another view) block the rename; drop them first.
DROP VIEW IF EXISTS pipeline_rows;
DROP VIEW IF EXISTS invoice_balances;

-- 2. The new table: the full definition from the latest migration, with the change applied.
CREATE TABLE payments_new ( … method TEXT CHECK (method IN ('cash', 'check', 'zelle', 'card', 'other')), … ) STRICT;

-- 3. Copy every row, naming columns explicitly.
INSERT INTO payments_new (id, invoice_id, …) SELECT id, invoice_id, … FROM payments;

-- 4. Swap.
DROP TABLE payments;
ALTER TABLE payments_new RENAME TO payments;

-- 5. Recreate what DROP TABLE removed: indexes and triggers on the table, then the views from step 1.
CREATE INDEX payments_invoice ON payments (invoice_id, status);
CREATE TRIGGER payments_only_on_issued_invoices … ;
CREATE VIEW invoice_balances AS … ;
CREATE VIEW pipeline_rows AS … ;
```

Find everything that depends on the table before writing step 5:

```sql
SELECT type, name FROM sqlite_master WHERE tbl_name = 'payments' AND type IN ('index', 'trigger');
SELECT name FROM sqlite_master WHERE type = 'view' AND sql LIKE '%payments%';
```

`migrations.test.ts` runs exactly this rebuild against a fully seeded demo database. It checks that every row
survives and every constraint, trigger and view still works, so use it as the worked example.
