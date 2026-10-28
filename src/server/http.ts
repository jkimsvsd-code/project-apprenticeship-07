import { AppError } from "./store";
export const privateHeaders = {
  "Cache-Control": "no-store, private",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin",
};
export function json(data: unknown, status = 200, extra?: HeadersInit) {
  const h = new Headers(extra);
  for (const [k, v] of Object.entries(privateHeaders)) h.set(k, v);
  return Response.json(data, { status, headers: h });
}
export function failure(error: unknown) {
  return json(
    {
      error:
        error instanceof AppError
          ? error.message
          : "처리하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
      field: error instanceof AppError ? error.field : "",
    },
    error instanceof AppError ? error.status : 503,
    error instanceof AppError && error.retryAfter
      ? { "Retry-After": String(error.retryAfter) }
      : undefined,
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin !== new URL(request.url).origin ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new AppError("같은 앱에서 다시 요청해 주세요.", 403);
}
export async function body(
  request: Request,
  max = 64000,
): Promise<Record<string, unknown>> {
  sameOrigin(request);
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("JSON 요청이 필요합니다.", 415);
  const tooLarge = () => new AppError("파일이나 요청이 너무 큽니다.", 413);
  const length = request.headers.get("content-length");
  if (length && /^\d+$/.test(length) && Number(length) > max) {
    await request.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  const reader = request.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  // One bounded buffer also avoids per-chunk allocation amplification when a
  // sender splits a legal-size body into millions of tiny fragments.
  const bytes = new Uint8Array(max);
  let size = 0;
  let source: string;
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (size + value.byteLength > max) {
          await reader.cancel().catch(() => {});
          throw tooLarge();
        }
        bytes.set(value, size);
        size += value.byteLength;
      }
    }
    source = decoder.decode(bytes.subarray(0, size));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError("입력 형식을 확인해 주세요.");
  } finally {
    reader?.releaseLock();
  }
  let data;
  try {
    data = JSON.parse(source);
  } catch {
    throw new AppError("입력 형식을 확인해 주세요.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError("입력 형식을 확인해 주세요.");
  return data;
}
