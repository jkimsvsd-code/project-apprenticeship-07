import { env } from "cloudflare:workers";
import { createAuth } from "./auth/config";
import { AppError } from "./store";
import type { Database } from "./store";
export function runtime() {
  if (!env.DB) throw new AppError("저장소에 연결하지 못했습니다.", 503);
  const secret = env.BETTER_AUTH_SECRET;
  const baseURL = env.BETTER_AUTH_URL;
  if (!secret || !baseURL)
    throw new AppError(
      "인증 환경 설정이 필요합니다. 관리자에게 문의해 주세요.",
      503,
    );
  return {
    db: env.DB as unknown as Database,
    d1: env.DB,
    auth: createAuth(env.DB, secret, baseURL),
  };
}
export async function requireIdentity(headers: Headers) {
  const context = runtime();
  const session = await context.auth.api.getSession({
    headers,
    query: { disableCookieCache: true },
  });
  if (!session)
    throw new AppError("로그인이 만료되었습니다. 다시 로그인해 주세요.", 401);
  return { ...context, user: session.user, session: session.session };
}
