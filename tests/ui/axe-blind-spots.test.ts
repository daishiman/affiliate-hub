/**
 * @tier 2
 * @req REQ-TS06
 * @types a11y, regression
 *
 * **axe では原理的に届かない領域の一覧。**
 *
 * --- なぜ一覧を文章で書かないか ---
 * 「axe はここを見ていません」と本文に書いただけの記述は、
 * **見るようになった日にも古く見えない。** 一覧を検査として書くと、
 * axe が規則を足してその形を拾い始めた日に、この検査が赤くなって知らせる。
 * 限界の記述ではなく、限界の監視である（②の形。`bd memories test-gate-directions`）。
 *
 * --- 一覧の軸（2026-08-19 の実測から出た統一的な説明） ---
 * **axe が見ているのは「書かれているものが妥当か」であって、
 * 「書かれるべきものが書かれているか」ではない。**
 * 名前の無い `group`、役割を名乗らない操作部品、向きを名乗らない見出し、
 * 焦点を受けない台紙——どれも「書かれていない」側なので、
 * 規則を足しても届かない。ここに並ぶのは全部その形である。
 *
 * --- 測った条件（2026-08-19、axe-core 4.13.0、画面 67 枚） ---
 * | | 現行 TAGS | + best-practice |
 * |---|---|---|
 * | 有効な規則（件） | 70 | 100 |
 * | 実際に当たった規則（件） | 28 | 45 |
 * | 違反（件） | 0 | 2（`landmark-unique`） |
 * 全規則は 105 件。**規則を広げても、下の一覧は 1 件も拾えない**ことまで確かめてある。
 * だから「まだ規則を有効にしていないだけ」ではなく「原理的に届かない」と書ける。
 *
 * --- この検査が主張していない 2 つのこと ---
 * 1. 一覧が網羅であること。**これは「見つけた分」であって「全部」ではない。**
 *    網羅を主張できる数え方をまだ持っていない。
 * 2. `whereReal` が付いている項目が十分に守られていること。
 *    ここが見ているのは「その画面を自分の目で見ている検査が実在する」ことだけで、
 *    その検査が正しいかは各ファイルの側の話である。
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { describeViolations, findA11yViolations } from "../support/a11y";

const ROOT = resolve(import.meta.dirname, "../..");

type BlindSpot = {
  /** 何が届かないか。 */
  readonly name: string;
  /** 要件を満たしていない姿。**判定式ではなく、要件の文がそのまま禁じている行為で壊す。** */
  readonly broken: string;
  /** 満たしている姿。 */
  readonly fixed: string;
  /** 自分の目。`broken` で偽、`fixed` で真になること。 */
  readonly sees: (html: string) => boolean;
  /**
   * 本物の画面でこれを見ている検査。
   * **`null` は「合成でしか押さえていない」という申告である。** 消さない。
   */
  readonly whereReal: string | null;
};

/**
 * 入れ物側。`<main>` と見出しを持たせておく。
 * 断片だけを渡すと `region` や `page-has-heading-one` の側が出て、
 * 「axe が何も言わなかった」のか「別のことを言った」のかが混ざる。
 */
function page(body: string): string {
  return `<main><h1>検査対象</h1>${body}</main>`;
}

const BLIND_SPOTS: readonly BlindSpot[] = [
  {
    name: "まとまりが名前を持たない（`role=\"group\"` に名前が無い）",
    broken: page(`<div role="group"><button type="button">ペン</button></div>`),
    fixed: page(`<div role="group" aria-label="道具"><button type="button">ペン</button></div>`),
    sees: (html) => /role="group"[^>]*aria-label=/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "操作部品が役割を名乗らない（押せるものが `button` ではない）",
    // 押せることを `onclick` で明示しても変わらない。
    // 「押せるのに役割を名乗っていない」という形そのものを見る規則が無い。
    broken: page(`<div class="tool" onclick="pick()">ペン</div>`),
    fixed: page(`<button type="button">ペン</button>`),
    sees: (html) => /<button\b/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "列の見出しが向きを名乗らない（`scope=\"col\"` が無い）",
    broken: page(
      `<table><caption>利用</caption><thead><tr><th>回数</th></tr></thead><tbody><tr><td>12</td></tr></tbody></table>`,
    ),
    fixed: page(
      `<table><caption>利用</caption><thead><tr><th scope="col">回数</th></tr></thead><tbody><tr><td>12</td></tr></tbody></table>`,
    ),
    sees: (html) => /scope="col"/.test(html),
    whereReal: "tests/ui/ai-usage-page.test.tsx",
  },
  {
    name: "行の見出しがただのマスになる（`<th scope=\"row\">` が `<td>`）",
    broken: page(
      `<table><caption>利用</caption><tbody><tr><td>ブログA</td><td>12</td></tr></tbody></table>`,
    ),
    fixed: page(
      `<table><caption>利用</caption><tbody><tr><th scope="row">ブログA</th><td>12</td></tr></tbody></table>`,
    ),
    sees: (html) => /scope="row"/.test(html),
    whereReal: "tests/ui/ai-usage-page.test.tsx",
  },
  {
    name: "描ける台紙が焦点を受けない（`canvas` に `tabindex` も役割も無い）",
    broken: page(`<canvas width="10" height="10"></canvas>`),
    fixed: page(
      `<canvas width="10" height="10" tabindex="0" role="application" aria-label="写しに印を置く"></canvas>`,
    ),
    sees: (html) => /<canvas[^>]*tabindex="0"/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "状態の変化が読み上げへ届かない（`aria-live` が無い）",
    broken: page(`<p>位置 3, 4</p>`),
    fixed: page(`<p aria-live="polite">位置 3, 4</p>`),
    sees: (html) => /aria-live=/.test(html),
    whereReal: "tests/ui/capture-canvas.test.tsx",
  },
  {
    name: "代替テキストが中身を説明していない（`alt` はあるが定型語）",
    broken: page(`<img src="/a.png" alt="画像">`),
    fixed: page(`<img src="/a.png" alt="編集台の上のノートパソコンと外付けモニター">`),
    // 定型語だけの `alt` を弾く。**これは十分な判定ではない**
    // （「内容を説明しているか」は機械には分からない。`tests/support/a11y.ts` の冒頭）。
    // ここで押さえられるのは、最も多い手抜きの形だけである。
    sees: (html) => {
      const alt = /alt="([^"]*)"/.exec(html)?.[1] ?? "";
      return alt.length > 0 && !["画像", "写真", "図", "image", "photo"].includes(alt);
    },
    // **本物の画面で見ている検査は無い。** 合成でしか押さえていない。
    whereReal: null,
  },
];

describe("axe では原理的に届かない領域", () => {
  /**
   * **0 の作り方を 2 通り持つ**（⑳）。
   * 下の「違反 0」は、対象に問題が無くても、測る側が壊れていても同じ 0 になる。
   * 見つかるはずの合成を同じ経路へ通して、見つける側が動いていることを先に示す。
   */
  it("先に、見つける側が動いていることを示す（陽性対照）", async () => {
    const found = await findA11yViolations(page(`<img src="/a.png">`));
    expect(found.map((v) => v.id)).toContain("image-alt");
  });

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — axe は要件を満たしていない姿を違反として上げない",
    async (_name, spot) => {
      const found = await findA11yViolations(spot.broken);
      // **赤くなったら、それは axe が見るようになった日である。**
      // そのときは項目を消すのではなく、`sees` を残したまま
      // 「axe も見るようになった」へ書き換えて、二重に見る。
      expect(found, `axe が見るようになった: ${describeViolations(found)}`).toStrictEqual([]);
    },
  );

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — 満たしている姿でも axe は何も言わない（違いを見ていない）",
    async (_name, spot) => {
      const found = await findA11yViolations(spot.fixed);
      expect(found, describeViolations(found)).toStrictEqual([]);
    },
  );

  it.each(BLIND_SPOTS.map((s) => [s.name, s] as const))(
    "%s — 自分の目のほうは効いている（壊すと落ちる／直すと通る）",
    (_name, spot) => {
      expect(spot.sees(spot.broken), "壊した姿を通してしまった").toBe(false);
      expect(spot.sees(spot.fixed), "直した姿を落としてしまった").toBe(true);
    },
  );

  it.each(
    BLIND_SPOTS.filter((s) => s.whereReal !== null).map((s) => [s.name, s.whereReal!] as const),
  )("%s — 本物の画面で見ている検査が実在する", (_name, where) => {
    expect(existsSync(resolve(ROOT, where)), `${where} が無い`).toBe(true);
  });
});

describe("一覧そのものが痩せていないか", () => {
  /**
   * **②の形の検査には、数える対象そのものの件数の下限を同居させる**（㉗）。
   * 上の 4 本は `BLIND_SPOTS` を回すので、**項目を消せば全部緑になる。**
   * 下限が無ければ、この一覧は減らすだけで満たせる。
   *
   * 7 は 2026-08-19 に出た数そのものである。下限なので上げる方向にしか動かさない。
   */
  it("項目を減らして緑にできない", () => {
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(7);
  });

  /**
   * 合成でしか押さえていない項目の数。**上限なので下げる方向にしか動かさない。**
   *
   * 1 は「代替テキストの中身」の 1 件。**この上限は「1 件までは合成で許す」ではなく、
   * 「いま 1 件ある」という申告である。** 減らすには本物の画面で見る検査を足す。
   * 増やしたくなったら止めて聞く。
   */
  it("合成でしか押さえていない項目が増えていない", () => {
    const synthetic = BLIND_SPOTS.filter((s) => s.whereReal === null);
    expect(synthetic.map((s) => s.name)).toHaveLength(1);
  });

  it("同じ形を 2 度書いていない（名前が重複していない）", () => {
    expect(new Set(BLIND_SPOTS.map((s) => s.name)).size).toBe(BLIND_SPOTS.length);
  });
});
