import { AppError } from "../store";
import type { Database } from "../store";
import { seoulDate } from "../../shared/domain";
import { defaultRules } from "../../shared/experiment/index";
import type {
  ExperimentState,
  Experiment,
  ExperimentDay,
  RuleChange,
} from "../../shared/experiment/index";
function value(data: Record<string, unknown>, key: string, max = 300) {
  if (
    typeof data[key] !== "string" ||
    !(data[key] as string).trim() ||
    (data[key] as string).length > max
  )
    throw new AppError(`${key} 내용을 확인해 주세요.`, 400, key);
  return (data[key] as string).trim();
}
export async function readExperiment(
  db: Database,
  userId: string,
  now = new Date(),
): Promise<ExperimentState> {
  const experiment = (await db
    .prepare(
      "SELECT * FROM experiments WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 1",
    )
    .bind(userId)
    .first()) as unknown as Experiment | null;
  if (!experiment)
    return { experiment: null, days: [], change: null, today: seoulDate(now) };
  const [days, change] = await Promise.all([
    db
      .prepare(
        "SELECT * FROM experiment_days WHERE experiment_id=? ORDER BY record_date,id",
      )
      .bind(experiment.id)
      .all(),
    db
      .prepare("SELECT * FROM rule_changes WHERE experiment_id=?")
      .bind(experiment.id)
      .first(),
  ]);
  return {
    experiment,
    days: days.results as unknown as ExperimentDay[],
    change: change as unknown as RuleChange | null,
    today: seoulDate(now),
  };
}
export async function updateExperiment(
  db: Database,
  userId: string,
  data: Record<string, unknown>,
  now = new Date(),
) {
  const state = await readExperiment(db, userId, now),
    at = now.toISOString(),
    today = state.today;
  if (data.action === "start") {
    if (state.experiment && state.days.length < 5)
      throw new AppError("진행 중인 5일 실험을 먼저 마쳐 주세요.", 409);
    const question = value(data, "question"),
      metric = value(data, "metric", 80),
      unit = value(data, "unit", 20),
      rule = value(data, "initial_rule", 250);
    const decimals = Number(data.decimals),
      weekStarts = data.weekStarts;
    if (
      !Number.isInteger(decimals) ||
      decimals < 0 ||
      decimals > 3 ||
      !["monday", "sunday"].includes(String(weekStarts))
    )
      throw new AppError("반올림과 주 시작 요일을 확인해 주세요.");
    const rules = { ...defaultRules, decimals, weekStarts };
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          "INSERT INTO experiments (id,user_id,question,metric,unit,rules_json,initial_rule,created_at) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM experiments e WHERE e.user_id=? AND (SELECT COUNT(*) FROM experiment_days d WHERE d.experiment_id=e.id)<5)",
        )
        .bind(
          id,
          userId,
          question,
          metric,
          unit,
          JSON.stringify(rules),
          rule,
          at,
          userId,
        ),
    ]);
    const created = await db
      .prepare("SELECT id FROM experiments WHERE id=? AND user_id=?")
      .bind(id, userId)
      .first();
    if (!created) throw new AppError("이미 진행 중인 실험이 있습니다.", 409);
    return readExperiment(db, userId, now);
  }
  if (!state.experiment) throw new AppError("실험을 먼저 시작해 주세요.", 404);
  const experimentId = state.experiment.id;
  if (data.experiment_id !== experimentId)
    throw new AppError("실험을 찾을 수 없습니다.", 404);
  if (data.action === "record") {
    if (
      typeof data.value !== "number" ||
      !Number.isFinite(data.value) ||
      data.value < 0 ||
      data.value > 1000000
    )
      throw new AppError(
        "0~1,000,000 사이의 실제 값을 적어 주세요.",
        400,
        "value",
      );
    if (typeof data.note !== "string" || data.note.length > 1000)
      throw new AppError("메모는 1,000자 이내입니다.");
    if (state.days.some((d) => d.record_date === today))
      throw new AppError(
        "오늘 기록은 이미 저장했습니다. 하루 한 건을 보존합니다.",
        409,
      );
    if (state.days.length >= 5)
      throw new AppError("이 실험의 5일 기록이 완성되었습니다.", 409);
    if (state.days.length === 2 && !state.change)
      throw new AppError("3일차 전에 계획 규칙 하나를 바꿔 주세요.", 409);
    const id = crypto.randomUUID();
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO experiment_days (id,experiment_id,record_date,value,note,recorded_at) SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM experiment_days WHERE experiment_id=?)<5 AND ((SELECT COUNT(*) FROM experiment_days WHERE experiment_id=?)<2 OR EXISTS (SELECT 1 FROM rule_changes WHERE experiment_id=?))",
          )
          .bind(
            id,
            experimentId,
            today,
            data.value,
            data.note.trim(),
            at,
            experimentId,
            experimentId,
            experimentId,
          ),
      ]);
    } catch {
      throw new AppError(
        "오늘 기록이 이미 있거나 기록 순서가 바뀌었습니다. 새로고침해 주세요.",
        409,
      );
    }
    if (
      !(await db
        .prepare("SELECT id FROM experiment_days WHERE id=?")
        .bind(id)
        .first())
    )
      throw new AppError("규칙 변경 후 3일차 기록을 작성해 주세요.", 409);
  } else if (data.action === "change") {
    if (state.days.length !== 2 || state.change)
      throw new AppError(
        "2일차 뒤, 3일차 전에 한 번만 변경할 수 있습니다.",
        409,
      );
    const next = value(data, "next_rule", 250),
      reason = value(data, "reason", 500);
    if (next === state.experiment.initial_rule)
      throw new AppError("이전과 다른 계획 규칙 하나를 적어 주세요.");
    const id = crypto.randomUUID();
    try {
      await db.batch([
        db
          .prepare(
            "INSERT INTO rule_changes (id,experiment_id,previous_rule,next_rule,reason,day1_id,day2_id,changed_at) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM experiment_days WHERE experiment_id=?)=2 AND NOT EXISTS (SELECT 1 FROM rule_changes WHERE experiment_id=?)",
          )
          .bind(
            id,
            experimentId,
            state.experiment.initial_rule,
            next,
            reason,
            state.days[0].id,
            state.days[1].id,
            at,
            experimentId,
            experimentId,
          ),
      ]);
    } catch {
      throw new AppError("규칙 변경은 한 번만 가능합니다.", 409);
    }
    if (
      !(await db
        .prepare("SELECT id FROM rule_changes WHERE id=?")
        .bind(id)
        .first())
    )
      throw new AppError("규칙 변경 순서를 다시 확인해 주세요.", 409);
  } else throw new AppError("지원하지 않는 실험 요청입니다.");
  return readExperiment(db, userId, now);
}
