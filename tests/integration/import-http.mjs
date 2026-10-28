import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const origin = process.argv[2] || "http://127.0.0.1:5173";
const production = process.argv.includes("--production");
const output =
  process.argv.find((value) => value.startsWith("--evidence="))?.slice(11) ||
  ".local/import-hardening-http.json";
const local = ["localhost", "127.0.0.1", "[::1]"].includes(
  new URL(origin).hostname,
);
if (
  !local &&
  !(
    production &&
    origin ===
      "https://pds-diary-apprenticeship-07-m2021.happybay512.chatgpt.site"
  )
)
  throw Error(
    "Use a local test server or explicitly select the known production Site.",
  );
if (!/^\.local\/[A-Za-z0-9._-]+\.json$/.test(output))
  throw Error("Write unreviewed evidence only under .local/.");
const source = JSON.parse(
  readFileSync("tests/fixtures/t06-export.json", "utf8"),
);
const password = randomBytes(24).toString("base64url");
const run = randomBytes(8).toString("hex");
const users = [];
const records = [];

async function call(label, path, { user, method = "GET", value, raw } = {}) {
  const response = await fetch(origin + path, {
    method,
    headers: {
      "User-Agent": "Mozilla/5.0",
      ...(user ? { Cookie: user.cookie } : {}),
      ...(value !== undefined || raw !== undefined
        ? { Origin: origin, "Content-Type": "application/json" }
        : {}),
    },
    body: raw ?? (value === undefined ? undefined : JSON.stringify(value)),
    redirect: "manual",
  });
  const data = await response.json().catch(() => null);
  records.push({
    test: label,
    status: response.status,
    ...(response.headers.has("retry-after")
      ? { retry_after: response.headers.get("retry-after") }
      : {}),
  });
  return { response, data };
}
const importing = (user, data, action = "import", label = action) =>
  call(label, "/api/import", {
    user,
    method: "POST",
    value: { action, source: data },
  });
try {
  assert.equal(
    (await importing(undefined, source, "preview", "anonymous import denied"))
      .response.status,
    401,
  );
  for (const tag of ["A", "B"]) {
    const signup = await call(`${tag} disposable signup`, "/api/auth/signup", {
      method: "POST",
      value: {
        name: "Import security QA",
        email: `import-qa-${run}-${tag}@example.test`,
        password,
      },
    });
    assert.equal(signup.response.status, 200);
    const cookie = signup.response.headers
      .getSetCookie()
      .map((x) => x.split(";")[0])
      .join("; ");
    assert.ok(cookie);
    users.push({ tag, cookie });
  }
  const [a, b] = users;
  const malformed = structuredClone(source);
  malformed.executions = [
    {
      id: "invalid-time",
      task_id: "fixture-task",
      started_at: "not-a-date",
      ended_at: "zzzz",
      actual_minutes: 1,
      blocked_reason: "",
      created_at: source.plans[0].created_at,
      updated_at: source.plans[0].updated_at,
    },
  ];
  assert.equal(
    (await importing(a, malformed, "import", "invalid timestamp denied"))
      .response.status,
    400,
  );
  const impossible = structuredClone(source);
  impossible.tasks[0].due_date = "2026-02-30";
  assert.equal(
    (
      await importing(
        a,
        impossible,
        "preview",
        "impossible calendar date denied",
      )
    ).response.status,
    400,
  );
  assert.equal(
    (
      await call("oversized HTTP request denied", "/api/import", {
        user: a,
        method: "POST",
        raw: " ".repeat(2_000_129),
      })
    ).response.status,
    413,
  );
  const boundary = structuredClone(source);
  boundary.padding = "";
  boundary.padding = "x".repeat(
    2_000_000 - Buffer.byteLength(JSON.stringify(boundary)),
  );
  assert.equal(
    (
      await importing(
        a,
        boundary,
        "preview",
        "exact 2MB source plus envelope accepted",
      )
    ).response.status,
    200,
  );
  assert.equal(
    (await importing(a, source, "import", "normal import accepted")).response
      .status,
    200,
  );
  const repeated = await importing(
    a,
    source,
    "import",
    "same-file retry deduplicated",
  );
  assert.equal(repeated.response.status, 200);
  assert.equal(repeated.data.duplicate, true);
  for (let i = 1; i <= 4; i++) {
    const variant = structuredClone(source);
    variant.plans[0].title += i;
    assert.equal(
      (await importing(a, variant, "import", `bounded variant ${i} accepted`))
        .response.status,
      200,
    );
  }
  const sixth = structuredClone(source);
  sixth.plans[0].title += "sixth";
  assert.equal(
    (await importing(a, sixth, "import", "sixth distinct import denied"))
      .response.status,
    409,
  );
  let limited = false;
  for (let i = 0; i < 25; i++) {
    const result = await importing(
      a,
      source,
      "preview",
      "per-account request limit",
    );
    if (result.response.status === 429) {
      const retry = Number(result.response.headers.get("retry-after"));
      assert.ok(retry >= 1 && retry <= 60);
      limited = true;
      break;
    }
    assert.equal(result.response.status, 200);
  }
  assert.ok(limited, "Persistent rate limit must reject repeated requests");
  assert.equal(
    (await importing(b, source, "import", "other account remains independent"))
      .response.status,
    200,
  );
  const aData = await call("A private export", "/api/export", { user: a });
  const bData = await call("B private export", "/api/export", { user: b });
  assert.equal(aData.data.plans.length, 5);
  assert.equal(bData.data.plans.length, 1);
  assert.ok(
    !aData.data.plans.some((p) => bData.data.plans.some((q) => q.id === p.id)),
  );
  records.push({
    test: "quotas and rejected imports preserve account isolation and record counts",
    passed: true,
  });
} finally {
  for (const user of users) {
    const removed = await call(
      `${user.tag} disposable account cleanup`,
      "/api/account",
      { user, method: "DELETE", value: { confirm: "내 계정 삭제", password } },
    );
    assert.equal(
      removed.response.status,
      200,
      "Disposable account cleanup must succeed",
    );
    assert.equal(
      (await call(`${user.tag} removed session denied`, "/api/diary", { user }))
        .response.status,
      401,
    );
  }
}
mkdirSync(".local", { recursive: true });
writeFileSync(
  output,
  JSON.stringify(
    {
      executed_at: new Date().toISOString(),
      environment: local ? "local Worker/D1" : "production Worker/D1",
      origin,
      fixture: "synthetic tests/fixtures/t06-export.json",
      actual_user_records_modified: false,
      disposable_accounts_removed: users.length,
      credentials_included: false,
      records,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  `PASS: ${records.length} sanitized HTTP checks; ${users.length} disposable accounts removed. Evidence: ${output}`,
);
