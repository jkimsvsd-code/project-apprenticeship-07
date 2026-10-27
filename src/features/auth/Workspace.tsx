"use client";
import { useEffect, useState, useRef } from "react";
import AuthForm from "./AuthForm";
import type { Identity } from "./AuthForm";
import Diary from "../../Diary";
export default function Workspace({ user }: { user: Identity }) {
  const [expired, setExpired] = useState(false);
  const expiredRef = useRef(false);
  useEffect(() => {
    const expire = () => {
      if (expiredRef.current) return;
      document
        .querySelectorAll<HTMLInputElement>(
          'input[type="password"],input[autocomplete="current-password"],input[autocomplete="new-password"]',
        )
        .forEach((input) => {
          input.value = "";
        });
      expiredRef.current = true;
      setExpired(true);
    };
    window.addEventListener("pds-session-expired", expire);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("pds07-auth")
        : null;
    if (channel)
      channel.onmessage = (event) => {
        const data = event.data as { type?: string; userId?: string };
        if (data.type === "logout") window.location.replace("/login");
        else if (data.type === "login" && data.userId !== user.id)
          window.location.replace("/");
        else if (data.type === "login") {
          expiredRef.current = false;
          setExpired(false);
          window.dispatchEvent(new Event("pds-session-restored"));
        }
      };
    const timer = window.setInterval(() => {
      void fetch("/api/auth/session", { cache: "no-store" })
        .then(async (r) => {
          if (r.status === 401) expire();
          else if (r.ok) {
            const data = (await r.json()) as { user: Identity };
            if (data.user.id !== user.id) window.location.replace("/");
          }
        })
        .catch(() => {});
    }, 60000);
    return () => {
      window.removeEventListener("pds-session-expired", expire);
      clearInterval(timer);
      channel?.close();
    };
  }, [user.id]);
  return (
    <>
      <div inert={expired} aria-hidden={expired ? true : undefined}>
        <Diary user={user} />
      </div>
      {expired && (
        <div
          className="reauth-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="로그인 만료"
        >
          <AuthForm
            reauth
            onAuthenticated={(next) => {
              if (next.id !== user.id) {
                window.location.replace("/");
                return;
              }
              expiredRef.current = false;
              setExpired(false);
              window.dispatchEvent(new Event("pds-session-restored"));
            }}
          />
        </div>
      )}
    </>
  );
}
