import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
export const experiments = sqliteTable("experiments", {
  id: text().primaryKey(),
  user_id: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  question: text().notNull(),
  metric: text().notNull(),
  unit: text().notNull(),
  rules_json: text().notNull(),
  initial_rule: text().notNull(),
  created_at: text().notNull(),
});
export const experimentDays = sqliteTable(
  "experiment_days",
  {
    id: text().primaryKey(),
    experiment_id: text()
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    record_date: text().notNull(),
    value: real().notNull(),
    note: text().notNull().default(""),
    recorded_at: text().notNull(),
  },
  (t) => [uniqueIndex("one_experiment_day").on(t.experiment_id, t.record_date)],
);
export const ruleChanges = sqliteTable("rule_changes", {
  id: text().primaryKey(),
  experiment_id: text()
    .notNull()
    .unique()
    .references(() => experiments.id, { onDelete: "cascade" }),
  previous_rule: text().notNull(),
  next_rule: text().notNull(),
  reason: text().notNull(),
  day1_id: text()
    .notNull()
    .references(() => experimentDays.id),
  day2_id: text()
    .notNull()
    .references(() => experimentDays.id),
  changed_at: text().notNull(),
});
export const imports = sqliteTable(
  "imports",
  {
    id: text().primaryKey(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    source_hash: text().notNull(),
    counts_json: text().notNull(),
    imported_at: text().notNull(),
  },
  (t) => [uniqueIndex("import_once_per_user").on(t.user_id, t.source_hash)],
);
export const importRequestLimits = sqliteTable("import_request_limits", {
  user_id: text()
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  window_start: integer().notNull(),
  request_count: integer().notNull(),
});
