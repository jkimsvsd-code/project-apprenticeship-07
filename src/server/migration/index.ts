import { AppError } from "../store";
import type { Database, Statement } from "../store";
import {
  IMPORT_FILE_BYTES,
  IMPORT_MAX_FILES,
  IMPORT_MAX_ROWS,
} from "../../shared/import-limits";
import { checkImportQuota, importedRowsSQL, importQuotaError } from "./limits";
const names = [
  "plans",
  "revisions",
  "tasks",
  "executions",
  "timers",
  "reviews",
  "completions",
] as const;
type Kind = (typeof names)[number];
type Row = Record<string, unknown>;
type Source = Record<Kind, Row[]>;
const columns: Record<Kind, string[]> = {
  plans: [
    "id",
    "title",
    "start_date",
    "end_date",
    "priority",
    "success_criteria",
    "estimated_minutes",
    "version",
    "created_at",
    "updated_at",
  ],
  revisions: [
    "revision_id",
    "plan_id",
    "version",
    "title",
    "start_date",
    "end_date",
    "priority",
    "success_criteria",
    "estimated_minutes",
    "created_at",
    "updated_at",
  ],
  tasks: [
    "id",
    "plan_id",
    "title",
    "due_date",
    "priority",
    "tags",
    "estimated_minutes",
    "status",
    "completion_cycle",
    "deleted_at",
    "created_at",
    "updated_at",
  ],
  executions: [
    "id",
    "task_id",
    "started_at",
    "ended_at",
    "actual_minutes",
    "blocked_reason",
    "created_at",
    "updated_at",
  ],
  timers: ["task_id", "started_at"],
  reviews: [
    "id",
    "plan_id",
    "from_date",
    "to_date",
    "improvement",
    "next_plan_id",
    "created_at",
    "updated_at",
  ],
  completions: ["id", "task_id", "cycle", "created_at"],
};
const tables: Record<Kind, string> = {
  plans: "plans",
  revisions: "plan_revisions",
  tasks: "tasks",
  executions: "executions",
  timers: "timers",
  reviews: "reviews",
  completions: "completions",
};
async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const calendarFields = new Set([
  "start_date",
  "end_date",
  "due_date",
  "from_date",
  "to_date",
]);
const timestampFields = new Set([
  "created_at",
  "updated_at",
  "started_at",
  "ended_at",
  "deleted_at",
]);
function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value.slice(0, 4) !== "0000" &&
    Number.isFinite(Date.parse(`${value}T00:00:00.000Z`)) &&
    new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
}
function validTimestamp(value: string) {
  // T06 exports canonical UTC timestamps. Keep the original string and hash.
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    validDate(value.slice(0, 10)) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}
function decode(input: unknown): Source {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new AppError("과제6 JSON 파일을 선택해 주세요.");
  if (
    new TextEncoder().encode(JSON.stringify(input)).byteLength >
    IMPORT_FILE_BYTES
  )
    throw new AppError("2MB 이하의 과제6 JSON 파일을 선택해 주세요.", 413);
  const obj = input as Row;
  if (
    obj.version !== "pds-schema-v2" ||
    obj.timezone !== "Asia/Seoul" ||
    obj.duration_unit !== "minute"
  )
    throw new AppError(
      "과제6의 pds-schema-v2 내보내기 파일만 가져올 수 있습니다.",
    );
  const result = {} as Source;
  let total = 0;
  for (const kind of names) {
    const rows = obj[kind];
    if (!Array.isArray(rows) || rows.length > 5000)
      throw new AppError(`${kind} 자료를 확인해 주세요.`);
    total += rows.length;
    if (total > 10000)
      throw new AppError("한 번에 최대 10,000건까지 가져올 수 있습니다.");
    result[kind] = rows.map((raw) => {
      if (!raw || typeof raw !== "object" || Array.isArray(raw))
        throw new AppError("파일에 잘못된 기록이 있습니다.");
      const row = raw as Row;
      const clean: Row = {};
      for (const key of columns[kind]) {
        let v = row[key];
        if (key === "tags") {
          if (typeof v === "string") {
            try {
              v = JSON.parse(v);
            } catch {
              throw new AppError("태그 형식을 확인해 주세요.");
            }
          }
          if (
            !Array.isArray(v) ||
            v.length > 10 ||
            v.some((t) => typeof t !== "string" || t.length > 30)
          )
            throw new AppError("태그 형식을 확인해 주세요.");
          v = JSON.stringify(v);
        }
        if (v === null && ["deleted_at", "next_plan_id"].includes(key)) {
          clean[key] = null;
          continue;
        }
        if (
          [
            "estimated_minutes",
            "actual_minutes",
            "version",
            "completion_cycle",
            "cycle",
          ].includes(key)
        ) {
          if (
            typeof v !== "number" ||
            !Number.isSafeInteger(v) ||
            v < 0 ||
            v > 1000000
          )
            throw new AppError("시간·버전 값을 확인해 주세요.");
        } else if (typeof v !== "string" || v.length > 5000)
          throw new AppError(`${key} 값을 확인해 주세요.`);
        if (calendarFields.has(key) && !validDate(String(v)))
          throw new AppError(
            `${key}: 실제 존재하는 YYYY-MM-DD 날짜를 입력해 주세요.`,
          );
        if (timestampFields.has(key) && !validTimestamp(String(v)))
          throw new AppError(
            `${key}: 과제6 내보내기의 UTC 시각 형식을 확인해 주세요.`,
          );
        if ((key === "id" || key.endsWith("_id")) && !String(v).trim())
          throw new AppError(`${key} 값을 확인해 주세요.`);
        clean[key] = v;
      }
      if (
        (kind === "plans" || kind === "revisions") &&
        String(clean.end_date) < String(clean.start_date)
      )
        throw new AppError("계획 종료일은 시작일 이후여야 합니다.");
      if (kind === "reviews" && String(clean.to_date) < String(clean.from_date))
        throw new AppError("회고 종료일은 시작일 이후여야 합니다.");
      if (
        kind === "executions" &&
        Date.parse(String(clean.ended_at)) <
          Date.parse(String(clean.started_at))
      )
        throw new AppError("실행 종료 시각은 시작 시각 이후여야 합니다.");
      if (
        clean.created_at &&
        clean.updated_at &&
        Date.parse(String(clean.updated_at)) <
          Date.parse(String(clean.created_at))
      )
        throw new AppError("수정 시각은 작성 시각 이후여야 합니다.");
      return clean;
    });
    const key =
      kind === "revisions"
        ? "revision_id"
        : kind === "timers"
          ? "task_id"
          : "id";
    if (new Set(result[kind].map((r) => r[key])).size !== result[kind].length)
      throw new AppError("파일 안에 중복 ID가 있습니다.");
    result[kind].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  }
  const planIds = new Set(result.plans.map((r) => r.id)),
    taskIds = new Set(result.tasks.map((r) => r.id));
  for (const kind of ["revisions", "tasks", "reviews"] as const)
    for (const row of result[kind]) {
      if (
        !planIds.has(row.plan_id) ||
        (row.next_plan_id && !planIds.has(row.next_plan_id))
      )
        throw new AppError("계획 연결이 끊긴 파일입니다.");
    }
  for (const kind of ["executions", "timers", "completions"] as const)
    for (const row of result[kind])
      if (!taskIds.has(row.task_id))
        throw new AppError("할 일 연결이 끊긴 파일입니다.");
  if (!result.plans.length) throw new AppError("가져올 계획이 없습니다.");
  return result;
}
export async function previewImport(
  db: Database,
  userId: string,
  input: unknown,
) {
  const source = decode(input),
    source_hash = await digest(JSON.stringify(source));
  const previous = await db
    .prepare(
      "SELECT id,counts_json,imported_at FROM imports WHERE user_id=? AND source_hash=?",
    )
    .bind(userId, source_hash)
    .first();
  if (!previous)
    await checkImportQuota(
      db,
      userId,
      names.reduce((sum, n) => sum + source[n].length, 0),
    );
  return {
    source_hash,
    counts: Object.fromEntries(names.map((n) => [n, source[n].length])),
    actual_minutes: source.executions.reduce(
      (n, r) => n + Number(r.actual_minutes),
      0,
    ),
    alreadyImported: !!previous,
    imported_at: previous?.imported_at ?? null,
  };
}
export async function importDiary(
  db: Database,
  userId: string,
  input: unknown,
) {
  const source = decode(input),
    preview = await previewImport(db, userId, input);
  if (preview.alreadyImported) return { ...preview, duplicate: true };
  const map = new Map<string, string>();
  for (const kind of [
    "plans",
    "tasks",
    "executions",
    "reviews",
    "completions",
    "revisions",
  ] as const)
    for (const row of source[kind]) {
      const old = String(row[kind === "revisions" ? "revision_id" : "id"]);
      map.set(
        `${kind}:${old}`,
        `imp_${(await digest(`${userId}:${preview.source_hash}:${kind}:${old}`)).slice(0, 40)}`,
      );
    }
  const at = new Date().toISOString();
  const receiptId = crypto.randomUUID();
  const rowCount = names.reduce((sum, n) => sum + source[n].length, 0);
  // Claim a receipt and its quota atomically BEFORE inserting any diary rows.
  // Each following insert requires this request's own receipt. A competing
  // import that loses the quota/dedup race therefore writes no diary data.
  const statements: Statement[] = [
    db
      .prepare(
        `INSERT INTO imports (id,user_id,source_hash,counts_json,imported_at)
       SELECT ?,?,?,?,? WHERE
       NOT EXISTS (SELECT 1 FROM imports WHERE user_id=? AND source_hash=?)
       AND (SELECT COUNT(*) FROM imports WHERE user_id=?)<?
       AND ${importedRowsSQL}+?<=?`,
      )
      .bind(
        receiptId,
        userId,
        preview.source_hash,
        JSON.stringify(preview.counts),
        at,
        userId,
        preview.source_hash,
        userId,
        IMPORT_MAX_FILES,
        userId,
        rowCount,
        IMPORT_MAX_ROWS,
      ),
  ];
  for (const kind of names)
    for (const row of source[kind]) {
      const copy = { ...row };
      const primary =
        kind === "revisions" ? "revision_id" : kind === "timers" ? null : "id";
      if (primary) copy[primary] = map.get(`${kind}:${row[primary]}`)!;
      for (const [field, parent] of [
        ["plan_id", "plans"],
        ["task_id", "tasks"],
        ["next_plan_id", "plans"],
      ])
        if (copy[field]) copy[field] = map.get(`${parent}:${copy[field]}`)!;
      if (kind === "plans") copy.owner_id = userId;
      const fields = Object.keys(copy);
      statements.push(
        db
          .prepare(
            `INSERT INTO ${tables[kind]} (${fields.join(",")}) SELECT ${fields.map(() => "?").join(",")} WHERE EXISTS (SELECT 1 FROM imports WHERE id=? AND user_id=?)`,
          )
          .bind(...fields.map((f) => copy[f]), receiptId, userId),
      );
    }
  statements.push(
    db
      .prepare(
        "SELECT id,imported_at FROM imports WHERE user_id=? AND source_hash=?",
      )
      .bind(userId, preview.source_hash),
  );
  let receipt: { id: string; imported_at: string } | undefined;
  try {
    const results = (await db.batch(statements)) as {
      results: { id: string; imported_at: string }[];
    }[];
    receipt = results.at(-1)?.results[0];
  } catch {
    throw new AppError(
      "가져오기에 실패해 전체 작업을 되돌렸습니다. 파일을 확인하고 다시 시도해 주세요.",
      400,
    );
  }
  if (!receipt) throw importQuotaError();
  return {
    ...preview,
    alreadyImported: true,
    imported_at: receipt.imported_at,
    duplicate: receipt.id !== receiptId,
  };
}
