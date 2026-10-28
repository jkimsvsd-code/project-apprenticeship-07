import { requireIdentity } from "@/src/server/runtime";
import { body, failure, json } from "@/src/server/http";
import { importDiary, previewImport } from "@/src/server/migration/index";
import { AppError } from "@/src/server/store";
import { consumeImportRequest } from "@/src/server/migration/limits";
import { IMPORT_REQUEST_BYTES } from "@/src/shared/import-limits";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    await consumeImportRequest(c.db, c.user.id);
    const data = await body(request, IMPORT_REQUEST_BYTES);
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
