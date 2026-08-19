/**
 * @tier 2
 * @req REQ-TS06
 * @types a11y, regression
 *
 * **axe の規則 1 つずつに、陽性対照を置く。**
 *
 * --- なぜ要るか ---
 * 「画面 67 枚に当たった規則は 28 件」という数は、**当たったことしか言っていない。**
 * 当たったうえで、要件を破った姿を渡したときに赤くなるかは別の話である。
 * 実測すると、28 件のうち **赤くできるのは 18 件**しかなかった。
 * 残り 10 件は、当たってはいるが**破っても赤くならない**。
 *
 * **判定不能にならないほうが、判定不能になるより危ない。**
 * 判定不能なら「分からなかった」が残るが、素通りは緑になり、
 * 見張られていない場所が見張られているように数えられる。
 * しかも `findA11yViolations` は `incomplete` を捨てるので、
 * **この作業場所では判定不能も緑と区別が付かない**（下の `describe` で固定してある）。
 *
 * --- 測った条件 ---
 * 2026-08-19、axe-core 4.13.0、`tests/support/a11y.ts` の `TAGS`（WCAG 2.2 AA まで）。
 * 28 件は画面 67 枚へ実際に当たった規則の集合そのもので、ここで数え直してはいない。
 *
 * --- 向き ---
 * - 18 件（`REACHABLE`）: **赤くできることの下限。**どれかが素通りへ落ちたら赤くなる
 * - 10 件（`OUT_OF_REACH`）: ②と⑤の形。**いまは届いていない**ことを固定し、
 *   届くようになった日（jsdom が描画を持つ・axe が判定を変える・入れ物を変える）に
 *   赤くなって「18 の側へ動かす番だ」と知らせる。消さずに向きを反転させて残す
 *
 * --- 壊し方について（1 度やった失敗） ---
 * 最初の合成では `aria-prohibited-attr` と `aria-conditional-attr` も素通りに見えたが、
 * **私の壊し方が要件を破っていなかっただけ**だった（前者は中身のある `div`、
 * 後者は `role="switch"` の当て方が規則の対象外）。
 * **「素通り」と書く前に、自分の合成が悪いだけでないかを疑うこと。**
 */
import { describe, expect, it } from "vitest";
import { findA11yViolations, runA11y } from "../support/a11y";

/** 要件の文がそのまま禁じている姿を渡すと、違反として返る規則。 */
const REACHABLE: readonly { readonly id: string; readonly broken: string }[] = [
  {
    id: "aria-allowed-attr",
    broken: `<div role="progressbar" aria-checked="true" aria-label="進み具合"></div>`,
  },
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
  { id: "label", broken: `<input type="text">` },
  { id: "link-name", broken: `<a href="/x"></a>` },
  { id: "list", broken: `<ul><p>x</p></ul>` },
  { id: "listitem", broken: `<div><li>x</li></div>` },
  { id: "nested-interactive", broken: `<button type="button"><a href="/x">y</a></button>` },
  { id: "select-name", broken: `<select><option>a</option></select>` },
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
    why: "`sharedDom()` の `<html lang=\"ja\">` が固定",
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
 * 画面 67 枚に実際に当たった 28 規則。**2026-08-19 の実測そのもの。**
 * 上の 2 つの表を足したものと一致していなければならない
 * （どちらかから項目を落とすと、その落としたぶんだけ見張りが減るため）。
 */
const APPLIED_2026_08_19: readonly string[] = [
  "aria-allowed-attr", "aria-conditional-attr", "aria-deprecated-role", "aria-hidden-body",
  "aria-hidden-focus", "aria-prohibited-attr", "aria-required-attr", "aria-roles",
  "aria-valid-attr", "aria-valid-attr-value", "button-name", "bypass", "definition-list",
  "dlitem", "document-title", "duplicate-id-aria", "form-field-multiple-labels",
  "html-has-lang", "html-lang-valid", "label", "link-name", "list", "listitem",
  "nested-interactive", "select-name", "target-size", "td-headers-attr", "th-has-data-cells",
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
  it.each(OUT_OF_REACH.filter((o) => o.attempt !== null).map((o) => [o.id, o] as const))(
    "%s — 破っても違反にならない（いまは届いていない）",
    async (id, o) => {
      const b = await runA11y(o.attempt!);
      // **赤くなったら、それは届くようになった日である。**
      // 項目を消すのではなく、REACHABLE へ動かして陽性対照に変える。
      expect(b.violations, `${id} が届くようになった。REACHABLE へ動かすこと`).not.toContain(id);
      const bucket = o.bucket === "緑" ? b.passes : b.incomplete;
      expect(bucket, `${id} の置かれ方が変わった（理由: ${o.why}）`).toContain(id);
    },
  );

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

describe("一覧そのものが痩せていないか", () => {
  /**
   * **②の形の検査には母集団の下限を同居させる**（㉗）。
   * 上の 3 つは表を回すので、**項目を消せば全部緑になる。**
   *
   * 18 は 2026-08-19 に出た数そのもの。下限なので上げる方向にしか動かさない。
   */
  it("赤くできる規則を減らして緑にできない", () => {
    expect(REACHABLE.length).toBeGreaterThanOrEqual(18);
  });

  /*
   * **届いていない 10 件の側に、上限を置いていない。**
   *
   * 置きたくなるが、置くと**壊しようのない緑が 1 つ増える**だけになる。証明:
   *     下の検査が 2 つの表の合計を 28 に固定している（重複も禁じている）
   *   ⟹ `OUT_OF_REACH.length` = 28 − `REACHABLE.length`
   *   ⟹ 上の下限（18 以上）と `OUT_OF_REACH ≤ 10` は**同じ 1 つのことを言っている**
   *   ⟹ 上限が赤くなるとき、下限も必ず赤くなる。**上限が単独で赤くなることは在り得ない**
   *
   * 実測でも確かめた（2026-08-19）。`select-name` を届いている側から
   * 届いていない側へ移す壊し方では、上限・下限・その規則自身の 3 本が同時に赤くなり、
   * 上限を消しても残り 2 本が同じ壊し方を捕まえた。
   *
   * 上限を置く番が来るのは、**合計の固定を外したとき**である。
   * そのときはこの但し書きごと書き換えること。
   */
  it("2 つの表を足すと、実際に当たった 28 規則とちょうど一致する", () => {
    const listed = [...REACHABLE.map((r) => r.id), ...OUT_OF_REACH.map((o) => o.id)].sort();
    expect(listed).toStrictEqual([...APPLIED_2026_08_19].sort());
    expect(new Set(listed).size, "同じ規則が両方の表に入っている").toBe(listed.length);
  });
});
