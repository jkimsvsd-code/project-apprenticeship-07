import { test } from "node:test";
import assert from "node:assert/strict";
import { TestD1 } from "../../fixtures/d1";
import {
  mutate,
  readState,
  readRecord,
  AppError,
  exportData,
} from "../../../src/server/store";
const plan = {
  title: "테스트 계획",
  start_date: "2026-10-01",
  end_date: "2026-10-31",
  priority: "medium",
  success_criteria: "기록",
  estimated_minutes: 60,
};
async function action(
  db: TestD1,
  owner: string,
  name: string,
  data: Record<string, unknown>,
  requestId = crypto.randomUUID(),
) {
  return mutate(db as never, { action: name, data, requestId }, owner);
}
test("owners isolate lists, related records, replay ids and bidirectional read/update/delete with no changes", async () => {
  const db = new TestD1();
  const a = await action(db, "A", "plan.save", plan, "same-request-id"),
    b = await action(db, "B", "plan.save", plan, "same-request-id");
  assert.notEqual(a.id, b.id);
  const taskA = await action(db, "A", "task.save", {
    plan_id: a.id,
    title: "A task",
    due_date: "2026-10-27",
    priority: "medium",
    tags: [],
    estimated_minutes: 30,
  });
  const taskB = await action(db, "B", "task.save", {
    plan_id: b.id,
    title: "B task",
    due_date: "2026-10-27",
    priority: "medium",
    tags: [],
    estimated_minutes: 30,
  });
  for (const [owner, target] of [
    ["A", taskB.id],
    ["B", taskA.id],
  ]) {
    const before = JSON.stringify(
      db.sqlite.prepare("SELECT * FROM tasks ORDER BY id").all(),
    );
    await assert.rejects(
      () => readRecord(db as never, owner, "tasks", target),
      (e: unknown) => e instanceof AppError && e.status === 404,
    );
    await assert.rejects(
      () =>
        action(db, owner, "task.save", {
          id: target,
          plan_id: owner === "A" ? a.id : b.id,
          title: "tamper",
          due_date: "2026-10-27",
          priority: "medium",
          tags: [],
          estimated_minutes: 1,
        }),
      (e: unknown) => e instanceof AppError && e.status === 404,
    );
    await assert.rejects(
      () => action(db, owner, "task.delete", { id: target }),
      (e: unknown) => e instanceof AppError && e.status === 404,
    );
    assert.equal(
      JSON.stringify(
        db.sqlite.prepare("SELECT * FROM tasks ORDER BY id").all(),
      ),
      before,
    );
  }
  await assert.rejects(() =>
    action(db, "A", "task.save", {
      id: taskA.id,
      plan_id: b.id,
      title: "bad link",
      due_date: "2026-10-27",
      priority: "medium",
      tags: [],
      estimated_minutes: 1,
    }),
  );
  const state = await readState(db as never, "A"),
    out = await exportData(db as never, "A");
  assert.equal(state.plans.length, 1);
  assert.equal(state.tasks[0].id, taskA.id);
  assert.ok(!JSON.stringify(out).includes(taskB.id));
});
