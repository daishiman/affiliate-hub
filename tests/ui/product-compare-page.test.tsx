/**
 * @tier 2
 * @req REQ-A02, REQ-A08
 * @types decision-table, screen-states
 *
 * 並べて比べる画面（`/admin/products/compare`）。
 *
 * この 1 枚は 9 個の関数のうち 1 個しか通っていなかった（2026-09-02 実測）。
 * 総当たり（`page-render.test.tsx`）は `searchParams` を渡さないので、
 * **いつも「比べる商品が足りません」の 1 枚だけ**を描いていた。
 * 描けてはいるので赤にならず、表そのものは一度も出ていなかった。
 *
 * この画面の主題は**揃っていない項目を空欄で出さないこと**である。
 * 空欄は「その機能が無い」と読まれる。値を持っていないだけの項目は
 * 表の外へ出す、という判断はユースケース側（`compare_products`）が持ち、
 * 画面はその結果をそのまま描く。だからここで見るのは判断の正しさではなく、
 * **判断の結果が読者のところまで届くか**である。
 */
import { describe, expect, it } from "vitest";
import { renderRouteIn, textOf } from "../support/render";

const PAGE = "@/app/admin/products/compare/page";

/*
  見本の 4 商品のうち、`p_gamma_16` だけが `張地` を持つ
  （`product-sample-repository.ts` の SPEC_BY_PRODUCT）。
  揃わない項目の枝を通すために見本側が用意してあるので、
  ここで欠けたデータを組み立てない。手で作った欠けは、
  実際には起きない欠けかもしれない。
*/
async function render(ids?: string): Promise<string> {
  return renderRouteIn("authorized", PAGE, {
    searchParams: Promise.resolve(ids === undefined ? {} : { ids }),
  });
}

describe("何を渡されたかで、出す物が変わる", () => {
  it("何も選ばれていなければ、表ではなく選び直す道を出す", async () => {
    const text = textOf(await render());

    expect(text).toContain("比べる商品が足りません");
    expect(text).toContain("商品の一覧");
  });

  it("1 件だけでは比べられないと言う", async () => {
    // 「2件以上」の境目。1 件で表を出すと、比較でない物が比較の顔で出る。
    const text = textOf(await render("p_alpha_15"));

    expect(text).toContain("比べる商品が足りません");
  });

  it("空白やカンマだけの指定を、選ばれた 1 件と数えない", async () => {
    /*
      `,,` や ` ` を id として数えると、存在しない商品を読みに行って
      「比較表を作れませんでした」が出る。読者から見れば
      **何も選んでいないのに失敗した画面**になる。
    */
    const text = textOf(await render(" , ,"));

    expect(text).toContain("比べる商品が足りません");
    expect(text).not.toContain("比較表を作れませんでした");
  });

  it("読み出せない商品を指されたら、断りと戻り先を出す", async () => {
    const text = textOf(await render("p_alpha_15,p_not_exist"));

    expect(text).toContain("比較表を作れませんでした");
    expect(text).toContain("商品の一覧へ戻る");
  });
});

describe("表に出るもの", () => {
  it("選んだ商品の名前と、揃っている項目の値が出る", async () => {
    const text = textOf(await render("p_alpha_15,p_beta_14"));

    expect(text).toContain("2件を比べています");
    // 列（全商品で揃っている項目）
    expect(text).toContain("座面の高さ");
    // 値そのもの。列が出ても中身が空なら、読者には何も伝わらない。
    expect(text).toContain("42〜54cm");
    expect(text).toContain("39〜51cm");
  });

  it("比べている商品それぞれの個別ページへ行ける", async () => {
    // 表だけでは根拠まで辿れない。比較の次に来る問いは「なぜその値か」である。
    const html = await render("p_alpha_15,p_beta_14");

    expect(html).toContain("/admin/products/p_alpha_15");
    expect(html).toContain("/admin/products/p_beta_14");
  });

  it("見本データで動いていることを黙らない", async () => {
    // 商品の保存先はまだ見本。実データと読まれると、比較の結論まで信じられてしまう。
    const text = textOf(await render("p_alpha_15,p_beta_14"));

    expect(text).toContain("見本データ");
  });
});

describe("揃っていない項目は、空欄ではなく表の外へ", () => {
  it("一部の商品にしか無い項目を、名前を挙げて表の外に出す", async () => {
    /*
      ここがこの画面の主題である。`張地` は `p_gamma_16` だけが持つ。
      表の中に空欄で出すと「アルファには張地が無い」と読まれるが、
      本当は**値を持っていないだけ**で、無いとは分かっていない。
    */
    const text = textOf(await render("p_alpha_15,p_gamma_16"));

    expect(text).toContain("比べられない項目");
    expect(text).toContain("張地");
    expect(text).toContain("値を持っていない商品があるため列にしていません");
  });

  it("全項目が揃っているときは、その断りを出さない", async () => {
    /*
      いつも出していると、断りは背景になって読まれなくなる。
      出すか出さないかで意味を持たせる。
    */
    const text = textOf(await render("p_alpha_15,p_beta_14"));

    expect(text).not.toContain("比べられない項目");
  });
});
