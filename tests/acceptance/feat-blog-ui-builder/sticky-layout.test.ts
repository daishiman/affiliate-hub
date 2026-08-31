/**
 * @tier 1
 * @req REQ-UX08, A3
 * @types regression, boundary
 *
 * feat-blog-ui-builder の受入 A3:
 * 「公開面でヘッダー・サイドバー・フッターがスクロール中も常時表示され、
 *   狭幅ではサイドバーが折りたたまれる」
 *
 * ## なぜ CSS の本文を読むのか
 *
 * 「スクロール中も見える」は **レイアウト計算の結果**であって、
 * DOM の属性ではない。jsdom はレイアウトを持たないので、
 * `getComputedStyle` で `position: sticky` を確かめても
 * 「そう書いてある」以上のことは分からない。
 *
 * それなら宣言そのものを読むほうが正直である。
 * ここが見ているのは DOM 構造（保守性制約 M2 が禁じるもの）ではなく、
 * **どの領域にどの追従規則を与えたか**という設計判断である。
 *
 * 実際にスクロールして見えるかは P09 の視覚回帰と
 * `tests/e2e/` の Playwright が持つ。この 1 本はその前段で、
 * 「規則が消えていない」ことだけを固定する。
 *
 * ## 現在の達成状況（P07 で実測後、2026-08-30）
 *
 * - T-A3-1（ヘッダー）: 🟢 追従する
 * - T-A3-2 / T-A3-4（サイドバー）: 🟢 追従する・狭幅で折りたたむ
 * - T-A3-3（フッター）: 🟡 **追従させない**。受入 A3 に対する既知の未達で、
 *   実測に基づく撤回である（下の T-A3-3 の註と `acceptance-report.md` A3）。
 *
 * **3 領域のうち 2 領域が達成**という状態を、この 3 本の緑で
 * 「A3 達成」と読み替えないこと。読み替えを防ぐために、
 * T-A3-3 の名前は「未達」と名乗っている。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  new URL("../../../src/presentation/ui/templates/site.module.css", import.meta.url),
  "utf8",
);

/**
 * CSS モジュールから 1 つのクラス規則の本文を切り出す。
 *
 * `@media` の中の同名クラスは拾わない — メディアクエリ内の宣言は
 * 「狭幅での上書き」であり、既定の規則とは別物として見る必要がある。
 * 先頭一致の走査で最初の（＝ファイル冒頭側の、メディア外の）定義を採る。
 */
function ruleBody(selector: string): string | null {
  const at = CSS.indexOf(`\n${selector} {`);
  if (at === -1) return null;
  const open = CSS.indexOf("{", at);
  const close = CSS.indexOf("}", open);
  if (close === -1) return null;
  return CSS.slice(open + 1, close);
}

/** 指定セレクタが「巻いても付いてくる」規則を持つか。 */
function isPinned(selector: string): boolean {
  const body = ruleBody(selector);
  if (body === null) return false;
  return /position:\s*(sticky|fixed)/.test(body);
}

describe("A3 3 領域の常時表示", () => {
  it("読み込んだ CSS が空でない（テスト自身の前提）", () => {
    // 経路を間違えて空文字を読むと、以下すべてが「偽の赤」になる。
    expect(CSS.length).toBeGreaterThan(1000);
    expect(CSS).toContain(".siteHeader");
    expect(CSS).toContain(".siteFooter");
  });

  /**
   * T-A3-1 — 🔴 実装待ち。
   * 現状 `.siteHeader` は `position: relative`。
   */
  it("T-A3-1 ヘッダーがスクロール中も見える", () => {
    expect(isPinned(".siteHeader"), ".siteHeader に追従規則が無い").toBe(true);
  });

  /**
   * T-A3-2 — 🟢 既存実装。
   * この 1 本が赤くなったら、既存の追従が壊されたということ。
   */
  it("T-A3-2 サイドバーがスクロール中も見える", () => {
    expect(isPinned(".siteAsideSticky")).toBe(true);
  });

  /**
   * T-A3-3 — 🟡 **受入 A3 に対する既知の未達**。緑だが達成ではない。
   *
   * ## 経緯
   *
   * P02 §2.2 は「フッターは追従させない」と決めた。P05 はそれを覆した——
   * **受入 A3 がフッターを名指ししている**以上、設計 phase に受入文を
   * 書き換える権限は無い、という理由で。筋は通っている。
   * だが実装して測ったら、害のほうが大きかった。
   *
   * ## 測って分かったこと（2026-08-30、Playwright の実座標）
   *
   * `position: sticky; inset-block-end: 0` の要素は
   * **画面下端の帯を常に占有する**。これは設定ではなく性質である。
   * 本文側に下余白を積んでも守れるのは「最後まで巻き切ったとき」だけで、
   * 途中のスクロール位置では必ず何かを覆う。
   * 1280x900 で本文のリンク（top=839.9）がフッター（top=792）の下に潜り、
   * E2E の重なり検査が **77 件**落ちた。
   * 取り分を 28dvh → 12dvh に下げ、本文と脇の欄に余白を積んでも消えなかった。
   *
   * ## なぜ「除外して緑」にしないのか
   *
   * 重なり検査には `data-floating-overlay`（浮くと自分で名乗る）という
   * 逃げ道がある。フッターに付ければ 77 件は消える。付けない。
   * あれは右下の小さなボタン 1 個のためのもので、画面幅いっぱいの帯に
   * 付ければ「重なりを検出する検査」自体が死ぬ。
   *
   * ## この 1 本が固定していること
   *
   * 追従を**意図して外した**という判断である。誰かが理由を読まずに
   * `position: sticky` を戻したらここで赤くなり、この註に辿り着く。
   * 未達であることは `acceptance-report.md` の A3 に 🟡 で記録した。
   * **この緑を A3 の達成として数えてはならない。**
   */
  it("T-A3-3 フッターは追従しない — 受入 A3 に対する既知の未達", () => {
    expect(
      isPinned(".siteFooter"),
      ".siteFooter に追従規則が戻っている。CSS 側の註と acceptance-report A3 を読むこと。",
    ).toBe(false);
  });

  /**
   * T-A3-4 — 🟢 既存実装。
   *
   * 「折りたたまれる」の実体は 2 つある。
   *   1. 段組みが 1 列になる（本文の下へ降りる）
   *   2. 追従をやめる（1 段になった時点で意味が無い）
   * 2 を落とすと、本文の下に「中だけ巻ける箱」が残り、
   * 指の動きが本文と食い合う。だから両方を固定する。
   */
  it("T-A3-4 狭幅（< 64rem）でサイドバーが折りたたまれる", () => {
    const narrow = CSS.slice(CSS.indexOf("@media (width < 64rem)"));
    expect(narrow.length).toBeGreaterThan(0);
    expect(narrow).toMatch(/\.siteBody\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(narrow).toMatch(/\.siteAsideSticky\s*\{[^}]*position:\s*static/);
  });
});

describe("A3 追従の代償（焦点と可読領域）", () => {
  /**
   * T-A3-7 — 🔴 実装待ち（`design-review.md` R3-1）。
   *
   * WCAG 2.2 SC 2.4.11 Focus Not Obscured。
   * **axe-core はこれを検出できない**。固定ヘッダーの下に
   * 焦点が潜り込んでも自動検査は緑のまま通る。
   * だから「潜らせない仕掛けがある」ことをここで固定する。
   *
   * 仕掛けの実体は `scroll-margin-top`
   * （`component-contract.md` S5）。追従する高さのぶん、
   * スクロール先の手前に余白を確保する。
   */
  it("T-A3-7 ページ内遷移で見出しが固定領域に隠れない仕掛けがある", () => {
    expect(CSS, "scroll-margin-top が無い（SC 2.4.11 を機械では守れない）").toMatch(
      /scroll-margin-top:/,
    );
  });

  /**
   * T-A3-5 — 追従する箱が本文の可読領域を食い潰さないこと。
   *
   * ## 当初の形と、それが間違っていた理由（2026-08-30）
   *
   * この 1 本は当初「`.siteHeader` と `.siteFooter` に高さの上限がある」
   * を求めていた。趣旨は正しい——固定した帯が青天井なら本文が消える。
   * だが**上限は帯の種類によって効いたり害になったりする**。
   *
   * ヘッダーに `max-block-size: 12dvh` + `overflow: hidden` を置いた結果、
   * 実測（1280x900）で上限 108px に中身 177px が入らなかった。
   * `overflow: hidden` は**潰れたことを隠しただけ**で、切られた要素の
   * 矩形は元の場所に残り、はみ出したナビ（下端 177）が本文の先頭
   * （top=132）と重なり続けた。**隠れたものには誰も気付かない。**
   *
   * 上限が効くのは「中身を巻いて読ませられる箱」——脇の欄のように
   * `overflow-y: auto` と併せられる箱だけである。ヘッダーの中身は
   * 巻かせられない（ナビが隠れる）ので、上限ではなく
   * **中身の並べ方**で短く保つのが正しい。
   *
   * ## いま固定していること
   *
   * 1. 追従する箱で画面より高くなり得る脇の欄には、上限と巻きがある。
   * 2. ヘッダーは高さを切らない。切って `overflow: hidden` で隠す手を
   *    **禁止する**（隠しても重なりは消えないことが実測で分かっている）。
   *
   * 数値そのもの（375px で可読領域 560px 以上）は実描画が要るので
   * P09 の視覚回帰と `tests/e2e/` が持つ。ここはその前段である。
   */
  it("T-A3-5 追従する箱が本文の可読領域を食い潰さない", () => {
    const aside = ruleBody(".siteAsideSticky") ?? "";
    expect(/max-height:|max-block-size:/.test(aside), "脇の欄の高さが青天井").toBe(true);
    expect(/overflow-y:\s*auto/.test(aside), "脇の欄が上限を超えたぶんを読めない").toBe(true);

    const header = ruleBody(".siteHeader") ?? "";
    expect(
      /max-height:|max-block-size:/.test(header),
      "`.siteHeader` に高さの上限が戻っている。CSS 側の 2026-08-30 の註を読むこと。",
    ).toBe(false);
    expect(
      /overflow:\s*hidden/.test(header),
      "`.siteHeader` が溢れを隠している。隠しても矩形は残り、本文と重なる。",
    ).toBe(false);
  });
});
