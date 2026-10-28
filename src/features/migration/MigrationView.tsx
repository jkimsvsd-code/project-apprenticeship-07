"use client";
import { useEffect, useState } from "react";
import { Upload, CheckCircle2, LoaderCircle } from "lucide-react";
import { request } from "../../shared/client";
import { IMPORT_FILE_BYTES } from "../../shared/import-limits";
type Preview = {
  counts: Record<string, number>;
  actual_minutes: number;
  alreadyImported: boolean;
  imported_at: string | null;
};
export default function MigrationView({
  email,
  onDone,
}: {
  email: string;
  onDone: () => Promise<unknown>;
}) {
  const [source, setSource] = useState<unknown>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [done, setDone] = useState(false);
  useEffect(() => {
    const restore = () => setError("");
    window.addEventListener("pds-session-restored", restore);
    return () => window.removeEventListener("pds-session-restored", restore);
  }, []);
  async function pick(file: File | undefined) {
    setError("");
    setPreview(null);
    setSource(null);
    setDone(false);
    if (!file) return;
    if (file.size > IMPORT_FILE_BYTES) {
      setError("2MB 이하의 과제6 JSON 파일을 선택해 주세요.");
      return;
    }
    setBusy(true);
    try {
      const data = JSON.parse(await file.text());
      const result = await request<Preview>("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", source: data }),
      });
      setSource(data);
      setPreview(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await request("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", source }),
      });
      setDone(true);
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-page">
      <p className="eyebrow">CONTINUE YOUR STORY</p>
      <h1>이전 기록 이어오기</h1>
      <p className="muted">
        과제6의 계획·할 일·실행·회고를 지금 로그인한 내 계정으로 가져와요. 원본
        앱의 자료는 그대로 유지됩니다.
      </p>
      <div className="feature-card stack-form">
        <h2>1. 과제6 내보내기 파일 선택</h2>
        <p>
          과제6의 ‘전체 내보내기’로 받은 JSON 파일을 선택하세요. 이 프로젝트에
          보관한 비공개 백업도 사용할 수 있어요.
        </p>
        <p className="muted">
          파일은 2MB 이하, 계정당 서로 다른 파일 5개·누적 20,000건까지 가져올 수
          있어요. 같은 파일의 재시도는 이 한도에 추가되지 않습니다.
        </p>
        <label className="file-picker">
          <Upload size={22} />
          <span>과제6 JSON 파일 선택</span>
          <input
            type="file"
            accept="application/json,.json"
            disabled={busy}
            onChange={(e) => void pick(e.target.files?.[0])}
          />
        </label>
        <p className="muted">
          가져올 계정: <strong>{email}</strong>
        </p>
      </div>
      {busy && (
        <p role="status">
          <LoaderCircle size={17} className="spin" /> 확인하고 있어요…
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {preview && (
        <div className="feature-card">
          <h2>2. 가져올 자료 확인</h2>
          <div className="summary-grid">
            {Object.entries(preview.counts).map(([k, v]) => (
              <div key={k}>
                <small>
                  {{
                    plans: "계획",
                    revisions: "수정 이력",
                    tasks: "할 일",
                    executions: "실행 기록",
                    timers: "실행 중 타이머",
                    reviews: "회고",
                    completions: "완료 기록",
                  }[k] || k}
                </small>
                <strong>{v}건</strong>
              </div>
            ))}
          </div>
          <p>
            실행 시간 합계 <strong>{preview.actual_minutes}분</strong>
          </p>
          <p className="muted">
            연결 관계와 원래 작성 시각을 보존합니다. 같은 원본 자료는 재시도해도
            중복되지 않아요.
          </p>
          {preview.alreadyImported || done ? (
            <p className="success-note" role="status">
              <CheckCircle2 size={18} />이 계정에 가져온 자료입니다. 나의
              계획에서 확인하세요.
            </p>
          ) : (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => void save()}
            >
              확인한 자료를 내 계정으로 가져오기
            </button>
          )}
        </div>
      )}
    </section>
  );
}
