# Performance: the scale check

The demo has 25 households. A busy practice might reach a few hundred; this checks that nothing breaks
long before that. Budget: **every hot path under 100 ms** (median of 7 runs after a warm-up) on a laptop
(Apple silicon, Bun 1.3.14).

## How to run it

```bash
bun run bench:seed        # data/bench/: 80 copies of the demo ≈ 2,000 households (demo data only, never live)
bun run bench             # time the hot paths; exits 1 if any is over budget
bun run bench:seed 400    # 10,000 households, to see where the headroom ends
```

The bench world is the seeded demo, cloned with fresh ids, so every row passed the same gates once. On top:
each return without one gets last year's completed return (same people, the sources open then), so the
returning-client checklist has real work, and every return gets six `engagement.viewed` events. It keeps
document rows but no files, and doesn't run `ANALYZE` (a live database never does, so the planner here sees
what it sees there).

| World | Households | Returns | Documents | Requests | Invoices | Events |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `bench:seed` | 2,000 | 4,400 | 6,960 | 6,160 | 1,280 | 55,680 |
| `bench:seed 400` | 10,000 | 22,000 | 34,800 | 30,800 | 6,400 | 278,400 |

Timings go through the whole stack: Request in, JSON out, through tRPC, zod, access checks and the views.
The CI version (`src/bench/bench.test.ts`, part of `bun test`) builds 200 households and holds every path
under 250 ms. The budget is loose so a slow runner can't make it flaky; what it catches is a query gone linear.

## Results (median ms)

| Hot path | What | 2,000 before | 2,000 after | 10,000 before | 10,000 after |
| --- | --- | ---: | ---: | ---: | ---: |
| `engagement.list` | the pipeline: every return in the year | 12.3 | 12.7 | 98.9 | 99.2 |
| `engagement.detail` | the busiest return | 2.1 | **0.4** | 21.6 | **0.4** |
| `inbox.list` | the triage queue | 8.1 | 9.4 | 61.8 | 62.7 |
| `activity.list` | first page / deep page / views hidden | 0.4 / 0.4 / 0.3 | 0.3 / 0.4 / 0.3 | 1.1 / 1.4 / 1.1 | 1.2 / 1.5 / 1.2 |
| `household.list` | Clients, by last activity | 7.4 | 6.6 | 40.2 | 41.2 |
| `engagement.mine` | a client's home (via `client_access`) | 0.1 | 0.1 | 0.1 | 0.1 |
| `client_access` | one (user, return) check | 0.0 | 0.0 | 0.0 | 0.0 |
| `expected_documents` | a returning client's checklist | 0.0 | 0.0 | 0.0 | 0.0 |
| `invoice_balances` | every issued invoice's balance | 2.4 | 2.3 | 12.1 | 12.5 |
| `invoice.list` | one return's invoices | 0.1 | 0.1 | 0.1 | 0.1 |

At 2,000 households every path is under 13 ms, about 8× inside the budget. Differences under a millisecond or so
between runs are noise.

## What was fixed

**`engagement.detail` grew with the practice, not the return.** A return's detail shouldn't care how many other
households exist, yet it took 2.1 ms at 2,000 and 21.6 ms at 10,000. Timing its parts showed 18 ms in
`listRequests`, which finds each request's latest upload:

```
EXPLAIN QUERY PLAN SELECT … FROM documents d … WHERE d.request_id = ? AND d.purged_at IS NULL ORDER BY d.created_at DESC …
|--SCAN d                                   ← every document, once per request
|--SEARCH k USING COVERING INDEX sqlite_autoindex_document_kinds_1 (code=?)
`--USE TEMP B-TREE FOR ORDER BY
```

Nothing indexed `documents.request_id`. Migration **005** adds `documents_request (request_id, created_at)`:

```
|--SEARCH d USING INDEX documents_request (request_id=?)
```

The upload endpoint's "supersede the rejected copy" lookup filters on the same column and gets the same fix.

**Person-level documents were found by scanning.** `listDocuments` asked for "this return's documents, or a
person-level one (a photo ID) belonging to someone on it" as one `OR`. SQLite answered the second half by
walking every document with no return (`documents_engagement (engagement_id=?)` with NULL) and filtering by
person, so it grew with the number of households. It's now a `UNION ALL` of two halves. The second starts from
the return's people, and a unary `+` keeps the planner off the NULL-engagement index:

```
`--MERGE (UNION ALL)
   |--LEFT   SEARCH d USING INDEX documents_engagement (engagement_id=?)
   `--RIGHT  SEARCH rp USING COVERING INDEX sqlite_autoindex_return_people_1 (engagement_id=?)
             SEARCH d USING INDEX documents_person (person_id=?)
```

A partial index (`WHERE engagement_id IS NULL`) was tried first. Without `ANALYZE` the planner ignored it, so the
query was rewritten instead. The CI test checks both plans against the routes' own SQL (`LATEST_DOCUMENT_SQL`,
`LIST_DOCUMENTS_SQL`), and fails if migration 005 is removed.

## Already fine, and why

- **`client_access`, `expected_documents`, `invoice_balances`**: every correlated subquery in the views
  reaches its rows through an index (`return_people` primary key, `return_sources`, `invoice_lines_invoice`,
  `payments_invoice`). They cost the same per row at any size.
- **`activity.list`**: pages on `(occurred_at, id)` using `events_time`, so a deep page costs the same as the
  first. Hiding views is a filter on the same walk.
- **`pipeline_rows`**: the year comes from `engagements_pipeline (tax_year)`, and each per-row subquery (filers,
  open requests, balance) is an index search. Nothing in it scans.

## Where the headroom ends

`engagement.list`, `inbox.list` and `household.list` return everything in one response, so they grow with what they
return, not with bad plans. At 2,000 households the pipeline SQL takes 6 ms of its 12.7; the rest is turning
2,160 rows into JSON. At 10,000 households (11,000 returns in a year) the pipeline sits right at the budget.
That is well past this practice. If it ever gets close, page the pipeline by stage and the Clients list by
cursor, like `activity.list` already is. No index would help.

## Added since

| Hot path | What | 2,000 households |
| --- | --- | ---: |
| `dashboard.summary` (ticket 38) | every KPI, chart and health check | 33.9 |
| `dashboard.badges` (ticket 38) | the sidebar counts, called on every page | 8.8 |
| `invoice.all`, first page (ticket 39) | the Invoices screen, problems first | 7.3 |
| `search.query`, a surname (ticket 41) | ⌘K across every group | 6.2 |
| `search.query`, "2025" (ticket 41) | ⌘K matching thousands of returns | 5.7 |
| `search.query`, nothing typed (ticket 41) | ⌘K's recent returns | 7.5 |

**Search needs no index.** Word-prefix `LIKE` over the tables is ~30 ms at 10,000 households (the most expensive
query, recent returns, 36 ms), so an FTS5 table and the triggers to keep it in sync would add machinery without a need.
Revisit if the practice ever passes 10,000 households.

**The next ceiling, at 10,000 households:** `engagement.list` (107 ms) and `dashboard.summary` (192 ms) go over budget.
Both are whole-year aggregates. That's five times this practice's target size; the remedy then is paging the pipeline
by stage and caching the dashboard's weekly filings, not indexes.

`dashboard.badges` builds the whole inbox to count it, so it moves with `inbox.list`. If it ever matters, give the
inbox a count-only path; today it's well inside the budget.
