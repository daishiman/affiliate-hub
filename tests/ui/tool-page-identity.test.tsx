/**
 * @tier 2
 * @req REQ-B01, REQ-S06
 * @types equivalence, boundary
 *
 * 道具のページ（`/s/{ブログ}/tools/{slug}`）が **1 つの住所** であることの確認。
 *
 * --- 何が壊れていたか（2026-08-26 まで）---
 *
 * `tool` 型で記事を公開すると、一覧・検索・パンくずが指す URL は
 * `articleHref()` の決めた `/tools/{slug}` になる。ところがその住所を受け持つ
 * 画面は道具の定義（`ReaderToolDefinition`）しか読まなかった。
 * つまり **書いた記事を踏んだ読者は 404 に落ちる。**
 * しかも公開の手続きの側からは成功に見えるので、書き手は気付けない。
 *
 * --- ここで固定すること ---
 *
 *   1. 書き込み側が決める URL と、読み取り側のルートが同じ識別子を使う。
 *   2. 道具の定義と記事が両方あれば、**同じ 1 枚**に出る（計算と、その根拠）。
 *   3. 記事がまだ無くても道具は使える（404 にしない）。
 *   4. どちらも無ければ 404（`resource-not-found.test.tsx` が全ルートで見ている）。
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { articleHref } from "@/application/read-models/published-article";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";
import { intoDom, renderRoute, textOf } from "../support/render";

const TOOL_SLUG = "storage-estimator";
const IMPORT_PATH = "@/app/s/[site]/tools/[tool]/page";

function props(searchParams: Record<string, string> = {}) {
  return {
    params: Promise.resolve({ site: SAMPLE_SITE_SLUG, tool: TOOL_SLUG }),
    searchParams: Promise.resolve(searchParams),
  };
}

afterEach(() => {
  vi.doUnmock("@/infrastructure/persistence/sample/content-sample-repository");
  vi.doUnmock("@/presentation/composition");
  vi.resetModules();
});

describe("書き込み側の URL と、読み取り側のルート", () => {
  it("tool 型の記事の URL は /tools/{slug} を指す", () => {
    expect(articleHref({ type: "tool", slug: TOOL_SLUG })).toBe(`/tools/${TOOL_SLUG}`);
  });

  it("その住所を受け持つファイルが実在する", async () => {
    // 文字列で書いた URL に、開ける画面が付いていることまで見る。
    // 付いていないと、上の 1 件だけが緑のまま読者は 404 に落ちる。
    const page = await import(IMPORT_PATH);
    expect(typeof page.default).toBe("function");
  });
});

describe("道具と記事が同じ 1 枚に出る", () => {
  it("計算の入力欄と、記事の根拠が同じページにある", async () => {
    const html = await renderRoute(IMPORT_PATH, props());
    const text = textOf(html);

    // 道具の側（定義から来るもの）
    expect(text).toContain("1 か月に撮影する時間");
    expect(text).toContain("結果の読み方");
    // 記事の側（公開記事から来るもの）
    expect(text).toContain("計算・判定の根拠");
    expect(text).toContain("このツールでできること");
  });

  it("操作できる部分が、説明より先に出る", async () => {
    const html = await renderRoute(IMPORT_PATH, props());
    const { document, cleanup } = intoDom(html);
    try {
      const form = document.querySelector("form");
      expect(form).not.toBeNull();
      const headings = [...document.querySelectorAll("h2")].map((h) => h.textContent ?? "");
      const rationale = headings.findIndex((t) => t.includes("計算・判定の根拠"));
      expect(rationale).toBeGreaterThanOrEqual(0);
      /*
        入力欄が本文より前にあること。道具を使いに来た読者に、
        先に読み物を読ませない。位置は見た目の好みではなく、
        「何をしに来たか」に画面の順番を合わせるという判断である。
      */
      const bodyHtml = html.indexOf("<form");
      const rationaleHtml = html.indexOf("計算・判定の根拠");
      expect(bodyHtml).toBeLessThan(rationaleHtml);
    } finally {
      cleanup();
    }
  });

  it("空のまま送信したら、未送信に戻さず必須入力エラーを出す", async () => {
    const html = await renderRoute(
      IMPORT_PATH,
      props({ minutes: "", bitrate: "", months: "" }),
    );
    const text = textOf(html);

    expect(text).toContain("入力を見直してください");
    expect(text).toContain("「1 か月に撮影する時間」が入力されていません。");
  });
});

describe("片方しか無いとき", () => {
  it("記事をまだ書いていなくても、道具は使える", async () => {
    /*
      差し替えるのは `findArticle` の 1 つだけ。残りは本物の見本が通る。
      戻りを画面の手前で作ると、「その枝が描けること」しか測れない。
    */
    vi.resetModules();
    vi.doMock("@/infrastructure/persistence/sample/content-sample-repository", async (original) => {
      const actual = await original<Record<string, unknown>>();
      const create = actual.createSampleContentRepository as () => Record<string, unknown>;
      return {
        ...actual,
        createSampleContentRepository: () => {
          const real = create();
          const findArticle = real.findArticle as (
            siteSlug: string,
            slug: string,
          ) => Promise<unknown>;
          return {
            ...real,
            async findArticle(siteSlug: string, slug: string) {
              // 消すのは道具の記事 1 本だけ。ほかの記事まで消すと
              // 「記事が 1 本も無いブログ」という別の状態を測ることになる。
              if (slug === TOOL_SLUG) return { ok: true, value: null };
              return findArticle(siteSlug, slug);
            },
          };
        },
      };
    });

    const html = await renderRoute(IMPORT_PATH, props());
    const text = textOf(html);
    expect(text).toContain("必要な保存容量の目安");
    expect(text).toContain("結果の読み方");
    /*
      記事の側が本当に消えていること。ここを見ないと、差し替えが効かないまま
      「両方ある」状態を測って緑になる。道具の名前は記事の題名と似ているので、
      名前の有無では区別が付かない。
    */
    expect(text).not.toContain("計算・判定の根拠");
    // 記事が無いことを「壊れ」として出さない。まだ書いていないだけである。
    expect(text).not.toContain("記事が見つかりませんでした");
  });

  it("道具の保存先が落ちたときは、実在する記事で失敗を隠さない", async () => {
    vi.resetModules();
    vi.doMock("@/presentation/composition", async (original) => {
      const actual = await original<Record<string, unknown>>();
      const { domainError, err } = await import("@/domain/shared");
      const realReaderUseCases = actual.readerUseCases as () => Promise<Record<string, unknown>>;
      return {
        ...actual,
        readerUseCases: async () => ({
          ...(await realReaderUseCases()),
          getReaderTool: {
            execute: async () =>
              err(
                domainError("UPSTREAM_UNAVAILABLE", "道具の読み出しに失敗しました。", {
                  retryable: true,
                }),
              ),
          },
        }),
      };
    });

    const html = await renderRoute(IMPORT_PATH, props());
    const text = textOf(html);
    expect(text).toContain("いま表示できません");
    expect(text).not.toContain("計算・判定の根拠");
  });
});
