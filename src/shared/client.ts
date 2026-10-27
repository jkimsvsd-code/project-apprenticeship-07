import type { DiaryState } from "./domain";
export class ApiError extends Error {
  constructor(
    message: string,
    public field = "",
    public status = 0,
  ) {
    super(message);
  }
}
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new ApiError(
      "연결이 끊겼습니다. 입력은 유지됩니다. 연결 후 다시 시도해 주세요.",
    );
  }
  let result;
  try {
    result = await response.json();
  } catch {
    throw new ApiError(
      "서버 응답을 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.",
    );
  }
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined")
      window.dispatchEvent(new Event("pds-session-expired"));
    const error = result as { error?: string; field?: string };
    throw new ApiError(
      error.error || "요청을 처리하지 못했습니다.",
      error.field || "",
      response.status,
    );
  }
  return result as T;
}
export const loadDiary = () => request<DiaryState>("/api/diary");
export type RunAction = (
  action: string,
  data: Record<string, unknown>,
) => Promise<{ id: string }>;
