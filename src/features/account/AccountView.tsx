"use client";
import { useEffect, useState } from "react";
import { Download, LockKeyhole, Trash2 } from "lucide-react";
import { request } from "../../shared/client";
import type { Identity } from "../auth/AuthForm";
import { announceAuth } from "../auth/events";
export default function AccountView({
  user,
  onLogout,
}: {
  user: Identity;
  onLogout: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const restore = () => {
      setError("");
      setMessage("다시 로그인했어요. 작업을 이어갈 수 있어요.");
    };
    window.addEventListener("pds-session-restored", restore);
    return () => window.removeEventListener("pds-session-restored", restore);
  }, []);
  async function exportAll() {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await request<Record<string, unknown>>("/api/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `pds-diary-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        "전체 자료 파일을 만들었습니다. 브라우저의 다운로드 목록에서 저장 완료를 확인하세요.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function password(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form);
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        }),
      });
      form.reset();
      setMessage(
        "비밀번호를 바꿨어요. 이전 로그인 세션은 모두 해제되었고 이 화면에는 새 세션이 적용됩니다.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await request("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: data.get("password"),
          confirm: data.get("confirm"),
        }),
      });
      announceAuth("logout");
      window.location.replace("/login?deleted=1");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <section className="feature-page">
      <p className="eyebrow">YOUR ACCOUNT · YOUR RECORDS</p>
      <h1>내 계정과 자료</h1>
      <p className="muted">
        {user.name} · {user.email}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success-note" role="status">
          {message}
        </p>
      )}
      <div className="feature-card">
        <h2>
          <Download size={21} /> 내 자료 전체 내보내기
        </h2>
        <p>
          이 계정의 계획·수정 이력·할 일(삭제 표시
          포함)·실행·타이머·완료·회고·5일 실험 전체와 규칙 변경·자료 이전 기록을
          JSON 파일 하나로 만듭니다.
        </p>
        <p className="muted">
          비밀번호·인증값·서버 설정·다른 계정 자료는 포함하지 않습니다. 개인
          파일이므로 GitHub에 올리지 말고 안전하게 보관하세요.
        </p>
        <button
          className="button primary"
          disabled={busy}
          onClick={() => void exportAll()}
        >
          범위를 확인하고 파일 내려받기
        </button>
      </div>
      <form
        className="feature-card stack-form"
        onSubmit={(e) => void password(e)}
      >
        <h2>
          <LockKeyhole size={21} /> 비밀번호 변경
        </h2>
        <label>
          현재 비밀번호
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <label>
          새 비밀번호
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <label>
          새 비밀번호 확인
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        <p className="muted">
          변경하면 이전에 발급한 로그인 인증값은 이 기기를 포함해 사용할 수
          없고, 현재 화면에 새 세션이 발급됩니다.
        </p>
        <button className="button secondary" disabled={busy}>
          비밀번호 변경
        </button>
      </form>
      <div className="feature-card">
        <h2>로그아웃</h2>
        <p>
          서버에서도 현재 세션을 폐기합니다. 저장하지 않은 입력은 지워집니다.
        </p>
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => void onLogout().catch((e) => setError(e.message))}
        >
          로그아웃
        </button>
      </div>
      <div className="feature-card danger-card">
        <h2>
          <Trash2 size={21} /> 계정 삭제
        </h2>
        <p>
          이 계정과 위의 모든 자료·이력·실험·이전 기록·로그인 세션을 함께 영구
          삭제합니다. 복구할 수 없으니 먼저 내보내기를 확인하세요.
        </p>
        <p className="muted">
          과제6 원본 앱과 그곳의 자료는 별도로 남아 있습니다. 이 앱에서 삭제해도
          원본이나 이미 내려받은 개인 파일은 지워지지 않습니다.
        </p>
        {!deleting ? (
          <button
            className="button danger"
            disabled={busy}
            onClick={() => setDeleting(true)}
          >
            삭제 범위를 확인하고 계속
          </button>
        ) : (
          <form className="stack-form" onSubmit={(e) => void remove(e)}>
            <label>
              현재 비밀번호
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                required
              />
            </label>
            <label>
              ‘내 계정 삭제’를 그대로 입력
              <input
                name="confirm"
                autoComplete="off"
                required
                pattern="내 계정 삭제"
              />
            </label>
            <div className="button-row">
              <button className="button danger" disabled={busy}>
                내 계정과 자료 영구 삭제
              </button>
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleting(false)}
              >
                취소
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
