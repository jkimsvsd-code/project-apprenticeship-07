import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
const origin = process.argv[2] || "http://127.0.0.1:5173";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(origin).hostname))
  throw Error("This destructive QA runs only on a local test database.");
const password = randomBytes(24).toString("base64url"),
  nextPassword = randomBytes(24).toString("base64url"),
  run = Date.now();
const evidence = [];
const cookieReferences = new Map();
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /password|token|secret|cookie/i.test(k) ? "[REDACTED]" : redact(v),
      ]),
    );
  return value;
}
async function call(
  label,
  path,
  { cookie, method = "GET", body, extra = {} } = {},
) {
  const headers = {
    ...(cookie ? { Cookie: cookie } : {}),
    ...(body ? { "Content-Type": "application/json", Origin: origin } : {}),
    ...extra,
  };
  const response = await fetch(origin + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = {
      location: response.headers.get("location"),
      html: text.includes("<html"),
    };
  }
  const cookies = response.headers
    .getSetCookie()
    .map((x) => x.split(";")[0])
    .join("; ");
  const safeHeaders = redact(headers);
  if (cookie) {
    if (!cookieReferences.has(cookie))
      cookieReferences.set(cookie, `cookie-ref-${cookieReferences.size + 1}`);
    safeHeaders.Cookie = `[${cookieReferences.get(cookie)} REDACTED]`;
  }
  evidence.push({
    label,
    request: {
      method,
      path,
      headers: safeHeaders,
      ...(body ? { body: redact(body) } : {}),
    },
    response: { status: response.status, body: redact(result) },
  });
  return {
    status: response.status,
    result,
    cookies,
    headers: response.headers,
  };
}
const users = [];
try {
  assert.equal((await call("public login page", "/login")).status, 200);
  assert.equal((await call("private screen redirects", "/")).status, 307);
  assert.equal(
    (await call("anonymous direct API denied", "/api/diary")).status,
    401,
  );
  for (const tag of ["A", "B"]) {
    const email = `qa-${run}-${tag.toLowerCase()}@example.test`;
    const signup = await call(`${tag} signup`, "/api/auth/signup", {
      method: "POST",
      body: { name: `QA ${tag}`, email, password },
    });
    assert.equal(signup.status, 200);
    assert.deepEqual(signup.result, { ok: true });
    assert.match(signup.headers.get("set-cookie"), /HttpOnly/i);
    const who = await call(`${tag} session`, "/api/auth/session", {
      cookie: signup.cookies,
    });
    users.push({
      tag,
      email,
      password,
      cookie: signup.cookies,
      id: who.result.user.id,
    });
  }
  const [a, b] = users;
  const dup = await call("duplicate signup denied", "/api/auth/signup", {
    method: "POST",
    body: { name: "A", email: a.email, password },
  });
  assert.ok(dup.status >= 400);
  const wrong = await call("existing user wrong password", "/api/auth/login", {
      method: "POST",
      body: { email: a.email, password: "wrong-password" },
    }),
    missing = await call("missing user same message", "/api/auth/login", {
      method: "POST",
      body: {
        email: `missing-${run}@example.test`,
        password: "wrong-password",
      },
    });
  assert.equal(wrong.status, missing.status);
  assert.deepEqual(wrong.result, missing.result);
  const plan = {
    title: "검증용 계획",
    start_date: "2026-10-01",
    end_date: "2026-10-31",
    priority: "medium",
    success_criteria: "검증 완료",
    estimated_minutes: 60,
  };
  async function mutate(user, action, data, id = crypto.randomUUID()) {
    return call(`${user.tag} ${action}`, "/api/diary", {
      cookie: user.cookie,
      method: "POST",
      body: { action, data, requestId: id },
    });
  }
  for (const user of users) {
    const p = await mutate(user, "plan.save", plan, "same-key-across-users");
    assert.equal(p.status, 200);
    user.plan = p.result.id;
    const t = await mutate(user, "task.save", {
      plan_id: user.plan,
      title: `${user.tag} task`,
      due_date: "2026-10-27",
      priority: "medium",
      tags: [],
      estimated_minutes: 30,
    });
    assert.equal(t.status, 200);
    user.task = t.result.id;
  }
  for (const [actor, target] of [
    [a, b],
    [b, a],
  ]) {
    assert.equal(
      (
        await mutate(actor, "task.save", {
          id: actor.task,
          plan_id: actor.plan,
          title: `${actor.tag} own updated`,
          due_date: "2026-10-27",
          priority: "medium",
          tags: [],
          estimated_minutes: 30,
        })
      ).status,
      200,
    );
    const before = await call(
      `${target.tag} before denied requests`,
      "/api/diary",
      { cookie: target.cookie },
    );
    const own = await call(
      `${actor.tag} own read success`,
      `/api/diary?record=tasks&id=${actor.task}`,
      { cookie: actor.cookie },
    );
    assert.equal(own.status, 200);
    assert.equal(
      (
        await call(
          `${actor.tag} cannot read ${target.tag}`,
          `/api/diary?record=tasks&id=${target.task}`,
          { cookie: actor.cookie },
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await mutate(actor, "task.save", {
          id: target.task,
          plan_id: actor.plan,
          title: "tamper",
          due_date: "2026-10-27",
          priority: "medium",
          tags: [],
          estimated_minutes: 1,
        })
      ).status,
      404,
    );
    assert.equal(
      (await mutate(actor, "task.delete", { id: target.task })).status,
      404,
    );
    assert.equal(
      (
        await mutate(actor, "task.save", {
          plan_id: target.plan,
          title: "bad parent",
          due_date: "2026-10-27",
          priority: "medium",
          tags: [],
          estimated_minutes: 1,
        })
      ).status,
      404,
    );
    assert.equal(
      (await mutate(actor, "timer.start", { task_id: target.task })).status,
      404,
    );
    const after = await call(
      `${target.tag} after denied requests`,
      "/api/diary",
      { cookie: target.cookie },
    );
    assert.deepEqual(after.result, before.result);
    assert.equal(
      (await mutate(actor, "task.delete", { id: actor.task })).status,
      200,
    );
    assert.equal(
      (await mutate(actor, "task.restore", { id: actor.task })).status,
      200,
    );
    const forged = await call(
      `${actor.tag} URL and header owner forgery returns own only`,
      `/api/diary?owner_id=${target.id}`,
      {
        cookie: actor.cookie,
        extra: {
          "x-user-id": target.id,
          "oai-authenticated-user-id": target.id,
        },
      },
    );
    assert.ok(forged.result.plans.every((p) => p.owner_id === actor.id));
    const bodyForgery = await mutate(actor, "plan.save", {
      ...plan,
      owner_id: target.id,
      user_id: target.id,
    });
    assert.equal(bodyForgery.status, 200);
    const owned = await call(
      "body owner ignored",
      `/api/diary?record=plans&id=${bodyForgery.result.id}`,
      { cookie: actor.cookie },
    );
    assert.equal(owned.result.owner_id, actor.id);
    const exported = await call(`${actor.tag} own export`, "/api/export", {
      cookie: actor.cookie,
    });
    assert.equal(exported.status, 200);
    assert.ok(!JSON.stringify(exported.result).includes(target.task));
    assert.ok(
      !/password|session_token|access_token/.test(
        JSON.stringify(exported.result),
      ),
    );
  }
  assert.equal(
    (
      await call("anonymous spoofed identity rejected", "/api/diary", {
        extra: { "oai-authenticated-user-id": a.id, "x-user-id": a.id },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("cross-origin request denied", "/api/diary", {
        cookie: a.cookie,
        method: "POST",
        body: {
          action: "plan.save",
          data: plan,
          requestId: crypto.randomUUID(),
        },
        extra: { Origin: "https://other.example.test" },
      })
    ).status,
    403,
  );
  // Read ONLY disposable accounts from the local test database to prove stored hash behavior.
  function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((x) =>
      x.isDirectory() ? files(join(dir, x.name)) : [join(dir, x.name)],
    );
  }
  const dbPath = files(".wrangler/state/v3/d1").find((p) =>
    p.endsWith(".sqlite"),
  );
  assert.ok(dbPath);
  const sql = new DatabaseSync(dbPath);
  const hashes = users.map(
    (u) =>
      sql
        .prepare("SELECT password FROM auth_accounts WHERE user_id=?")
        .get(u.id).password,
  );
  assert.notEqual(hashes[0], hashes[1]);
  assert.ok(hashes.every((h) => !h.includes(password)));
  mkdirSync(".local", { recursive: true });
  writeFileSync(
    ".local/qa-password-hashes.json",
    JSON.stringify({ test_only: true, same_password: true, hashes }, null, 2),
    { mode: 0o600 },
  );
  evidence.push({
    label:
      "same password uses different stored scrypt hashes; disposable accounts deleted after QA",
    algorithm: "scrypt",
    parameters: { N: 16384, r: 16, p: 1, dkLen: 64 },
    stored_hashes: hashes.map((hash) => {
      const [salt, key] = hash.split(":");
      return `${salt.slice(0, 8)}…:${key.slice(0, 12)}…`;
    }),
    stored_hashes_redacted: true,
    storage_format: "32 hex salt characters : 128 hex derived-key characters",
    different: hashes[0] !== hashes[1],
  });
  const old = a.cookie;
  assert.equal(
    (await call("same GET before logout", "/api/diary", { cookie: old }))
      .status,
    200,
  );
  assert.equal(
    (
      await call("logout", "/api/auth/logout", {
        cookie: old,
        method: "POST",
        body: {},
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call("same GET after logout, same old cookie", "/api/diary", {
        cookie: old,
      })
    ).status,
    401,
  );
  const login = await call("login again", "/api/auth/login", {
    method: "POST",
    body: { email: a.email, password },
  });
  a.cookie = login.cookies;
  const beforeChange = a.cookie;
  const changed = await call(
    "change password revokes old sessions",
    "/api/auth/password",
    {
      cookie: a.cookie,
      method: "POST",
      body: { currentPassword: password, newPassword: nextPassword },
    },
  );
  assert.equal(changed.status, 200);
  assert.deepEqual(changed.result, { ok: true });
  a.cookie = changed.cookies;
  a.password = nextPassword;
  assert.equal(
    (
      await call("old cookie after password change denied", "/api/diary", {
        cookie: beforeChange,
      })
    ).status,
    401,
  );
  assert.equal(
    (await call("replacement cookie works", "/api/diary", { cookie: a.cookie }))
      .status,
    200,
  );
  sql
    .prepare("UPDATE auth_sessions SET expires_at=? WHERE user_id=?")
    .run(Date.now() - 1000, a.id);
  assert.equal(
    (await call("expired cookie denied", "/api/diary", { cookie: a.cookie }))
      .status,
    401,
  );
  sql.close();
  const again = await call("login after expiry", "/api/auth/login", {
    method: "POST",
    body: { email: a.email, password: nextPassword },
  });
  a.cookie = again.cookies;
  const bBefore = await call("B before A deletion", "/api/diary", {
    cookie: b.cookie,
  });
  assert.equal(
    (
      await call("wrong-password deletion denied", "/api/account", {
        cookie: a.cookie,
        method: "DELETE",
        body: { password: "wrong-password", confirm: "내 계정 삭제" },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await call("A account and data deleted", "/api/account", {
        cookie: a.cookie,
        method: "DELETE",
        body: { password: a.password, confirm: "내 계정 삭제" },
      })
    ).status,
    200,
  );
  a.deleted = true;
  assert.equal(
    (
      await call("deleted account session denied", "/api/diary", {
        cookie: a.cookie,
      })
    ).status,
    401,
  );
  assert.deepEqual(
    (
      await call("B unchanged after A deletion", "/api/diary", {
        cookie: b.cookie,
      })
    ).result,
    bBefore.result,
  );
  mkdirSync("docs/evidence/authentication", { recursive: true });
  writeFileSync(
    "docs/evidence/authentication/http-results.json",
    JSON.stringify(
      {
        executed_at: new Date().toISOString(),
        environment: "local Cloudflare Worker and D1; disposable QA accounts",
        actual_five_day_use: false,
        source_state: {
          baseline_commit: execFileSync("git", ["rev-parse", "HEAD"], {
            encoding: "utf8",
          }).trim(),
          description:
            "Local working tree; hashes identify the actual implementation tested",
          file_sha256: Object.fromEntries(
            [
              "src/server/store.ts",
              "src/server/access-control/index.ts",
              "src/server/auth/config.ts",
              "src/server/runtime.ts",
              "src/server/accounts/index.ts",
              "src/server/migration/index.ts",
              "src/server/experiment/index.ts",
              "package-lock.json",
            ].map((path) => [
              path,
              createHash("sha256").update(readFileSync(path)).digest("hex"),
            ]),
          ),
        },
        passed: true,
        records: evidence,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `PASS: ${evidence.length} sanitized HTTP/password evidence records. Disposable accounts are cleaned up.`,
  );
} finally {
  for (const user of users)
    if (!user.deleted) {
      try {
        const cleanup = await call("QA cleanup", "/api/account", {
          cookie: user.cookie,
          method: "DELETE",
          body: { password: user.password, confirm: "내 계정 삭제" },
        });
        if (cleanup.status !== 200)
          throw new Error("Disposable QA cleanup failed");
      } catch {
        process.exitCode = 1;
        console.log(
          `Cleanup required for disposable QA label ${user.tag}; no credentials logged.`,
        );
      }
    }
}
