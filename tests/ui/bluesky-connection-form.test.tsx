/** @tier 2 @req REQ-P08 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BlueskyConnectionForm } from "@/presentation/admin/publish/bluesky-connection-form";

function render(): string {
  return renderToStaticMarkup(<BlueskyConnectionForm />);
}

describe("Bluesky接続の管理画面", () => {
  it("秘密値を入力・表示する欄を持たず、Cloudflareへ登録済みの値を使うと伝える", () => {
    const html = render();

    expect(html).toContain("Cloudflareに登録した認証情報を使います");
    expect(html).toContain("この画面では入力も表示もしません");
    expect(html).not.toMatch(/<(?:input|textarea|select)\b/);
    expect(html).not.toContain("channel/conn_bluesky/credentials");
  });

  it("AI向けの道具として公開せず、人が押す接続確認だけを置く", () => {
    const html = render();

    expect(html).toContain("Blueskyとの接続を確認する");
    expect(html).not.toContain("toolname=");
  });
});
