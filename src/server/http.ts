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
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > max)
    throw new AppError("파일이나 요청이 너무 큽니다.", 413);
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
