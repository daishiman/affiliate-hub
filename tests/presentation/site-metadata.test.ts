/**
 * @tier 1
 * @req REQ-SEO01
 * @types equivalence, scenario
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const metadataRequest = vi.hoisted(() => ({
  headers: new Headers({ host: "example.com", "x-forwarded-proto": "https" }),
}));

/*
  記事とサイトは**別々に読めなくなりうる**。片方だけ落ちたときに何を配るかが
  この module の判断の中心なので、2 つの読みを独立に倒せるようにしておく。
  固定の mock では「両方読めた」1 通りしか通らない。
*/
const reads = vi.hoisted(() => ({ article: true, site: true }));

/*
  住所の付け方は 3 通りある（独自ドメイン / 既定のサブドメイン / path 形）。
  canonical は**どれで来ても同じ 1 本**を指さなければならないので、
  住所表と基底ドメインの両方を試験から倒せるようにしておく。
*/
const addressing = vi.hoisted(() => ({
  canonicalHostname: null as string | null,
  baseDomain: null as string | null,
  throwsOnLookup: false,
}));

vi.mock("@/infrastructure/domains/resolve-custom-host", () => ({
  resolveCanonicalHostForSite: async () => {
    if (addressing.throwsOnLookup) throw new Error("D1 down");
    return addressing.canonicalHostname;
  },
  lookupCanonicalHostInD1: async () => null,
}));

vi.mock("@/infrastructure/platform/site-base-domain", () => ({
  readSiteBaseDomain: async () => addressing.baseDomain,
}));

vi.mock("next/headers", () => ({
  headers: async () => metadataRequest.headers,
}));

vi.mock("@/presentation/composition", async () => {
  const { resolveRequestOrigin } = await import("@/infrastructure/http/request-origin");
  return {
    requestOriginFromNextHeaders: async () =>
      resolveRequestOrigin({
        host: metadataRequest.headers.get("host"),
        forwardedHost: metadataRequest.headers.get("x-forwarded-host"),
        forwardedProtocol: metadataRequest.headers.get("x-forwarded-proto"),
        defaultProtocol: "https",
      }),
    readerActor: () => ({ kind: "anonymous" }),
    siteUseCases: async () => ({
    getArticle: {
      execute: async (_actor: unknown, input: { readonly slug: string }) =>
        reads.article === false
        ? { ok: false as const, error: { kind: "not-found" } }
        : ({
        ok: true as const,
        value: {
          slug: input.slug,
          siteSlug: "gadget",
          type: "guide",
          title: `記事: ${input.slug}`,
          summary: "要約。",
          categorySlug: "laptops",
          publishedAt: "2026-08-20",
          updatedAt: "2026-08-24",
          author: { slug: "editor", name: "編集部", bio: "紹介。", credentials: [] },
          disclosureRequired: false,
          sections: [],
        },
      }),
    },
    getSite: {
      execute: async () =>
        reads.site === false
          ? { ok: false as const, error: { kind: "not-found" } }
          : {
              ok: true as const,
              value: { blueprint: { name: "ガジェット研究室", purpose: "道具選びを助ける。" } },
            },
    },
    }),
  };
});

const { articleMetadata, createArticlePageMetadata, siteCanonicalPath, siteHomeMetadata, siteMetadataUrl } =
  await import("@/presentation/site/site-metadata");

beforeEach(() => {
  metadataRequest.headers = new Headers({ host: "example.com", "x-forwarded-proto": "https" });
  reads.article = true;
  reads.site = true;
  addressing.canonicalHostname = null;
  addressing.baseDomain = null;
  addressing.throwsOnLookup = false;
});

describe("canonicalは住所の付け方で揺れない", () => {
  it("生きた独自ドメインがあれば、どの住所で来てもそこを正本にする", async () => {
    addressing.canonicalHostname = "blog.example.jp";
    addressing.baseDomain = "example.com";
    // 既定のサブドメインで届いた要求。
    metadataRequest.headers = new Headers({
      host: "gadget.example.com",
      "x-forwarded-proto": "https",
    });

    const metadata = await siteHomeMetadata("gadget");

    expect(metadata.alternates?.canonical).toBe("https://blog.example.jp");
    expect(metadata.openGraph).toMatchObject({ url: "https://blog.example.jp" });
  });

  it("独自ドメインが無ければ既定のサブドメインを正本にする", async () => {
    /*
      ここが要点。基底ドメインが設定された環境では、入口が `/s/<URL名>` を
      外から開けない形にしている。旧実装のように要求 host + `/s/<URL名>` を
      canonical にすると、**自分で 404 を指す**ことになる。
    */
    addressing.baseDomain = "example.com";
    metadataRequest.headers = new Headers({
      host: "gadget.example.com",
      "x-forwarded-proto": "https",
    });

    await expect(siteMetadataUrl("gadget", "/guides/x")).resolves.toBe(
      "https://gadget.example.com/guides/x",
    );
  });

  it("住所表が読めないときは既定の住所へ倒す（canonicalごと落とさない）", async () => {
    addressing.throwsOnLookup = true;
    addressing.baseDomain = "example.com";

    await expect(siteMetadataUrl("gadget", "/guides/x")).resolves.toBe(
      "https://gadget.example.com/guides/x",
    );
  });
});

describe("公開ページのmetadata共通アダプター", () => {
  it("異なる route param 名をそれぞれの記事slugへ投影する", async () => {
    const [topic, comparison, product] = await Promise.all([
      createArticlePageMetadata("topic")({
        params: Promise.resolve({ site: "gadget", topic: "guide-item" }),
      }),
      createArticlePageMetadata("comparison")({
        params: Promise.resolve({ site: "gadget", comparison: "compare-item" }),
      }),
      createArticlePageMetadata("product")({
        params: Promise.resolve({ site: "gadget", product: "review-item" }),
      }),
    ]);

    expect(topic.title).toBe("記事: guide-item");
    expect(topic.alternates?.canonical).toBe(
      "https://example.com/s/gadget/guides/guide-item",
    );
    expect(comparison.alternates?.canonical).toBe(
      "https://example.com/s/gadget/guides/compare-item",
    );
    expect(product.alternates?.canonical).toBe(
      "https://example.com/s/gadget/guides/review-item",
    );
  });

  it("サイト直下と子ページのcanonical pathを1つの規則で合成する", () => {
    expect(siteCanonicalPath("gadget")).toBe("/s/gadget");
    expect(siteCanonicalPath("gadget", "/tools/diagnosis")).toBe(
      "/s/gadget/tools/diagnosis",
    );
  });

  it("転送元のhostとprotocolからマルチホスト用の絶対URLを作る", async () => {
    metadataRequest.headers = new Headers({
      host: "internal.example",
      "x-forwarded-host": "blog.example.jp",
      "x-forwarded-proto": "https",
    });

    await expect(siteMetadataUrl("gadget", "/tools/diagnosis")).resolves.toBe(
      "https://blog.example.jp/s/gadget/tools/diagnosis",
    );
  });

  it("request hostが無い場合は誤った相対canonicalを配らない", async () => {
    metadataRequest.headers = new Headers();

    const metadata = await createArticlePageMetadata("topic")({
      params: Promise.resolve({ site: "gadget", topic: "guide-item" }),
    });

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
  });

  it.each([
    "blog.example.jp, attacker.example",
    "attacker.example/path",
    "user@attacker.example",
  ])("不正なforwarded hostをcanonicalへ混ぜず安全側に失敗する: %s", async (host) => {
    metadataRequest.headers = new Headers({
      host: "internal.example",
      "x-forwarded-host": host,
      "x-forwarded-proto": "https",
    });

    await expect(siteMetadataUrl("gadget", "/tools/diagnosis")).resolves.toBeNull();
  });
});

describe("サイトの表紙のmetadata", () => {
  it("題名も説明もサイト設計図から作る", async () => {
    // 画面の見出しと検索結果の見出しがずれないよう、取り方を 1 つにする。
    const metadata = await siteHomeMetadata("gadget");

    expect(metadata.title).toBe("ガジェット研究室");
    expect(metadata.description).toBe("道具選びを助ける。");
    expect(metadata.alternates?.canonical).toBe("https://example.com/s/gadget");
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      url: "https://example.com/s/gadget",
      siteName: "ガジェット研究室",
    });
  });

  it("切り詰めない意思を検索エンジンへ明示する", async () => {
    /*
      既定でも index はされるが、snippet の長さは検索エンジン任せになる。
      AI 検索が引くのは snippet なので、長さ制限を課さないことを明示する。
    */
    const metadata = await siteHomeMetadata("gadget");

    expect(metadata.robots).toMatchObject({
      index: true,
      googleBot: { "max-snippet": -1, "max-image-preview": "large" },
    });
  });

  it("サイトが読めなければ、推測した題名を配らない", async () => {
    // 読めなかったときに slug から題名を作ると、消したサイトの名前が検索結果に残る。
    reads.site = false;

    await expect(siteHomeMetadata("gadget")).resolves.toEqual({});
  });

  it("hostが無ければ、表紙でもcanonicalを配らない", async () => {
    metadataRequest.headers = new Headers();

    const metadata = await siteHomeMetadata("gadget");

    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).not.toHaveProperty("url");
    // 題名と説明は host に依らないので、ここは配れる。
    expect(metadata.title).toBe("ガジェット研究室");
  });
});

describe("記事のmetadataは、読めた分だけ配る", () => {
  it("記事が読めなければ空を返す", async () => {
    reads.article = false;

    await expect(articleMetadata("gadget", "guide-item")).resolves.toEqual({});
  });

  it("サイトだけ読めないときは、siteNameを省いて記事は配る", async () => {
    /*
      ここが**この module のいちばん細い判断**である。記事の metadata まで
      空にすると、読めている記事の題名も canonical も配れなくなる。
      逆に siteName を slug から作ると、サイト設計図に無い名前が世に出る。
      だから「省く」——無い方が、誤った名前より害が小さい。
    */
    reads.site = false;

    const metadata = await articleMetadata("gadget", "guide-item");

    expect(metadata.title).toBe("記事: guide-item");
    expect(metadata.alternates?.canonical).toBe("https://example.com/s/gadget/guides/guide-item");
    expect(metadata.openGraph).not.toHaveProperty("siteName");
  });

  it("両方読めたときは、記事の日付と書き手も添える", async () => {
    const metadata = await articleMetadata("gadget", "guide-item");

    expect(metadata.openGraph).toMatchObject({
      type: "article",
      siteName: "ガジェット研究室",
      publishedTime: "2026-08-20",
      modifiedTime: "2026-08-24",
      authors: ["編集部"],
    });
  });
});
