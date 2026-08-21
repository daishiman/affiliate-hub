/** @tier 2 @req REQ-S09 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CSS_ROOT, type Rule, cssFilesUnder, declarationOf, keyOf, rulesOf } from "./css-rules";

/**
 * 管理画面の上端の帯が、狭い画面で逃げ道を持っていることを**規則の形として**固定する。
 *
 * ==========================================================================
 * **この検査自身は溢れを測らない。**
 * ==========================================================================
 *
 * jsdom は**組版を一切しない**（幅も高さも常に 0）。だからここが見ているのは
 * **CSS に何と書いてあるか**だけである。画面の結果は Playwright の
 * `tests/e2e/route-audit.spec.ts` が desktop / mobile の実DOMで別に測る。
 *
 *   - 言えること: 「`.header` に `flex-wrap: wrap` が書いてある」
 *   - 言えないこと: 「`.header` は溢れない」
 *
 * **この 2 つを報告で混ぜないこと。**この検査の緑は「予防が消えていない」、
 * E2E の緑は「現在の登録済み画面で横溢れが観測されない」を意味する。
 *
 * --- なぜ「予防」なのか（UX-07、2026-08-21）---
 *
 * `.header` / `.breadcrumb` / `.headerActions` の折り返しは、**溢れを観測して
 * 直したものではない。**全画面を描いて子の数を数えたところ、子が 2 個以上あり得る
 * 器は `header` / `breadcrumb` / `productCardSpecValue` の 3 つだけで、
 * **その中に折り返せない 20 文字以上の英数字の並びが 1 件も無かった。**
 * 横並びの min-content 幅は子の min-content の和なので、日本語だけなら 1 文字ずつ折れる。
 * つまり**溢れの主な原因が、いまは存在していない。**
 *
 * 入れる判断は妥当だった（この帯は `position: sticky` なので、溢れると全画面の
 * 上端に貼り付いたまま残る。管理画面 32 枚に効く）。**しかし壊しても赤にならなかった。**
 * この検査はその 1 点だけを埋める。
 *
 * --- **捕まえないもの** ---
 *
 * **① 折り返せない長い並びが後から入ること。**
 * 「20 文字以上の英数字が 0 件」は**いま入っているデータの性質**であって、
 * **規則の性質ではない。**識別子・URL・API キーの断片を 1 つ画面に出した日に
 * 前提は消えるが、この検査は CSS しか読まないので**緑のまま**である。
 * （母集団の性質を規則の性質と読み違える形。今日 9 つ目として記録されたもの。）
 *
 * **② 実際に折り返した後に読めるかどうか。**折り返した 2 行目が下の内容に
 * かぶる、行間が詰まって読めない、といったことは組版の結果なので見えない。
 *
 * **③ `.feedbackDialog` はこの見張りの母集団に入らない。**
 * 走査に 1 度も現れない——押して初めて開く client 側の状態の枝だから
 * （残課題 141 と同じ穴が client 側にも開いている）。CSS の文面は読めるので
 * 「横並びの器」としては数に入るが、**描かれた実物と突き合わせた結果は無い。**
 *
 * **④ 幅の指定そのもの。**この検査は `min-width: 0` の全体件数を正本にしない。
 * 実ブラウザで見つかった溢れを止める宣言は `flex-row-shape.test.ts` の理由台帳が
 * 網羅し、この検査は上端の帯に関係する宣言だけを守る。
 *
 * 規範: docs/product/ui-ux-tasks.md UX-07
 */

type Guard = {
  /** 何を数えて、いつ数えたか。 */
  readonly measured: string;
  /** この規則に**在るべき**宣言。`属性: 値` の形で完全一致を見る。 */
  readonly requires: readonly string[];
  /** この規則に**在ってはならない**属性。値ではなく属性名で見る。 */
  readonly forbids: readonly string[];
  /** なぜその形なのか。**消したくなった人がここを読んで判断できるだけ書く。** */
  readonly why: string;
};

/**
 * 押さえている規則。
 *
 * **数を先に書かずに列挙してある。**件数が要るなら `Object.keys(GUARDED).length`
 * を読むこと——「3 つ組」と書いてから中身を並べると、並べたものが 4 つでも
 * 誰も気づかない（2026-08-21 に同じ穴を 2 人が踏んでいる）。
 *
 * **doc は「3 つ組」と書いているが、この一覧は 4 つある。**`.main` を含めたのは、
 * 溢れが起きる経路が `.main`（縮める）→ 帯（折り返す）と繋がっていて、
 * **どちらか一方が消えても同じ結果になる**ため。3 と 4 のどちらが正しいかではなく、
 * **「3 つ組」が指していた範囲が、押さえるべき範囲と違っていた。**
 */
const GUARDED: Record<string, Guard> = {
  "src/presentation/ui/primitives/ui.module.css :: .header": {
    measured: "2026-08-21 実測。走査で 42 回 / 子 1〜2",
    requires: ["display: flex", "flex-wrap: wrap"],
    // **`justify-content` を禁じるのが、この一覧でいちばん壊れやすい行である。**
    // `space-between` は「1 行に収まっている」ことを前提にした指定で、
    // 折り返した瞬間に意味が変わる（行が 1 つずつになるので両端に寄せる相手が
    // 消え、左寄せに戻る）。**`flex-wrap: wrap` と `space-between` は、
    // 片方ずつ見るとどちらも正しく見える。**寄せ方は `.headerActions` の
    // `margin-inline-start: auto` が持つ。
    forbids: ["justify-content"],
    why:
      "**この帯は `position: sticky`。**溢れると画面の上端に貼り付いたまま残り、" +
      "下へ送っても消えない。管理画面 32 枚すべての骨格なので、狭い画面での逃げ道を" +
      "ここに持たせないと 32 枚が同時に読めなくなる",
  },
  "src/presentation/ui/primitives/ui.module.css :: .breadcrumb": {
    measured: "2026-08-21 実測。走査で 63 回 / 子 1〜3。**子が 2 個以上あり得る 3 件の 1 つ**",
    requires: ["display: flex", "flex-wrap: wrap", "min-width: 0"],
    forbids: [],
    why:
      "flex の子の最小幅は既定で `auto`、つまり中身より小さくならない。" +
      "パンくずは画面名をそのまま並べるので、深い画面（3 段が 13 枚）では帯ごと横へ広がる。" +
      "**縮められるようにしたうえで、縮めた先で切り落とさずに折り返す**" +
      "——パンくずは「どこから来たか」なので、末尾だけ残して切ると意味が消える",
  },
  "src/presentation/ui/primitives/ui.module.css :: .headerActions": {
    measured: "2026-08-21 実測。走査で 40 回 / 子 1",
    requires: ["display: flex", "flex-wrap: wrap", "margin-inline-start: auto"],
    forbids: [],
    why:
      "**寄せ方をここが持つ**（`.header` の `justify-content` を禁じた先）。" +
      "`margin-inline-start: auto` は行が 1 本でも 2 本でも「操作は行の右端」で同じことを言う。" +
      "操作が増えた画面ではこの中でも折り返し、折り返した行は右端に揃える" +
      "（`justify-content: flex-end`）——押す的が行ごとに左右へ動くと目で追う位置が定まらない",
  },
  "src/presentation/ui/primitives/ui.module.css :: .main": {
    measured: "2026-08-21 実測。帯を含む右側の柱",
    requires: ["display: flex", "min-width: 0"],
    forbids: [],
    why:
      "**折り返す前に、縮めるほうの経路。**`.shell` の grid の子で、これが `min-width: 0` を" +
      "持たないと右の柱が中身の幅まで広がり、帯がいくら折り返しても画面ごと横へ溢れる。" +
      "**帯の `flex-wrap` はこの規則の上に乗っている**ので、片方だけを見張っても意味が無い",
  },
};

const CSS_FILES = cssFilesUnder(join(CSS_ROOT, "src"));
const ALL: readonly Rule[] = CSS_FILES.flatMap(rulesOf);
const BY_KEY = new Map(ALL.map((r) => [keyOf(r), r] as const));

/** 横並びの器。`flex-direction` が縦のものは、折り返しの話が別になるので外す。 */
function isRowContainer(rule: Rule): boolean {
  const display = declarationOf(rule.body, "display");
  if (display === null || !/^(inline-)?flex$/.test(display)) return false;
  const direction = declarationOf(rule.body, "flex-direction");
  return direction === null || /row/.test(direction);
}

/** 本文から指定の属性の宣言を落とす。**対照のためだけに使う**（下の「対照」を見ること）。 */
function withoutProperty(body: string, property: string): string {
  return body.replace(new RegExp(String.raw`(^|[\s;])${property}\s*:[^;}]*;?`, "g"), "$1");
}

/** `属性: 値` の完全一致。値の空白は 1 つに畳んで比べる。 */
function hasDeclaration(rule: Rule, declaration: string): boolean {
  const at = declaration.indexOf(":");
  const property = declaration.slice(0, at).trim();
  const expected = declaration.slice(at + 1).trim();
  const actual = declarationOf(rule.body, property);
  return actual !== null && actual.replace(/\s+/g, " ") === expected;
}

describe("上端の帯は、狭い画面での逃げ道を規則として持っている", () => {
  it("走査そのものが空振りしていない（母集団の床）", () => {
    // 切り出しが壊れると、以下すべてが「見つからない」ではなく「0 件で緑」に化ける。
    expect(ALL.length, "CSS の規則をほとんど拾えていません。切り出す側を先に疑うこと").toBeGreaterThan(250);
    expect(CSS_FILES.length, "CSS のファイルを歩けていません").toBeGreaterThanOrEqual(8);
    expect(ALL.filter(isRowContainer).length, "横並びの器が 1 つも見つかりません").toBeGreaterThan(30);
  });

  it("折り返す器と折り返さない器を、実際に見分けている（陰性対照）", () => {
    // 2026-08-21 の実測: 横並びの器 48（wrap 21 / wrap 無し 27）。
    // **両側に数が立つことを見る。**片側が 0 なら、判定ではなく読み取りが壊れている。
    const rows = ALL.filter(isRowContainer);
    const wrapping = rows.filter((r) => declarationOf(r.body, "flex-wrap") === "wrap");
    expect(wrapping.length, "`flex-wrap: wrap` を持つ器が 1 つも見つかりません").toBeGreaterThan(10);
    expect(rows.length - wrapping.length, "`flex-wrap` を持たない器が 1 つも見つかりません").toBeGreaterThan(10);
  });

  it("押さえている規則が、CSS に実在する", () => {
    // **これが無いと、名前を変えただけで検査が空振りして緑になる。**
    // 下の本体は「在る規則を調べる」形なので、規則ごと消えると調べる対象が消えて通る。
    const missing = Object.keys(GUARDED).filter((k) => !BY_KEY.has(k));
    expect(
      missing,
      "一覧の規則が CSS に見つかりません。名前が変わったなら一覧の鍵も一緒に直すこと",
    ).toStrictEqual([]);
  });

  it("在るべき宣言が消えていない", () => {
    const broken: string[] = [];
    for (const [key, guard] of Object.entries(GUARDED)) {
      const rule = BY_KEY.get(key);
      if (rule === undefined) continue; // 実在は上の検査が見る
      for (const need of guard.requires) {
        if (!hasDeclaration(rule, need)) broken.push(`${key} → \`${need}\` が無い / 値が違う`);
      }
    }
    expect(broken, "上端の帯の折り返しが外れています。理由は一覧の `why` に書いてあります").toStrictEqual([]);
  });

  it("在ってはならない宣言が入っていない", () => {
    const added: string[] = [];
    for (const [key, guard] of Object.entries(GUARDED)) {
      const rule = BY_KEY.get(key);
      if (rule === undefined) continue;
      for (const banned of guard.forbids) {
        if (declarationOf(rule.body, banned) !== null) added.push(`${key} → \`${banned}\` が入った`);
      }
    }
    expect(
      added,
      "折り返しと噛み合わない寄せ方が入りました。`.header` の `why` を読むこと",
    ).toStrictEqual([]);
  });

  it("上端の帯で縮める役は、親ではなく子と外側の柱が持つ", () => {
    // ==================================================================
    // 全CSSの件数はここで写さない。実ブラウザで必要になった別画面の宣言まで
    // ヘッダーの契約へ混ぜると、二つの正本が生まれる。GUARDED が対象にする
    // 上端の帯だけを切り出し、親（header/headerActions）ではなく
    // 子（breadcrumb）と外側の柱（main）が縮む、という非対称を固定する。
    // ==================================================================
    const guardedKeys = new Set(Object.keys(GUARDED));
    const withMinWidthZero = ALL.filter(
      (rule) => guardedKeys.has(keyOf(rule)) && declarationOf(rule.body, "min-width") === "0",
    ).map(keyOf);
    expect(
      withMinWidthZero.sort(),
      "上端の帯で `min-width: 0` を持つ役が変わりました。UX-07 も一緒に直すこと",
    ).toStrictEqual([
      "src/presentation/ui/primitives/ui.module.css :: .breadcrumb",
      "src/presentation/ui/primitives/ui.module.css :: .main",
    ]);
  });

  it("**対照**——宣言を 1 つ抜くと、この検査は実際に赤へ倒れる", () => {
    // ==================================================================
    // **赤にならない見張りは、緑であることを何も意味しない。**
    //
    // ただし**対照を共有ファイルの書き換えでやらない。**この作業木は 4 人で
    // 共有していて、`ui.module.css` は 2026-08-21 18:50:39 に他の担当が書いている
    // （その瞬間に走った私の検査は、`.breadcrumb` の `min-width: 0` が無い状態を
    // 読んで実際に赤になった）。**書き換えて戻す形の対照は、戻すまでの数秒を
    // 他の 3 人に押し付ける。**
    //
    // 代わりに**実物の本文から宣言を 1 つ落とした写しを作って判定に掛ける。**
    // 判定と本文は実物のまま、欠けた状態だけを作る。**そして一度きりの手作業では
    // なく、毎回走る。**
    //
    // 見ていないもの: 「この検査がその規則を走査対象にしているか」。
    // 走査の側は上の「押さえている規則が、CSS に実在する」が受け持つ。
    // ==================================================================
    const survived: string[] = [];
    let attempted = 0;
    for (const [key, guard] of Object.entries(GUARDED)) {
      const rule = BY_KEY.get(key);
      if (rule === undefined) continue;
      for (const need of guard.requires) {
        attempted += 1;
        const property = need.slice(0, need.indexOf(":")).trim();
        const damaged: Rule = { ...rule, body: withoutProperty(rule.body, property) };
        if (hasDeclaration(damaged, need)) survived.push(`${key} → \`${need}\` を抜いても通る`);
      }
      for (const banned of guard.forbids) {
        attempted += 1;
        const damaged: Rule = { ...rule, body: `${rule.body}${banned}: space-between;` };
        if (declarationOf(damaged.body, banned) === null) {
          survived.push(`${key} → \`${banned}\` を足しても気づかない`);
        }
      }
    }
    expect(survived, "壊した写しが通りました。判定のほうが効いていません").toStrictEqual([]);
    // **対照そのものが空振りしていないこと。**壊す相手が 0 件でも上の行は緑になる
    // ——空の一覧はいつでも一致する。これは grid の側で見つけた形と同じで、
    // **「壊しても赤にならない」を防ぐ検査自身が、壊す相手を失って緑になる。**
    expect(attempted, "壊した写しを 1 つも作っていません").toBeGreaterThan(8);
  });

  it("一覧のどの行も、数と理由の両方を持っている", () => {
    const thin = Object.entries(GUARDED)
      .filter(([, v]) => v.measured.trim().length < 4 || v.why.trim().length < 12)
      .map(([k]) => k);
    expect(thin, "実測か理由が空です。理由を書かずに足さないこと").toStrictEqual([]);
  });
});
