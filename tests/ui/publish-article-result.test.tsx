/** @tier 2 @req REQ-P08 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublishArticleResult } from "@/presentation/admin/publish-article-result";
import type { PublishArticleFormState } from "@/presentation/admin/publish-article-state";

/**
 * 「いまサイトに出す」を押したあとの知らせ。
 *
 * --- ここを別に見ている理由 ---
 * 欄と一緒にしておくと、結果の出し分けを試すのに押す操作ごと組み立てることになり、
 * **試されないまま残る枝**（確かめられなかった項目・読者ページへの導線）ができる。
 * そこが出ないと、利用者は「出した」という文字だけを見て確かめずに終わる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */

function render(state: PublishArticleFormState): string {
  return renderToStaticMarkup(<PublishArticleResult state={state} />);
}

describe("記事を出したあとの知らせ", () => {
  it("欄が分からない断りは、まとめてここに出す", () => {
    const html = render({
      status: "failed",
      message: "この配信は公開済みです。記事の画面から新しい配信を作ってください。",
    });
    expect(html).toContain("新しい配信");
  });

  it("欄が分かる断りは、ここには出さない（欄の下に出す）", () => {
    // 同じ文が 2 か所に出ると、直す場所が分からなくなる。
    const html = render({ status: "failed", message: "タイトルを入れてください。", field: "title" });
    expect(html).not.toContain("タイトルを入れてください");
  });

  it("出せたときは、読者の画面への導線を必ず添える", () => {
    // 「公開しました」だけでは、本当に出たかを確かめる手段が無い。
    const html = render({
      status: "done",
      message: "記事を公開しました。",
      url: "/s/quiet-desk/guides/quiet-laptop",
    });
    expect(html).toContain("/s/quiet-desk/guides/quiet-laptop");
    expect(html).toContain("読者の画面");
  });

  it("確かめられなかった項目は、成功の知らせに混ぜて消さない", () => {
    const html = render({
      status: "done",
      message: "記事を公開しました。",
      url: "/s/quiet-desk/guides/quiet-laptop",
      skipped: [{ label: "事実確認", reason: "確認する仕組みがまだつながっていません" }],
    });
    expect(html).toContain("確かめられなかった項目");
    expect(html).toContain("事実確認");
    // 成功の知らせも消えない。両方出るのが正しい。
    expect(html).toContain("記事を公開しました");
  });

  it("通知結果の記録だけ失敗しても、公開成功と記録失敗を両方表示する", () => {
    const html = render({
      status: "done",
      phase: "published",
      message: "記事を公開しました。",
      url: "/s/quiet-desk/guides/quiet-laptop",
      indexNow: {
        status: "sent",
        auditStatus: "failed",
        detail: "1 件を通知しました。ただし、通知結果の記録を保存できませんでした。",
      },
    });

    expect(html).toContain("記事を公開しました");
    expect(html).toContain("検索エンジンへの更新通知");
    expect(html).toContain("記録を保存できませんでした");
  });

  it("AI 検索への備えが全て揃っていれば、点数と一言だけを出す", () => {
    const html = render({
      status: "done",
      message: "記事を公開しました。",
      url: "/s/quiet-desk/guides/quiet-laptop",
      aiSearch: [
        { check: "冒頭に結論がある", ok: true, hint: "" },
        { check: "更新日がある", ok: true, hint: "" },
      ],
    });
    expect(html).toContain("AI 検索への備え: 2/2");
    expect(html).toContain("構造が揃っています");
  });

  it("AI 検索への備えが欠けている項目は、直し方（hint)まで出す", () => {
    // 項目名だけ出すと、直し方を人に調べさせることになる。
    const html = render({
      status: "done",
      message: "記事を公開しました。",
      url: "/s/quiet-desk/guides/quiet-laptop",
      aiSearch: [
        { check: "冒頭に結論がある", ok: true, hint: "" },
        {
          check: "出典がある",
          ok: false,
          hint: "言い切り（claims）に evidence を付ける。",
        },
      ],
    });
    expect(html).toContain("AI 検索への備え: 1/2");
    expect(html).toContain("出典がある");
    expect(html).toContain("evidence を付ける");
    // 成功の知らせも消えない。公開できた事実と、もう一歩の余地は別の話。
    expect(html).toContain("記事を公開しました");
  });

  it("点検が返っていない（読み直せなかった）ときは、点検の枠ごと出さない", () => {
    // 推測の点検を出すより、無いことがそのまま伝わる方がよい。
    const html = render({
      status: "done",
      message: "記事を公開しました。",
      url: "/s/quiet-desk/guides/quiet-laptop",
    });
    expect(html).not.toContain("AI 検索への備え");
  });

  it("押す前は何も出さない", () => {
    // 開いた直後に空の枠が出ると、失敗したように見える。
    expect(render({ status: "idle", message: "" })).toBe("");
  });
});
