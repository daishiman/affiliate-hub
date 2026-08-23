/**
 * @tier 2
 * @req REQ-TS06
 * @types a11y, regression
 *
 * **axe の規則 1 つずつに、陽性対照を置く。**
 *
 * --- なぜ要るか ---
 * 「画面 67 枚に当たった規則は 45 件」という数は、**当たったことしか言っていない。**
 * 当たったうえで、要件を破った姿を渡したときに赤くなるかは別の話である。
 * 実測すると、45 件のうち **赤くできるのは 33 件**しかなかった。
 * 残り 12 件は、当たってはいるが**破っても赤くならない**。
 *
 * **判定不能にならないほうが、判定不能になるより危ない。**
 * 判定不能なら「分からなかった」が残るが、素通りは緑になり、
 * 見張られていない場所が見張られているように数えられる。
 * しかも `findA11yViolations` は `incomplete` を捨てるので、
 * **この作業場所では判定不能も緑と区別が付かない**（下の `describe` で固定してある）。
 *
 * --- 測った条件 ---
 * 2026-08-19、axe-core 4.13.0、`tests/support/a11y.ts` の `A11Y_TAGS`
 * （WCAG 2.2 AA まで + `best-practice`）。
 * 45 件は画面 67 枚へ実際に当たった規則の集合そのもので、ここで数え直してはいない。
 * 止めていない有効な規則は 99 件あり、**当たらなかった 54 件はこの表に載っていない**
 * （例: `image-alt` は 67 枚に `<img>` が 1 枚も無いため当たらない。
 * 画像を足した日に初めて動き出す。backlog 84 に 1 行残してある）。
 *
 * --- 数を動かした回の記録（2026-08-19） ---
 * `best-practice` を足す前は **当たり 28 件・赤くできる 18 件**だった。
 * 足したことで当たりが 17 件増え、そのうち **15 件が赤くでき、2 件は判定不能どまり**。
 * 新旧どちらの定義でも数を残してある（数え方を変えた回は両方を残す）。
 *
 * --- 壊し方について（2 度やった失敗） ---
 * 1 度目: `aria-prohibited-attr` と `aria-conditional-attr` が素通りに見えたが、
 * **私の壊し方が要件を破っていなかっただけ**だった。
 * 2 度目: `landmark-banner-is-top-level` と `landmark-contentinfo-is-top-level` が
 * 「入れ物（対象外）」に見えたが、`<main>` の中の `<header>` は banner にならない
 * （HTML の仕様で、`main` の子孫の `header` は目印ではない）ため、
 * **壊したつもりで壊す対象を作れていなかった**。`role="banner"` を明示したら赤くなった。
 * **「素通り」と書く前に、自分の合成が悪いだけでないかを疑うこと。**
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allRuleIds,
  DISABLED_RULES,
  disabledRulesWithoutReason,
  enabledRuleIds,
  findA11yViolations,
  runA11y,
} from "../support/a11y";

const ROOT = resolve(import.meta.dirname, "../..");

/** 要件の文がそのまま禁じている姿を渡すと、違反として返る規則。 */
const REACHABLE: readonly { readonly id: string; readonly broken: string }[] = [
  {
    id: "aria-allowed-attr",
    broken: `<div role="progressbar" aria-checked="true" aria-label="進み具合"></div>`,
  },
  { id: "aria-allowed-role", broken: `<img src="a.png" alt="絵" role="listitem">` },
  {
    id: "aria-conditional-attr",
    // 表の行に `aria-expanded`（treegrid の行にしか許されない）。
    broken: `<table><tr aria-expanded="true"><td>x</td></tr></table>`,
  },
  { id: "aria-deprecated-role", broken: `<div role="directory"><div>x</div></div>` },
  // 中身のある要素だと axe は判定不能に置く。空にして初めて違反になる。
  { id: "aria-prohibited-attr", broken: `<div aria-label="名前"></div>` },
  { id: "aria-required-attr", broken: `<div role="checkbox" aria-label="同意" tabindex="0"></div>` },
  { id: "aria-roles", broken: `<div role="そんな役割は無い">x</div>` },
  { id: "aria-valid-attr", broken: `<div role="button" tabindex="0" aria-そんな属性は無い="x">y</div>` },
  {
    id: "aria-valid-attr-value",
    broken: `<div role="checkbox" aria-checked="たぶん" aria-label="同意" tabindex="0"></div>`,
  },
  { id: "button-name", broken: `<button type="button"></button>` },
  { id: "definition-list", broken: `<dl><p>語の説明</p></dl>` },
  { id: "dlitem", broken: `<div><dt>語</dt></div>` },
  { id: "empty-heading", broken: `<h2></h2>` },
  {
    id: "empty-table-header",
    broken: `<table><tr><th></th><th>値</th></tr><tr><td>あ</td><td>1</td></tr></table>`,
  },
  { id: "heading-order", broken: `<h1>大</h1><h4>小</h4>` },
  { id: "label", broken: `<input type="text">` },
  // `title` だけを名前にすると、読み上げ以外（拡大鏡・音声操作）で名前が出ない。
  { id: "label-title-only", broken: `<input type="text" title="名前">` },
  // `<main>` の子孫の `<header>` は目印にならないので、役割を明示しないと壊せない。
  { id: "landmark-banner-is-top-level", broken: `<main><div role="banner">頭</div></main>` },
  {
    id: "landmark-contentinfo-is-top-level",
    broken: `<main><div role="contentinfo">脚</div></main>`,
  },
  { id: "landmark-main-is-top-level", broken: `<aside aria-label="脇"><main>本</main></aside>` },
  { id: "landmark-no-duplicate-banner", broken: `<header>頭1</header><header>頭2</header>` },
  { id: "landmark-no-duplicate-contentinfo", broken: `<footer>脚1</footer><footer>脚2</footer>` },
  { id: "landmark-no-duplicate-main", broken: `<main>本1</main><main>本2</main>` },
  // これが見えていなかったことが `best-practice` を足した理由そのもの。
  {
    id: "landmark-unique",
    broken: `<aside aria-label="同じ名前">1</aside><aside aria-label="同じ名前">2</aside>`,
  },
  { id: "link-name", broken: `<a href="/x"></a>` },
  { id: "list", broken: `<ul><p>x</p></ul>` },
  { id: "listitem", broken: `<div><li>x</li></div>` },
  { id: "nested-interactive", broken: `<button type="button"><a href="/x">y</a></button>` },
  { id: "region", broken: `<p>目印の外にある文</p>` },
  {
    id: "scope-attr-valid",
    broken: `<table><tr><th scope="でたらめ">見出し</th></tr><tr><td>あ</td></tr></table>`,
  },
  { id: "select-name", broken: `<select><option>a</option></select>` },
  {
    id: "table-duplicate-name",
    broken: `<table summary="売上表"><caption>売上表</caption><tr><td>あ</td></tr></table>`,
  },
  {
    id: "td-headers-attr",
    broken: `<table><caption>利用</caption><tr><td headers="どこにも無い">x</td></tr></table>`,
  },
];

/**
 * 当たってはいるが、破っても赤くならない規則。
 *
 * `bucket` は要件を破った姿を渡したときに axe が置く場所。
 * - `判定不能`: axe は気づいているが違反にしない（`why` にその文言を写してある）
 * - `緑`: 破っているのに「満たしている」と答える。**いちばん危ない**
 * - `入れ物`: 判定の対象が `<body>` の外にあり、画面の側から壊しようがない
 */
type OutOfReach = {
  readonly id: string;
  readonly bucket: "判定不能" | "緑" | "入れ物";
  /** 要件を破った姿。`入れ物` の 4 件は渡す側から作れないので `null`。 */
  readonly attempt: string | null;
  /** なぜ赤くならないか。判定不能のものは axe が返した文言そのもの。 */
  readonly why: string;
};

const OUT_OF_REACH: readonly OutOfReach[] = [
  {
    id: "target-size",
    bucket: "緑",
    attempt: `<div><button type="button" style="width:10px;height:10px;padding:0">a</button><button type="button" style="width:10px;height:10px;padding:0">b</button></div>`,
    why: "jsdom は全要素を 0×0 で返すため、10px 四方を 2 つ並べても『Safe clickable space has a diameter of 24px』と答える。押しどころの大きさは画面の側の検査（--hit-min）でしか見られていない",
  },
  {
    id: "bypass",
    bucket: "判定不能",
    attempt: `<a href="/x">先へ</a><p>本文</p>`,
    why: "No valid skip link found | Page does not have a heading | Page does not have a landmark region（3 つとも気づいたうえで判定不能）",
  },
  {
    id: "th-has-data-cells",
    bucket: "判定不能",
    attempt: `<table><caption>利用</caption><tr><th scope="col">見出し</th><th scope="col">空</th></tr><tr><td>x</td></tr></table>`,
    why: "Table data cells are missing or empty",
  },
  {
    id: "duplicate-id-aria",
    bucket: "判定不能",
    attempt: `<div id="dup">a</div><div id="dup">b</div><button type="button" aria-describedby="dup">x</button>`,
    why: "Document has multiple elements referenced with ARIA with the same id attribute: dup —— **重複した id を名指しで返しているのに、違反にはしない**",
  },
  {
    id: "form-field-multiple-labels",
    bucket: "判定不能",
    attempt: `<label for="f">A</label><label for="f">B</label><input id="f" type="text">`,
    why: "Multiple label elements is not widely supported in assistive technologies",
  },
  {
    id: "aria-hidden-focus",
    bucket: "判定不能",
    attempt: `<div aria-hidden="true"><button type="button">x</button></div>`,
    why: "Axe encountered an error; test the page for this type of problem manually —— これだけは axe の設計ではなく、この環境で例外が出ている",
  },
  /*
   * 下の 2 件は `best-practice` を足したことで**有効にはなったが、
   * この渡し方では中身を 1 文字も見ていない。**
   * 目印がまったく無い画面・見出しが 1 つも無い画面を渡しても、
   * axe は判定を返さず「手で確かめてください」と答える
   * （画面全体を見る規則で、`<body>` の中身だけを差し替える渡し方と噛み合っていない）。
   * **直すのは今ではない。**渡し方を画面まるごとへ変える日に、この 2 件が赤くなって知らせる。
   */
  {
    id: "landmark-one-main",
    bucket: "判定不能",
    attempt: `<div>本文だけ。目印が無い</div>`,
    why: "Axe encountered an error; test the page for this type of problem manually —— 有効だが、この渡し方では何も見ていない",
  },
  {
    id: "page-has-heading-one",
    bucket: "判定不能",
    attempt: `<main><p>見出しの無い画面</p></main>`,
    why: "Axe encountered an error; test the page for this type of problem manually —— 有効だが、この渡し方では何も見ていない",
  },
  {
    id: "document-title",
    bucket: "入れ物",
    attempt: null,
    why: "`sharedDom()` の `<head>` が `<title>` を持つ。渡すのは `<body>` の中だけなので、画面の側からは題を消せない",
  },
  {
    id: "html-has-lang",
    bucket: "入れ物",
    attempt: null,
    why: '`sharedDom()` の `<html lang="ja">` が固定',
  },
  { id: "html-lang-valid", bucket: "入れ物", attempt: null, why: "同上" },
  {
    id: "aria-hidden-body",
    bucket: "入れ物",
    attempt: null,
    why: "`<body>` そのものに `aria-hidden` を付ける道が無い（付けられるのは中身だけ）",
  },
];

/**
 * 画面 67 枚に実際に当たった 45 規則。**2026-08-19 の実測そのもの。**
 * 上の 2 つの表を足したものと一致していなければならない
 * （どちらかから項目を落とすと、その落としたぶんだけ見張りが減るため）。
 */
const APPLIED_2026_08_19: readonly string[] = [
  "aria-allowed-attr", "aria-allowed-role", "aria-conditional-attr", "aria-deprecated-role",
  "aria-hidden-body", "aria-hidden-focus", "aria-prohibited-attr", "aria-required-attr",
  "aria-roles", "aria-valid-attr", "aria-valid-attr-value", "button-name", "bypass",
  "definition-list", "dlitem", "document-title", "duplicate-id-aria", "empty-heading",
  "empty-table-header", "form-field-multiple-labels", "heading-order", "html-has-lang",
  "html-lang-valid", "label", "label-title-only", "landmark-banner-is-top-level",
  "landmark-contentinfo-is-top-level", "landmark-main-is-top-level",
  "landmark-no-duplicate-banner", "landmark-no-duplicate-contentinfo",
  "landmark-no-duplicate-main", "landmark-one-main", "landmark-unique", "link-name", "list",
  "listitem", "nested-interactive", "page-has-heading-one", "region", "scope-attr-valid",
  "select-name", "table-duplicate-name", "target-size", "td-headers-attr", "th-has-data-cells",
];

describe("赤くできる規則（陽性対照）", () => {
  it.each(REACHABLE.map((r) => [r.id, r] as const))(
    "%s — 要件を破った姿が違反として返る",
    async (id, r) => {
      const found = await findA11yViolations(r.broken);
      expect(
        found.map((v) => v.id),
        `${id} が赤くならなくなった。素通りへ落ちたなら OUT_OF_REACH へ動かす`,
      ).toContain(id);
    },
  );
});

describe("当たってはいるが赤くできない規則", () => {
  const attempted = OUT_OF_REACH.filter((o) => o.attempt !== null).map((o) => [o.id, o] as const);

  // **1 つの `it` に 2 つの `expect` を入れない。**
  // 前が落ちると後ろは評価されず、「もう片方はどうだったか」が失敗の記録に残らない。
  it.each(attempted)("%s — 破っても違反にならない（いまは届いていない）", async (id, o) => {
    const b = await runA11y(o.attempt!);
    // **赤くなったら、それは届くようになった日である。**
    // 項目を消すのではなく、REACHABLE へ動かして陽性対照に変える。
    expect(b.violations, `${id} が届くようになった。REACHABLE へ動かすこと`).not.toContain(id);
  });

  it.each(attempted)("%s — 置かれ方（判定不能か素通りか）も変わっていない", async (id, o) => {
    const b = await runA11y(o.attempt!);
    const bucket = o.bucket === "緑" ? b.passes : b.incomplete;
    expect(bucket, `${id} の置かれ方が変わった（理由: ${o.why}）`).toContain(id);
  });

  it.each(OUT_OF_REACH.filter((o) => o.attempt === null).map((o) => [o.id, o] as const))(
    "%s — 判定の対象が入れ物の側にあり、渡す側から壊せない",
    async (id) => {
      // 何も渡さなくても緑になる＝画面の中身を 1 文字も見ていない。
      const b = await runA11y("");
      expect(b.passes, `${id} が入れ物の側で満たされなくなった`).toContain(id);
    },
  );
});

/**
 * **判定不能が、この作業場所では緑と区別が付かない**ことを固定する（②の形）。
 *
 * `findA11yViolations` は `result.violations` だけを返し、`incomplete` を捨てる。
 * axe の側では「分からなかった」として残っているものが、**私たちの検査へは届かない。**
 * 本文に「捨てています」と書くだけだと、拾うようになった日にも古く見えない。
 *
 * ⑤ の反転先: `incomplete` を流すようにしたらこの検査が赤くなる。
 * そのときは消さず、「判定不能は判定不能として届く」へ書き換える。
 */
describe("判定不能は、違反として届かない", () => {
  const incompleteCase = OUT_OF_REACH.find((o) => o.bucket === "判定不能" && o.attempt !== null)!;

  it("axe の側では判定不能として残っている", async () => {
    const b = await runA11y(incompleteCase.attempt!);
    expect(b.incomplete).toContain(incompleteCase.id);
  });

  it("それでも違反の一覧には出てこない（＝緑と同じ見え方になる）", async () => {
    const found = await findA11yViolations(incompleteCase.attempt!);
    expect(found.map((v) => v.id)).not.toContain(incompleteCase.id);
  });
});

/**
 * **止めている規則の数に上限を張る**（①の形）。
 *
 * 規則を止めるのは、赤が出たときにいちばん簡単な逃げ道になる。
 * しかも止めた規則は 4 つの入れ物のどこにも出てこないので、
 * **何も起きなかった画面と見分けが付かない。**
 */
describe("止めている規則", () => {
  /**
   * 2026-08-19 に止めていたのは `color-contrast` の 1 件だけ。**下げる向きにしか動かさない。**
   *
   * **床の単独の検出力は、1 つの壊し方では判定できない。**4 通りで測った:
   *   - 45 に載っている `region` を止める     → 赤 3 本（陽性対照と件数の床も鳴る）
   *   - 45 に無い `image-alt` を止める        → 赤 2 本（件数の床も鳴る）
   *   - 存在しない id を足す                  → 赤 56 本（axe が全件で例外になる）
   *   - 基準の外にある `duplicate-id` を足す  → **赤 1 本。この床だけが鳴った**
   * 最後の 1 つがあるので、この床は他から導けない。
   */
  const MAX_DISABLED = 1;

  it("止めている規則の数が上限を超えていない", () => {
    expect(
      DISABLED_RULES.length,
      `止めた規則が増えた（現在: ${DISABLED_RULES.map((r) => r.id).join(", ")}）。増やす前に、赤の原因のほうを直せないか確かめる`,
    ).toBeLessThanOrEqual(MAX_DISABLED);
  });

  it("理由の書かれていない規則が 0 件", () => {
    expect(disabledRulesWithoutReason()).toStrictEqual([]);
  });

  /**
   * **0 を報告する検査は、0 の作り方を 2 通り持っていなければ 0 を主張できない**（⑳）。
   * 上の 0 件は「本当に全部に理由がある」からでも「見つける側が壊れている」からでも出る。
   * 同じ関数へ理由の無い項目を渡し、見つける側が動いていることを示す。
   */
  it("理由が空の項目は、同じ関数がちゃんと見つける", () => {
    expect(
      disabledRulesWithoutReason([
        { id: "理由なし", reason: "   " },
        { id: "理由あり", reason: "別の検査で見ているため" },
      ]),
    ).toStrictEqual(["理由なし"]);
  });
});

describe("一覧そのものが痩せていないか", () => {
  /**
   * **②の形の検査には母集団の下限を同居させる**（㉗）。
   * 上の 3 つは表を回すので、**項目を消せば全部緑になる。**
   *
   * 33 は 2026-08-19 に出た数そのもの（`best-practice` を足す前は 18）。
   * 下限なので上げる方向にしか動かさない。
   */
  it("赤くできる規則を減らして緑にできない", () => {
    expect(REACHABLE.length).toBeGreaterThanOrEqual(33);
  });

  /*
   * **届いていない 12 件の側に、上限を置いていない。**
   *
   * 置きたくなるが、置くと**壊しようのない緑が 1 つ増える**だけになる。証明:
   *     下の検査が 2 つの表の合計を 45 に固定している（重複も禁じている）
   *   ⟹ `OUT_OF_REACH.length` = 45 − `REACHABLE.length`
   *   ⟹ 上の下限（33 以上）と `OUT_OF_REACH ≤ 12` は**同じ 1 つのことを言っている**
   *   ⟹ 上限が赤くなるとき、下限も必ず赤くなる。**上限が単独で赤くなることは在り得ない**
   *
   * 実測でも確かめた（2026-08-19、当たり 28 件のとき）。
   * `select-name` を届いている側から届いていない側へ移す壊し方では、
   * 上限・下限・その規則自身の 3 本が同時に赤くなり、
   * 上限を消しても残り 2 本が同じ壊し方を捕まえた。
   *
   * 上限を置く番が来るのは、**合計の固定を外したとき**である。
   * そのときはこの但し書きごと書き換えること。
   */
  it("2 つの表を足すと、実際に当たった 45 規則とちょうど一致する", () => {
    const listed = [...REACHABLE.map((r) => r.id), ...OUT_OF_REACH.map((o) => o.id)].sort();
    expect(listed).toStrictEqual([...APPLIED_2026_08_19].sort());
  });

  it("同じ規則が 2 つの表の両方に入っていない", () => {
    const listed = [...REACHABLE.map((r) => r.id), ...OUT_OF_REACH.map((o) => o.id)];
    expect(new Set(listed).size).toBe(listed.length);
  });

  /*
   * --- 一度置いて、測って外した床（2026-08-19） ---
   * 「表に載っている 45 件が、いま全部有効になっている」という検査を書いた。
   * 見る基準（`A11Y_TAGS`）が**狭まった**日に気づけない、と考えたためである。
   * 3 通りの壊し方で測ったところ、**単独で赤くなることが 1 度も無かった**:
   *   - `best-practice` を抜く → この床を含めて赤 18 本。外すと 17 本（陽性対照の側が捕まえる）
   *   - `wcag22aa` を抜く      → 赤 2 本。外すと 1 本（`target-size` の置かれ方が捕まえる）
   *   - 45 の一覧を綴り違いに   → 赤 2 本。外すと 1 本（合計の一致が捕まえる）
   * 基準が狭まると、その規則を使っている陽性対照か置かれ方の検査が必ず赤くなる。
   * **床の総数だけが厚くなるので外した。**
   *
   * 外して初めて分かったのは、**狭まる側ではなく広がる側が見えていない**ことだった。
   * 基準を広げても、増えた規則を誰も指していないので 1 本も赤くならない。
   * そこで下の 1 本だけを置いてある（`wcag2aaa` を足す壊し方で赤 1 本・外すと 0 本）。
   */
  /**
   * **有効な規則の数を固定する。**
   *
   * 45 は「67 枚に当たった数」で、有効な規則はその倍以上ある。
   * 基準を広げたり axe を上げたりして有効な規則が増えると、
   * **増えたぶんは 45 の表に載っていないまま、誰にも見られない状態で回る。**
   * 増えた日にここが赤くなり、「表を取り直す番だ」と知らせる。
   *
   * 99 は 2026-08-19 の axe-core 4.13.0 と `A11Y_TAGS` での実測そのもの
   * （基準に当たる 100 件から、止めている `color-contrast` を引いた数）。
   * **合わせるために動かす数ではない。**動かすときは 45 の表も同じコミットで取り直す。
   */
  it("止めていない有効な規則は 99 件のまま（増えたら 45 の表を取り直す）", async () => {
    expect(
      await enabledRuleIds(),
      "有効な規則の数が変わった。docs/product/backlog.md の 84 と同じやり方で 67 枚へ当て直し、REACHABLE / OUT_OF_REACH / APPLIED を取り直すこと",
    ).toHaveLength(99);
  });
});

/**
 * **要件追跡表の a11y 欄の凡例が、実測とずれたら赤くする。**
 *
 * --- なぜ要るか（実際に起きたこと） ---
 * 凡例は 2026-08-19 に実測を書いて置かれたが、**同じ日のうちに古くなった。**
 * `best-practice` を足して当たりが 28 → 45 件・赤にできるのが 18 → 33 件へ動いたのに、
 * 凡例は 28 のまま残っていた。**文章で書いた実測は、測り直した日にも古く見えない。**
 * これは残課題 78 の①（何かが緑に見える形）そのもので、
 * 直し方は「今度こそ気をつける」ではなく**測り方の側**である。
 *
 * --- 何を見ていないか ---
 * 数が合っていることだけを見る。**凡例の文が正しいかは見ていない。**
 * 「33 件ぶんだけ」という言い切りが妥当かは人が読む側の話である。
 *
 * --- 壊して測った（2026-08-21。どれも赤は 1 本ずつ） ---
 * 凡例の 33 を 28（古い数）へ戻す → 「赤にできる規則の一致」だけが赤。
 * 凡例から「axe を回している」を根拠にしない、の一文を消す → その 1 本だけが赤。
 * 凡例の届かない領域を 7 → 6 にする → `tests/ui/axe-blind-spots.test.ts` の 1 本だけが赤。
 */
describe("要件追跡表の a11y 欄の凡例", () => {
  /** 凡例の数の表だけを切り出す。文書の他の場所にある数字を拾わないため。 */
  const legendBlock = (): string => {
    const doc = readFileSync(resolve(ROOT, "docs/product/traceability.md"), "utf8");
    const from = doc.indexOf("<!-- a11y-legend:counts");
    const to = doc.indexOf("#### a11y 欄の書き方", from);
    if (from < 0 || to < 0) {
      throw new Error("凡例の数の表が見つからない（a11y-legend:counts の目印ごと消えている）");
    }
    return doc.slice(from, to);
  };

  /** 表の 1 行から件数を取る。**見つからなければ throw する**（黙って 0 を返さない）。 */
  const legendCount = (label: string): number => {
    const row = legendBlock()
      .split("\n")
      .find((l) => l.includes(label) && /\|\s*\d+\s*\|/.test(l));
    if (row === undefined) throw new Error(`凡例に「${label}」の行が無い`);
    return Number(/\|\s*(\d+)\s*\|/.exec(row)![1]);
  };

  /**
   * **0 の作り方を 2 通り持つ**（⑳）。
   * 下の一致は、`legendCount` が何も見ずに正しい数を返していても通る。
   * 先に、無い行を渡したら見つからないことを示す。
   */
  it("先に、凡例を読む側が動いていることを示す（陽性対照）", () => {
    expect(() => legendCount("そんな行は凡例に無い")).toThrow();
  });

  it("「axe-core が持つ規則」の数が実測と合っている", async () => {
    expect(legendCount("axe-core 4.13.0 が持つ規則")).toBe((await allRuleIds()).length);
  });

  it("「止めていない有効な規則」の数が実測と合っている", async () => {
    expect(legendCount("うち止めていない有効な規則")).toBe((await enabledRuleIds()).length);
  });

  it("「実際に当たった規則」の数が、この表の 45 件と合っている", () => {
    expect(legendCount("うち画面 67 枚に実際に当たった規則")).toBe(APPLIED_2026_08_19.length);
  });

  /** **凡例がいちばん言いたい数。**「対応」の裏が取れている範囲そのもの。 */
  it("「破ったときに赤にできる規則」の数が、陽性対照の件数と合っている", () => {
    expect(legendCount("うち破ったときに赤にできる規則")).toBe(REACHABLE.length);
  });

  /**
   * **「axe を回している」を根拠にしない**と決めた以上、
   * 凡例にその決めごとが書かれていること自体を見張る。
   * 決めごとが消えれば、次の書き手は前の書き方へ戻る。
   */
  it("「axe を回している」を根拠にしない、が凡例に書かれている", () => {
    const doc = readFileSync(resolve(ROOT, "docs/product/traceability.md"), "utf8");
    expect(doc).toContain("**「axe を回している」を根拠にしない。**");
  });
});
