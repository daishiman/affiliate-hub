/**
 * @tier 1
 * @req REQ-BOPS01
 * @types screen-states, boundary
 *
 * 記事 1 本を作る欄の**初期値の決まり方**を固定する。
 *
 * この欄には「まだ何も選ばれていない」状態が 2 種類ある。
 * ブログが 1 つも無い状態と、ブログはあるがカテゴリが無い状態である。
 * どちらも `?? ""` で空文字へ落ちるので、**画面上は同じに見える**。
 * 落ち方を間違えても見た目で気づけないので、ここで別々に固定する。
 *
 * 併せて、カテゴリの選択肢が「いま選んでいるブログのぶんだけ」に
 * 絞られていることを見る。ここが素通しになると、別のブログのカテゴリを
 * 選んだまま下書きが作れてしまい、保存側で弾かれるまで分からない。
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

const { BlogArticleCreateForm } = await import("@/presentation/admin/publish/blog-article-form");

type SiteOption = {
  readonly value: string;
  readonly label: string;
  readonly categories: readonly { readonly value: string; readonly label: string }[];
};

const 二つのブログ: readonly SiteOption[] = [
  {
    value: "alpha",
    label: "アルファ",
    categories: [
      { value: "review", label: "レビュー" },
      { value: "news", label: "お知らせ" },
    ],
  },
  {
    value: "beta",
    label: "ベータ",
    categories: [{ value: "diary", label: "日記" }],
  },
];

function render(siteOptions: readonly SiteOption[]): string {
  return renderToStaticMarkup(<BlogArticleCreateForm siteOptions={siteOptions} />);
}

describe("記事を作る欄", () => {
  it("ブログが 1 つ以上あれば、先頭のブログと、そのブログの先頭カテゴリを初期値にする", () => {
    const html = render(二つのブログ);

    expect(html).toContain('value="alpha"');
    expect(html).toContain('value="review"');
    // **カテゴリはブログをまたがない。** 2 つ目のブログのカテゴリが
    // 初期表示に混ざっていたら、選択肢の絞り込みが効いていない。
    expect(html).not.toContain('value="diary"');
  });

  it("ブログが 1 つも無くても落ちず、空のまま出す", () => {
    // 初回セットアップ直後がこの状態になる。ここで例外を投げると、
    // **「ブログを作れ」と言うべき画面が真っ白になる。**
    const html = render([]);

    expect(html).toContain("どのブログに置くか");
    expect(html).toContain("公開カテゴリ");
  });

  it("ブログはあるがカテゴリが 1 つも無いときも、ブログだけは選ばれている", () => {
    // 前のケースと結果の見た目は同じ（カテゴリが空）だが、原因が違う。
    // 落ち方を取り違えると、ブログの初期選択まで一緒に消える。
    const html = render([{ value: "alpha", label: "アルファ", categories: [] }]);

    expect(html).toContain('value="alpha"');
    expect(html).not.toContain('value="review"');
  });

  it("版面は既定で T1 を選び、その版面が要求する部品を先に告げる", () => {
    // 部品の入力はここでは求めない代わりに、**あとで何を入れることになるかを
    // 作る前に見せる**。見せないと、下書きを作ってから要求を知ることになる。
    const html = render(二つのブログ);

    expect(html).toContain("T1");
    expect(html).toContain("この版面は");
    expect(html).toContain("を要求します");
  });

  it("作るときに送るのは入れ物ぶんだけで、intent は create である", () => {
    const html = render(二つのブログ);

    expect(html).toContain('value="create"');
    for (const name of ["siteSlug", "categorySlug", "slug", "template", "title"]) {
      expect(html).toContain(`name="${name}"`);
    }
  });
});
