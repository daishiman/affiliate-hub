/**
 * @tier 2
 * @req REQ-SEO06
 * @types equivalence, boundary, fault-injection
 *
 * 系統①（自分のサイトの HTML を読む）を、**本物の workerd の中で**確かめる。
 *
 * --- なぜ結合テストなのか ---
 * この読み取りは `HTMLRewriter` に全面的に乗っている。Node の側で
 * 似たものを用意して確かめると、確かめられるのは似たもののほうで、
 * 本番で動く読み取りではない。属性の順・改行・コメントの中の似た文字列で
 * 静かに間違えるのを避けるために `HTMLRewriter` を選んだのだから、
 * ここだけは本物を通す。
 *
 * 実装は `tests/support/static-audit-worker.ts` が本物をそのまま呼ぶ。
 * 束ね方（`@/` の解決や `server-only`）が壊れれば、この検査が落ちる。
 *
 * --- ここで見ないこと ---
 * 「title が短い」などの規則は `tests/domain/aeo-measurement.test.ts`。
 * ここは「HTML に何が書いてあったか」だけを見る。
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { PageObservation } from "@/domain/seo/aeo-measurement";
import type { DomainError } from "@/domain/shared";
import { createStaticAuditCollector } from "@/infrastructure/seo/aeo-measurement/static-audit-collector";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const URL_UNDER_TEST = "https://example.com/s/creator-tools/guides/quiet-laptop";

type ObserveOutcome =
  | { readonly ok: true; readonly value: PageObservation }
  | { readonly ok: false; readonly error: DomainError };
type LlmsOutcome =
  | { readonly ok: true; readonly value: "present" | "empty" | "missing" }
  | { readonly ok: false; readonly error: DomainError };

let mf: Miniflare;

beforeAll(async () => {
  const bundle = await build({
    entryPoints: [resolve(REPO_ROOT, "tests/support/static-audit-worker.ts")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    // workerd 向けの分岐を選ぶ。Node 向けの実装を引き込むと、
    // 本番と違うものを確かめることになる。
    conditions: ["workerd", "worker", "browser", "import"],
    mainFields: ["module", "main"],
    target: "es2022",
    alias: {
      "@": resolve(REPO_ROOT, "src"),
      "server-only": resolve(REPO_ROOT, "tests/support/server-only-stub.ts"),
    },
  });

  mf = new Miniflare({
    workers: [
      {
        config: {
          name: "static-audit",
          type: "worker",
          // 本番と同じ日付と旗で立てる。ここをずらすと、通ったのに
          // 本番で落ちる（あるいはその逆の）検査になる。
          compatibilityDate: "2026-08-16",
          compatibilityFlags: ["nodejs_compat"],
          manifest: {
            mainModule: "worker.js",
            modules: {
              "worker.js": { type: "esm", contents: bundle.outputFiles[0]?.text ?? "" },
            },
          },
        },
      },
    ],
  });
  await mf.ready;
}, 60_000);

afterAll(async () => {
  await mf?.dispose();
});

async function observe(spec: {
  url?: string;
  html?: string;
  status?: number;
  throwName?: string;
}): Promise<ObserveOutcome> {
  const response = await mf.dispatchFetch("http://static-audit.test/", {
    method: "POST",
    body: JSON.stringify({ url: spec.url ?? URL_UNDER_TEST, ...spec }),
  });
  return (await response.json()) as ObserveOutcome;
}

async function observeLlms(spec: { html?: string; status?: number; throwName?: string }): Promise<LlmsOutcome> {
  const response = await mf.dispatchFetch("http://static-audit.test/", {
    method: "POST",
    body: JSON.stringify({ url: "https://example.com/s/creator-tools/llms.txt", kind: "llms", ...spec }),
  });
  return (await response.json()) as LlmsOutcome;
}

/**
 * 「全部そろっている良い例」。ここから 1 か所ずつ崩す。
 *
 * わざと属性の順を変え、改行を挟み、コメントに紛らわしい文字列を入れてある。
 * 正規表現で拾う作りなら、この形で静かに間違える。
 */
const A_GOOD_PAGE = `<!doctype html>
<html lang="ja">
<head>
  <!-- <title>これはコメントの中の title</title> -->
  <title>静かなノートパソコンの選び方</title>
  <meta charset="utf-8">
  <meta
    content="作業時間と騒音のバランスで選びます。"
    name="description">
  <meta property="og:title" content="静かなノートパソコンの選び方">
  <meta property="og:description" content="作業時間と騒音のバランスで選びます。">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://example.com/s/creator-tools/guides/quiet-laptop">
  <meta property="og:image" content="https://example.com/og/quiet-laptop.png">
  <link href="https://example.com/s/creator-tools/guides/quiet-laptop" rel="canonical">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","headline":"静かなノートパソコン"}
  </script>
</head>
<body>
  <h1>静かなノートパソコンの選び方</h1>
  <h2>測り方</h2>
  <h3>騒音計の当て方</h3>
  <p><a href="/s/creator-tools/guides/keyboards">キーボードの記事</a></p>
  <p><a href="https://example.com/s/creator-tools/">一覧へ</a></p>
  <p><a href="https://another.example.net/review">よそのサイト</a></p>
  <p><a href="#measure">この中の見出しへ</a></p>
  <p><a href="mailto:hello@example.com">連絡</a></p>
  <time datetime="2026-09-01">2026年9月1日</time>
  <img src="/img/laptop.png" alt="ノートパソコン" width="800" height="450">
</body>
</html>`;

describe("静的解析の読み取り（本物の workerd）", () => {
  describe("そろっているページ", () => {
    it("head と body から観測した事実をそのまま返す", async () => {
      const result = await observe({ html: A_GOOD_PAGE });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const page = result.value;

      // コメントの中の title を拾わない。
      expect(page.title).toBe("静かなノートパソコンの選び方");
      expect(page.metaDescription).toBe("作業時間と騒音のバランスで選びます。");
      expect(page.ogImage).toBe("https://example.com/og/quiet-laptop.png");
      expect(page.canonical).toBe(URL_UNDER_TEST);
      expect(page.jsonLdTypes).toEqual(["Article"]);
      expect(page.openGraph).toEqual({
        title: "静かなノートパソコンの選び方",
        description: "作業時間と騒音のバランスで選びます。",
        type: "article",
        url: URL_UNDER_TEST,
        image: "https://example.com/og/quiet-laptop.png",
      });
      expect(page.jsonLdNodes).toEqual([{
        types: ["Article"], properties: ["headline"], datePublished: null, dateModified: null,
      }]);
      expect(page.visibleDateTimes).toEqual(["2026-09-01"]);
      // 段は現れた順に並ぶ。順が崩れると「段の飛び」を見られない。
      expect(page.headingLevels).toEqual([1, 2, 3]);
      expect(page.url).toBe(URL_UNDER_TEST);
    });

    it("同じブログの中を指すリンクだけを数える", async () => {
      const result = await observe({ html: A_GOOD_PAGE });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      /*
        `#measure` と `mailto:` を数えると、目次だけがあって
        他の記事へ 1 本も繋がっていないページが「行き先あり」になる。
        よそのサイトへのリンクも中の行き来ではない。
      */
      expect(result.value.internalLinkCount).toBe(2);
      expect(result.value.internalLinkPageKeys).toEqual([
        "example.com/s/creator-tools/guides/keyboards",
        "example.com/s/creator-tools",
      ]);
    });

    it("同じhostでも別site、自己、fragment、viewer依存URLは行き先に含めない", async () => {
      const result = await observe({ html: `<a href="/s/other/guides/a">別site</a>
        <a href="${URL_UNDER_TEST}">自己</a><a href="#part">fragment</a>
        <a href="/s/creator-tools/search?q=a">検索</a>
        <a href="/s/creator-tools/shortlist">候補</a>
        <a href="../guides/inside?utm_source=x#part">同site</a>` });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.internalLinkPageKeys).toEqual([
        "example.com/s/creator-tools/guides/inside",
      ]);
    });

    it("画像は説明文と寸法の有無だけを見る", async () => {
      const result = await observe({ html: A_GOOD_PAGE });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.images).toEqual([
        { src: "/img/laptop.png", hasAlt: true, hasDimensions: true },
      ]);
    });
  });

  describe("1 か所ずつ崩す", () => {
    it("title が無ければ null（空文字にしない）", async () => {
      const result = await observe({ html: "<html><head></head><body></body></html>" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 空文字にすると「空の title が付いている」と読めてしまう。
      // 無いことと空であることは別の直し方になる。
      expect(result.value.title).toBeNull();
      expect(result.value.metaDescription).toBeNull();
      expect(result.value.canonical).toBeNull();
      expect(result.value.ogImage).toBeNull();
    });

    it("title の前後の空白は落とす", async () => {
      const result = await observe({
        html: "<title>\n  静かなノートパソコン  \n</title>",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.title).toBe("静かなノートパソコン");
    });

    it("title が 2 つあれば最初のものを採る", async () => {
      const result = await observe({
        html: "<title>ひとつめ</title><title>ふたつめ</title>",
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // ブラウザも 2 つ目を無視する。実際に表示されるほうを事実にする。
      expect(result.value.title).toBe("ひとつめ");
    });

    it("長い title が途中で切れない", async () => {
      const long = "静".repeat(400);
      const result = await observe({ html: `<title>${long}</title>` });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      /*
        HTMLRewriter は中身を細切れで渡してくる。継ぎ足さずに読むと
        長い title が途中で切れ、`title_too_long` が出なくなる。
      */
      expect(result.value.title).toBe(long);
    });

    it("空文字の alt は「有る」として数える", async () => {
      const result = await observe({ html: `<img src="/deco.svg" alt="">` });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      /*
        `alt=""` は「説明の要らない飾りの絵」を表す正しい書き方である。
        欠落として扱うと、正しく書いた飾り画像が毎回所見に出て、
        直しようが無い指摘が積み上がる。
      */
      expect(result.value.images).toEqual([
        { src: "/deco.svg", hasAlt: true, hasDimensions: false },
      ]);
    });

    it("寸法は縦横の両方がそろって初めて「有る」", async () => {
      const result = await observe({
        html: `<img src="/a.png" width="800"><img src="/b.png" height="450"><img src="/c.png" width="8" height="4">`,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.images.map((image) => image.hasDimensions)).toEqual([false, false, true]);
    });

    it("src の無い画像も数える（空文字として）", async () => {
      const result = await observe({ html: `<img alt="説明だけある">` });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.images).toEqual([{ src: "", hasAlt: true, hasDimensions: false }]);
    });

    it("rel が canonical 以外の link は拾わない", async () => {
      const result = await observe({
        html: `<link rel="stylesheet" href="/a.css"><link rel="CANONICAL" href="https://example.com/x">`,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 大文字で書かれていても canonical である。
      expect(result.value.canonical).toBe("https://example.com/x");
    });

    it("content の無い meta は無視する", async () => {
      const result = await observe({ html: `<meta name="description">` });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.metaDescription).toBeNull();
    });
  });

  describe("構造化データ", () => {
    it("@graph の中に並べた書き方も配列で並べた書き方も読む", async () => {
      const result = await observe({
        html: `<script type="application/ld+json">
          {"@graph":[{"@type":"BreadcrumbList"},{"@type":["Article","BlogPosting"]}]}
        </script>`,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.jsonLdTypes).toEqual(
        expect.arrayContaining(["BreadcrumbList", "Article", "BlogPosting"]),
      );
    });

    it("読めない塊は黙って捨て、読めた塊は残す", async () => {
      const result = await observe({
        html: `<script type="application/ld+json">{ 壊れている </script>
               <script type="application/ld+json">{"@type":"FAQPage"}</script>`,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      /*
        ここで失敗させると、広告の埋め込みが壊れた JSON を出した日に
        ページ全体の観測が落ちる。読めた分だけを事実として残す。
      */
      expect(result.value.jsonLdTypes).toEqual(["FAQPage"]);
    });

    it("type の付いていない script は読まない", async () => {
      const result = await observe({
        html: `<script>{"@type":"Article"}</script>`,
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.jsonLdTypes).toEqual([]);
    });
  });

  describe("読みに行けなかったとき", () => {
    it("byte上限超過を空の成功にせず明示的失敗にする", async () => {
      const result = await observe({ html: "a".repeat(1_000_001) });
      expect(result).toMatchObject({ ok: false, error: {
        retryable: false, details: { reason: "response_too_large" },
      } });
    });

    it("一意な同site link先が500件を超えたら明示的失敗にする", async () => {
      const links = Array.from({ length: 501 }, (_, index) =>
        `<a href="/s/creator-tools/guides/${index}">x</a>`).join("");
      const result = await observe({ html: links });
      expect(result).toMatchObject({ ok: false, error: {
        retryable: false, details: { reason: "link_limit_exceeded" },
      } });
    });

    it("鍵を作れない URL は対象外として断る", async () => {
      const result = await observe({ url: "https://example.com/search?q=laptop" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.retryable).toBe(false);
    });

    it("404 は「所見 0 件」ではなく失敗として返す", async () => {
      const result = await observe({ status: 404, html: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      /*
        0 件で返すと、消えたページが「問題の無いページ」として
        一覧から静かに落ちる。消えたことこそ知りたい。
      */
      expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
      // 404 は待っても直らない。直すのは人である。
      expect(result.error.retryable).toBe(false);
      expect(result.error.details).toMatchObject({ status: "404" });
    });

    it("500 はあとで試す失敗として返す", async () => {
      const result = await observe({ status: 503, html: "" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.retryable).toBe(true);
    });

    it("網に出られなければ、例外の名前だけを残して失敗にする", async () => {
      const result = await observe({ throwName: "TimeoutError" });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
      // 例外の文面には URL や内部の道が載ることがある。名前だけを残す。
      expect(result.error.details).toMatchObject({ reason: "TimeoutError" });
    });

    it("中身が空でも、読めたなら成功として返す", async () => {
      const result = await observe({ html: "" });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // 空のページは「読めなかった」ではなく「何も無いページ」である。
      // 規則の側（`auditPageObservation`）が所見にする。
      expect(result.value.title).toBeNull();
      expect(result.value.headingLevels).toEqual([]);
      expect(result.value.images).toEqual([]);
    });
  });

  describe("llms.txt", () => {
    it.each([
      [200, "# Blog\n案内", "present"],
      [200, "  \n", "empty"],
      [404, "", "missing"],
    ] as const)("HTTP %dを本文を保持せず%sとして観測する", async (status, html, expected) => {
      expect(await observeLlms({ status, html })).toEqual({ ok: true, value: expected });
    });

    it("500と通信失敗を404へ倒さない", async () => {
      expect(await observeLlms({ status: 500 })).toMatchObject({ ok: false, error: { retryable: true } });
      expect(await observeLlms({ throwName: "TimeoutError" })).toMatchObject({
        ok: false,
        error: { details: { reason: "TimeoutError" } },
      });
    });
  });
});

describe("取得後URLの所属境界", () => {
  function redirectedResponse(finalUrl: string): Response {
    return {
      ok: true,
      status: 200,
      url: finalUrl,
      redirected: true,
    } as Response;
  }

  it.each([
    ["HTML", false],
    ["llms.txt", true],
  ] as const)("%sは同じhostの別siteへ移動した応答を成功にしない", async (_label, llms) => {
    const requested = llms
      ? "https://example.com/s/creator-tools/llms.txt"
      : URL_UNDER_TEST;
    const collector = createStaticAuditCollector({
      fetch: async () => redirectedResponse(
        llms
          ? "https://example.com/s/other/llms.txt"
          : "https://example.com/s/other/guides/quiet-laptop",
      ),
    });

    const result = llms
      ? await collector.observeLlmsTxt(requested)
      : await collector.observe(requested);

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "UPSTREAM_UNAVAILABLE",
        retryable: false,
        details: { reason: "unexpected_redirect" },
      },
    });
    expect(JSON.stringify(result)).not.toContain("/s/other");
  });

  it.each([
    ["HTML", false],
    ["llms.txt", true],
  ] as const)("%sは別originへ移動した応答にURLを露出せず失敗する", async (_label, llms) => {
    const requested = llms
      ? "https://example.com/s/creator-tools/llms.txt"
      : URL_UNDER_TEST;
    const secretBearingPath = "/private/token-value";
    const collector = createStaticAuditCollector({
      fetch: async () => redirectedResponse(`https://other.example${secretBearingPath}`),
    });

    const result = llms
      ? await collector.observeLlmsTxt(requested)
      : await collector.observe(requested);

    expect(result).toMatchObject({ ok: false, error: { details: { reason: "unexpected_redirect" } } });
    expect(JSON.stringify(result)).not.toContain(secretBearingPath);
  });
});
