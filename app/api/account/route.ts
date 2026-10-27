import { requireIdentity } from "@/src/server/runtime";
import { deleteAccount } from "@/src/server/accounts/index";
import { body, failure, json } from "@/src/server/http";
import { AppError } from "@/src/server/store";
export const dynamic = "force-dynamic";
export async function DELETE(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    const data = await body(request);
    if (data.confirm !== "내 계정 삭제")
      throw new AppError("삭제 확인 문장을 입력해 주세요.");
    const result = await deleteAccount(c.db, c.user.id, data.password);
    const signedOut = await c.auth.api.signOut({
      headers: request.headers,
      body: {},
      asResponse: true,
    });
    return json(result, 200, signedOut.headers);
  } catch (e) {
    return failure(e);
  }
}
