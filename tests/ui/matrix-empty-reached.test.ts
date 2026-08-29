/** @tier 2 @req REQ-S05 @types screen-states */
/*
 * **生成マトリクスの「空の案内」が、実際に描かれることを見る。**（2026-08-21、UX-14）
 *
 * --- なぜ 1 ファイル立てるのか ---
 *
 * `admin/content/matrix/page.tsx:177` の `EmptyView` は、**書かれてから一度も
 * 描かれたことが無かった。**見本の企画が読者像を全部持っているため、
 * `?axis=audience` を渡しても行は必ず埋まる。
 * `docs/product/ui-ux-tasks.md` の「14 つ目の形：分岐は在るが、一度も通っていない」
 * の 3 例目で、**枝が通らない理由が身元でも URL でもなく見本データの側にあった。**
 *
 * `tests/support/render.tsx` に `no-audience` の世界を足して通した。
 * **だが、通せるようにしただけでは 14 つ目の形をもう一度やることになる**
 * ——世界は在るが誰も確かめない、という同じ形である。ここがその確かめ。
 *
 * --- この検査の向き ---
 *
 * `route-branch-reached.test.ts` は「**断りの 1 枚に化けていないか**」を見る。
 * こちらは「**中身のうち、狙った 1 つの枝が出ているか**」を見る。
 * **網はここを捕まえられない**——空の案内は権限の断りではないので、
 * あちらの目には「普通に描けている画面」として映る。
 *
 * --- 最初に書いた検査が 2 つとも間違っていた。両方とも実物が正した ---
 *
 *   1. 文言を `docs/product/ui-ux-tasks.md` から写して「読者**像**が 1 つも
 *      登録されていません」と書いた。実物は `${matrix.rowAxisLabel}が…` で、
 *      `?axis=audience` のとき軸のラベルは「読者」である。**doc の側が違っていた。**
 *      直したのは検査のほうだが、記録としては doc も直すこと。
 *   2. 行を `tbody tr` で数えて 0 本を期待し、7 本が返ってきた。**同じ画面に
 *      「媒体ごとの制約」という別の表が同居している。**マトリクスの表は
 *      正しく消えていたのに、隣の表を数えていた。
 *
 * どちらも「**入れ物を名前で名指ししないと、道具は勝手に畳む**」という
 * `screen-hit-and-current.test.tsx` の doc と同じ教訓である。以下、表は
 * `aria-label` で名指しする。
 */
import { describe, expect, it } from "vitest";
import { renderCase } from "./route-table";
import { intoDom } from "../support/render";
import { SCREEN_RENDER_BUDGET_MS } from "../../quality-gates.config.mjs";

/** `EmptyView` の見出し。軸のラベルが差し込まれるので、軸ごとに変わる。 */
const EMPTY_TITLE = "読者が 1 つも登録されていません";

/** マトリクスの表を名指しする目印（`page.tsx:189`）。同居する別の表と混ざらない。 */
const MATRIX_TABLE = '[aria-label="企画と媒体の組み合わせごとの、記事の作り分け"]';

const AUDIENCE = { file: "admin/content/matrix/page.tsx", searchParams: { axis: "audience" } };

function matrixRowsIn(html: string): number {
  const { document, cleanup } = intoDom(html);
  try {
    // **`<table>` の有無では見ない。**画面が骨だけ残して中身を空にした場合
    // （＝ UX-14 が直そうとしていた当の姿）を通してしまう。行を数える。
    return document.querySelectorAll(`${MATRIX_TABLE} tbody tr`).length;
  } finally {
    cleanup();
  }
}

describe("生成マトリクスの空の案内が、実際に描かれる", () => {
  it("読者像が 1 つも無い世界では、空の案内が出る", async () => {
    const html = await renderCase({ ...AUDIENCE, world: "no-audience" });
    expect(
      html,
      "空の案内が描かれていません。**分岐が在ることと、そこへ届くことは別です**" +
        "——`tests/support/render.tsx` の `no-audience` が効いているかを先に疑うこと",
    ).toContain(EMPTY_TITLE);
  }, SCREEN_RENDER_BUDGET_MS);

  it("空の案内が、表の代わりに出ている（マトリクスの表が消えている）", async () => {
    const rows = matrixRowsIn(await renderCase({ ...AUDIENCE, world: "no-audience" }));
    expect(
      rows,
      `マトリクスの表に行が ${rows} 本あります。**見出し行だけの空表**は空の案内より悪い` +
        "——「まだ作っていない」のか「作れない」のかが区別できません",
    ).toBe(0);
  }, SCREEN_RENDER_BUDGET_MS);

  it("既定の世界では、空の案内は出ず、表に行が立つ（陰性対照）", async () => {
    const html = await renderCase(AUDIENCE);
    // **片方向だけの検査は「いつも空」を緑にする。**空を測る検査は、
    // 空でないほうを一緒に測らないと、常時空との区別が付かない。
    expect(
      html,
      "既定の見本データでも空の案内が出ています。見本の企画" +
        "（`content-editorial-sample-repository.ts`）が読者像を持っているかを見ること",
    ).not.toContain(EMPTY_TITLE);
    const rows = matrixRowsIn(html);
    expect(rows, "既定の見本データでも行が 0 本です。上の検査が意味を失っています").toBeGreaterThan(
      0,
    );
  }, SCREEN_RENDER_BUDGET_MS);

  it("同じ世界でも、軸を切り替えれば行は立つ（世界が全部を空にしていない）", async () => {
    // **上の陰性対照より強い。**世界を外して比べるのではなく、**世界を着たまま**
    // 軸だけ変える。`no-audience` が空にしているのは企画の `audiencePersonaIds`
    // 1 フィールドだけなので、切り口の軸では行が立たなければならない。
    // ここが 0 になったら、置き換えが 1 フィールドを越えて効いている——
    // つまり上の「空の案内が出た」は**世界が画面を壊しただけ**かもしれない。
    const rows = matrixRowsIn(
      await renderCase({
        file: "admin/content/matrix/page.tsx",
        searchParams: { axis: "angle" },
        world: "no-audience",
      }),
    );
    expect(
      rows,
      "読者像を空にした世界で、切り口の軸まで 0 行になっています。" +
        "**`render.tsx` の置き換えが 1 フィールドを越えて効いていないか**を疑うこと",
    ).toBeGreaterThan(0);
  }, SCREEN_RENDER_BUDGET_MS);
});
