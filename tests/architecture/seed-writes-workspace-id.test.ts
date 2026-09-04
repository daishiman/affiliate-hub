/**
 * @tier 1
 * @req REQ-FD06
 * @types equivalence, boundary
 *
 * 見本データの `INSERT` が、作業場所（`workspace_id`）を**必ず書いていること**。
 *
 * --- 何が起きたか（2026-08-30 実測）---
 *
 * `legal_page` への `INSERT` だけが列の一覧から `workspace_id` を落としていた。
 * この列は `DEFAULT '' NOT NULL` なので、**書かなければ空文字が黙って入る。**
 * 読む側（`findSiteDocument`）は公開済み設計図の作業場所で絞るため、
 * 空文字の行は 1 件も返らない。結果、固定ページの **16 経路が全部 404** だった。
 *
 * この壊れ方のたちが悪いのは、**どこにも「間違い」が出ない**ところである。
 *
 * - `INSERT` は通る（列を省いただけで、制約違反ではない）
 * - 表には 18 行ちゃんと在って、`status` も `published`
 * - 画面は 404 を返す。「まだ作っていないページ」と見分けが付かない
 * - ログにも何も出ない
 *
 * データを開いて `workspace_id` の欄が空であることに気づくまで、
 * **原因の候補にすら挙がらない。**
 *
 * --- なぜ 1 箇所ではなく全部を見るか ---
 *
 * 直したのは 1 行だが、同じ落とし穴は 59 の表すべてに開いている。
 * 「今回抜けていた表」を名指しで見張ると、**次に別の表で抜けた日に何も起きない。**
 * 検査は `drizzle` の最新スナップショットから「作業場所の列を持つ表」を引き、
 * 見本データが書く `INSERT` の全部を突き合わせる。
 * 表が増えれば見張る対象も自動で増える。
 *
 * --- 空文字も見る ---
 *
 * 列名を書いていても値が `''` なら症状は同じである。列の有無と値の中身を
 * 別々に見るのは、**片方だけ直して緑になる形**を作らないためである。
 */
import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSeedSql } from "../../scripts/seed/local-seed-data";

const ROOT = process.cwd();
const META = join(ROOT, "drizzle", "meta");

/** 最新のスナップショットから、作業場所の列を持つ表を引く。 */
function tablesWithWorkspaceId(): ReadonlySet<string> {
  const snapshots = readdirSync(META)
    .filter((f) => f.endsWith("_snapshot.json"))
    .sort();
  const latest = snapshots[snapshots.length - 1];
  const schema = JSON.parse(readFileSync(join(META, latest), "utf8")) as {
    tables: Record<string, { columns: Record<string, unknown> }>;
  };
  return new Set(
    Object.entries(schema.tables)
      .filter(([, table]) => "workspace_id" in table.columns)
      .map(([name]) => name.replace(/^.*\./, "")),
  );
}

type Insert = { readonly table: string; readonly columns: readonly string[]; readonly values: string };

/**
 * `INSERT INTO t (a, b) VALUES (...)` を、表名・列名・値の文字列へ分ける。
 *
 * 値の側を構文解析まではしない。**必要なのは「作業場所の欄に何が入るか」だけ**で、
 * そこは列の並び順で位置が決まる。SQL を完全に読む器を持ち込むと、
 * 見本データより検査のほうが壊れやすくなる。
 */
function parseInserts(statements: readonly string[]): Insert[] {
  const found: Insert[] = [];
  for (const sql of statements) {
    const m = /^\s*INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES\s*\(([\s\S]*)$/i.exec(sql);
    if (m === null) continue;
    found.push({
      table: m[1],
      columns: m[2].split(",").map((c) => c.trim()),
      values: m[3],
    });
  }
  return found;
}

/** 列の並びの n 番目の値を、素朴に切り出す。引用符の中の `,` は跨がない。 */
function nthValue(values: string, index: number): string {
  const out: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = "";
  for (let i = 0; i < values.length; i += 1) {
    const ch = values[i];
    if (quoted) {
      if (ch === "'" && values[i + 1] === "'") {
        current += "''";
        i += 1;
        continue;
      }
      if (ch === "'") quoted = false;
      current += ch;
      continue;
    }
    if (ch === "'") {
      quoted = true;
      current += ch;
      continue;
    }
    if (ch === "(") depth += 1;
    if (ch === ")") {
      if (depth === 0) break;
      depth -= 1;
    }
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out[index] ?? "";
}

const statements = buildSeedSql(1_756_000_000);
const inserts = parseInserts(statements);
const guarded = tablesWithWorkspaceId();

describe("見本データが作業場所を書いていること", () => {
  it("作業場所の列を持つ表への INSERT は、その列を必ず並べている", () => {
    const watched = inserts.filter((i) => guarded.has(i.table));
    // 母数を同じ検査に置く。**0 件でも下の主張は通る。**
    // 解析器が壊れて 1 件も拾えなくなった日、ここが先に赤くなる。
    expect(watched.length, "見張る INSERT を 1 つも拾えていません").toBeGreaterThan(100);
    const missing = watched
      .filter((i) => !i.columns.includes("workspace_id"))
      .map((i) => i.table);
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  it("並べたうえで、空文字を書いていない", () => {
    // 列名だけ書いて `''` を入れると、症状は書き落としたときと同じになる。
    const blank = inserts
      .filter((i) => i.columns.includes("workspace_id"))
      .filter((i) => {
        const value = nthValue(i.values, i.columns.indexOf("workspace_id"));
        return value === "''" || value === '""' || value === "";
      })
      .map((i) => i.table);
    expect([...new Set(blank)].sort()).toEqual([]);
  });

  it("母数：見張っている INSERT が実際に在る", () => {
    // 上の 2 件は、対象が 0 件でも緑になる。**何件を見たのかを併記する。**
    // 解析器が壊れて 1 件も拾えなくなった日に、ここが最初に赤くなる。
    expect(guarded.size).toBeGreaterThanOrEqual(50);
    const watched = inserts.filter((i) => guarded.has(i.table));
    expect(watched.length).toBeGreaterThan(100);
    // 今回抜けていた表が、見張りの対象に入っていること。
    expect(guarded.has("legal_page")).toBe(true);
    expect(inserts.some((i) => i.table === "legal_page")).toBe(true);
  });

  describe("見つける側が効いていること", () => {
    it("列を落とした INSERT は表名つきで挙がる", () => {
      const got = parseInserts([
        "INSERT INTO legal_page (id, site_slug) VALUES ('a', 'b');",
      ]).filter((i) => guarded.has(i.table) && !i.columns.includes("workspace_id"));
      expect(got.map((i) => i.table)).toEqual(["legal_page"]);
    });

    it("空文字を書いた INSERT も挙がる", () => {
      const [parsed] = parseInserts([
        "INSERT INTO legal_page (id, workspace_id, site_slug) VALUES ('a', '', 'b');",
      ]);
      expect(nthValue(parsed.values, parsed.columns.indexOf("workspace_id"))).toBe("''");
    });

    it("値の中の `,` や `(` で位置がずれない", () => {
      // 本文には読点も括弧も入る。ここがずれると、
      // **正しい行を「空だ」と報せる**か、空の行を見逃すかのどちらかになる。
      const [parsed] = parseInserts([
        "INSERT INTO legal_page (id, title, workspace_id) VALUES ('a', '運営者(会社), 連絡先', 'ws_sample');",
      ]);
      expect(nthValue(parsed.values, parsed.columns.indexOf("workspace_id"))).toBe("'ws_sample'");
    });
  });
});
