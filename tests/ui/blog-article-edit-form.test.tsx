/**
 * @tier 2
 * @req REQ-UX02, REQ-BOPS01, REQ-BOPS05
 * @types state-transition, boundary
 *
 * 記事 1 本を直す画面。
 *
 * --- ここで見ること ---
 *
 * **画面の中だけで完結する判断**に限る。すなわち
 * 「足りない部品の指摘」「並びのずれの指摘」「部品を動かす」「部品を足す」。
 * どれも保存を待たずにその場で出る。押した先（保存が通るか）は
 * `tests/application/blog-ops-usecases.test.ts` が本物の道で確かめている。
 *
 * --- なぜテストを足したか（2026-08-30）---
 *
 * `blog-article-form.tsx` は分岐 27.5%・関数 36.1% だった。
 * `BlogArticleRestoreForm` だけが静的描画で見られていて、**この編集画面は
 * 1 度も動かされていなかった。** 並べ替えの端（先頭を上へ／末尾を下へ）は
 * 境界そのものなのに、誰も押していなかった。
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArticleBlockKind } from "@/domain/blogops";
import { ARTICLE_BLOCK_LABEL, REQUIRED_BLOCKS } from "@/domain/blogops";

/*
  保存の口だけ差し替える。囲い（ToolForm・Callout・useDraft）は本物を通す。
  ここで本物のサーバ操作を呼ぶと、画面の判断ではなく保存の道を測ることになる。
*/
vi.mock("@/presentation/admin/publish/blog-article-action", () => ({
  manageBlogArticleAction: async () => ({ status: "idle", message: "", field: null }),
}));

const { BlogArticleEditForm } = await import("@/presentation/admin/publish/blog-article-form");

type Row = { readonly id: string; readonly kind: ArticleBlockKind; readonly heading: string; readonly body: string };

const label = (kind: ArticleBlockKind) => ARTICLE_BLOCK_LABEL[kind];

/** T1 が要求する部品を、版面どおりの並びで全部そろえた記事。 */
function fullRows(): Row[] {
  return REQUIRED_BLOCKS.T1.map((kind, index) => ({
    id: `blk_${index}`,
    kind,
    heading: `${label(kind)}の見出し`,
    body: `${label(kind)}の本文`,
  }));
}

function renderForm(rows: readonly Row[], articleId = "bar_edit") {
  return render(
    <BlogArticleEditForm
      articleId={articleId}
      revision={3}
      title="椅子の選び方"
      lead="長く座る人向け。"
      template="T1"
      status="draft"
      authorName="望月"
      categorySlug="chairs"
      categoryOptions={[{ value: "chairs", label: "椅子" }]}
      blocks={rows}
      tagOptions={[{ value: "tag_chairs", label: "椅子" }]}
      selectedTagIds={["tag_chairs"]}
    />,
  );
}

/**
 * いま並んでいる部品の種類を順に読む。
 *
 * **送信される `blocks[n].kind` から読む。** `<legend>` の文字を読むと
 * タグの `<fieldset>` まで拾ってしまい、しかも「画面に見える順」と
 * 「送られる順」が食い違っても気づけない。ここで見たいのは後者である。
 */
function orderOnScreen(): string[] {
  return [...document.querySelectorAll('[name^="blocks["][name$="].kind"]')].map((node) =>
    label(node.getAttribute("value") as ArticleBlockKind),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("足りない部品を、保存を待たずに言う", () => {
  it("要求された部品が欠けていれば、名前を挙げて止める", () => {
    const rows = fullRows().filter((row) => row.kind !== "summary-section");
    renderForm(rows);

    expect(screen.getByText("公開に必要な部品が足りません")).toBeTruthy();
    expect(screen.getByText(new RegExp(`${label("summary-section")} がまだありません`))).toBeTruthy();
  });

  it("そろっていれば、何も言わない", () => {
    renderForm(fullRows());
    expect(screen.queryByText("公開に必要な部品が足りません")).toBeNull();
  });

  it("画面で部品を足せば、その場で指摘が消える", () => {
    const rows = fullRows().filter((row) => row.kind !== "summary-section");
    renderForm(rows);
    expect(screen.getByText("公開に必要な部品が足りません")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/部品を 1 つ足す/), {
      target: { value: "summary-section" },
    });

    /*
      **保存を待たない**のが要点。待つ作りにすると、運営者は
      「足す → 保存 → まだ言われる → また足す」を 1 手ずつ繰り返すことになる。
    */
    expect(screen.queryByText("公開に必要な部品が足りません")).toBeNull();
    expect(orderOnScreen()).toContain(label("summary-section"));
  });

  it("表に無い種類が選ばれても、部品を足さない", () => {
    renderForm(fullRows());
    const before = orderOnScreen().length;
    fireEvent.change(screen.getByLabelText(/部品を 1 つ足す/), { target: { value: "" } });
    expect(orderOnScreen().length).toBe(before);
  });
});

describe("並びのずれは、足りないのとは別の言葉で言う", () => {
  it("版面と違う並びなら、動かす対象と正しい並びを示す", () => {
    const rows = fullRows();
    [rows[0], rows[1]] = [rows[1]!, rows[0]!];
    renderForm(rows);

    expect(screen.getByText("部品の並びが版面と違います")).toBeTruthy();
    /*
      **公開は止めない。** 並びは読みやすさの問題で、部品の欠落とは重さが違う。
      同じ枠に混ぜると、運営者は在る部品を探しに行って空振りする。
    */
    expect(screen.queryByText("公開に必要な部品が足りません")).toBeNull();
  });

  it("版面どおりなら、何も言わない", () => {
    renderForm(fullRows());
    expect(screen.queryByText("部品の並びが版面と違います")).toBeNull();
  });
});

describe("部品を動かす", () => {
  it("1 つ上へ押すと、直前の部品と入れ替わる", () => {
    renderForm(fullRows());
    const before = orderOnScreen();

    fireEvent.click(screen.getByLabelText(`${before[1]}を 1 つ上へ`));

    const after = orderOnScreen();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
    // 動かしただけで、数は変わらない。
    expect(after.length).toBe(before.length);
  });

  it("1 つ下へ押すと、直後の部品と入れ替わる", () => {
    renderForm(fullRows());
    const before = orderOnScreen();

    fireEvent.click(screen.getByLabelText(`${before[0]}を 1 つ下へ`));

    const after = orderOnScreen();
    expect(after[0]).toBe(before[1]);
    expect(after[1]).toBe(before[0]);
  });

  it("先頭の「上へ」と末尾の「下へ」は押せない", () => {
    renderForm(fullRows());
    const order = orderOnScreen();

    /*
      **端は押せなくしておく。** 押せてしまうと、`moveRow` の範囲外判定に
      頼ることになり、判定を消しても画面は静かに何も起きないだけで、
      「押したのに動かない」ボタンが残る。
    */
    expect(screen.getByLabelText(`${order[0]}を 1 つ上へ`).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText(`${order.at(-1)}を 1 つ下へ`).hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText(`${order[0]}を 1 つ下へ`).hasAttribute("disabled")).toBe(false);
    expect(screen.getByLabelText(`${order.at(-1)}を 1 つ上へ`).hasAttribute("disabled")).toBe(false);
  });

  it("押すボタンには、どの部品のものかが名前に入っている", () => {
    renderForm(fullRows());
    /*
      同じ文言のボタンが部品の数だけ並ぶ。読み上げは順に読むだけなので、
      名前が同じだと「1 つ上へ」が 7 個並んで区別できない。
    */
    for (const kind of REQUIRED_BLOCKS.T1) {
      expect(screen.getByLabelText(`${label(kind)}を 1 つ上へ`)).toBeTruthy();
      expect(screen.getByLabelText(`${label(kind)}を 1 つ下へ`)).toBeTruthy();
    }
  });

  it("動かしても、その部品に書いた本文はついていく", () => {
    const rows = fullRows();
    renderForm(rows);
    const before = orderOnScreen();

    fireEvent.click(screen.getByLabelText(`${before[1]}を 1 つ上へ`));

    const bodies = [...document.querySelectorAll('[name^="blocks["][name$="].body"]')].map(
      (node) => (node as HTMLInputElement | HTMLTextAreaElement).value,
    );
    // 入れ替えたのは並びであって、中身の割り当てではない。
    expect(bodies[0]).toBe(`${before[1]}の本文`);
    expect(bodies[1]).toBe(`${before[0]}の本文`);
  });
});

describe("送る形", () => {
  it("部品は毎回すべて送り直す（差分ではない）", () => {
    const rows = fullRows();
    renderForm(rows);

    const kinds = [...document.querySelectorAll('[name^="blocks["][name$="].kind"]')];
    /*
      **消した部品は「送られてこない」ことでしか伝わらない。**
      差分だけを送る作りにすると、消したことがサーバへ届かない。
    */
    expect(kinds.length).toBe(rows.length);
  });

  it("まだ保存していない部品には id を送らない", () => {
    renderForm(fullRows());
    const before = document.querySelectorAll('[name^="blocks["][name$="].id"]').length;

    fireEvent.change(screen.getByLabelText(/部品を 1 つ足す/), {
      target: { value: "product-card" },
    });

    // 採番はサーバの仕事。空の id を送ると「その id の部品」を探しに行ってしまう。
    expect(document.querySelectorAll('[name^="blocks["][name$="].id"]').length).toBe(before);
    expect(document.querySelectorAll('[name^="blocks["][name$="].kind"]').length).toBe(before + 1);
  });

  it("直す相手と、こちらが見ている版を添える", () => {
    renderForm(fullRows(), "bar_target");
    const value = (name: string) =>
      document.querySelector(`[name="${name}"]`)?.getAttribute("value");

    expect(value("intent")).toBe("update");
    expect(value("articleId")).toBe("bar_target");
    /*
      **見ていた版を送る。** これが無いと、2 人が同時に直したとき
      後から保存した側が黙って上書きする。
    */
    expect(value("expectedRevision")).toBe("3");
  });
});
