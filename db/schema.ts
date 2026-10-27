import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export * from "./auth-schema";
export * from "./experiment-schema";

const dates = () => ({
  created_at: text().notNull(),
  updated_at: text().notNull(),
});
export const plans = sqliteTable(
  "plans",
  {
    id: text().primaryKey(),
    owner_id: text().notNull().default("__legacy_unclaimed__"),
    title: text().notNull(),
    start_date: text().notNull(),
    end_date: text().notNull(),
    priority: text().notNull(),
    success_criteria: text().notNull(),
    estimated_minutes: integer().notNull(),
    version: integer().notNull().default(1),
    ...dates(),
  },
  (t) => [
    check("plan_minutes", sql`${t.estimated_minutes} >= 0`),
    check("plan_period", sql`${t.end_date} >= ${t.start_date}`),
    check("plan_priority", sql`${t.priority} in ('high','medium','low')`),
  ],
);
export const planRevisions = sqliteTable(
  "plan_revisions",
  {
    revision_id: text().primaryKey(),
    plan_id: text()
      .notNull()
      .references(() => plans.id),
    version: integer().notNull(),
    title: text().notNull(),
    start_date: text().notNull(),
    end_date: text().notNull(),
    priority: text().notNull(),
    success_criteria: text().notNull(),
    estimated_minutes: integer().notNull(),
    ...dates(),
  },
  (t) => [uniqueIndex("plan_version_unique").on(t.plan_id, t.version)],
);
export const tasks = sqliteTable(
  "tasks",
  {
    id: text().primaryKey(),
    plan_id: text()
      .notNull()
      .references(() => plans.id),
    title: text().notNull(),
    due_date: text().notNull(),
    priority: text().notNull(),
    tags: text().notNull().default("[]"),
    estimated_minutes: integer().notNull(),
    status: text().notNull().default("todo"),
    completion_cycle: integer().notNull().default(0),
    deleted_at: text(),
    ...dates(),
  },
  (t) => [
    index("tasks_plan_due").on(t.plan_id, t.due_date),
    check("task_minutes", sql`${t.estimated_minutes} >= 0`),
    check("task_status", sql`${t.status} in ('todo','done')`),
    check("task_priority", sql`${t.priority} in ('high','medium','low')`),
  ],
);
export const executions = sqliteTable(
  "executions",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => tasks.id),
    started_at: text().notNull(),
    ended_at: text().notNull(),
    actual_minutes: integer().notNull(),
    blocked_reason: text().notNull().default(""),
    ...dates(),
  },
  (t) => [
    index("executions_task").on(t.task_id),
    check("execution_minutes", sql`${t.actual_minutes} >= 1`),
    check("execution_period", sql`${t.ended_at} >= ${t.started_at}`),
  ],
);
export const timers = sqliteTable("timers", {
  task_id: text()
    .primaryKey()
    .references(() => tasks.id),
  started_at: text().notNull(),
});
export const completions = sqliteTable(
  "completions",
  {
    id: text().primaryKey(),
    task_id: text()
      .notNull()
      .references(() => tasks.id),
    cycle: integer().notNull(),
    created_at: text().notNull(),
  },
  (t) => [uniqueIndex("completion_once_per_cycle").on(t.task_id, t.cycle)],
);
export const reviews = sqliteTable(
  "reviews",
  {
    id: text().primaryKey(),
    plan_id: text()
      .notNull()
      .references(() => plans.id),
    from_date: text().notNull(),
    to_date: text().notNull(),
    improvement: text().notNull(),
    next_plan_id: text().references(() => plans.id),
    ...dates(),
  },
  (t) => [check("review_period", sql`${t.to_date} >= ${t.from_date}`)],
);
export const commands = sqliteTable("commands", {
  id: text().primaryKey(),
  owner_id: text().notNull().default("__legacy_unclaimed__"),
  fingerprint: text().notNull(),
  result_id: text().notNull(),
  created_at: text().notNull(),
});
