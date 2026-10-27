import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const snapshot = readdirSync("drizzle/meta")
  .filter((f) => f.endsWith("_snapshot.json"))
  .sort()
  .at(-1);
if (!snapshot) throw new Error("Generate the DB migration first.");
const tables = JSON.parse(
  readFileSync(`drizzle/meta/${snapshot}`, "utf8"),
).tables;
const schema = Object.fromEntries(
  Object.entries(tables).map(([name, t]) => [
    name,
    {
      fields: Object.values(t.columns).map((c) => ({
        name: c.name,
        type: c.type,
        required: c.notNull,
        primary_key: c.primaryKey,
        ...("default" in c ? { default: c.default } : {}),
      })),
      foreign_keys: Object.values(t.foreignKeys),
      indexes: Object.values(t.indexes),
      checks: Object.values(t.checkConstraints),
    },
  ]),
);
const path = "contracts/pds-schema-v3.json";
const rules = {
  version: "pds-schema-v3",
  database: "Cloudflare D1 / SQLite",
  schema_source: "db/schema.ts",
  migration_directory: "drizzle",
  date_rules: {
    calendar_dates: "YYYY-MM-DD; stored without timezone conversion",
    timestamps: "UTC ISO 8601; rendered in Asia/Seoul",
    today: "Asia/Seoul calendar date",
    duration_unit: "integer minute",
    timer_rounding:
      "ceil(elapsedMilliseconds / 60000), minimum 1; manual corrections allowed",
    manual_duration:
      "positive integer; may differ from elapsed wall-clock time",
  },
  query_rules: {
    period: "task due_date, inclusive from/to; default selected plan period",
    deleted: "soft-deleted tasks and their execution minutes excluded",
    planned: "count of non-deleted tasks, not plan documents",
    completed: "currently done tasks",
    delayed: "todo tasks whose due_date < Seoul today",
    blocked:
      "distinct tasks with at least one nonblank execution blocked_reason",
    estimated: "sum scoped tasks estimated_minutes",
    actual:
      "sum all execution actual_minutes for scoped tasks regardless of execution date",
    difference: "actual - estimated",
    empty: "zero for all metrics",
    sort_tie: "created_at ascending, then id ascending",
  },
  preservation: {
    plan: "plan ID stable; every version including initial version in plan_revisions",
    execution: "separate rows, never overwrite plan baseline",
    completion:
      "unique(task_id, cycle); reopening increments cycle; commands ensure replay safety; batch transaction",
    timer: "server persisted; deletion preserves timer for undo",
    review:
      "period and improvement persisted; next_plan_id links to new plan; copied tasks are todo with no execution history",
  },
  export: {
    format: "single JSON",
    includes: [
      "plans",
      "revisions",
      "tasks including deleted",
      "executions",
      "timers",
      "reviews",
      "completions",
      "timezone",
      "duration_unit",
      "exported_at",
      "version",
    ],
    excludes: ["commands", "runtime secrets"],
  },
  tables: schema,
};
if (process.argv.includes("--write")) {
  writeFileSync(path, JSON.stringify(rules, null, 2) + "\n");
  console.log("Wrote schema contract.");
} else {
  const current = JSON.parse(readFileSync(path, "utf8"));
  assert.deepEqual(current.tables, schema);
  assert.deepEqual(current.date_rules, rules.date_rules);
  assert.deepEqual(current.query_rules, rules.query_rules);
  console.log(
    "Schema contract matches generated migration snapshot and rules.",
  );
}
