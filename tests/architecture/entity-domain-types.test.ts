/**
 * @tier 1
 * @req REQ-E01, REQ-E16, REQ-E32
 * @types code-boundary
 *
 * **要件表 F 節の「32 件すべてにドメイン型がある」を、実物と突き合わせる。**
 *
 * --- なぜ足したか（2026-08-21 の実測）---
 * F 節の締めくくりには「**32 件すべてにドメイン型がある。**」と書いてあったが、
 * **これを見ている検査は 1 つも無かった。**
 * 実測: `REQ-E01` のドメイン型を `identity/workspace.ts` から
 * `identity/nonexistent.ts` へ書き換えて `tests/architecture/` を全部走らせたところ、
 * 壊す前と**赤の件数が 1 件も変わらなかった**（どちらも 4 件で、
 * その 4 件は並行作業由来の別件）。
 *
 * 行を 1 本足す壊し方では赤が出たが、落ちたのは
 * 「要件の総数が生成した文書とずれた」という**別のこと**である。
 * 行数を変えない壊し方（型の置き場所だけを実在しないものにする）で測り直したら、
 * まるごと素通りだった。**数が動いた赤を、中身を見た赤と読まないこと。**
 *
 * --- 何を見ていて、何を見ていないか ---
 * 見ているのは「表が名指しした置き場所が実在すること」までである。
 * その中に不変条件が書いてあるかは見ていない（そちらは
 * `tests/domain/entity-*.test.ts` の 5 ファイルが断る場所ごとに当てている）。
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DOC = join(ROOT, "docs/product/traceability.md");

/** F 節（データモデル）の行だけを取る。**節を跨がないよう見出しで区切る。** */
function entityRows(): { req: string; name: string; domainType: string }[] {
  const text = readFileSync(DOC, "utf8");
  const start = text.indexOf("## F. データモデル");
  expect(start, "F 節の見出しが見つかりません（節名を変えたなら、ここも直してください）").toBeGreaterThan(
    0,
  );
  const after = text.indexOf("\n## ", start + 1);
  const section = text.slice(start, after < 0 ? text.length : after);
  return section
    .split("\n")
    .filter((l) => /^\| REQ-E\d\d \|/.test(l))
    .map((l) => {
      const c = l.split("|").map((s) => s.trim());
      return { req: c[1], name: c[2], domainType: c[3] };
    });
}

describe("データモデル（F 節）の一覧と実物", () => {
  it("一覧を実際に読めている", () => {
    // 母集団の床。節が読めなくなったら「欠けは 0 件」は常に成り立つ。
    expect(entityRows().length, "F 節の行が読めていません").toBeGreaterThanOrEqual(32);
  });

  it("どの行のドメイン型も、名指しした場所に実在する", () => {
    const missing: string[] = [];
    for (const row of entityRows()) {
      const m = row.domainType.match(/`([a-z0-9\-/]+\.ts)`/);
      if (!m) {
        missing.push(`${row.req} (${row.name}): ドメイン型の欄に置き場所が書かれていません`);
        continue;
      }
      const path = join(ROOT, "src/domain", m[1]);
      if (!existsSync(path)) {
        missing.push(`${row.req} (${row.name}): src/domain/${m[1]} がありません`);
      }
    }
    expect(
      missing,
      "「32 件すべてにドメイン型がある」と書くなら、置き場所が実在していること。" +
        "型を動かしたら表も動かしてください。",
    ).toEqual([]);
  });

  it("表の行が、締めくくりが名乗る件数を下回っていない", () => {
    // 締めくくりの文そのものを実物から読む。文言を変えたら、ここが先に落ちる。
    const text = readFileSync(DOC, "utf8");
    const m = text.match(/\*\*(\d+) 件すべてにドメイン型がある。\*\*/);
    expect(m, "F 節の締めくくりの文が見つかりません").not.toBeNull();
    const claimed = Number(m?.[1]);
    expect(claimed).toBeGreaterThan(0);
    expect(entityRows().length, `締めくくりは ${claimed} 件と名乗っています`).toBe(claimed);
  });
});
