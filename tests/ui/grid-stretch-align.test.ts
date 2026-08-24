/** @tier 2 @req REQ-S09 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSS_ROOT, type Rule, cssFilesUnder, declarationOf, keyOf, rulesOf } from "./css-rules";

/**
 * **伸びる箱が grid のとき、`align-content` を書き忘れていないか**を規則の形として見る。
 *
 * ==========================================================================
 * **この検査は余白を測っていない。測れない。**
 * ==========================================================================
 *
 * `align-content` の既定値の効きは**実際に描かせないと出ない**（残課題 143）。
 * ここが見ているのは**書き方の型**だけで、間延びした画面を見つける仕掛けではない。
 *
 *   - 言えること: 「伸びる grid で `align-content` が書かれていない規則は無い」
 *   - 言えないこと: 「中身が短い画面で余白が効いている」
 *
 * --- 何を捕まえたいのか（UX-01 / UX-11）---
 *
 * `.siteMain` は `min-height: 100vh` の枠の中で `flex: 1` なので、中身が短い画面では
 * **画面の高さまで引き伸ばされる。**grid の `align-content` の初期値は `stretch` で、
 * 行がすべて `auto` のときは**余った高さを全部の行へ均等に配ぶんする。**
 * 結果、塊と塊の間がどこも同じだけ間延びし、`gap` に書いた値が意味を持たなくなる。
 * 中身の少ない画面（ログイン・0 件の一覧・エラー）ほどひどく崩れる。
 *
 * **これは目で見て初めて分かった。**同じ崩れが再発しても誰も気づかない、というのが
 * UX-11 の出発点である。
 *
 * ==========================================================================
 * **母集団は 1 件しかない。**（2026-08-21 実測）
 * ==========================================================================
 *
 * 全 CSS 314 規則のうち、grid は 46 件、伸びる箱（`flex: 1` / `flex-grow`）は 2 件、
 * **両方に当たるのは `.siteMain` の 1 件だけ**である。
 *
 * **doc の見立てとは、緑になる理由が違っていた。**UX-11 は
 * 「他 3 ファイルは既に `align-content: start` を持っているので緑のはず」と書いていたが、
 * その 3 件（`.densitySide` / `.boardItem` / `.page`）は**伸びる箱ではない**ので、
 * そもそもこの型に当たらない。**持っているから緑なのではなく、母集団の外だから緑である。**
 * 見立ては当たっていたが、当たった理由が違っていた——**「緑になった」を根拠に
 * 見立てのほうまで正しかったと読まないこと。**
 *
 * 母集団が 1 件だということは、**この検査は放っておくと空振りで緑になる。**
 * `.siteMain` から `flex: 1` か `display: grid` が消えれば、対象は 0 件になり、
 * 「全部が `align-content` を持っている」は**中身が空のまま真になる。**
 * だから下では**型に当たる規則の一覧そのものを両方向で突き合わせている。**
 * 増えても減っても赤になる——**減ったときに赤になることのほうが、ここでは大事。**
 *
 * --- **捕まえないもの** ---
 *
 * **① `flex` を使わずに高さが伸びる形。**`height: 100%`、`min-height: 100dvh`、
 * 親の `grid-template-rows: 1fr` に置かれた子——どれも同じ間延びを起こしうるが、
 * この型 (a) では見えない。
 *
 * **実物が在る。**`ui.module.css :: .shell` は `display: grid` かつ
 * `min-height: 100dvh` で `align-content` を持たない。**この検査は素通りさせる。**
 * （素通りさせてよいと判断している——`.shell` の行は `grid-template-columns` で
 * 横に割った 1 行だけなので、伸ばす先が 1 行しか無く、間延びする隙間が無い。
 * だが**判断したのは人であって、この検査ではない。**下の「見えない側」の検査は、
 * この規則が実在し続けることだけを固定して、次に読む人へ渡している。）
 *
 * **② 描いた結果。**行が本当に `auto` になるか、余白が実際にどう配ぶんされるかは
 * 中身次第で、CSS だけでは決まらない。
 *
 * **③ `align-content` の値の是非。**`start` か `center` かはここでは問わない。
 * 書かれていない（＝既定の `stretch` に落ちる）ことだけを見る。
 *
 * 規範: docs/product/ui-ux-tasks.md UX-11 / UX-01
 */

const CSS_FILES = cssFilesUnder(join(CSS_ROOT, "src"));
const ALL: readonly Rule[] = CSS_FILES.flatMap(rulesOf);

/** grid の器か。 */
function isGrid(rule: Rule): boolean {
  const display = declarationOf(rule.body, "display");
  return display === "grid" || display === "inline-grid";
}

/**
 * 余った高さを受け取って伸びる箱か。
 *
 * `flex: 1` の一括指定と `flex-grow` の個別指定の両方を見る。**一括のほうだけを
 * 見ると、`flex-grow: 1` と書いた規則を取りこぼす**——いまは 0 件だが、
 * 「いま 0 件」は規則の性質ではない。
 */
function grows(rule: Rule): boolean {
  const shorthand = declarationOf(rule.body, "flex");
  if (shorthand !== null && /^[1-9]/.test(shorthand)) return true;
  const grow = declarationOf(rule.body, "flex-grow");
  return grow !== null && grow !== "0";
}

/** 本文から指定の属性の宣言を落とす。**対照のためだけに使う**（下の「対照」を見ること）。 */
function withoutProperty(body: string, property: string): string {
  return body.replace(new RegExp(String.raw`(^|[\s;])${property}\s*:[^;}]*;?`, "g"), "$1");
}

/**
 * 型 (a) に当たる規則。**一覧にして持つ。**
 *
 * 件数ではなく鍵で持っているのは、`.siteMain` が消えたときに
 * 「0 件だから緑」ではなく**「一覧と合わないから赤」**にするため。
 */
const IN_SCOPE: Record<string, string> = {
  "src/presentation/ui/templates/site.module.css :: .siteMain": [
    "2026-08-21 実測。読者向け全画面（22 枚）の本文の器。",
    "`.siteShell` が `min-height: 100vh` / `flex-direction: column` で、その中の `flex: 1`。",
    "**UX-01 で実際に崩れたのがこの 1 件である**——型 (a) は、その 1 件を型にしたもの。",
  ].join(""),
};

describe("伸びる grid は、余った高さの行き先を書いている", () => {
  it("走査そのものが空振りしていない（母集団の床）", () => {
    expect(ALL.length, "CSS の規則をほとんど拾えていません。切り出す側を先に疑うこと").toBeGreaterThan(250);
    expect(CSS_FILES.length, "CSS のファイルを歩けていません").toBeGreaterThanOrEqual(8);
    expect(ALL.filter(isGrid).length, "grid の規則が 1 つも見つかりません").toBeGreaterThan(20);
  });

  it("`align-content` の有無を、実際に見分けている（陰性対照）", () => {
    // 2026-08-21 の実測: grid 46 件のうち `align-content` を持つのは 4 件、持たないのが 42 件。
    // **持たない側が 0 件になったら、この検査は「全部持っている」を無条件に返す。**
    const grids = ALL.filter(isGrid);
    const withAlign = grids.filter((r) => declarationOf(r.body, "align-content") !== null);
    expect(withAlign.length, "`align-content` を書いた規則が 1 つも見つかりません").toBeGreaterThan(2);
    expect(grids.length - withAlign.length, "`align-content` を書かない規則が 1 つも見つかりません").toBeGreaterThan(10);
  });

  it("**型 (a) に当たる規則の一覧が、書いてあるものと一致する（両方向）**", () => {
    // **減ったときに赤になることが、この検査の本体である。**
    // 母集団が 1 件しか無いので、対象が消えると下の検査は空のまま緑になる。
    const found = ALL.filter((r) => isGrid(r) && grows(r))
      .map(keyOf)
      .sort();
    expect(
      found,
      "伸びる grid の顔ぶれが変わりました。増えたなら一覧と `align-content` を、" +
        "減ったなら**この検査がまだ何かを見ているか**を確かめること",
    ).toStrictEqual(Object.keys(IN_SCOPE).sort());
  });

  it("伸びる grid はすべて `align-content` を持っている", () => {
    const missing = ALL.filter((r) => isGrid(r) && grows(r) && declarationOf(r.body, "align-content") === null).map(
      keyOf,
    );
    expect(
      missing,
      "伸びる grid に `align-content` がありません。既定の `stretch` は、" +
        "中身が短い画面で塊の間隔を均等に引き伸ばします（UX-01 の崩れ）",
    ).toStrictEqual([]);
  });

  it("**見えない側**——`flex` を使わずに伸びる grid が実在する", () => {
    // 上の型 (a) は `flex` の有無で母集団を切っている。**切り落とした側に実物が在る**
    // ことを、この検査自身が持っておく。消えたら「捕まえないもの①」の記述が
    // 具体例を失うので、そのときは doc の側を書き直すこと。
    const stretchedByHeight = ALL.filter(
      (r) =>
        isGrid(r) &&
        !grows(r) &&
        declarationOf(r.body, "align-content") === null &&
        (declarationOf(r.body, "min-height") !== null || declarationOf(r.body, "height") !== null),
    ).map(keyOf);
    expect(
      stretchedByHeight,
      "高さで伸びる grid が消えました。捕まえないもの①の実例なので、doc も一緒に直すこと",
    ).toStrictEqual(["src/presentation/ui/primitives/ui.module.css :: .shell"]);
  });

  it("**対照**——`align-content` を抜くと赤に、`flex` を抜くと母集団が空になる", () => {
    // ==================================================================
    // **赤にならない見張りは、緑であることを何も意味しない。**
    //
    // 共有ファイルを書き換えて確かめる形は採らない（この作業木は 4 人で共有していて、
    // 戻すまでの数秒を他人に押し付ける）。**実物の本文から宣言を落とした写し**に
    // 判定を掛ける。毎回走るので、一度きりの手作業より長持ちする。
    //
    // **2 つ確かめている。向きが違う。**
    //   ① `align-content` を抜く → 「持っていない」と判定される（**赤の側**）
    //   ② `flex: 1` を抜く → 型に当たらなくなり、**母集団が空になる**
    //      ②が大事なのは、空になった母集団に対して①が**緑を返す**からである。
    //      「伸びる grid はすべて `align-content` を持つ」は、伸びる grid が
    //      0 件なら中身が空のまま真になる。**だから空になったことを別に見る。**
    // ==================================================================
    const target = ALL.find((r) => keyOf(r) === Object.keys(IN_SCOPE)[0]);
    expect(target, "対照の相手が見つかりません").toBeDefined();
    if (target === undefined) return;

    const withoutAlign: Rule = { ...target, body: withoutProperty(target.body, "align-content") };
    expect(
      declarationOf(withoutAlign.body, "align-content"),
      "① `align-content` を抜いた写しが、まだ持っていると判定されました",
    ).toBeNull();
    expect(isGrid(withoutAlign) && grows(withoutAlign), "① 抜いた写しが母集団から外れました").toBe(true);

    const withoutFlex: Rule = {
      ...target,
      body: withoutProperty(withoutProperty(target.body, "flex"), "flex-grow"),
    };
    expect(grows(withoutFlex), "② `flex` を抜いた写しが、まだ伸びると判定されました").toBe(false);
    // **ここが空振りの正体。**この写しだけの世界では、上の「すべて持っている」は
    // 一致する相手が 0 件のまま緑になる。一覧との突き合わせだけがそれを捕まえる。
    expect([withoutFlex].filter((r) => isGrid(r) && grows(r)).map(keyOf)).toStrictEqual([]);
  });

  it("一覧のどの行も、何をいつ測ったかを持っている", () => {
    const thin = Object.entries(IN_SCOPE)
      .filter(([, v]) => v.trim().length < 12)
      .map(([k]) => k);
    expect(thin, "実測が空です。理由を書かずに足さないこと").toStrictEqual([]);
  });
});
