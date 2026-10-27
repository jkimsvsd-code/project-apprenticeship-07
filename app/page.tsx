import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Workspace from "@/src/features/auth/Workspace";
import { requireIdentity } from "@/src/server/runtime";
import { AppError } from "@/src/server/store";
export const dynamic = "force-dynamic";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (typeof v === "string") query.set(k, v);
  let identity;
  try {
    identity = await requireIdentity(new Headers(await headers()));
  } catch (e) {
    if (e instanceof AppError && e.status === 401)
      redirect(
        `/login?next=${encodeURIComponent(`/${query.size ? "?" + query : ""}`)}`,
      );
    throw e;
  }
  return (
    <Workspace
      user={{
        id: identity.user.id,
        name: identity.user.name,
        email: identity.user.email,
      }}
    />
  );
}
