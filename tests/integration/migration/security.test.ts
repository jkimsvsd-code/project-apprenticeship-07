import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TestD1 } from "../../fixtures/d1";
import {
  importDiary,
  previewImport,
} from "../../../src/server/migration/index";
import { consumeImportRequest } from "../../../src/server/migration/limits";
import { body, failure } from "../../../src/server/http";
import { AppError, readState } from "../../../src/server/store";
import {
  IMPORT_FILE_BYTES,
  IMPORT_REQUEST_BYTES,
  IMPORT_REQUESTS_PER_MINUTE,
} from "../../../src/shared/import-limits";

function fixture() {
  return JSON.parse(readFileSync("tests/fixtures/t06-export.json", "utf8"));
}
function database() {
  const db = new TestD1();
  for (const id of ["A", "B"])
    db.sqlite
      .prepare(
        "INSERT INTO auth_users(id,name,email,created_at,updated_at) VALUES(?,?,?,?,?)",
      )
      .run(id, id, `${id}@example.test`, 0, 0);
  return db;
}
const status = (expected: number) => (error: unknown) =>
  error instanceof AppError && error.status === expected;

test("persistent import rate limit is per-account, bounded, resettable and removed on account deletion", async () => {
  const db = database();
  const time = Date.UTC(2026, 9, 28, 0, 0, 1);
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => consumeImportRequest(db, "A", time)),
  );
  assert.equal(
    results.filter((r) => r.status === "fulfilled").length,
    IMPORT_REQUESTS_PER_MINUTE,
  );
  const rejected = results.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.ok(status(429)(rejected.reason));
  assert.equal(failure(rejected.reason).headers.get("Retry-After"), "59");
  await consumeImportRequest(db, "B", time);
  assert.equal(
    db.sqlite.prepare("SELECT COUNT(*) AS n FROM import_request_limits").get()!
      .n,
    2,
  );
  await consumeImportRequest(db, "A", time + 60_000);
  assert.equal(
    db.sqlite
      .prepare(
        "SELECT request_count FROM import_request_limits WHERE user_id='A'",
      )
      .get()!.request_count,
    1,
  );
  db.sqlite.prepare("DELETE FROM auth_users WHERE id='A'").run();
  assert.equal(
    db.sqlite
      .prepare(
        "SELECT COUNT(*) AS n FROM import_request_limits WHERE user_id='A'",
      )
      .get()!.n,
    0,
  );
});

test("content mutations hit a lifetime import cap, retries remain idempotent, other accounts remain independent", async () => {
  const db = database();
  for (let i = 0; i < 5; i++) {
    const source = fixture();
    source.plans[0].title += i;
    await importDiary(db, "A", source);
  }
  const last = fixture();
  last.plans[0].title += 4;
  assert.equal((await importDiary(db, "A", last)).duplicate, true);
  const next = fixture();
  next.plans[0].title += "sixth";
  await assert.rejects(() => previewImport(db, "A", next), status(409));
  await assert.rejects(() => importDiary(db, "A", next), status(409));
  assert.equal((await readState(db, "A")).plans.length, 5);
  next.owner_id = "A";
  next.plans[0].owner_id = "A";
  next.auth_users = [{ id: "forged" }];
  await importDiary(db, "B", next);
  const b = await readState(db, "B");
  assert.equal(b.plans.length, 1);
  assert.equal(
    db.sqlite
      .prepare("SELECT owner_id FROM plans WHERE id=?")
      .get(b.plans[0].id)!.owner_id,
    "B",
  );
  assert.equal(
    db.sqlite.prepare("SELECT COUNT(*) AS n FROM auth_users").get()!.n,
    2,
  );
  assert.equal((await readState(db, "A")).plans.length, 5);
});

test("cumulative row quota counts legacy receipts and accepts exactly the remaining capacity", async () => {
  const db = database();
  db.sqlite
    .prepare("INSERT INTO imports VALUES(?,?,?,?,?)")
    .run(
      "legacy",
      "A",
      "legacy-hash",
      JSON.stringify({ tasks: 19997 }),
      "2026-10-27T00:00:00.000Z",
    );
  await importDiary(db, "A", fixture()); // one plan + one revision + one task
  const source = fixture();
  source.plans[0].title += "next";
  await assert.rejects(() => importDiary(db, "A", source), status(409));
  assert.equal(
    db.sqlite
      .prepare("SELECT COUNT(*) AS n FROM imports WHERE user_id='A'")
      .get()!.n,
    2,
  );
});

test("competing imports cannot exceed the cap; concurrent identical imports store one copy", async () => {
  const db = database();
  const originalBatch = db.batch.bind(db);
  let queued = Promise.resolve<unknown>(undefined);
  let release!: () => void;
  let calls = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  // Model D1's transaction serialization after BOTH callers finish preflight.
  db.batch = (statements) => {
    if (++calls === 2) release();
    const result = queued.then(async () => {
      await gate;
      return originalBatch(statements);
    });
    queued = result.catch(() => undefined);
    return result;
  };
  const results = await Promise.all([
    importDiary(db, "A", fixture()),
    importDiary(db, "A", fixture()),
  ]);
  assert.equal(results.filter((r) => r.duplicate).length, 1);
  assert.equal((await readState(db, "A")).plans.length, 1);
  db.batch = originalBatch;
  for (let i = 0; i < 3; i++) {
    const source = fixture();
    source.plans[0].title += i;
    await importDiary(db, "A", source);
  }
  calls = 0;
  queued = Promise.resolve(undefined);
  let unblock!: () => void;
  const gate2 = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  db.batch = (statements) => {
    if (++calls === 2) unblock();
    const result = queued.then(async () => {
      await gate2;
      return originalBatch(statements);
    });
    queued = result.catch(() => undefined);
    return result;
  };
  const first = fixture();
  first.plans[0].title += "race-one";
  const second = fixture();
  second.plans[0].title += "race-two";
  const raced = await Promise.allSettled([
    importDiary(db, "A", first),
    importDiary(db, "A", second),
  ]);
  assert.equal(raced.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (raced.find((r) => r.status === "rejected") as PromiseRejectedResult).reason
      .status,
    409,
  );
  db.batch = originalBatch;
  assert.equal((await readState(db, "A")).plans.length, 5);
  assert.equal(
    db.sqlite
      .prepare("SELECT COUNT(*) AS n FROM imports WHERE user_id='A'")
      .get()!.n,
    5,
  );
  const rowDb = database();
  rowDb.sqlite
    .prepare("INSERT INTO imports VALUES(?,?,?,?,?)")
    .run(
      "legacy",
      "A",
      "legacy",
      JSON.stringify({ tasks: 19997 }),
      "2026-10-27T00:00:00.000Z",
    );
  const rowBatch = rowDb.batch.bind(rowDb);
  let rowQueue = Promise.resolve<unknown>(undefined);
  let rowCalls = 0;
  let allowRows!: () => void;
  const rowGate = new Promise<void>((resolve) => {
    allowRows = resolve;
  });
  rowDb.batch = (statements) => {
    if (++rowCalls === 2) allowRows();
    const result = rowQueue.then(async () => {
      await rowGate;
      return rowBatch(statements);
    });
    rowQueue = result.catch(() => undefined);
    return result;
  };
  const rowRace = await Promise.allSettled([
    importDiary(rowDb, "A", first),
    importDiary(rowDb, "A", second),
  ]);
  assert.equal(rowRace.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (rowRace.find((r) => r.status === "rejected") as PromiseRejectedResult)
      .reason.status,
    409,
  );
  rowDb.batch = rowBatch;
  assert.equal((await readState(rowDb, "A")).plans.length, 1);
});

test("malformed dates, impossible UTC times, empty IDs and reversed periods are rejected without storing a receipt", async () => {
  const db = database();
  const variants = [
    (s: ReturnType<typeof fixture>) => {
      s.plans[0].start_date = "2026-02-30";
    },
    (s: ReturnType<typeof fixture>) => {
      s.tasks[0].due_date = "not-a-date";
    },
    (s: ReturnType<typeof fixture>) => {
      s.tasks[0].deleted_at = "2026-10-28";
    },
    (s: ReturnType<typeof fixture>) => {
      s.plans[0].created_at = "2026-02-30T00:00:00.000Z";
    },
    (s: ReturnType<typeof fixture>) => {
      s.plans[0].updated_at = "2026-10-27T24:00:00.000Z";
    },
    (s: ReturnType<typeof fixture>) => {
      s.plans[0].updated_at = "2026-10-27T00:00:00.000Z";
    },
    (s: ReturnType<typeof fixture>) => {
      s.plans[0].end_date = "2026-10-01";
    },
    (s: ReturnType<typeof fixture>) => {
      s.plans[0].id = "";
    },
    (s: ReturnType<typeof fixture>) => {
      s.executions = [
        {
          id: "execution",
          task_id: "fixture-task",
          started_at: "not-a-date",
          ended_at: "zzzz",
          actual_minutes: 1,
          blocked_reason: "",
          created_at: s.plans[0].created_at,
          updated_at: s.plans[0].updated_at,
        },
      ];
    },
    (s: ReturnType<typeof fixture>) => {
      s.reviews = [
        {
          id: "review",
          plan_id: "fixture-plan",
          from_date: "2026-10-31",
          to_date: "2026-10-27",
          improvement: "test",
          next_plan_id: null,
          created_at: s.plans[0].created_at,
          updated_at: s.plans[0].updated_at,
        },
      ];
    },
  ];
  for (const corrupt of variants) {
    const source = fixture();
    corrupt(source);
    await assert.rejects(() => previewImport(db, "A", source), status(400));
    await assert.rejects(() => importDiary(db, "A", source), status(400));
  }
  assert.equal(
    db.sqlite.prepare("SELECT COUNT(*) AS n FROM imports").get()!.n,
    0,
  );
  assert.equal((await readState(db, "A")).plans.length, 0);
  await importDiary(db, "A", fixture());
});

test("a database failure rolls back the claimed receipt and data, preserving quota for retry", async () => {
  const db = database();
  const source = fixture();
  source.executions = [
    {
      id: "execution",
      task_id: "fixture-task",
      started_at: "2026-10-27T01:00:00.000Z",
      ended_at: "2026-10-27T01:01:00.000Z",
      actual_minutes: 0,
      blocked_reason: "",
      created_at: source.plans[0].created_at,
      updated_at: source.plans[0].updated_at,
    },
  ];
  await assert.rejects(() => importDiary(db, "A", source), status(400));
  assert.equal(
    db.sqlite.prepare("SELECT COUNT(*) AS n FROM imports").get()!.n,
    0,
  );
  assert.equal((await readState(db, "A")).plans.length, 0);
  source.executions[0].actual_minutes = 1;
  await importDiary(db, "A", source);
});

function streamedRequest(
  headers: Record<string, string> = {},
  throwingCancel = false,
) {
  let consumed = 0,
    cancelled = false;
  const request = new Request("https://example.test/api/import", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
      ...headers,
    },
    // Node's Request requires duplex for a streaming request body.
    ...({ duplex: "half" } as Record<string, unknown>),
    body: new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          consumed += 4096;
          controller.enqueue(new Uint8Array(4096).fill(32));
        },
        cancel() {
          cancelled = true;
          if (throwingCancel) throw Error("cancel failure");
        },
      },
      { highWaterMark: 0 },
    ),
  });
  return { request, consumed: () => consumed, cancelled: () => cancelled };
}

test("streaming body limit cancels before reading the entire payload even with absent or lying Content-Length", async () => {
  for (const headers of [{}, { "content-length": "1" }] as Record<
    string,
    string
  >[]) {
    const stream = streamedRequest(headers);
    await assert.rejects(() => body(stream.request, 1024), status(413));
    assert.ok(stream.cancelled());
    assert.equal(stream.consumed(), 4096);
  }
  const declared = streamedRequest({ "content-length": "100000000" });
  await assert.rejects(() => body(declared.request, 1024), status(413));
  assert.equal(declared.consumed(), 0);
  assert.ok(declared.cancelled());
  const rejectsCancel = streamedRequest({}, true);
  await assert.rejects(() => body(rejectsCancel.request, 1024), status(413));
});

test("byte limits handle split UTF-8, exact-size source files plus envelope, and reject oversized sources", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ text: "한글" }));
  let index = 0;
  const request = new Request("https://example.test/api/import", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    ...({ duplex: "half" } as Record<string, unknown>),
    body: new ReadableStream({
      pull(c) {
        if (index === bytes.length) c.close();
        else c.enqueue(bytes.slice(index, ++index));
      },
    }),
  });
  assert.deepEqual(await body(request, bytes.length), { text: "한글" });
  const tooSmall = new Request("https://example.test/api/import", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ text: "한글" }),
  });
  await assert.rejects(() => body(tooSmall, bytes.length - 1), status(413));
  const source = fixture();
  source.padding = "";
  source.padding = "x".repeat(
    IMPORT_FILE_BYTES - new TextEncoder().encode(JSON.stringify(source)).length,
  );
  const serialized = JSON.stringify({ action: "preview", source });
  const envelope = new Request("https://example.test/api/import", {
    method: "POST",
    headers: {
      origin: "https://example.test",
      "content-type": "application/json",
    },
    body: serialized,
  });
  const parsed = await body(envelope, IMPORT_REQUEST_BYTES);
  await previewImport(database(), "A", parsed.source);
  source.padding += "x";
  await assert.rejects(
    () => previewImport(database(), "A", source),
    status(413),
  );
});
