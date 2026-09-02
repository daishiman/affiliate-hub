/**
 * @tier 1
 * @req REQ-BOPS06
 * @types decision-table, screen-states
 *
 * 票を伏せる／戻す欄。**同じ部品が、押すと逆のことをする 2 つの顔を持つ。**
 *
 * 顔の切り替えは `hidden` 1 つで決まり、そこから 8 か所（送る intent・
 * 道具の名前と説明・欄の見出し・注意書き・釦の色と文字）が同時に変わる。
 * 1 か所でも取り違えると、**押した人の意図と逆の操作が飛ぶ**。
 * しかも画面上はもっともらしく見えるので、使っても気づけない。
 *
 * 見た目ではなく「どちらの顔でも、伏せる側と戻す側が入れ替わっていないこと」を
 * 両方の状態で固定する。
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useActionState: (_action: unknown, initial: unknown) => [initial, () => undefined, false],
  };
});

const { BlogRatingHideForm } = await import("@/presentation/admin/publish/blog-rating-form");

function render(hidden: boolean): string {
  return renderToStaticMarkup(
    <BlogRatingHideForm articleId="bar_article" ratingId="brt_rating" hidden={hidden} />,
  );
}

describe("評価を伏せる／戻す欄", () => {
  it("見えている票には「伏せる」を送り、消えないことを断る", () => {
    const html = render(false);

    expect(html).toContain('value="hide"');
    expect(html).not.toContain('value="show"');
    // 「消える」と思われたまま押されるのがいちばん困る。
    // 行は残り、平均と件数から外れるだけであることを、押す前に言う。
    expect(html).toContain("伏せても票は消えません。平均と件数から外れるだけです。");
    expect(html).toContain("この評価を伏せる");
  });

  it("伏せてある票には「戻す」を送り、平均に入り直すことを断る", () => {
    const html = render(true);

    expect(html).toContain('value="show"');
    expect(html).not.toContain('value="hide"');
    expect(html).toContain("戻すと、この票が平均と件数に入り直します。");
    expect(html).toContain("読者に見えるよう戻す");
  });

  it("どちらの顔でも理由の欄を出す", () => {
    // 読者が書いたものを見えなくする操作なので、
    // **理由の無い一手を作らない。** 記録側でも必須にしてある。
    expect(render(false)).toContain("伏せる理由");
    expect(render(true)).toContain("戻す理由");
    for (const hidden of [false, true]) {
      expect(render(hidden)).toContain('name="reason"');
    }
  });

  it("どちらの顔でも、どの記事のどの票かを一緒に送る", () => {
    // 票 1 件ごとに欄を置いているのは、理由と票を 1 対 1 で結ぶため。
    // ここが欠けると、理由だけが宙に浮いた記録が残る。
    for (const hidden of [false, true]) {
      const html = render(hidden);
      expect(html).toContain('value="bar_article"');
      expect(html).toContain('value="brt_rating"');
    }
  });
});
