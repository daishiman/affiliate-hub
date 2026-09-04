/**
 * @tier 1
 * @req REQ-CI15
 * @types infra-config, equivalence, boundary
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md
 */
import { describe, expect, it, vi } from "vitest";
import {
  canonicalSql,
  createSchemaClient,
  diffSchema,
  environmentFrom,
  executeWrangler,
  judge,
  parseWranglerRows,
  withRetry,
} from "../../scripts/check-schema-drift.mjs";

const table = (name: string, sql: string) => ({ type: "table", name, tbl_name: name, sql });
const index = (name: string, owner: string, sql = `CREATE INDEX \`${name}\` ON \`${owner}\` (\`a\`)`) => ({
  type: "index",
  name,
  tbl_name: owner,
  sql,
});
const trigger = (
  name: string,
  owner: string,
  sql = `CREATE TRIGGER \`${name}\` BEFORE INSERT ON \`${owner}\` BEGIN SELECT 1; END`,
) => ({ type: "trigger", name, tbl_name: owner, sql });

const expected = [
  table("widget", "CREATE TABLE `widget` (`id` text PRIMARY KEY NOT NULL, `workspace_id` text NOT NULL)"),
  index("widget_workspace_idx", "widget"),
  trigger("widget_guard", "widget"),
];

const verdictOf = (actual: unknown[]) => judge(diffSchema(expected, actual as never), "dev");

describe("D1 schema drift の定義比較", () => {
  it("同じ最終形なら通す", () => {
    expect(diffSchema(expected, expected)).toEqual({ missing: [], extra: [], changed: [] });
    expect(verdictOf(expected).ok).toBe(true);
  });

  it("D1 / SQLite の内部テーブルは比較から除く", () => {
    const actual = [
      ...expected,
      table("d1_migrations", "CREATE TABLE d1_migrations (id integer, name text)"),
      table("sqlite_sequence", "CREATE TABLE sqlite_sequence(name,seq)"),
      table("_cf_METADATA", "CREATE TABLE _cf_METADATA(key text, value blob)"),
    ];
    expect(verdictOf(actual).ok).toBe(true);
  });

  it("足りない物と migration に無い物を両方落とす", () => {
    const diff = diffSchema(expected, [expected[0], table("legacy", "CREATE TABLE legacy (id text)")]);
    expect(diff.missing).toEqual(["index:widget_workspace_idx", "trigger:widget_guard"]);
    expect(diff.extra).toEqual(["table:legacy"]);
    expect(judge(diff, "production").ok).toBe(false);
  });

  it("同名の索引でも所属する表が違えば落とす", () => {
    const actual = expected.map((row) =>
      row.type === "index" ? index("widget_workspace_idx", "other_widget") : row,
    );
    const diff = diffSchema(expected, actual);
    expect(diff.changed[0]).toMatchObject({
      key: "index:widget_workspace_idx",
      expected: { table: "widget" },
      actual: { table: "other_widget" },
    });
    expect(judge(diff, "dev").ok).toBe(false);
  });

  it("同名・同所属の索引でも UNIQUE 定義が違えば落とす", () => {
    const actual = expected.map((row) =>
      row.type === "index"
        ? index("widget_workspace_idx", "widget", row.sql.replace("CREATE INDEX", "CREATE UNIQUE INDEX"))
        : row,
    );
    expect(verdictOf(actual).ok).toBe(false);
  });

  it("同名・同所属のトリガーでも本体の定義が違えば落とす", () => {
    const actual = expected.map((row) =>
      row.type === "trigger" ? { ...row, sql: row.sql.replace("SELECT 1", "SELECT 2") } : row,
    );
    expect(verdictOf(actual).ok).toBe(false);
  });

  it("表の列・制約定義が違えば落とす", () => {
    const actual = expected.map((row) =>
      row.type === "table" ? table("widget", row.sql.replace("workspace_id` text", "workspace_id` integer")) : row,
    );
    expect(verdictOf(actual).ok).toBe(false);
  });
});

describe("SQL の正規化", () => {
  it("空白・大小・識別子の引用差を無視する", () => {
    expect(canonicalSql('create  table "Widget"( "ID" TEXT )')).toBe(
      canonicalSql("CREATE TABLE `widget` (`id` text)"),
    );
  });

  it("文字列リテラルの差は消さない", () => {
    expect(canonicalSql("CHECK(status = 'ready')")).not.toBe(canonicalSql("CHECK(status = 'draft')"));
  });
});

describe("Wrangler 境界", () => {
  const json = (rows: unknown[]) => `wrangler notice\n${JSON.stringify([{ results: rows }])}`;

  it("JSON 前後のメッセージを除いて results を読む", () => {
    expect(parseWranglerRows(`${json(expected)}\nwrangler done`)).toEqual(expected);
  });

  it("JSON が壊れていれば fail-closed", () => {
    expect(() => parseWranglerRows("wrangler notice: no json")).toThrow(/JSON/);
    expect(() => parseWranglerRows("[]")).toThrow(/results/);
  });

  it("外部失敗は有限回だけ再試行してから成功できる", () => {
    const read = vi.fn().mockImplementationOnce(() => {
      throw new Error("temporary 7403");
    }).mockReturnValue(expected);
    const sleep = vi.fn();

    expect(withRetry(read, { attempts: 3, sleep, delayMs: 10 })).toEqual(expected);
    expect(read).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(10);
  });

  it("全試行が失敗したら通さない", () => {
    const attempts: number[] = [];
    const read = vi.fn(() => {
      attempts.push(attempts.length + 1);
      throw new Error("network down");
    });
    expect(() => withRetry(read, { attempts: 3, sleep: vi.fn() })).toThrow("network down");
    expect(attempts).toEqual([1, 2, 3]);
  });

  it("一時 D1 の構築は長い timeout、照会は短い timeout を使い、必ず後始末する", () => {
    const calls: Array<{ args: string[]; timeoutMs: number }> = [];
    const execute = vi.fn((args: string[], options: { timeoutMs: number }) => {
      calls.push({ args, timeoutMs: options.timeoutMs });
      return args.includes("execute") ? json(expected) : "applied";
    });
    const cleanup = vi.fn();
    const client = createSchemaClient({ execute, makeTemp: () => "/tmp/fake-schema", cleanup });

    expect(client.buildExpected("dev")).toEqual(expected);
    expect(calls.map((call) => call.timeoutMs)).toEqual([240_000, 60_000]);
    expect(calls[0].args).toContain("--persist-to");
    expect(cleanup).toHaveBeenCalledWith("/tmp/fake-schema");
  });

  it("一時 D1 の適用が失敗しても後始末して例外を返す", () => {
    const cleanup = vi.fn();
    const client = createSchemaClient({
      execute: () => {
        throw new Error("migration failed");
      },
      makeTemp: () => "/tmp/fake-schema",
      cleanup,
    });
    expect(() => client.buildExpected("dev")).toThrow("migration failed");
    expect(cleanup.mock.calls).toEqual([["/tmp/fake-schema"]]);
  });

  it("外部コマンドの timeout を判定不能として落とす", () => {
    const error = Object.assign(new Error("timed out"), { code: "ETIMEDOUT" });
    expect(() =>
      executeWrangler([], {
        timeoutMs: 25,
        spawn: () => ({ error }),
      }),
    ).toThrow(/25ms.*timeout/);
  });

  it("CLI 引数を環境変数より優先する", () => {
    expect(environmentFrom(["--env", "production"], { D1_ENV: "dev" })).toBe("production");
    expect(environmentFrom(["--env=dev"], { D1_ENV: "production" })).toBe("dev");
  });
});
