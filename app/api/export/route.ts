import { requireIdentity } from "@/src/server/runtime";
import { exportAccount } from "@/src/server/accounts/index";
import { failure, privateHeaders } from "@/src/server/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const c = await requireIdentity(request.headers);
    const data = await exportAccount(c.db, c.user.id);
    return Response.json(data, {
      headers: {
        ...privateHeaders,
        "Content-Disposition": `attachment; filename="pds-diary-${data.today}.json"`,
      },
    });
  } catch (e) {
    return failure(e);
  }
}
