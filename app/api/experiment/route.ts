import { requireIdentity } from "@/src/server/runtime";
import { body, failure, json } from "@/src/server/http";
import {
  readExperiment,
  updateExperiment,
} from "@/src/server/experiment/index";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    return json(await readExperiment(c.db, c.user.id));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    return json(await updateExperiment(c.db, c.user.id, await body(request)));
  } catch (e) {
    return failure(e);
  }
}
