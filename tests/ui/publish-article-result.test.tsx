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

  it("押す前は何も出さない", () => {
    // 開いた直後に空の枠が出ると、失敗したように見える。
    expect(render({ status: "idle", message: "" })).toBe("");
  });
});
