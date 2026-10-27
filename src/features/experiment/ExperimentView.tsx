"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, FlaskConical } from "lucide-react";
import { request } from "../../shared/client";
import { defaultRules, experimentSummary } from "../../shared/experiment/index";
import type {
  ExperimentState,
  ExperimentRules,
} from "../../shared/experiment/index";
export default function ExperimentView() {
  const [state, setState] = useState<ExperimentState | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    const restore = () => {
      setError("");
      setMessage("다시 로그인했어요. 입력을 확인하고 저장해 주세요.");
    };
    window.addEventListener("pds-session-restored", restore);
    return () => window.removeEventListener("pds-session-restored", restore);
  }, []);
  const load = useCallback(
    () =>
      request<ExperimentState>("/api/experiment")
        .then(setState)
        .catch((e) => setError(e.message)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function send(event: React.FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    try {
      const result = await request<ExperimentState>("/api/experiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fields,
          action,
          experiment_id: state?.experiment?.id,
          ...(action === "start" ? { decimals: Number(fields.decimals) } : {}),
          ...(action === "record" ? { value: Number(fields.value) } : {}),
        }),
      });
      setState(result);
      form.reset();
      setMessage(
        action === "change"
          ? "새 규칙을 기록했어요. 다음 날짜부터 3일차 기록을 이어가세요."
          : "기록을 안전하게 저장했어요.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!state)
    return (
      <section className="feature-page">
        <h1>5일의 작은 실험</h1>
        {error ? (
          <p role="alert" className="form-error">
            {error}
          </p>
        ) : (
          <p role="status">실험을 불러오고 있어요…</p>
        )}
        <button className="button secondary" onClick={() => void load()}>
          다시 불러오기
        </button>
      </section>
    );
  const exp = state.experiment,
    count = state.days.length,
    todaySaved = state.days.some((d) => d.record_date === state.today),
    stats = experimentSummary(state),
    rules = exp
      ? (JSON.parse(exp.rules_json) as ExperimentRules)
      : defaultRules;
  return (
    <section className="feature-page">
      <p className="eyebrow">PLAN · TRY · LEARN</p>
      <h1>
        <FlaskConical size={29} /> 5일의 작은 실험
      </h1>
      <p className="muted">
        하나의 질문을 정하고, 2일을 돌아본 뒤 계획 규칙 하나를 바꿔 보세요. 기준
        시각은 서울입니다.
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      {!exp ? (
        <form
          className="feature-card stack-form"
          onSubmit={(e) => void send(e, "start")}
        >
          <h2>무엇을 알아보고 싶나요?</h2>
          <label>
            답하려는 질문 한 문장
            <input
              name="question"
              required
              maxLength={300}
              placeholder="예: 시작 시간을 정하면 매일 꾸준히 실행할 수 있을까?"
            />
          </label>
          <div className="form-row">
            <label>
              관찰할 지표 한 개
              <input
                name="metric"
                required
                maxLength={80}
                placeholder="예: 하루 집중 시간"
              />
            </label>
            <label>
              단위
              <input name="unit" required maxLength={20} placeholder="예: 분" />
            </label>
          </div>
          <label>
            처음 적용할 계획 규칙 하나
            <textarea
              name="initial_rule"
              required
              maxLength={250}
              placeholder="예: 저녁 식사 후에 30분간 시작한다."
            />
          </label>
          <div className="form-row">
            <label>
              합계·평균 반올림
              <select name="decimals" defaultValue="1">
                <option value="0">정수</option>
                <option value="1">소수 첫째 자리</option>
                <option value="2">소수 둘째 자리</option>
                <option value="3">소수 셋째 자리</option>
              </select>
            </label>
            <label>
              주 시작 요일
              <select name="weekStarts" defaultValue="monday">
                <option value="monday">월요일</option>
                <option value="sunday">일요일</option>
              </select>
            </label>
          </div>
          <details>
            <summary>고정할 계산 규칙 확인</summary>
            <ul>
              <li>하루 값: 선택한 지표의 실제 값을 직접 기록합니다.</li>
              <li>{defaultRules.missing}</li>
              <li>{defaultRules.duplicate}</li>
              <li>{defaultRules.outlier}</li>
              <li>
                합계는 원래 값의 합, 평균은 합계 ÷ 실제 기록일 수입니다. 마지막
                표시 단계에서 반올림합니다.
              </li>
            </ul>
          </details>
          <p className="muted">
            시작하면 질문·지표·단위·계산 규칙이 고정됩니다. 변경하는 것은 2일차
            뒤의 계획 규칙 하나입니다.
          </p>
          <button className="button primary" disabled={busy}>
            설정을 확인하고 실험 시작
          </button>
        </form>
      ) : (
        <>
          <div className="feature-card">
            <p className="eyebrow">고정한 질문</p>
            <h2>{exp.question}</h2>
            <p>
              {exp.metric} · {exp.unit}
            </p>
            <ol className="day-progress" aria-label="5일 진행 현황">
              {[1, 2, 3, 4, 5].map((day) => (
                <li className={day <= count ? "complete" : ""} key={day}>
                  {day <= count ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <span>{day}</span>
                  )}
                  <strong>{day}일차</strong>
                  <small>{state.days[day - 1]?.record_date || "기록 전"}</small>
                </li>
              ))}
            </ol>
            <p>
              <strong>현재 계획 규칙</strong>{" "}
              {state.change?.next_rule || exp.initial_rule}
            </p>
            <details>
              <summary>고정한 계산·날짜 규칙</summary>
              <p>{rules.missing}</p>
              <p>{rules.duplicate}</p>
              <p>{rules.outlier}</p>
              <p>
                원값의 합계와 합계 ÷ 기록일 수, 표시할 때 소수 {rules.decimals}
                자리 반올림. 주 시작{" "}
                {rules.weekStarts === "monday" ? "월요일" : "일요일"}. 날짜
                Asia/Seoul.
              </p>
            </details>
          </div>
          {count === 2 && !state.change && (
            <form
              className="feature-card stack-form rule-change"
              onSubmit={(e) => void send(e, "change")}
            >
              <p className="eyebrow">2일차 뒤 · 3일차 전</p>
              <h2>계획 규칙 하나만 바꿔 보세요</h2>
              <p>
                앞의 두 기록 {state.days.map((d) => d.record_date).join(", ")}을
                근거로 바꿉니다.
              </p>
              <p className="muted">이전 규칙: {exp.initial_rule}</p>
              <label>
                새 계획 규칙 한 문장
                <textarea name="next_rule" maxLength={250} required />
              </label>
              <label>
                두 기록을 보고 바꾸는 이유
                <textarea name="reason" maxLength={500} required />
              </label>
              <button className="button primary" disabled={busy}>
                변경 내용과 시각 저장
              </button>
            </form>
          )}
          {count < 5 && !(count === 2 && !state.change) && (
            <div className="feature-card">
              {todaySaved ? (
                <p className="success-note">
                  오늘 기록을 마쳤어요. 다음 실제 날짜에 {count + 1}일차를
                  이어가세요.
                </p>
              ) : (
                <form
                  className="stack-form"
                  onSubmit={(e) => void send(e, "record")}
                >
                  <h2>
                    {count + 1}일차 · {state.today}
                  </h2>
                  <label>
                    오늘의 {exp.metric} ({exp.unit})
                    <input
                      name="value"
                      type="number"
                      min="0"
                      max="1000000"
                      step="any"
                      required
                    />
                  </label>
                  <label>
                    기록 근거·특이한 점
                    <textarea name="note" maxLength={1000} defaultValue="" />
                  </label>
                  <p className="muted">
                    오늘 실제 값 한 건을 확정해서 저장합니다. 저장한 기록은
                    보존하며 과거 날짜로 입력하지 않습니다.
                  </p>
                  <button className="button primary" disabled={busy}>
                    오늘 실제 기록 확정
                  </button>
                </form>
              )}
            </div>
          )}
          {state.change && (
            <div className="feature-card">
              <h2>규칙 변경 기록</h2>
              <p>
                {state.change.previous_rule} → {state.change.next_rule}
              </p>
              <p>{state.change.reason}</p>
              <small className="muted">
                {new Date(state.change.changed_at).toLocaleString("ko-KR", {
                  timeZone: "Asia/Seoul",
                })}{" "}
                · 1·2일차 기록 참조 보존
              </small>
            </div>
          )}
          <div className="feature-card">
            <h2>같은 기준으로 비교하기</h2>
            <div className="summary-grid">
              {[
                ["변경 전 · 최대 2일", stats.before],
                ["변경 후 · 최대 3일", stats.after],
                ["전체 · 정확히 5일 목표", stats.total],
              ].map(([label, stat]) => {
                const item = stat as typeof stats.total;
                return (
                  <div key={String(label)}>
                    <small>
                      {String(label)} · 실제 {item.count}일
                    </small>
                    <strong>
                      합계 {item.sum} {exp.unit}
                    </strong>
                    <span>
                      평균 {item.average ?? "—"} {exp.unit}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>일차</th>
                    <th>서울 날짜</th>
                    <th>
                      {exp.metric} ({exp.unit})
                    </th>
                    <th>근거·메모</th>
                  </tr>
                </thead>
                <tbody>
                  {state.days.map((day, i) => (
                    <tr key={day.id}>
                      <td>{i + 1}일차</td>
                      <td>{day.record_date}</td>
                      <td>{day.value}</td>
                      <td>{day.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {count > 0 && (
              <p className="muted">
                검산: {state.days.map((d) => d.value).join(" + ")} ={" "}
                {stats.total.rawSum} {exp.unit}. 평균 = {stats.total.rawSum} ÷{" "}
                {count} → {stats.total.average} {exp.unit}.
              </p>
            )}
            {count === 5 && (
              <p className="success-note" role="status">
                <CheckCircle2 size={18} />
                실제 날짜 5일의 기록을 마쳤어요. 결과가 나빠져도 그대로 보존하고
                돌아보세요. 전체 내보내기에 이 기록과 규칙 변경이 포함됩니다.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
