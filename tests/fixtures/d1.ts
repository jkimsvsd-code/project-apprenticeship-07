import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
export class TestD1 {
  sqlite = new DatabaseSync(":memory:");
  constructor() {
    this.sqlite.exec("PRAGMA foreign_keys=ON");
    for (const file of readdirSync("drizzle")
      .filter((f) => f.endsWith(".sql"))
      .sort())
      this.sqlite.exec(readFileSync(`drizzle/${file}`, "utf8"));
  }
  prepare(query: string) {
    return new TestStatement(this, query, []);
  }
  async batch(statements: TestStatement[]) {
    this.sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const stmt of statements) results.push(await stmt.all());
      this.sqlite.exec("COMMIT");
      return results;
    } catch (e) {
      this.sqlite.exec("ROLLBACK");
      throw e;
    }
  }
  async exec(sql: string) {
    this.sqlite.exec(sql);
    return { count: 1, duration: 0 };
  }
}
class TestStatement {
  constructor(
    public owner: TestD1,
    public query: string,
    public values: unknown[],
  ) {}
  bind(...values: unknown[]) {
    return new TestStatement(this.owner, this.query, values);
  }
  async all() {
    const stmt = this.owner.sqlite.prepare(this.query);
    const rows = stmt.all(...(this.values as never[]));
    return {
      success: true,
      results: rows,
      meta: { changes: 0, duration: 0, last_row_id: 0 },
    };
  }
  async run() {
    const info = this.owner.sqlite
      .prepare(this.query)
      .run(...(this.values as never[]));
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
        duration: 0,
      },
    };
  }
  async raw(options?: { columnNames?: boolean }) {
    const stmt = this.owner.sqlite.prepare(this.query);
    stmt.setReturnArrays(true);
    const rows = stmt.all(...(this.values as never[]));
    return options?.columnNames
      ? [stmt.columns().map((c) => c.name), ...rows]
      : rows;
  }
  async first(column?: string) {
    const row = this.owner.sqlite
      .prepare(this.query)
      .get(...(this.values as never[]));
    return column ? (row?.[column] ?? null) : (row ?? null);
  }
}
