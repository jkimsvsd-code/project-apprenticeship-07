import { AppError } from "../store";
import type { Database } from "../store";
import {
  IMPORT_MAX_FILES,
  IMPORT_MAX_ROWS,
  IMPORT_REQUESTS_PER_MINUTE,
} from "../../shared/import-limits";

// The unique user row and conditional UPSERT serialize competing requests in D1.
// This survives Worker replacement and does not allocate a row per request.
export async function consumeImportRequest(
  db: Database,
  userId: string,
  now = Date.now(),
) {
  const window = Math.floor(now / 60_000) * 60_000;
  const allowed = await db
    .prepare(
      `INSERT INTO import_request_limits (user_id,window_start,request_count) VALUES (?,?,1)
       ON CONFLICT(user_id) DO UPDATE SET
         window_start=excluded.window_start,
         request_count=CASE WHEN import_request_limits.window_start<>excluded.window_start THEN 1 ELSE import_request_limits.request_count+1 END
       WHERE import_request_limits.window_start<>excluded.window_start OR import_request_limits.request_count<?
       RETURNING request_count`,
    )
    .bind(userId, window, IMPORT_REQUESTS_PER_MINUTE)
    .first();
  if (!allowed)
    throw new AppError(
      "가져오기 요청이 많습니다. 잠시 뒤 다시 시도해 주세요.",
      429,
      "",
      Math.max(1, Math.ceil((window + 60_000 - now) / 1000)),
    );
}

// Existing receipts are the source of truth, including imports before this fix.
export const importedRowsSQL = `COALESCE((SELECT SUM(
  COALESCE(json_extract(counts_json,'$.plans'),0)+
  COALESCE(json_extract(counts_json,'$.revisions'),0)+
  COALESCE(json_extract(counts_json,'$.tasks'),0)+
  COALESCE(json_extract(counts_json,'$.executions'),0)+
  COALESCE(json_extract(counts_json,'$.timers'),0)+
  COALESCE(json_extract(counts_json,'$.reviews'),0)+
  COALESCE(json_extract(counts_json,'$.completions'),0)
) FROM imports WHERE user_id=?),0)`;

export async function checkImportQuota(
  db: Database,
  userId: string,
  rows: number,
) {
  const usage = await db
    .prepare(
      `SELECT (SELECT COUNT(*) FROM imports WHERE user_id=?) AS files, ${importedRowsSQL} AS rows`,
    )
    .bind(userId, userId)
    .first<{ files: number; rows: number }>();
  if (
    !usage ||
    usage.files >= IMPORT_MAX_FILES ||
    usage.rows + rows > IMPORT_MAX_ROWS
  )
    throw importQuotaError();
}

export function importQuotaError() {
  return new AppError(
    `계정당 가져오기는 최대 ${IMPORT_MAX_FILES}개 파일, 누적 ${IMPORT_MAX_ROWS.toLocaleString("ko-KR")}건입니다. 기존 기록은 나의 계획에서 확인해 주세요.`,
    409,
  );
}
