"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sun,
  Layers3,
  BarChart3,
  Plus,
  ShieldCheck,
  LoaderCircle,
  Check,
  CircleHelp,
  Menu,
  X,
  BookOpen,
  Share2,
  FlaskConical,
  Upload,
  Settings,
} from "lucide-react";
import ExperimentView from "./features/experiment/ExperimentView";
import MigrationView from "./features/migration/MigrationView";
import AccountView from "./features/account/AccountView";
import type { Identity } from "./features/auth/AuthForm";
import { announceAuth } from "./features/auth/events";
import TodayView from "./features/today/TodayView";
import { PlansGrid, PlanHeader } from "./features/plans/PlanViews";
import PlanForm from "./features/plans/PlanForm";
import History from "./features/plans/History";
import TaskForm from "./features/tasks/TaskForm";
import TaskDetail from "./features/tasks/TaskDetail";
import ExecutionForm from "./features/executions/ExecutionForm";
import ReviewView from "./features/reviews/ReviewView";
import { TaskExplorer } from "./features/tasks/TaskList";
import type { TaskActions } from "./features/tasks/TaskList";
import { Modal } from "./components/ui/Modal";
import { ApiError, loadDiary, request } from "./shared/client";
import {
  emptyState,
  defaultFilters,
  scopeTasks,
  seoulDate,
} from "./shared/domain";
import type {
  DiaryState,
  Filters,
  Plan,
  Task,
  Review,
  Execution,
} from "./shared/domain";
type View =
  "today" | "plans" | "review" | "experiment" | "migration" | "account";
type Dialog = {
  kind:
    | "plan"
    | "task"
    | "execution"
    | "history"
    | "detail"
    | "next"
    | "help"
    | "share";
  plan?: Plan;
  task?: Task;
  execution?: Execution;
  review?: Review;
} | null;
export default function Diary({ user }: { user: Identity }) {
  const [state, setState] = useState<DiaryState>(emptyState),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [exporting] = useState(false);
  const [view, setView] = useState<View>("today"),
    [filters, setFilters] = useState<Filters>(defaultFilters),
    [metric, setMetric] = useState(""),
    [dialog, setDialog] = useState<Dialog>(null),
    [mobile, setMobile] = useState(false),
    [compact, setCompact] = useState(false),
    [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [undo, setUndo] = useState<Task | null>(null),
    [copied, setCopied] = useState(false);
  useEffect(() => {
    const restore = () => {
      setError("");
      setMessage("다시 로그인했어요. 입력을 확인하고 저장해 주세요.");
    };
    window.addEventListener("pds-session-restored", restore);
    return () => window.removeEventListener("pds-session-restored", restore);
  }, []);
  const busyRef = useRef(false),
    failed = useRef<{ action: string; data: Record<string, unknown> } | null>(
      null,
    ),
    requests = useRef(new Map<string, string>());
  const refresh = useCallback(async () => {
    const data = await loadDiary();
    setState(data);
    setLoading(false);
    return data;
  }, []);
  useEffect(() => {
    let alive = true;
    loadDiary()
      .then((data) => {
        if (alive) {
          setState(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (alive) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    function sync() {
      const q = new URLSearchParams(window.location.search);
      const v = q.get("view");
      setView(
        ["plans", "review", "experiment", "migration", "account"].includes(
          v || "",
        )
          ? (v as View)
          : "today",
      );
      setFilters(
        Object.fromEntries(
          Object.entries(defaultFilters).map(([k, v]) => [k, q.get(k) || v]),
        ) as Filters,
      );
      setMetric(q.get("metric") || "");
    }
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    const t = setInterval(() => {
      const today = seoulDate();
      setState((s) => (s.today === today ? s : { ...s, today }));
    }, 30000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (dialog?.kind !== "detail") return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [dialog?.kind]);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setCompact(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!compact || !mobile) return;
    const sidebar = document.querySelector<HTMLElement>(".sidebar");
    sidebar?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    function keys(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobile(false);
        requestAnimationFrame(() =>
          document.querySelector<HTMLElement>(".mobile-menu")?.focus(),
        );
      }
      if (event.key !== "Tab" || !sidebar) return;
      const controls = [
        ...sidebar.querySelectorAll<HTMLElement>("button:not(:disabled)"),
      ].filter((el) => el.getClientRects().length > 0);
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [compact, mobile]);
  useEffect(() => {
    if (metric) {
      requestAnimationFrame(() =>
        document
          .getElementById("metric-evidence")
          ?.focus({ preventScroll: false }),
      );
    }
  }, [metric]);
  function navigate(
    nextView: View,
    patch: Partial<Filters> = {},
    nextMetric = "",
    replace = false,
  ) {
    const f = { ...filters, ...patch };
    const q = new URLSearchParams();
    if (nextView !== "today") q.set("view", nextView);
    for (const [k, v] of Object.entries(f))
      if (v && v !== defaultFilters[k as keyof Filters]) q.set(k, v);
    if (nextMetric) q.set("metric", nextMetric);
    window.history[replace ? "replaceState" : "pushState"](
      {},
      "",
      `${window.location.pathname}${q.size ? "?" + q : ""}`,
    );
    setView(nextView);
    setFilters(f);
    setMetric(nextMetric);
    setMobile(false);
  }
  async function run(action: string, data: Record<string, unknown>) {
    if (busyRef.current)
      throw new ApiError("다른 기록을 저장 중입니다. 잠시 기다려 주세요.");
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("저장 중…");
    const signature = JSON.stringify({ action, data });
    let requestId = requests.current.get(signature);
    if (!requestId) {
      requestId = crypto.randomUUID();
      requests.current.set(signature, requestId);
    }
    try {
      const result = await request<{ id: string }>("/api/diary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data, requestId }),
      });
      const refreshed = await refresh();
      requests.current.delete(signature);
      failed.current = null;
      setMessage("모든 변경 사항이 저장되었어요");
      return { ...result, state: refreshed };
    } catch (e) {
      failed.current = { action, data };
      setMessage("");
      setError((e as Error).message);
      throw e;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const invoke = (action: string, data: Record<string, unknown>) => {
    void run(action, data).catch(() => {});
  };
  const actions: TaskActions = {
    onComplete: (t) =>
      invoke("task.complete", { id: t.id, done: t.status !== "done" }),
    onEdit: (t) => setDialog({ kind: "task", task: t }),
    onDelete: (t) => {
      void run("task.delete", { id: t.id })
        .then(() => {
          setUndo(t);
          setDialog(null);
        })
        .catch(() => {});
    },
    onTimer: (t, stop) => {
      void run(stop ? "timer.stop" : "timer.start", { task_id: t.id })
        .then((r) => {
          if (stop) {
            const execution = r.state.executions.find((e) => e.id === r.id);
            setDialog(
              execution
                ? { kind: "execution", task: t, execution }
                : { kind: "detail", task: t },
            );
          } else setDialog({ kind: "detail", task: t });
        })
        .catch(() => {});
    },
    onRecord: (t, e) => setDialog({ kind: "execution", task: t, execution: e }),
    onDetail: (t) => setDialog({ kind: "detail", task: t }),
  };
  async function logout() {
    await request("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    announceAuth("logout");
    setState(emptyState);
    setDialog(null);
    failed.current = null;
    requests.current.clear();
    window.location.replace("/login");
  }
  const selectedPlan = state.plans.find((p) => p.id === filters.plan),
    all = scopeTasks(state),
    complete = all.filter((t) => t.status === "done").length,
    active = dialog?.task
      ? state.tasks.find((t) => t.id === dialog.task?.id) || dialog.task
      : undefined;
  const addTask = () =>
    setDialog({ kind: state.plans.length ? "task" : "plan" });
  const openPlan = (id: string) =>
    navigate("plans", {
      plan: id,
      from: "",
      to: "",
      q: "",
      status: "",
      priority: "",
      tag: "",
    });
  const nav = [
    {
      key: "today" as View,
      label: "오늘",
      subtitle: "지금의 한 걸음",
      icon: Sun,
    },
    {
      key: "plans" as View,
      label: "나의 계획",
      subtitle: "하고 싶은 일의 방향",
      icon: Layers3,
    },
    {
      key: "review" as View,
      label: "돌아보기",
      subtitle: "다음을 위한 발견",
      icon: BarChart3,
    },
    {
      key: "experiment" as View,
      label: "5일 실험",
      subtitle: "하나를 바꾸고 관찰하기",
      icon: FlaskConical,
    },
    {
      key: "migration" as View,
      label: "기록 이어오기",
      subtitle: "과제6 자료를 내 계정으로",
      icon: Upload,
    },
    {
      key: "account" as View,
      label: "계정과 자료",
      subtitle: "내보내기와 안전한 관리",
      icon: Settings,
    },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        본문으로 바로가기
      </a>
      <aside
        className={`sidebar ${mobile ? "open" : ""}`}
        inert={compact && !mobile}
        aria-hidden={compact && !mobile ? true : undefined}
      >
        <div className="brand">
          <span className="brand-symbol">틈</span>
          <div>
            <strong>
              틈<span>diary</span>
            </strong>
            <small>PLAN · DO · SEE</small>
          </div>
          <button
            className="icon-button mobile-close"
            aria-label="메뉴 닫기"
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <p className="sidebar-caption">나를 알아가는 작은 기록</p>
        <nav aria-label="기본 탐색">
          {nav.map(({ key, label, subtitle, icon: Icon }) => (
            <button
              key={key}
              className={`nav-item ${view === key ? "active" : ""}`}
              aria-current={view === key ? "page" : undefined}
              onClick={() =>
                navigate(key, {
                  plan: "",
                  from: "",
                  to: "",
                  q: "",
                  status: "",
                  priority: "",
                  tag: "",
                })
              }
            >
              <Icon size={21} />
              <span>
                <strong>{label}</strong>
                <small>{subtitle}</small>
              </span>
              {key === "plans" && <b>{state.plans.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-rule" />
        <button
          className="sidebar-new"
          onClick={() => {
            setDialog({ kind: "plan" });
            setMobile(false);
          }}
          disabled={loading || busy}
        >
          <Plus size={18} />새 계획 시작하기
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-quote">
            <span>“</span>
            <p>
              작은 기록이 쌓여
              <br />
              나만의 방향이 됩니다.
            </p>
            <small>ONE STEP AT A TIME</small>
          </div>
          <button
            className="sidebar-help"
            onClick={() => setDialog({ kind: "help" })}
          >
            <CircleHelp size={17} />
            다이어리 사용 안내
          </button>
          <div className="profile">
            <span className="profile-icon">
              <BookOpen size={19} />
            </span>
            <div>
              <strong>{user.name}의 다이어리</strong>
              <small>완료한 한 걸음 {complete}개</small>
            </div>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="메뉴 닫기"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell" inert={compact && mobile}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="메뉴 열기"
              aria-expanded={mobile}
              onClick={() => setMobile(true)}
            >
              <Menu size={22} />
            </button>
            <span>나의 다이어리</span>
            <span>/</span>
            <strong>{nav.find((n) => n.key === view)?.label}</strong>
          </div>
          <div className="topbar-actions">
            <span className="save-state" role="status">
              {busy ? (
                <LoaderCircle size={13} className="spin" />
              ) : error ? (
                <span className="error-dot" />
              ) : (
                <span className="saved-dot" />
              )}
              {busy ? "저장 중" : error ? "연결 확인 필요" : "서버에 기록 보관"}
            </span>
            <button
              className="button secondary small"
              disabled={loading || exporting}
              onClick={() => navigate("account")}
              aria-label="전체 자료 내보내기"
            >
              {exporting && <LoaderCircle size={15} className="spin" />}
              <span>전체 내보내기</span>
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <div className="public-notice">
            <ShieldCheck size={17} />
            <p>
              로그인한 내 계정의 기록만 표시합니다. 기록은 서버에 안전하게
              보관하고, 기기를 떠날 때는 로그아웃하세요.
            </p>
            <span>나만의 다이어리</span>
          </div>
          {error && (
            <div className="error-banner" role="alert">
              <p>
                {error}
                {state.plans.length > 0 && (
                  <small>마지막으로 불러온 자료를 표시하고 있어요.</small>
                )}
              </p>
              <button
                className="button secondary small"
                disabled={busy}
                onClick={() => {
                  const retry = failed.current;
                  if (retry) invoke(retry.action, retry.data);
                  else
                    void refresh()
                      .then(() => setError(""))
                      .catch((e) => setError(e.message));
                }}
              >
                다시 시도
              </button>
            </div>
          )}
          {undo && (
            <div className="undo-banner" role="status">
              <p>‘{undo.title}’ 할 일을 삭제했어요.</p>
              <button
                disabled={busy}
                className="text-button"
                onClick={() => {
                  void run("task.restore", { id: undo.id })
                    .then(() => setUndo(null))
                    .catch(() => {});
                }}
              >
                실행 취소
              </button>
              <button
                className="icon-button"
                aria-label="삭제 안내 닫기"
                onClick={() => setUndo(null)}
              >
                <X size={15} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading-state" role="status">
              <LoaderCircle className="spin" size={27} />
              <p>다이어리를 펼치고 있어요…</p>
            </div>
          ) : view === "experiment" ? (
            <ExperimentView />
          ) : view === "migration" ? (
            <MigrationView email={user.email} onDone={refresh} />
          ) : view === "account" ? (
            <AccountView user={user} onLogout={logout} />
          ) : view === "today" ? (
            <TodayView
              state={state}
              actions={actions}
              busy={busy}
              onAdd={addTask}
              onPlan={() => setDialog({ kind: "plan" })}
              onReview={() => navigate("review")}
              onPlans={() => navigate("plans", { plan: "" })}
            />
          ) : view === "plans" ? (
            <>
              {selectedPlan ? (
                <>
                  <PlanHeader
                    plan={selectedPlan}
                    state={state}
                    onBack={() => navigate("plans", { plan: "" })}
                    onEdit={() =>
                      setDialog({ kind: "plan", plan: selectedPlan })
                    }
                    onHistory={() =>
                      setDialog({ kind: "history", plan: selectedPlan })
                    }
                  />
                  <TaskExplorer
                    state={state}
                    tasks={scopeTasks(state, { plan: selectedPlan.id })}
                    filters={filters}
                    onFilters={(p) => navigate(view, p, "", "q" in p)}
                    actions={actions}
                    busy={busy}
                    onAdd={addTask}
                  />
                  <button
                    className="review-shortcut"
                    onClick={() =>
                      navigate("review", {
                        plan: selectedPlan.id,
                        from: "",
                        to: "",
                      })
                    }
                  >
                    <BarChart3 size={20} />
                    <span>이 계획의 예상과 실제를 돌아볼까요?</span>
                  </button>
                </>
              ) : (
                <>
                  <PlansGrid
                    state={state}
                    onSelect={openPlan}
                    onAdd={() => setDialog({ kind: "plan" })}
                  />
                  {state.tasks.some((t) => !t.deleted_at) && (
                    <TaskExplorer
                      state={state}
                      tasks={all}
                      filters={filters}
                      onFilters={(p) => navigate(view, p, "", "q" in p)}
                      actions={actions}
                      busy={busy}
                      onAdd={addTask}
                    />
                  )}
                </>
              )}
            </>
          ) : (
            <ReviewView
              state={state}
              filters={filters}
              onFilters={(p) => navigate(view, p)}
              metric={metric}
              onMetric={(m) => navigate(view, {}, m)}
              actions={actions}
              run={run}
              busy={busy}
              onNext={(r) =>
                setDialog({
                  kind: "next",
                  review: r,
                  plan: state.plans.find((p) => p.id === r.plan_id),
                })
              }
              onOpenPlan={openPlan}
              onShare={() => {
                setCopied(false);
                setDialog({ kind: "share" });
              }}
            />
          )}
          <footer className="main-footer">
            <span>
              틈 <i>·</i> 계획과 실제 사이, 나를 알아가는 기록.
            </span>
            <span role="status" aria-live="polite">
              {message || "PLAN · DO · SEE"}
            </span>
          </footer>
        </main>
      </div>
      {dialog?.kind === "plan" && (
        <PlanForm
          plan={dialog.plan}
          run={run}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            setDialog(null);
            openPlan(id);
          }}
        />
      )}
      {dialog?.kind === "task" && (
        <TaskForm
          task={dialog.task}
          plans={state.plans}
          planId={filters.plan}
          run={run}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "execution" && dialog.task && (
        <ExecutionForm
          task={dialog.task}
          execution={dialog.execution}
          run={run}
          onClose={() => setDialog({ kind: "detail", task: dialog.task })}
        />
      )}
      {dialog?.kind === "detail" && active && (
        <TaskDetail
          task={active}
          state={state}
          actions={actions}
          busy={busy}
          now={now}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "history" && dialog.plan && (
        <History
          plan={
            state.plans.find((p) => p.id === dialog.plan?.id) || dialog.plan
          }
          revisions={state.revisions}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "next" && dialog.review && (
        <PlanForm
          plan={dialog.plan}
          review={dialog.review}
          tasks={state.tasks.filter(
            (t) => t.plan_id === dialog.review?.plan_id && !t.deleted_at,
          )}
          run={run}
          onClose={() => setDialog(null)}
          onSaved={(id) => {
            setDialog(null);
            openPlan(id);
          }}
        />
      )}
      {dialog?.kind === "help" && (
        <Modal
          title="작은 기록으로 나를 알아가요"
          onClose={() => setDialog(null)}
        >
          <div className="help-steps">
            <article>
              <span>01</span>
              <div>
                <h3>계획을 세워요</h3>
                <p>
                  기간과 성공 기준을 적고 할 일을 나눠요. 계획을 고쳐도 처음
                  생각은 수정 이력에 남아요.
                </p>
              </div>
            </article>
            <article>
              <span>02</span>
              <div>
                <h3>실제로 한 일을 남겨요</h3>
                <p>
                  타이머를 사용하거나 시작·종료·소요 시간을 직접 입력해요.
                  완료는 별도로 표시하고 언제든 되돌릴 수 있어요.
                </p>
              </div>
            </article>
            <article>
              <span>03</span>
              <div>
                <h3>돌아보고, 다음으로 이어가요</h3>
                <p>
                  숫자를 눌러 근거 기록을 확인하고 개선점 한 가지를 다음 계획에
                  연결해요.
                </p>
              </div>
            </article>
          </div>
          <p className="hint">
            날짜·시각은 서울 기준, 소요 시간은 분 단위입니다. 타이머는 올림해
            최소 1분으로 기록하며 실제 시간은 직접 보정할 수 있어요. 전체
            내보내기에는 수정 이력과 삭제한 기록도 포함됩니다.
          </p>
        </Modal>
      )}
      {dialog?.kind === "share" && (
        <Modal
          title="같은 조건으로 다시 돌아오기"
          subtitle="주소에 조회 조건이 포함됩니다. 검색어에 공개하기 어려운 내용이 없는지 확인해 주세요."
          onClose={() => setDialog(null)}
        >
          <label>
            조회 주소
            <input
              readOnly
              value={typeof window !== "undefined" ? window.location.href : ""}
              onFocus={(e) => e.target.select()}
            />
          </label>
          <button
            className="button primary"
            onClick={() => {
              void navigator.clipboard
                .writeText(window.location.href)
                .then(() => setCopied(true))
                .catch(() =>
                  setError("주소 입력칸을 선택해 직접 복사해 주세요."),
                );
            }}
          >
            <Share2 size={16} />
            {copied ? "주소를 복사했어요" : "주소 복사"}
          </button>
        </Modal>
      )}
    </div>
  );
}
