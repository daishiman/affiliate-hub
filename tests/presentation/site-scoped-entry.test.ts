/**
 * @tier 2
 * @req REQ-S09
 * @types screen-states, boundary
 *
 * 旧 URL の殻と、site 配下の関門。**副作用のある側だけ**をここで見る。
 *
 * 規則そのもの（どのブログへ送るか・どの住所を site 配下へ写すか）は純粋関数に
 * 出してあり、`tests/presentation/site-scoped-redirect.test.ts` が総当たりで見ている。
 * ここで重ねて見ない。ここでしか見られないのは、**外の世界が期待どおりに
 * 返らなかったとき**にどう振る舞うか——ブログ一覧が引けない、cookie が無い、
 * `?site=` が文字列で来ない、ブログが引けない——の 4 つである。
 *
 * どれも「起きたら例外にする」のが一番書きやすく、一番まずい。利用者は
 * 「読者像を見たい」と言っただけで、エラー画面を見せられても次の操作が決まらない。
 * だから決められないときはブログ選択へ出す (A3)。その約束をここで固定する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Site = { readonly slug: string };

let sitesResult: { ok: boolean; value?: { items: readonly Site[] } } = {
  ok: true,
  value: { items: [] },
};
let cookieValue: string | undefined;
let siteResult: { ok: boolean; value?: unknown } = { ok: false };

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "ah_last_site" && cookieValue !== undefined ? { value: cookieValue } : undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    // 本物は描画を止める特別な例外を投げる。ここでは投げたことだけが分かればよい。
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    currentActor: async () => ({ id: "usr_test", roles: ["owner"], workspaceId: "ws_test" }),
    platformUseCases: async () => ({
      listSites: { execute: async () => sitesResult },
      getSite: { execute: async () => siteResult },
    }),
  };
});

const { legacyAdminRedirect, LAST_SITE_COOKIE } = await import(
  "@/presentation/admin/legacy-admin-redirect"
);
const { resolveSiteOrNotFound } = await import("@/presentation/admin/resolve-site");

beforeEach(() => {
  sitesResult = { ok: true, value: { items: [] } };
  cookieValue = undefined;
  siteResult = { ok: false };
});

describe("legacyAdminRedirect: 外の世界が返らなかったとき", () => {
  it("cookie の名前が、実装と検査で同じものを指している", () => {
    // 名前を実装から取る。書き写すと、実装が名前を変えた日にこの検査だけが古びる。
    expect(LAST_SITE_COOKIE).toBe("ah_last_site");
  });

  it("ブログ一覧が引けなくても例外にせず、ブログ選択へ送る (A3)", async () => {
    sitesResult = { ok: false };
    cookieValue = "home-office-desk";
    /*
      cookie に slug があっても、一覧が引けない以上「実在する」と言えない。
      実在を確かめずに送ると、消したブログの住所へ利用者を落とせる。
    */
    await expect(legacyAdminRedirect("/admin/personas")).resolves.toBe("/admin/sites");
  });

  it("cookie が無くてもブログが 1 本なら、そのブログへ送る", async () => {
    sitesResult = { ok: true, value: { items: [{ slug: "first-camera" }] } };
    await expect(legacyAdminRedirect("/admin/personas")).resolves.toBe(
      "/admin/sites/first-camera/authors",
    );
  });

  it("`?site=` が文字列で来なければ、無かったものとして cookie を使う", async () => {
    /*
      URL は同じ鍵を 2 回書ける (`?site=a&site=b`)。Next.js はそれを配列で渡す。
      配列をそのまま slug として扱うと、`site=a,b` のような住所を組み立ててしまう。
    */
    sitesResult = { ok: true, value: { items: [{ slug: "a" }, { slug: "b" }] } };
    cookieValue = "b";
    await expect(legacyAdminRedirect("/admin/personas", { site: ["a", "b"] })).resolves.toBe(
      "/admin/sites/b/authors",
    );
  });

  it("対応表に無い旧住所は、勝手な行き先を作らずブログ選択へ送る", async () => {
    sitesResult = { ok: true, value: { items: [{ slug: "first-camera" }] } };
    await expect(legacyAdminRedirect("/admin/unknown-legacy")).resolves.toBe("/admin/sites");
  });
});

describe("resolveSiteOrNotFound: 中身を読む前の関門", () => {
  it("引けたブログの名前と型を、そのまま渡す", async () => {
    siteResult = {
      ok: true,
      value: { summary: { name: "はじめてのカメラ", pattern: "comparison" } },
    };
    await expect(resolveSiteOrNotFound("first-camera")).resolves.toStrictEqual({
      siteSlug: "first-camera",
      siteName: "はじめてのカメラ",
      pattern: "comparison",
    });
  });

  it("引けなければ notFound() を投げ、理由を言い分けない", async () => {
    /*
      `getSite` は「無い」と「他のワークスペースのもの」を同じ `NOT_FOUND` で返す。
      ここで理由を足すと、他人のブログが在ることが漏れる。
    */
    siteResult = { ok: false };
    await expect(resolveSiteOrNotFound("someone-elses-blog")).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
