import { verifyPassword } from "better-auth/crypto";
import { AppError, exportData, ownerCondition } from "../store";
import type { Database } from "../store";
export async function exportAccount(db: Database, userId: string) {
  const diary = await exportData(db, userId);
  const queries = [
    ["profile", "SELECT id,name,email FROM auth_users WHERE id=?"],
    [
      "experiments",
      "SELECT * FROM experiments WHERE user_id=? ORDER BY created_at,id",
    ],
    [
      "experiment_days",
      "SELECT * FROM experiment_days WHERE experiment_id IN (SELECT id FROM experiments WHERE user_id=?) ORDER BY record_date,id",
    ],
    [
      "rule_changes",
      "SELECT * FROM rule_changes WHERE experiment_id IN (SELECT id FROM experiments WHERE user_id=?) ORDER BY changed_at,id",
    ],
    [
      "imports",
      "SELECT id,source_hash,counts_json,imported_at FROM imports WHERE user_id=? ORDER BY imported_at,id",
    ],
  ];
  const rows = (await db.batch(
    queries.map(([, sql]) => db.prepare(sql).bind(userId)),
  )) as { results: Record<string, unknown>[] }[];
  return {
    ...diary,
    version: "pds-schema-v3",
    profile: rows[0].results[0],
    experiments: rows[1].results,
    experiment_days: rows[2].results,
    rule_changes: rows[3].results,
    imports: rows[4].results,
  };
}
export async function deleteAccount(
  db: Database,
  userId: string,
  password: unknown,
) {
  if (typeof password !== "string" || password.length > 128)
    throw new AppError("현재 비밀번호를 입력해 주세요.", 400, "password");
  const account = await db
    .prepare(
      "SELECT password FROM auth_accounts WHERE user_id=? AND provider_id='credential'",
    )
    .bind(userId)
    .first();
  if (
    !account?.password ||
    !(await verifyPassword({ hash: String(account.password), password }))
  )
    throw new AppError("비밀번호가 올바르지 않습니다.", 403, "password");
  const statements = ["rule_changes", "experiment_days"].map((table) =>
    db
      .prepare(
        `DELETE FROM ${table} WHERE experiment_id IN (SELECT id FROM experiments WHERE user_id=?)`,
      )
      .bind(userId),
  );
  for (const table of [
    "completions",
    "timers",
    "executions",
    "reviews",
    "plan_revisions",
    "tasks",
    "commands",
    "plans",
  ]) {
    statements.push(
      db
        .prepare(`DELETE FROM ${table} WHERE ${ownerCondition(table)}`)
        .bind(userId),
    );
  }
  statements.push(
    db.prepare("DELETE FROM experiments WHERE user_id=?").bind(userId),
    db.prepare("DELETE FROM imports WHERE user_id=?").bind(userId),
    db.prepare("DELETE FROM auth_users WHERE id=?").bind(userId),
  );
  await db.batch(statements);
  return { ok: true };
}
