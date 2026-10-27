import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createAuth } from "../../../src/server/auth/config";
import { TestD1 } from "../../fixtures/d1";
function cookie(r: Response) {
  return r.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
}
test("Better Auth real database: salted scrypt, duplicate signup, generic errors, session revocation and password change", async () => {
  const db = new TestD1(),
    auth = createAuth(
      db as unknown as D1Database,
      randomBytes(48).toString("hex"),
      "http://localhost:5173",
    );
  const password = randomBytes(24).toString("base64url"),
    base = new Headers({ origin: "http://localhost:5173" });
  const a = await auth.api.signUpEmail({
    headers: base,
    body: { email: "a@example.test", name: "A", password },
    asResponse: true,
  });
  assert.equal(a.status, 200);
  const aCookie = cookie(a);
  assert.ok(aCookie);
  const ah = new Headers({ ...Object.fromEntries(base), cookie: aCookie });
  const b = await auth.api.signUpEmail({
    headers: base,
    body: { email: "b@example.test", name: "B", password },
    asResponse: true,
  });
  assert.equal(b.status, 200);
  const stored = db.sqlite
    .prepare("SELECT password FROM auth_accounts ORDER BY id")
    .all();
  assert.equal(stored.length, 2);
  assert.notEqual(stored[0].password, stored[1].password);
  assert.ok(!JSON.stringify(stored).includes(password));
  assert.match(String(stored[0].password), /^[a-f0-9]{32}:[a-f0-9]{128}$/);
  const duplicate = await auth.api.signUpEmail({
    headers: base,
    body: { email: "a@example.test", name: "A", password },
    asResponse: true,
  });
  assert.equal(duplicate.ok, false);
  const wrong = await auth.api.signInEmail({
    headers: base,
    body: { email: "a@example.test", password: "invalid-password" },
    asResponse: true,
  });
  const missing = await auth.api.signInEmail({
    headers: base,
    body: { email: "missing@example.test", password: "invalid-password" },
    asResponse: true,
  });
  assert.equal(wrong.status, missing.status);
  assert.deepEqual(await wrong.json(), await missing.json());
  assert.ok(await auth.api.getSession({ headers: ah }));
  await auth.api.signOut({ headers: ah, body: {} });
  assert.equal(await auth.api.getSession({ headers: ah }), null);
  const login = await auth.api.signInEmail({
    headers: base,
    body: { email: "a@example.test", password },
    asResponse: true,
  });
  const oldHeaders = new Headers({
    ...Object.fromEntries(base),
    cookie: cookie(login),
  });
  const changed = await auth.api.changePassword({
    headers: oldHeaders,
    body: {
      currentPassword: password,
      newPassword: randomBytes(24).toString("base64url"),
      revokeOtherSessions: true,
    },
    asResponse: true,
  });
  assert.equal(changed.status, 200);
  assert.equal(await auth.api.getSession({ headers: oldHeaders }), null);
  const newHeaders = new Headers({
    ...Object.fromEntries(base),
    cookie: cookie(changed),
  });
  assert.ok(await auth.api.getSession({ headers: newHeaders }));
  db.sqlite
    .prepare("UPDATE auth_sessions SET expires_at=?")
    .run(Date.now() - 1000);
  assert.equal(await auth.api.getSession({ headers: newHeaders }), null);
});
