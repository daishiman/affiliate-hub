/** @tier 2 */
import { describe, expect, it, vi } from "vitest";
import { buildArticleItemList, buildWebSite } from "@/application/seo/structured-data";
import { SITE } from "../ui/route-cases";
import { renderCase } from "../ui/route-table";
import { intoDom } from "../support/render";

/*
  届いたリクエストの Host。**画面を描くだけでは決まらない値**なので、ここでは固定する。
  固定しないと `origin === null` になり、画面は JSON-LD をまるごと出さない枝へ入る
  ——「宣言が正しいか」を見るはずの検査が「宣言が無い」で赤になり、
  何を見ているのか分からなくなる。

  Host から origin を作る処理そのものは `tests/presentation/site-metadata.test.ts`
  が別に見ている。ここが見るのは、origin が決まったときに何を宣言するかである。
*/
const ORIGIN = "https://example.test";
vi.mock("@/presentation/http/request-origin", () => ({
  requestOriginFromNextHeaders: async () => ORIGIN,
}));

/**
 * トップ画面が機械へ渡す宣言（JSON-LD）を見る。
 *
 * ==========================================================================
 * 画面から取り出して読む
 * ==========================================================================
 *
 * 組み立て関数だけを呼んで形を確かめると、**その関数が画面から呼ばれていなくても緑**
 * になる。ここは描いた HTML の `<script type="application/ld+json">` を実際に読み、
 * JSON として解けることまで見る。解けない宣言は、無いのと同じ扱いを受ける。
 *
 * ==========================================================================
 * 宣言と実物が食い違わないこと
 * ==========================================================================
 *
 * `SearchAction` は「このサイトには検索がある」と機械へ言う宣言である。
 * 言うだけなら通るので、**宣言した住所が画面の検索フォームと同じ形か**を
 * 突き合わせる。検索フォームは `name="q"` の GET なので、
 * 宣言側の `urlTemplate` も `?q=` でなければ、そのとおり叩いた機械が空振りする。
 *
 * `ItemList` も同じで、**画面に出ている順そのまま**でなければ、
 * 読者が見る一覧と機械が読む一覧が別物になる。順位は 1 から始める。
 */

const HOME = { file: "s/[site]/page.tsx", params: { site: SITE } } as const;

type JsonLd = Record<string, unknown>;

async function jsonLdOfHome(searchParams: Record<string, string> = {}) {
  const { document, cleanup } = intoDom(await renderCase({ ...HOME, searchParams }));
  const raw = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
    (s) => s.textContent ?? "",
  );
  /*
    宣言と突き合わせる相手は、**おすすめ→記事の区画に出ている題だけ**。
    画面全体から拾うと、カテゴリー区画に再掲された同じ記事まで混ざり、
    「並びが食い違う」の検査が並び以外の理由で赤くなる。
  */
  // id は区画そのものではなく**見出しに付いた印**（`aria-labelledby` の相手）。
  // 記事の題を数えるには、各見出しから区画へ登り、読者の順につなぐ。
  const titles = ["#featured-articles", "#home-articles"].flatMap((selector) => {
    const section = document.querySelector(selector)?.closest("section") ?? null;
    return [...(section?.querySelectorAll("li h3 a") ?? [])].map((a) =>
      (a.textContent ?? "").trim(),
    );
  });
  cleanup();
  return { raw, blocks: raw.map((text) => JSON.parse(text) as JsonLd), titles };
}

/** ある `@type` の宣言を 1 つ取り出す。無ければ undefined。 */
function typed(blocks: readonly JsonLd[], type: string): JsonLd | undefined {
  return blocks.find((b) => b["@type"] === type);
}

describe("トップ画面の構造化データ", () => {
  it("宣言はすべて JSON として解け、schema.org の文脈を持つ", async () => {
    const { raw, blocks } = await jsonLdOfHome();

    expect(raw.length, "JSON-LD が 1 つも出ていません").toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block["@context"], "schema.org の文脈がありません").toBe("https://schema.org");
    }
    // `<` を残すと、記事本文から script を閉じられる（XSS）。
    expect(
      raw.filter((text) => text.includes("<")),
      "JSON-LD に生の `<` が残っています",
    ).toEqual([]);
  });

  it("WebSite は 1 つだけ出す", async () => {
    const { blocks } = await jsonLdOfHome();
    const websites = blocks.filter((b) => b["@type"] === "WebSite");

    // 2 つ以上あると、どれが正本か機械から見て決まらない。
    expect(websites.length, "WebSite の宣言が 1 つではありません").toBe(1);
    expect(websites[0].name, "ブログ名が宣言に入っていません").toBeTruthy();
    expect(String(websites[0].url), "住所が絶対 URL ではありません").toMatch(/^https?:\/\//);
  });

  it("宣言した検索の住所が、画面の検索フォームと同じ形をしている", async () => {
    const { blocks } = await jsonLdOfHome();
    const website = typed(blocks, "WebSite");
    const action = website?.potentialAction as JsonLd | undefined;
    const target = action?.target as JsonLd | undefined;
    const template = String(target?.urlTemplate ?? "");

    expect(action?.["@type"], "検索の宣言がありません").toBe("SearchAction");
    // 画面の検索フォームは `/search` へ `name="q"` を GET で送る。宣言も同じ形にする。
    expect(template, "宣言した検索の住所が画面と違います").toContain("/search?q=");
    expect(template, "検索語の入る場所が指定されていません").toContain("{search_term_string}");
    // `query-input` の書式は schema.org 側が決めている。崩すと解釈されない。
    expect(action?.["query-input"]).toBe("required name=search_term_string");
  });

  it("ItemList が、画面に出ている記事と同じ順で 1 から並ぶ", async () => {
    const { blocks, titles } = await jsonLdOfHome();
    const list = typed(blocks, "ItemList");
    const items = (list?.itemListElement ?? []) as readonly JsonLd[];

    expect(list, "記事一覧の宣言がありません").toBeDefined();
    expect(items.length, "宣言の中身が空です").toBeGreaterThan(0);
    expect(
      items.map((i) => i.position),
      "順位が 1 から連番になっていません",
    ).toEqual(items.map((_, index) => index + 1));
    // 画面の見出しと宣言の名前が、同じ順で一致すること。
    expect(
      items.map((i) => i.name),
      "画面の並びと宣言の並びが食い違っています",
    ).toEqual(titles.slice(0, items.length));
    for (const item of items) {
      expect(String(item.url), "記事の住所が絶対 URL ではありません").toMatch(/^https?:\/\//);
    }
  });

  it("並べ替えても、宣言はそのときの並びに追従する", async () => {
    const latest = await jsonLdOfHome();
    const popular = await jsonLdOfHome({ sort: "popular" });

    const namesOf = (blocks: readonly JsonLd[]) =>
      ((typed(blocks, "ItemList")?.itemListElement ?? []) as readonly JsonLd[]).map((i) => i.name);

    // 「読者が見ている一覧」と「機械が読む一覧」を 1 つに保つ。
    expect(namesOf(popular.blocks)).toEqual(popular.titles.slice(0, namesOf(popular.blocks).length));
    expect(namesOf(latest.blocks).length).toBeGreaterThan(0);
  });

  it("記事が 1 本も無いときは、空の一覧を宣言しない", () => {
    // 空の `ItemList` は「中身が無い」ではなく「中身が無いことを宣言した」になる。
    expect(buildArticleItemList([])).toBeNull();
    expect(
      buildArticleItemList([{ title: "a", url: "https://example.test/a" }]),
    ).not.toBeNull();
  });

  it("組み立て関数は、渡された住所をそのまま土台にする", () => {
    const website = buildWebSite({
      siteName: "テスト",
      origin: "https://example.test",
      basePath: "/s/x",
    });
    expect(website.url).toBe("https://example.test/s/x");
    const target = (website.potentialAction as JsonLd).target as JsonLd;
    expect(target.urlTemplate).toBe("https://example.test/s/x/search?q={search_term_string}");
  });
});
