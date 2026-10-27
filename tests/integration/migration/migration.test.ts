import { test } from "node:test";
import assert from "node:assert/strict";
import { TestD1 } from "../../fixtures/d1";
import {
  previewImport,
  importDiary,
} from "../../../src/server/migration/index";
import { mutate, exportData, readState } from "../../../src/server/store";
import {
  deleteAccount,
  exportAccount,
} from "../../../src/server/accounts/index";
import { hashPassword } from "better-auth/crypto";
import { randomBytes } from "node:crypto";
import { updateExperiment } from "../../../src/server/experiment/index";
function addUser(db: TestD1, id: string) {
  db.sqlite
    .prepare(
      "INSERT INTO auth_users (id,name,email,created_at,updated_at) VALUES (?,?,?,?,?)",
    )
    .run(id, id, `${id}@example.test`, 0, 0);
}
test("import preserves relationships, counts, timestamps and totals; retry/metadata changes do not duplicate; delete isolates other account", async () => {
  const db = new TestD1();
  addUser(db, "A");
  addUser(db, "B");
  const base = {
    title: "공개 테스트 계획",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    priority: "medium",
    success_criteria: "완료",
    estimated_minutes: 60,
  };
  const p = await mutate(db as never, {
    action: "plan.save",
    data: base,
    requestId: crypto.randomUUID(),
  });
  const t = await mutate(db as never, {
    action: "task.save",
    data: {
      plan_id: p.id,
      title: "테스트 할 일",
      due_date: "2026-10-27",
      priority: "medium",
      tags: [],
      estimated_minutes: 30,
    },
    requestId: crypto.randomUUID(),
  });
  await mutate(db as never, {
    action: "execution.save",
    data: {
      task_id: t.id,
      started_at: "2026-10-27T00:00:00Z",
      ended_at: "2026-10-27T00:20:00Z",
      actual_minutes: 20,
      blocked_reason: "",
    },
    requestId: crypto.randomUUID(),
  });
  const source = await exportData(db as never),
    original = JSON.stringify(source);
  const preview = await previewImport(db as never, "A", source);
  assert.equal(preview.counts.tasks, 1);
  assert.equal(preview.actual_minutes, 20);
  await importDiary(db as never, "A", source);
  await importDiary(db as never, "A", { ...source, exported_at: "different" });
  const a = await readState(db as never, "A");
  assert.equal(a.tasks.length, 1);
  assert.equal(a.executions[0].actual_minutes, 20);
  assert.equal(a.tasks[0].plan_id, a.plans[0].id);
  assert.equal(a.executions[0].task_id, a.tasks[0].id);
  assert.equal(a.plans[0].created_at, source.plans[0].created_at);
  assert.equal(JSON.stringify(source), original);
  await importDiary(db as never, "B", source);
  const b = await readState(db as never, "B");
  assert.notEqual(a.plans[0].id, b.plans[0].id);
  const invalid = structuredClone(source);
  invalid.plans[0].estimated_minutes = -1;
  await assert.rejects(() => importDiary(db as never, "A", invalid));
  assert.equal((await readState(db as never, "A")).tasks.length, 1);
  const missing = structuredClone(source);
  missing.tasks[0].plan_id = "missing";
  await assert.rejects(() => previewImport(db as never, "A", missing));
  const brokenPeriod = structuredClone(source);
  brokenPeriod.plans[0].end_date = "2026-09-01";
  await assert.rejects(() => importDiary(db as never, "A", brokenPeriod));
  assert.equal((await readState(db as never, "A")).plans.length, 1);
  const exp = await updateExperiment(
    db as never,
    "A",
    {
      action: "start",
      question: "검증 질문",
      metric: "분",
      unit: "분",
      initial_rule: "저녁 시작",
      decimals: 1,
      weekStarts: "monday",
    },
    new Date("2026-10-01T00:00:00Z"),
  );
  for (const [day, value] of [
    [1, 10],
    [2, 20],
  ])
    await updateExperiment(
      db as never,
      "A",
      {
        action: "record",
        experiment_id: exp.experiment!.id,
        value,
        note: "테스트",
      },
      new Date(`2026-10-0${day}T01:00:00Z`),
    );
  await updateExperiment(
    db as never,
    "A",
    {
      action: "change",
      experiment_id: exp.experiment!.id,
      next_rule: "아침 시작",
      reason: "두 날을 확인",
    },
    new Date("2026-10-02T02:00:00Z"),
  );
  const password = randomBytes(24).toString("hex"),
    hash = await hashPassword(password);
  db.sqlite
    .prepare(
      "INSERT INTO auth_accounts (id,account_id,provider_id,user_id,password,created_at,updated_at) VALUES ('accA','A','credential','A',?,0,0)",
    )
    .run(hash);
  const exported = await exportAccount(db as never, "A");
  assert.equal(exported.version, "pds-schema-v3");
  assert.equal(exported.experiment_days.length, 2);
  assert.equal(exported.rule_changes.length, 1);
  assert.ok(!JSON.stringify(exported).includes(hash));
  await assert.rejects(() => deleteAccount(db as never, "A", "wrong-password"));
  await deleteAccount(db as never, "A", password);
  assert.equal((await readState(db as never, "A")).plans.length, 0);
  assert.equal((await readState(db as never, "B")).plans.length, 1);
  assert.equal(
    db.sqlite.prepare("SELECT COUNT(*) AS n FROM rule_changes").get()!.n,
    0,
  );
  assert.equal(
    db.sqlite.prepare("SELECT COUNT(*) AS n FROM experiment_days").get()!.n,
    0,
  );
  assert.equal(
    db.sqlite
      .prepare("SELECT COUNT(*) AS n FROM auth_users WHERE id='A'")
      .get()!.n,
    0,
  );
});
