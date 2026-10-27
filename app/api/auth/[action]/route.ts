import { runtime, requireIdentity } from "@/src/server/runtime";
import { body, failure, json, privateHeaders } from "@/src/server/http";
import { AppError } from "@/src/server/store";
export const dynamic = "force-dynamic";
function action(request: Request) {
  return new URL(request.url).pathname.split("/").pop();
}
export async function GET(request: Request) {
  try {
    if (action(request) !== "session")
      throw new AppError("요청을 찾을 수 없습니다.", 404);
    const c = await requireIdentity(request.headers);
    return json({
      user: { id: c.user.id, email: c.user.email, name: c.user.name },
      expiresAt: c.session.expiresAt,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const data = await body(request),
      { auth, d1 } = runtime();
    let response: Response;
    switch (action(request)) {
      case "signup": {
        if (
          typeof data.email !== "string" ||
          typeof data.password !== "string" ||
          typeof data.name !== "string"
        )
          throw new AppError("가입 정보를 확인해 주세요.");
        response = await auth.api.signUpEmail({
          headers: request.headers,
          body: {
            email: data.email.trim().toLowerCase(),
            password: data.password,
            name: data.name.trim().slice(0, 50) || "나",
          },
          asResponse: true,
        });
        break;
      }
      case "login": {
        if (typeof data.email !== "string" || typeof data.password !== "string")
          throw new AppError("이메일과 비밀번호를 확인해 주세요.");
        response = await auth.api.signInEmail({
          headers: request.headers,
          body: {
            email: data.email.trim().toLowerCase(),
            password: data.password,
          },
          asResponse: true,
        });
        break;
      }
      case "logout": {
        const current = await requireIdentity(request.headers);
        response = await auth.api.signOut({
          headers: request.headers,
          body: {},
          asResponse: true,
        });
        // The library clears cookies even if its own deletion fails; enforce DB revocation before success.
        await d1
          .prepare("DELETE FROM auth_sessions WHERE id=? AND user_id=?")
          .bind(current.session.id, current.user.id)
          .run();
        break;
      }
      case "password": {
        await requireIdentity(request.headers);
        if (
          typeof data.currentPassword !== "string" ||
          typeof data.newPassword !== "string"
        )
          throw new AppError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
        response = await auth.api.changePassword({
          headers: request.headers,
          body: {
            currentPassword: data.currentPassword,
            newPassword: data.newPassword,
            revokeOtherSessions: true,
          },
          asResponse: true,
        });
        break;
      }
      default:
        throw new AppError("요청을 찾을 수 없습니다.", 404);
    }
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    for (const [k, v] of Object.entries(privateHeaders)) headers.set(k, v);
    if (!response.ok) {
      const message =
        action(request) === "login"
          ? "이메일 또는 비밀번호가 올바르지 않습니다."
          : action(request) === "signup"
            ? "가입할 수 없습니다. 입력 정보나 기존 계정을 확인해 주세요."
            : "처리하지 못했습니다. 현재 비밀번호와 입력을 확인해 주세요.";
      return json(
        {
          error:
            response.status === 429
              ? "시도가 많습니다. 잠시 뒤 다시 시도해 주세요."
              : message,
        },
        response.status,
        headers,
      );
    }
    // Never expose library tokens, password hashes or full sessions in JSON responses.
    return json({ ok: true }, 200, headers);
  } catch (e) {
    return failure(e);
  }
}
