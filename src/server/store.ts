import { ownerCondition } from "./access-control/index";
export { ownerCondition } from "./access-control/index";
import { seoulDate, minutesBetween } from "../shared/domain";
import type { DiaryState } from "../shared/domain";
export interface Statement {
  bind(...values: unknown[]): Statement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public field = "",
  ) {
    super(message);
  }
}
type Data = Record<string, unknown>;
function text(d: Data, k: string, max = 2000, required = true) {
  const v = d[k];
  if (typeof v !== "string" || v.length > max || (required && !v.trim()))
    throw new AppError(`${k} 값을 확인해 주세요.`, 400, k);
  return v.trim();
}
function number(d: Data, k: string, min = 0) {
  const v = d[k];
  if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > 1000000)
    throw new AppError("시간은 올바른 분 단위 정수로 입력해 주세요.", 400, k);
  return Number(v);
}
function date(d: Data, k: string) {
  const v = text(d, k, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
    !Number.isFinite(Date.parse(v)) ||
    new Date(v).toISOString().slice(0, 10) !== v
  )
    throw new AppError("올바른 날짜를 입력해 주세요.", 400, k);
  return v;
}
function priority(d: Data) {
  const p = text(d, "priority", 10);
  if (!["high", "medium", "low"].includes(p))
    throw new AppError("우선순위를 확인해 주세요.", 400, "priority");
  return p;
}
function stamp(d: Data, k: string) {
  const v = text(d, k, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) ||
    !Number.isFinite(Date.parse(v))
  )
    throw new AppError("올바른 시각을 입력해 주세요.", 400, k);
  return new Date(v).toISOString();
}
function planFields(d: Data) {
  const a = date(d, "start_date"),
    b = date(d, "end_date");
  if (b < a)
    throw new AppError("종료일은 시작일 이후여야 합니다.", 400, "end_date");
  return [
    text(d, "title", 200),
    a,
    b,
    priority(d),
    text(d, "success_criteria"),
    number(d, "estimated_minutes"),
  ];
}
const id = () => crypto.randomUUID();
const snapshot = `INSERT INTO plan_revisions (revision_id,plan_id,version,title,start_date,end_date,priority,success_criteria,estimated_minutes,created_at,updated_at) SELECT ?,id,version,title,start_date,end_date,priority,success_criteria,estimated_minutes,created_at,updated_at FROM plans WHERE id=?`;
export const LEGACY_OWNER = "__legacy_unclaimed__";
function stateQueries(db: Database, ownerId: string) {
  return [
    ["plans", "*", "created_at,id"],
    ["plan_revisions", "*,plan_id AS id", "version"],
    ["tasks", "*", "created_at,id"],
    ["executions", "*", "started_at,id"],
    ["timers", "*", "task_id"],
    ["reviews", "*", "created_at DESC,id"],
  ].map(([table, fields, order]) =>
    db
      .prepare(
        `SELECT ${fields} FROM ${table} WHERE ${ownerCondition(table)} ORDER BY ${order}`,
      )
      .bind(ownerId),
  );
}
function stateFromRows(
  rows: { results: Record<string, unknown>[] }[],
): DiaryState {
  const [plans, revisions, tasks, executions, timers, reviews] = rows;
  return {
    plans: plans.results,
    revisions: revisions.results,
    tasks: tasks.results.map((t) => ({
      ...t,
      tags: JSON.parse(String(t.tags)),
    })),
    executions: executions.results,
    timers: timers.results,
    reviews: reviews.results,
    today: seoulDate(),
  } as DiaryState;
}
export async function readState(
  db: Database,
  ownerId = LEGACY_OWNER,
): Promise<DiaryState> {
  return stateFromRows(
    (await db.batch(stateQueries(db, ownerId))) as {
      results: Record<string, unknown>[];
    }[],
  );
}
export async function mutate(
  db: Database,
  body: Data,
  ownerId = LEGACY_OWNER,
): Promise<{ id: string }> {
  const action = text(body, "action", 40);
  let requestId = text(body, "requestId", 100);
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(requestId))
    throw new AppError("요청 식별자가 올바르지 않습니다.");
  requestId = `${ownerId}:${requestId}`;
  const data = body.data;
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError("입력 내용을 확인해 주세요.");
  const d = data as Data;
  const bytes = new TextEncoder().encode(JSON.stringify({ action, data }));
  const fingerprint = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  )
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const existing = await db
    .prepare("SELECT * FROM commands WHERE id=?")
    .bind(requestId)
    .first();
  if (existing) {
    if (existing.fingerprint !== fingerprint)
      throw new AppError(
        "같은 요청 번호에 다른 내용이 있습니다. 다시 시도해 주세요.",
        409,
      );
    if (action === "review.next") {
      const review = await db
        .prepare("SELECT next_plan_id FROM reviews WHERE id=?")
        .bind(d.review_id)
        .first();
      return { id: String(review?.next_plan_id) };
    }
    return { id: String(existing.result_id) };
  }
  const now = new Date().toISOString();
  let resultId = typeof d.id === "string" && d.id ? d.id : id();
  const statements: Statement[] = [];
  const guard = " AND NOT EXISTS (SELECT 1 FROM commands WHERE id=?)";
  function sql(query: string, values: unknown[] = []) {
    statements.push(db.prepare(query + guard).bind(...values, requestId));
  }
  async function requireRow(table: string, rowId: string, active = false) {
    const row = await db
      .prepare(
        `SELECT * FROM ${table} WHERE id=? AND ${ownerCondition(table)}${active ? " AND deleted_at IS NULL" : ""}`,
      )
      .bind(rowId, ownerId)
      .first();
    if (!row)
      throw new AppError("기록을 찾을 수 없습니다. 새로고침해 주세요.", 404);
    return row;
  }
  switch (action) {
    case "plan.save": {
      const values = planFields(d);
      if (d.id) {
        await requireRow("plans", resultId);
        sql(
          "UPDATE plans SET title=?,start_date=?,end_date=?,priority=?,success_criteria=?,estimated_minutes=?,version=version+1,updated_at=? WHERE id=?",
          [...values, now, resultId],
        );
      } else
        sql(
          "INSERT INTO plans (id,owner_id,title,start_date,end_date,priority,success_criteria,estimated_minutes,version,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,1,?,? WHERE 1",
          [resultId, ownerId, ...values, now, now],
        );
      sql(snapshot, [id(), resultId]);
      break;
    }
    case "task.save": {
      const planId = text(d, "plan_id", 100);
      await requireRow("plans", planId);
      const tags = d.tags;
      if (
        !Array.isArray(tags) ||
        tags.length > 10 ||
        tags.some((t) => typeof t !== "string" || t.length > 30)
      )
        throw new AppError("태그는 30자 이내, 최대 10개입니다.", 400, "tags");
      const values = [
        planId,
        text(d, "title", 200),
        date(d, "due_date"),
        priority(d),
        JSON.stringify([...new Set(tags.map((t) => t.trim()).filter(Boolean))]),
        number(d, "estimated_minutes"),
      ];
      if (d.id) {
        await requireRow("tasks", resultId, true);
        sql(
          "UPDATE tasks SET plan_id=?,title=?,due_date=?,priority=?,tags=?,estimated_minutes=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
          [...values, now, resultId],
        );
      } else
        sql(
          "INSERT INTO tasks (id,plan_id,title,due_date,priority,tags,estimated_minutes,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,? WHERE 1",
          [resultId, ...values, now, now],
        );
      break;
    }
    case "task.complete": {
      await requireRow("tasks", resultId, true);
      if (typeof d.done !== "boolean")
        throw new AppError("완료 상태를 확인해 주세요.");
      if (d.done) {
        sql(
          "INSERT OR IGNORE INTO completions (id,task_id,cycle,created_at) SELECT ?,id,completion_cycle,? FROM tasks WHERE id=? AND status='todo' AND deleted_at IS NULL",
          [id(), now, resultId],
        );
        sql(
          "UPDATE tasks SET status='done',updated_at=? WHERE id=? AND status='todo' AND deleted_at IS NULL",
          [now, resultId],
        );
      } else
        sql(
          "UPDATE tasks SET status='todo',completion_cycle=completion_cycle+1,updated_at=? WHERE id=? AND status='done' AND deleted_at IS NULL",
          [now, resultId],
        );
      break;
    }
    case "task.delete":
      await requireRow("tasks", resultId, true);
      sql(
        "UPDATE tasks SET deleted_at=?,updated_at=? WHERE id=? AND deleted_at IS NULL",
        [now, now, resultId],
      );
      // An active timer is preserved so undo restores the full execution context.
      break;
    case "task.restore":
      await requireRow("tasks", resultId);
      sql("UPDATE tasks SET deleted_at=NULL,updated_at=? WHERE id=?", [
        now,
        resultId,
      ]);
      break;
    case "execution.save": {
      const taskId = text(d, "task_id", 100);
      await requireRow("tasks", taskId, true);
      const start = stamp(d, "started_at"),
        end = stamp(d, "ended_at");
      if (end < start)
        throw new AppError(
          "종료 시각은 시작 시각 이후여야 합니다.",
          400,
          "ended_at",
        );
      const values = [
        start,
        end,
        number(d, "actual_minutes", 1),
        text(d, "blocked_reason", 2000, false),
        now,
      ];
      if (d.id) {
        const row = await requireRow("executions", resultId);
        if (row.task_id !== taskId)
          throw new AppError("실행 기록의 할 일을 바꿀 수 없습니다.");
        sql(
          "UPDATE executions SET started_at=?,ended_at=?,actual_minutes=?,blocked_reason=?,updated_at=? WHERE id=? AND task_id=?",
          [...values, resultId, taskId],
        );
      } else
        sql(
          "INSERT INTO executions (id,task_id,started_at,ended_at,actual_minutes,blocked_reason,updated_at,created_at) SELECT ?,?,?,?,?,?,?,? WHERE 1",
          [resultId, taskId, ...values, now],
        );
      break;
    }
    case "timer.start": {
      resultId = text(d, "task_id", 100);
      await requireRow("tasks", resultId, true);
      sql(
        "INSERT OR IGNORE INTO timers (task_id,started_at) SELECT ?,? WHERE 1",
        [resultId, now],
      );
      break;
    }
    case "timer.stop": {
      const taskId = text(d, "task_id", 100);
      await requireRow("tasks", taskId, true);
      const timer = await db
        .prepare("SELECT * FROM timers WHERE task_id=?")
        .bind(taskId)
        .first();
      if (!timer)
        throw new AppError(
          "실행 중인 타이머가 없습니다. 새로고침해 주세요.",
          409,
        );
      const start = String(timer.started_at),
        duration = minutesBetween(start, now);
      sql(
        "INSERT INTO executions (id,task_id,started_at,ended_at,actual_minutes,blocked_reason,created_at,updated_at) SELECT ?,task_id,started_at,?,?,?, ?,? FROM timers WHERE task_id=? AND started_at=?",
        [resultId, now, duration, "", now, now, taskId, start],
      );
      sql("DELETE FROM timers WHERE task_id=? AND started_at=?", [
        taskId,
        start,
      ]);
      break;
    }
    case "review.save": {
      const planId = text(d, "plan_id", 100);
      await requireRow("plans", planId);
      const from = date(d, "from_date"),
        to = date(d, "to_date");
      if (from > to)
        throw new AppError("조회 기간을 확인해 주세요.", 400, "to_date");
      const values = [planId, from, to, text(d, "improvement", 1000), now];
      if (d.id) {
        const review = await requireRow("reviews", resultId);
        if (review.next_plan_id)
          throw new AppError(
            "다음 계획에 연결한 돌아보기는 보존합니다. 새 돌아보기를 작성해 주세요.",
            409,
          );
        sql(
          "UPDATE reviews SET plan_id=?,from_date=?,to_date=?,improvement=?,updated_at=? WHERE id=?",
          [...values, resultId],
        );
      } else
        sql(
          "INSERT INTO reviews (id,plan_id,from_date,to_date,improvement,updated_at,created_at) SELECT ?,?,?,?,?,?,? WHERE 1",
          [resultId, ...values, now],
        );
      break;
    }
    case "review.next": {
      const reviewId = text(d, "review_id", 100),
        review = await requireRow("reviews", reviewId);
      if (review.next_plan_id) return { id: String(review.next_plan_id) };
      const values = planFields(d),
        taskIds = d.task_ids;
      if (
        !Array.isArray(taskIds) ||
        taskIds.length > 50 ||
        taskIds.some((t) => typeof t !== "string") ||
        new Set(taskIds).size !== taskIds.length
      )
        throw new AppError("복사할 할 일은 최대 50개까지 선택해 주세요.");
      for (const taskId of taskIds) {
        const task = await requireRow("tasks", String(taskId), true);
        if (task.plan_id !== review.plan_id)
          throw new AppError("원래 계획의 할 일만 복사할 수 있습니다.");
      }
      sql(
        "INSERT INTO plans (id,owner_id,title,start_date,end_date,priority,success_criteria,estimated_minutes,version,created_at,updated_at) SELECT ?,?,?,?,?,?,?,?,1,?,? FROM reviews WHERE id=? AND next_plan_id IS NULL",
        [resultId, ownerId, ...values, now, now, reviewId],
      );
      sql(snapshot, [id(), resultId]);
      for (const taskId of taskIds)
        sql(
          "INSERT INTO tasks (id,plan_id,title,due_date,priority,tags,estimated_minutes,status,completion_cycle,created_at,updated_at) SELECT ?,?,t.title,?,t.priority,t.tags,t.estimated_minutes,'todo',0,?,? FROM tasks t WHERE t.id=? AND t.deleted_at IS NULL AND EXISTS (SELECT 1 FROM plans WHERE id=?)",
          [id(), resultId, d.end_date, now, now, taskId, resultId],
        );
      sql(
        "UPDATE reviews SET next_plan_id=?,updated_at=? WHERE id=? AND next_plan_id IS NULL AND EXISTS (SELECT 1 FROM plans WHERE id=?)",
        [resultId, now, reviewId, resultId],
      );
      break;
    }
    default:
      throw new AppError("지원하지 않는 요청입니다.");
  }
  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO commands (id,owner_id,fingerprint,result_id,created_at) VALUES (?,?,?,?,?)",
      )
      .bind(requestId, ownerId, fingerprint, resultId, now),
  );
  await db.batch(statements);
  const saved = await db
    .prepare("SELECT * FROM commands WHERE id=?")
    .bind(requestId)
    .first();
  if (saved?.fingerprint !== fingerprint)
    throw new AppError(
      "요청이 충돌했습니다. 새로고침 후 다시 시도해 주세요.",
      409,
    );
  if (action === "review.next") {
    const review = await db
      .prepare("SELECT next_plan_id FROM reviews WHERE id=?")
      .bind(d.review_id)
      .first();
    return { id: String(review?.next_plan_id) };
  }
  return { id: String(saved.result_id) };
}
export async function exportData(db: Database, ownerId = LEGACY_OWNER) {
  // Export every relation in one snapshot even when another visitor writes.
  const rows = (await db.batch([
    ...stateQueries(db, ownerId),
    db
      .prepare(
        `SELECT * FROM completions WHERE ${ownerCondition("completions")} ORDER BY created_at,id`,
      )
      .bind(ownerId),
  ])) as { results: Record<string, unknown>[] }[];
  const state = stateFromRows(rows);
  return {
    version: "pds-schema-v2",
    exported_at: new Date().toISOString(),
    timezone: "Asia/Seoul",
    duration_unit: "minute",
    ...state,
    completions: rows[6].results,
  };
}

export async function readRecord(
  db: Database,
  ownerId: string,
  table: unknown,
  rowId: unknown,
) {
  if (
    typeof table !== "string" ||
    !["plans", "tasks", "executions", "reviews"].includes(table) ||
    typeof rowId !== "string" ||
    rowId.length > 100
  )
    throw new AppError("자료 조회 요청을 확인해 주세요.", 400);
  const row = await db
    .prepare(`SELECT * FROM ${table} WHERE id=? AND ${ownerCondition(table)}`)
    .bind(rowId, ownerId)
    .first();
  if (!row) throw new AppError("기록을 찾을 수 없습니다.", 404);
  return row;
}
