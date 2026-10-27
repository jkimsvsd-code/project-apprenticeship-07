import { test } from "node:test";
import assert from "node:assert/strict";
import { TestD1 } from "../../fixtures/d1";
import {
  updateExperiment,
  readExperiment,
} from "../../../src/server/experiment/index";
function date(day: number) {
  return new Date(`2026-10-${String(day).padStart(2, "0")}T03:00:00Z`);
}
test("real-time server rules enforce 5 distinct Seoul dates and one change between day2/day3", async () => {
  const db = new TestD1();
  db.sqlite
    .prepare(
      "INSERT INTO auth_users (id,name,email,created_at,updated_at) VALUES ('A','A','a@test',0,0)",
    )
    .run();
  const start = await updateExperiment(
    db as never,
    "A",
    {
      action: "start",
      question: "집중이 늘까?",
      metric: "집중 시간",
      unit: "분",
      initial_rule: "저녁에 시작",
      decimals: 1,
      weekStarts: "monday",
    },
    date(1),
  );
  const id = start.experiment!.id;
  await updateExperiment(
    db as never,
    "A",
    { action: "record", experiment_id: id, value: 10, note: "테스트" },
    date(1),
  );
  await assert.rejects(() =>
    updateExperiment(
      db as never,
      "A",
      { action: "record", experiment_id: id, value: 10, note: "중복" },
      date(1),
    ),
  );
  await assert.rejects(() =>
    updateExperiment(
      db as never,
      "A",
      {
        action: "change",
        experiment_id: id,
        next_rule: "아침에 시작",
        reason: "이유",
      },
      date(1),
    ),
  );
  await updateExperiment(
    db as never,
    "A",
    { action: "record", experiment_id: id, value: 20, note: "테스트" },
    date(2),
  );
  await assert.rejects(() =>
    updateExperiment(
      db as never,
      "A",
      { action: "record", experiment_id: id, value: 30, note: "순서 위반" },
      date(3),
    ),
  );
  const changed = await updateExperiment(
    db as never,
    "A",
    {
      action: "change",
      experiment_id: id,
      next_rule: "아침에 시작",
      reason: "두 날 모두 늦게 시작함",
    },
    new Date("2026-10-02T04:00:00Z"),
  );
  assert.equal(changed.change!.day1_id, changed.days[0].id);
  assert.equal(changed.change!.day2_id, changed.days[1].id);
  for (const day of [3, 4, 5])
    await updateExperiment(
      db as never,
      "A",
      { action: "record", experiment_id: id, value: day * 10, note: "테스트" },
      date(day),
    );
  const state = await readExperiment(db as never, "A", date(5));
  assert.equal(state.days.length, 5);
  assert.equal(new Set(state.days.map((x) => x.record_date)).size, 5);
  await assert.rejects(() =>
    updateExperiment(
      db as never,
      "A",
      { action: "record", experiment_id: id, value: 60, note: "6일" },
      date(6),
    ),
  );
  await assert.rejects(() =>
    updateExperiment(
      db as never,
      "B",
      { action: "record", experiment_id: id, value: 1, note: "타인" },
      date(6),
    ),
  );
});
