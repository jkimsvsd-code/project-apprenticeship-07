"use client";
import { useState } from "react";
import { announceAuth } from "./events";
import { Eye, EyeOff, LockKeyhole, LoaderCircle } from "lucide-react";
export type Identity = { id: string; email: string; name: string };
export function safeReturn(value: string | null) {
  return value &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\u0000-\u001f]/.test(value)
    ? value
    : "/";
}
export default function AuthForm({
  signup = false,
  reauth = false,
  onAuthenticated,
}: {
  signup?: boolean;
  reauth?: boolean;
  onAuthenticated?: (user: Identity) => void;
}) {
  const [visible, setVisible] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = event.currentTarget,
      data = new FormData(form);
    try {
      const response = await fetch(`/api/auth/${signup ? "signup" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name") || "나",
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error || "로그인하지 못했습니다.");
      const session = await fetch("/api/auth/session", { cache: "no-store" });
      if (!session.ok) throw new Error("로그인 상태를 확인하지 못했습니다.");
      const current = (await session.json()) as { user: Identity };
      form.reset();
      announceAuth("login", current.user.id);
      if (onAuthenticated) onAuthenticated(current.user);
      else
        window.location.assign(
          safeReturn(new URLSearchParams(window.location.search).get("next")),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={reauth ? "reauth-card" : "auth-card"}>
      <a className="auth-brand" href="/login">
        <span className="brand-symbol">틈</span>
        <span>나만의 작은 기록</span>
      </a>
      <div className="auth-heading">
        <LockKeyhole size={24} />
        <p className="eyebrow">PLAN · DO · SEE</p>
        <h1>
          {reauth
            ? "다시 로그인해 주세요"
            : signup
              ? "나만의 다이어리를 시작해요"
              : "다시, 나의 기록으로"}
        </h1>
        <p className="muted">
          {reauth
            ? "같은 계정으로 로그인하면 이 화면의 입력을 이어갈 수 있어요."
            : "계획과 실제 사이의 이야기를 나만 볼 수 있게 보관해요."}
        </p>
      </div>
      <form onSubmit={submit} className="stack-form">
        {signup && (
          <label>
            이름
            <input
              name="name"
              autoComplete="name"
              maxLength={50}
              required
              disabled={busy}
            />
          </label>
        )}
        <label>
          이메일
          <input
            name="email"
            type="email"
            autoFocus={reauth}
            autoComplete="username"
            inputMode="email"
            maxLength={254}
            required
            disabled={busy}
          />
        </label>
        <label>
          비밀번호
          <div className="password-field">
            <input
              name="password"
              type={visible ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              minLength={signup ? 12 : 1}
              maxLength={128}
              required
              disabled={busy}
              aria-describedby={signup ? "password-guide" : undefined}
            />
            <button
              type="button"
              className="icon-button"
              onClick={() => setVisible((v) => !v)}
              aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
              aria-pressed={visible}
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {signup && (
          <small className="muted" id="password-guide">
            12~128자로 설정하세요. 비밀번호 관리자에서 만든 긴 비밀번호를 사용할
            수 있어요.
          </small>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={17} /> : null}
          {busy ? "확인 중…" : signup ? "계정 만들기" : "로그인"}
        </button>
      </form>
      {!reauth && (
        <p className="auth-switch">
          {signup ? "이미 계정이 있나요?" : "처음 오셨나요?"}{" "}
          <a href={signup ? "/login" : "/signup"}>
            {signup ? "로그인" : "계정 만들기"}
          </a>
        </p>
      )}
      {reauth && (
        <p className="muted">
          다른 계정으로 로그인하면 이전 계정의 입력을 비우고 새 다이어리를
          엽니다.
        </p>
      )}
      <small className="muted">
        이메일 확인·비밀번호 찾기 기능은 아직 제공하지 않습니다. 로그인 정보를
        안전하게 보관해 주세요.
      </small>
    </div>
  );
}
