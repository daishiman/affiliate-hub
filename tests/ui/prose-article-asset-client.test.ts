/**
 * @tier 2
 * @req REQ-BOPS05
 * @types boundary, screen-states
 */
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  searchArticleProducts,
  uploadArticleImage,
} from "@/presentation/admin/publish/article-asset-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("記事の商品検索 client", () => {
  it("id と name だけを検証済みの選択肢として返す", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [{ id: "pc_1", name: "商品 1", commercial: "画面へ渡さない値" }],
        }),
      ),
    );

    await expect(searchArticleProducts("商品 1")).resolves.toStrictEqual([
      { id: "pc_1", name: "商品 1" },
    ]);
  });

  it("0 件は正常な検索結果として空配列を返す", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [] })));

    await expect(searchArticleProducts("該当なし")).resolves.toStrictEqual([]);
  });

  it("応答の形が違うときは 0 件に見せず失敗する", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ items: [{ id: 1, name: "商品" }] })));

    await expect(searchArticleProducts("商品")).rejects.toThrow("商品を探せませんでした。");
  });

  it("通信そのものが失敗しても、ブラウザの例外文言を画面へ漏らさない", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("network detail"))));

    await expect(searchArticleProducts("商品")).rejects.toThrow("商品を探せませんでした。");
  });
});

describe("記事画像 upload client", () => {
  it("サーバが返した安全な失敗理由を失わない", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "画像は 8 MiB 以下にしてください。" },
          { status: 400 },
        ),
      ),
    );

    await expect(
      uploadArticleImage("article_1", new File(["x"], "large.png", { type: "image/png" })),
    ).rejects.toThrow("画像は 8 MiB 以下にしてください。");
  });

  it("成功応答の形が違うときは一般文で失敗する", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ url: 42 })));

    await expect(
      uploadArticleImage("article_1", new File(["x"], "image.png", { type: "image/png" })),
    ).rejects.toThrow("画像を送れませんでした。");
  });
});
