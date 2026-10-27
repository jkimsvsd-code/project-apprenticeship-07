import { mutate, readState, readRecord } from "@/src/server/store";
import { requireIdentity } from "@/src/server/runtime";
import { body, failure, json } from "@/src/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    const q = new URL(request.url).searchParams;
    return json(
      q.has("record") || q.has("id")
        ? await readRecord(c.db, c.user.id, q.get("record"), q.get("id"))
        : await readState(c.db, c.user.id),
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    const data = await body(request);
    return json(await mutate(c.db, data, c.user.id));
  } catch (e) {
    return failure(e);
  }
}
