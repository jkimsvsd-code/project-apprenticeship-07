import { AppError } from "../store";
import type { Database, Statement } from "../store";
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
function decode(input: unknown): Source {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new AppError("과제6 JSON 파일을 선택해 주세요.");
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
        clean[key] = v;
      }
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
  if (total > 10000)
    throw new AppError("한 번에 최대 10,000건까지 가져올 수 있습니다.");
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
  const statements: Statement[] = [];
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
            `INSERT INTO ${tables[kind]} (${fields.join(",")}) SELECT ${fields.map(() => "?").join(",")} WHERE NOT EXISTS (SELECT 1 FROM imports WHERE user_id=? AND source_hash=?)`,
          )
          .bind(...fields.map((f) => copy[f]), userId, preview.source_hash),
      );
    }
  const at = new Date().toISOString();
  statements.push(
    db
      .prepare(
        "INSERT OR IGNORE INTO imports (id,user_id,source_hash,counts_json,imported_at) VALUES (?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        userId,
        preview.source_hash,
        JSON.stringify(preview.counts),
        at,
      ),
  );
  try {
    await db.batch(statements);
  } catch {
    throw new AppError(
      "가져오기에 실패해 전체 작업을 되돌렸습니다. 파일을 확인하고 다시 시도해 주세요.",
      400,
    );
  }
  return {
    ...preview,
    alreadyImported: true,
    imported_at: at,
    duplicate: false,
  };
}
