export type ExperimentRules = {
  missing: string;
  duplicate: string;
  outlier: string;
  decimals: number;
  weekStarts: "monday" | "sunday";
};
export type Experiment = {
  id: string;
  question: string;
  metric: string;
  unit: string;
  initial_rule: string;
  rules_json: string;
  created_at: string;
};
export type ExperimentDay = {
  id: string;
  experiment_id: string;
  record_date: string;
  value: number;
  note: string;
  recorded_at: string;
};
export type RuleChange = {
  id: string;
  previous_rule: string;
  next_rule: string;
  reason: string;
  day1_id: string;
  day2_id: string;
  changed_at: string;
};
export type ExperimentState = {
  experiment: Experiment | null;
  days: ExperimentDay[];
  change: RuleChange | null;
  today: string;
};
export const defaultRules: ExperimentRules = {
  missing:
    "기록 없는 날짜는 누락으로 표시하고 0이나 사용일로 계산하지 않습니다.",
  duplicate: "서울 날짜별 한 건만 기록하며 중복 저장은 거절합니다.",
  outlier:
    "0~1,000,000 범위의 원래 값을 보존하고 특이한 이유를 메모합니다. 범위 밖은 입력 오류로 거절합니다.",
  decimals: 1,
  weekStarts: "monday",
};
export function summarize(values: number[], decimals: number) {
  const rawSum = values.reduce((a, b) => a + b, 0);
  const round = (v: number) =>
    Math.round((v + Number.EPSILON) * 10 ** decimals) / 10 ** decimals;
  return {
    count: values.length,
    sum: round(rawSum),
    average: values.length ? round(rawSum / values.length) : null,
    rawSum,
  };
}
export function experimentSummary(state: ExperimentState) {
  const decimals = state.experiment
    ? (JSON.parse(state.experiment.rules_json) as ExperimentRules).decimals
    : 1;
  return {
    before: summarize(
      state.days.slice(0, 2).map((x) => x.value),
      decimals,
    ),
    after: summarize(
      state.days.slice(2, 5).map((x) => x.value),
      decimals,
    ),
    total: summarize(
      state.days.map((x) => x.value),
      decimals,
    ),
  };
}
