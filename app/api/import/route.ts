import { requireIdentity } from "@/src/server/runtime";
import { body, failure, json } from "@/src/server/http";
import { importDiary, previewImport } from "@/src/server/migration/index";
import { AppError } from "@/src/server/store";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    const data = await body(request, 2_000_000);
    if (data.action !== "preview" && data.action !== "import")
      throw new AppError("이전 요청을 확인해 주세요.");
    return json(
      await (data.action === "preview"
        ? previewImport(c.db, c.user.id, data.source)
        : importDiary(c.db, c.user.id, data.source)),
    );
  } catch (e) {
    return failure(e);
  }
}
