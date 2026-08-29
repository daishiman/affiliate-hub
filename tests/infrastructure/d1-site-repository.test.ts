/** @tier 1 */
import { describe, expect, it } from "vitest";
import { createD1SiteRepository } from "@/infrastructure/persistence/d1/site-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";

/**
 * 読者向けブログの一覧（D1）が、保存先の不調をどう返すか。
 *
 * **これは実際に起きた壊れ方である。** 2026-08-21、本番の入口が 500 になった。
 * 原因はマイグレーションの当て忘れで `site_blueprints` が無く、drizzle の投げた
 * 例外が画面まで抜けたこと。`page.tsx` は `result.ok === false` を受ければ
 * 「ブログの一覧を取れませんでした」と出す作りだったのに、この経路だけ
 * そこへ落ちなかった。
 *
 * 素の 500 は利用者に何も伝えず、手がかりは実行ログにしか残らない。
 * 他の D1 の保存先はすべて `storageFailure` で受けており、ここだけが抜けていた。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 * @req REQ-B01
 */

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: site_blueprints");
  };
  return { select: boom, insert: boom, run: boom } as unknown as DrizzleD1;
}

describe("ブログの一覧（D1）が落ちたとき", () => {
  it("一覧は、投げずに断りとして返す", async () => {
    const result = await createD1SiteRepository(brokenDb()).list();

    // 投げると画面が 500 になり、押した人には何が起きたか分からない。
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    // 時間をおいて開き直せば直ることがある種類の不調である、と伝わること。
    expect(result.error.retryable).toBe(true);
  });

  it("1 本を引くときも、投げずに断りとして返す", async () => {
    const result = await createD1SiteRepository(brokenDb()).findBySlug("kurashi-no-hinto");

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("落ちているのに通っています");
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("例外の中身を、画面へ出す言葉に混ぜない", async () => {
    const result = await createD1SiteRepository(brokenDb()).list();
    if (result.ok) throw new Error("落ちているのに通っています");

    /**
     * `no such table: site_blueprints` は利用者の役に立たないうえ、
     * 内部の作りを外へ出すことになる（§26.3）。残すのは種類の名前だけ。
     */
    expect(result.error.message).not.toContain("site_blueprints");
    expect(result.error.suggestedAction ?? "").not.toContain("site_blueprints");
    expect(result.error.details).toEqual({ reason: "Error" });
  });
});
