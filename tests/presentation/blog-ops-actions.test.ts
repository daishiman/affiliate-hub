/**
 * @tier 1
 * @req REQ-BOPS03, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS08, REQ-BOPS12
 * @types equivalence, decision-table, boundary
 *
 * 版面（`manageBlogLayoutAction`）・配信（`manageBlogDeliveryAction` /
 * `checkBlogDeliveryAction`）・記事（`manageBlogArticleAction`）の 4 つの口。
 *
 * --- なぜ画面のテストでは足りないのか ---
 *
 * どの口も**1 つの関数が 2〜4 の操作を引き受ける**。画面は同じ欄の並びを
 * 使い回し、`intent` の hidden 欄だけで行き先を変える。だから振り分けを
 * 間違えても画面は動き、押した人には「保存しました」と出る。
 *
 * 実測（2026-08-27）では `blog-layout-action.ts` の分岐が 26.78%、
 * `blog-article-action.ts` が 20.58%。
 * **書いた日から一度も振り分けが確かめられていない。**
 *
 * 保存そのものの正しさは `tests/application/blog-ops-usecases.test.ts` が
 * 本物のユースケースで見ている。ここで見るのは 3 つだけ:
 *
 * 1. **断る所で断る。**ログインしていない・保存先が無い・知らない業務語。
 * 2. **画面から届いた形をユースケースの入力へ正しく直す。**
 * 3. **押した操作に対応する行き先へ振り分ける。**
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type DomainError, type Result, domainError, err, ok } from "@/domain/shared";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { expressionBlockOfArticleBody } from "@/application/adapters/expression-article-block";

/** 再描画の指示は、呼ばれた宛先だけを控える。 */
const revalidated: string[] = [];
vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => {
    revalidated.push(path);
  },
  revalidateTag: () => undefined,
}));

/**
 * `redirect()` は Next では例外を投げて後続を止める。
 * ここでも投げないと、記事の削除で「消えた記事の画面を描き直す」経路が
 * テストの中だけ通ってしまい、本番と違う道を確かめることになる。
 */
const redirected: string[] = [];
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    redirected.push(path);
    throw Object.assign(new Error("NEXT_REDIRECT"), { digest: `NEXT_REDIRECT;replace;${path}` });
  },
}));

/** 届いたリクエストのヘッダ。住所の起点をここから作る。 */
let requestHost: string | null = "blog.example.test";
let forwardedHost: string | null = null;
let forwardedProto: string | null = null;
vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => {
      if (name === "host") return requestHost;
      if (name === "x-forwarded-host") return forwardedHost;
      if (name === "x-forwarded-proto") return forwardedProto;
      return null;
    },
  }),
}));

/** ログインできているか。誰であるかとは別の軸。 */
let loggedIn = true;
/** 保存先が用意できているか。自動テストに D1 は無いので、ここで作る。 */
let storageReady = true;

/** 差し替えたユースケースが受け取った入力。届いた形の直し方を、ここで読む。 */
const seen: Record<string, unknown> = {};

const results: Record<string, Result<unknown, DomainError>> = {};

function recording(name: string) {
  return {
    execute: async (_actor: unknown, input: unknown) => {
      seen[name] = input;
      return results[name] as Result<unknown, DomainError>;
    },
  };
}

vi.mock("@/presentation/composition", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    signedInActor: async () => (loggedIn ? SAMPLE_ACTOR : null),
    blogOpsEntry: async () =>
      storageReady
        ? {
            ready: true,
            saveLayoutSlot: recording("layout.slot"),
            saveLayoutBand: recording("layout.band"),
            saveDeliveryPart: recording("delivery.save"),
            checkDelivery: recording("delivery.check"),
            createArticle: recording("article.create"),
            getArticle: recording("article.get"),
            updateArticle: recording("article.update"),
            deleteArticle: recording("article.delete"),
            restoreArticle: recording("article.restore"),
          }
        : { ready: false, reason: "保存先 (D1) が用意されていません。" },
    siteUseCases: async () => ({ getSite: recording("site.get") }),
  };
});

const { manageBlogLayoutAction, manageBlogDeliveryAction, checkBlogDeliveryAction } = await import(
  "@/presentation/admin/blog-layout-action"
);
const { manageBlogArticleAction } = await import("@/presentation/admin/blog-article-action");

const IDLE = { status: "idle", message: "" } as const;

function form(entries: Record<string, string | readonly string[]>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (typeof value === "string") data.append(key, value);
    else for (const one of value) data.append(key, one);
  }
  return data;
}

beforeEach(() => {
  loggedIn = true;
  storageReady = true;
  requestHost = "blog.example.test";
  forwardedHost = null;
  forwardedProto = null;
  revalidated.length = 0;
  redirected.length = 0;
  for (const key of Object.keys(seen)) delete seen[key];

  results["layout.slot"] = ok({});
  results["layout.band"] = ok({});
  results["delivery.save"] = ok({});
  results["delivery.check"] = ok({ checked: 9, missing: [] });
  results["article.create"] = ok({ requiredBlocks: ["breadcrumb", "article-title"] });
  results["article.get"] = ok({
    articleId: "bar_1",
    siteSlug: "owned-blog",
    slug: "note",
    blocks: [],
  });
  results["article.update"] = ok({ changed: ["題名"], missing: [] });
  results["article.delete"] = ok({ siteSlug: "owned-blog", slug: "note", title: "消した記事" });
  results["article.restore"] = ok({ siteSlug: "owned-blog", slug: "note", title: "戻した記事" });
  results["page.save"] = ok({});
  results["page.delete"] = ok({});
  results["page.restore"] = ok({ siteSlug: "owned-blog" });
  results["site.get"] = ok({
    blueprint: { name: "見本ブログ", purpose: "試す", emitLlmsTxt: true },
  });
});

describe("版面の口（枠と帯）", () => {
  const BAND = {
    intent: "band",
    siteSlug: "owned-blog",
    band: "latest_posts",
    title: "新着",
    enabledPresent: "1",
    enabled: "on",
    position: "1",
    itemLimit: "6",
  } as const;

  const SLOT = {
    intent: "slot",
    siteSlug: "owned-blog",
    region: "sidebar",
    slotKey: "profile",
    title: "運営者",
    body: "はじめまして。",
    enabledPresent: "1",
    position: "2",
  } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogLayoutAction(IDLE, form(BAND));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("版面");
    expect(seen["layout.band"]).toBeUndefined();
  });

  it("保存先が無いとき、見本へ落ちずに断る", async () => {
    storageReady = false;
    const state = await manageBlogLayoutAction(IDLE, form(BAND));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("保存先");
    expect(seen["layout.band"]).toBeUndefined();
  });

  it("知らない操作の指定は、枠にも帯にも寄せない", async () => {
    const state = await manageBlogLayoutAction(IDLE, form({ ...BAND, intent: "ぜんぶ" }));

    expect(state).toMatchObject({ status: "failed", field: "intent" });
    expect(seen["layout.band"]).toBeUndefined();
    expect(seen["layout.slot"]).toBeUndefined();
  });

  it("表示設定の hidden marker が無いフォームは断る", async () => {
    // marker が無いと「チェックを外した」と「欄ごと消された」を見分けられない。
    const { enabledPresent: _drop, ...withoutMarker } = BAND;
    const state = await manageBlogLayoutAction(IDLE, form(withoutMarker));

    expect(state).toMatchObject({ status: "failed", field: "enabled" });
  });

  it("チェックを外した帯は、隠す指定として届く", async () => {
    const { enabled: _unchecked, ...unchecked } = BAND;
    await manageBlogLayoutAction(IDLE, form(unchecked));

    expect(seen["layout.band"]).toMatchObject({ band: "latest_posts", enabled: false });
  });

  it("知らない帯は、既定へ寄せずに断る", async () => {
    const state = await manageBlogLayoutAction(IDLE, form({ ...BAND, band: "なんとなく" }));

    expect(state).toMatchObject({ status: "failed", field: "band" });
    expect(seen["layout.band"]).toBeUndefined();
  });

  it("並べる本数は 0〜24 の外を断る", async () => {
    // 上限が無いと、トップに全記事を並べる指定が保存できてしまう。
    const over = await manageBlogLayoutAction(IDLE, form({ ...BAND, itemLimit: "25" }));
    expect(over).toMatchObject({ status: "failed", field: "itemLimit" });

    const under = await manageBlogLayoutAction(IDLE, form({ ...BAND, itemLimit: "-1" }));
    expect(under).toMatchObject({ status: "failed", field: "itemLimit" });

    const edge = await manageBlogLayoutAction(IDLE, form({ ...BAND, itemLimit: "24" }));
    expect(edge.status).toBe("done");
  });

  it("数でない並び順は断る", async () => {
    const state = await manageBlogLayoutAction(IDLE, form({ ...BAND, position: "さいしょ" }));

    expect(state).toMatchObject({ status: "failed", field: "position" });
  });

  it("帯を保存したら、版面の画面を描き直す", async () => {
    const state = await manageBlogLayoutAction(IDLE, form(BAND));

    expect(seen["layout.band"]).toMatchObject({
      siteSlug: "owned-blog",
      band: "latest_posts",
      title: "新着",
      enabled: true,
      position: 1,
      itemLimit: 6,
    });
    expect(revalidated).toContain("/admin/blog/layout");
    expect(state).toMatchObject({ status: "done" });
    expect(state.message).toContain("帯");
  });

  it("帯の保存を断られたら、原因の欄ごと返す", async () => {
    results["layout.band"] = err(domainError("VALIDATION_FAILED", "件数が多すぎます。", { field: "itemLimit" }));
    const state = await manageBlogLayoutAction(IDLE, form(BAND));

    expect(state).toMatchObject({ status: "failed", field: "itemLimit" });
    expect(revalidated).toHaveLength(0);
  });

  it("知らない置き場所の枠は断る", async () => {
    const state = await manageBlogLayoutAction(IDLE, form({ ...SLOT, region: "まんなか" }));

    expect(state).toMatchObject({ status: "failed", field: "region" });
    expect(seen["layout.slot"]).toBeUndefined();
  });

  it("枠を保存したら、置き場所と本文がそのまま届く", async () => {
    const state = await manageBlogLayoutAction(IDLE, form(SLOT));

    expect(seen["layout.slot"]).toMatchObject({
      region: "sidebar",
      slotKey: "profile",
      body: "はじめまして。",
      position: 2,
      enabled: false,
    });
    expect(state.message).toContain("枠");
  });

  it("枠の保存を断られたら、失敗として返す", async () => {
    results["layout.slot"] = err(domainError("FORBIDDEN", "権限がありません。"));
    const state = await manageBlogLayoutAction(IDLE, form(SLOT));

    expect(state.status).toBe("failed");
    expect(revalidated).toHaveLength(0);
  });
});

describe("配信部品の口", () => {
  const PART = {
    siteSlug: "owned-blog",
    part: "canonical",
    enabledPresent: "1",
    enabled: "on",
    note: "",
    position: "0",
  } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogDeliveryAction(IDLE, form(PART));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("配信部品");
  });

  it("保存先が無いとき、見本へ落ちずに断る", async () => {
    storageReady = false;
    const state = await manageBlogDeliveryAction(IDLE, form(PART));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("保存先");
  });

  it("知らない配信部品は断る", async () => {
    const state = await manageBlogDeliveryAction(IDLE, form({ ...PART, part: "なにか" }));

    expect(state).toMatchObject({ status: "failed", field: "part" });
    expect(seen["delivery.save"]).toBeUndefined();
  });

  it("経路を切るときは、理由がそのまま届く", async () => {
    const state = await manageBlogDeliveryAction(
      IDLE,
      form({ ...PART, enabled: [], note: " 重複していたため ", position: "3" }),
    );

    expect(seen["delivery.save"]).toMatchObject({
      part: "canonical",
      enabled: false,
      note: "重複していたため",
      position: 3,
    });
    expect(revalidated).toContain("/admin/blog/delivery");
    expect(state.status).toBe("done");
  });

  it("保存を断られたら、原因の欄ごと返す", async () => {
    results["delivery.save"] = err(domainError("VALIDATION_FAILED", "理由が要ります。", { field: "note" }));
    const state = await manageBlogDeliveryAction(IDLE, form(PART));

    expect(state).toMatchObject({ status: "failed", field: "note" });
  });

  it("並び順が数でなければ断る", async () => {
    const state = await manageBlogDeliveryAction(IDLE, form({ ...PART, position: "" }));

    expect(state).toMatchObject({ status: "failed", field: "position" });
  });
});

describe("配信物の点検", () => {
  const CHECK = { siteSlug: "owned-blog" } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("点検");
  });

  it("保存先が無いとき、見本へ落ちずに断る", async () => {
    storageReady = false;
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("保存先");
  });

  it("住所の起点が取れないときは、当てずっぽうで点検しない", async () => {
    // ここで既定値を作ると、開発と本番で違う住所を点検したまま緑になる。
    requestHost = null;
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("住所の起点");
    expect(seen["delivery.check"]).toBeUndefined();
  });

  it("proto が無ければ https で組み立てる", async () => {
    await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(seen["delivery.check"]).toMatchObject({ origin: "https://blog.example.test" });
  });

  it("proxy が proto を伝えてきたら、それに従う", async () => {
    forwardedProto = "http";
    await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(seen["delivery.check"]).toMatchObject({ origin: "http://blog.example.test" });
  });

  it("不正なforwarded hostでは配信点検を始めない", async () => {
    forwardedHost = "blog.example.test, attacker.example";
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("住所の起点");
    expect(seen["delivery.check"]).toBeUndefined();
  });

  it("設計図が読めなければ、点検へ進まない", async () => {
    results["site.get"] = err(domainError("NOT_FOUND", "ブログが見つかりません。"));
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("failed");
    expect(seen["delivery.check"]).toBeUndefined();
  });

  it("設計図は読者側と同じ口から引いて、点検へ渡す", async () => {
    await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(seen["delivery.check"]).toMatchObject({
      siteSlug: "owned-blog",
      siteName: "見本ブログ",
      purpose: "試す",
      emitLlmsTxt: true,
    });
  });

  it("欠落が無ければ、無いと言い切る", async () => {
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("done");
    expect(state.message).toContain("欠落はありません");
  });

  it("欠落があれば、何種で見つかったかを言う", async () => {
    results["delivery.check"] = ok({ checked: 9, missing: ["rss", "sitemap"] });
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.message).toContain("9 種");
    expect(state.message).toContain("2 種");
  });

  it("点検を断られたら、失敗として返す", async () => {
    results["delivery.check"] = err(domainError("UPSTREAM_UNAVAILABLE", "組み立てられませんでした。"));
    const state = await checkBlogDeliveryAction(IDLE, form(CHECK));

    expect(state.status).toBe("failed");
  });
});

describe("記事の口", () => {
  const CREATE = {
    intent: "create",
    siteSlug: "owned-blog",
    slug: "first-note",
    template: "T1",
    title: "はじめての記事",
    lead: "みちしるべ",
    authorName: "編集部",
  } as const;

  const UPDATE = {
    intent: "update",
    articleId: "bar_1",
    template: "T2",
    status: "draft",
    title: "直した題名",
    lead: "",
    authorName: "編集部",
  } as const;

  it("ログインしていない人には理由が返る", async () => {
    loggedIn = false;
    const state = await manageBlogArticleAction(IDLE, form(CREATE));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("記事");
  });

  it("保存先が無いとき、見本へ落ちずに断る", async () => {
    storageReady = false;
    const state = await manageBlogArticleAction(IDLE, form(CREATE));

    expect(state.status).toBe("failed");
    expect(state.message).toContain("保存先");
  });

  it("知らない操作の指定は、どの mutation へも寄せない", async () => {
    const state = await manageBlogArticleAction(IDLE, form({ intent: "publish" }));

    expect(state).toMatchObject({ status: "failed", field: "intent" });
    expect(seen["article.create"]).toBeUndefined();
    expect(seen["article.update"]).toBeUndefined();
    expect(seen["article.delete"]).toBeUndefined();
  });

  it("知らない版面では作らない", async () => {
    const state = await manageBlogArticleAction(IDLE, form({ ...CREATE, template: "T9" }));

    expect(state).toMatchObject({ status: "failed", field: "template" });
    expect(seen["article.create"]).toBeUndefined();
  });

  it("作ったら、版面が要求する部品の数を伝える", async () => {
    const state = await manageBlogArticleAction(IDLE, form(CREATE));

    expect(seen["article.create"]).toMatchObject({
      siteSlug: "owned-blog",
      slug: "first-note",
      template: "T1",
      title: "はじめての記事",
    });
    expect(state.status).toBe("done");
    expect(state.message).toContain("2 種類");
  });

  it("作成を断られたら、原因の欄ごと返す", async () => {
    results["article.create"] = err(domainError("VALIDATION_FAILED", "slug が重複。", { field: "slug" }));
    const state = await manageBlogArticleAction(IDLE, form(CREATE));

    expect(state).toMatchObject({ status: "failed", field: "slug" });
  });

  it("知らない状態へは進めない", async () => {
    const state = await manageBlogArticleAction(IDLE, form({ ...UPDATE, status: "こうかい" }));

    expect(state).toMatchObject({ status: "failed", field: "status" });
    expect(seen["article.update"]).toBeUndefined();
  });

  it("部品の行番号が飛んでいたら、黙って捨てずに断る", async () => {
    // 0 で読み終えると 2 番の入力が消える。書いた本人は消えたことに気づけない。
    const state = await manageBlogArticleAction(
      IDLE,
      form({
        ...UPDATE,
        "blocks[0].kind": "article-title",
        "blocks[2].kind": "intro-box",
      }),
    );

    expect(state.status).toBe("failed");
    expect(seen["article.update"]).toBeUndefined();
  });

  it("知らない部品の種類は断る", async () => {
    const state = await manageBlogArticleAction(
      IDLE,
      form({ ...UPDATE, "blocks[0].kind": "なぞの部品" }),
    );

    expect(state).toMatchObject({ status: "failed" });
    expect(seen["article.update"]).toBeUndefined();
  });

  it("直すとき、空のタグ id は落とし、部品は順に並べて渡す", async () => {
    await manageBlogArticleAction(
      IDLE,
      form({
        ...UPDATE,
        tagIds: ["btg_1", "", "btg_2"],
        "blocks[0].id": "blk_1",
        "blocks[0].kind": "article-title",
        "blocks[0].heading": " 見出し ",
        "blocks[0].body": "本文",
        "blocks[1].id": "",
        "blocks[1].kind": "intro-box",
        "blocks[1].heading": "",
        "blocks[1].body": "つづき",
      }),
    );

    // 空の id を渡すと、保管庫は「その id の行を直す」と読む。
    expect(seen["article.update"]).toMatchObject({
      articleId: "bar_1",
      tagIds: ["btg_1", "btg_2"],
      blocks: [
        { id: "blk_1", kind: "article-title", heading: "見出し", body: "本文" },
        { kind: "intro-box", heading: "", body: "つづき" },
      ],
    });
  });

  it.each([
    ["answer", "先に答えます。", ""],
    ["key_points", "速い\n軽い", ""],
    ["faq", "保証は？ | 1年です。", ""],
    ["sources", "公式仕様 | 2026-08-31 | https://example.com/spec", ""],
    ["freshness", "2026-08-31", "確認済み"],
    ["figure", "内部構造", "製品内部の図"],
    ["comparison", "用途別に比較", ""],
    ["cta", "公式サイトを見る", "/go/offer-1"],
    ["summary", "軽さを優先します", ""],
    ["spec_table", "重さ: 900g", ""],
  ] as const)("%s表現を専用append DTOで保存し、フィルタ済みread modelを全置換へ使わない", async (kind, content, detail) => {
    const state = await manageBlogArticleAction(
      IDLE,
      form({ intent: "append_expression", articleId: "bar_1", kind, content, detail }),
    );

    expect(state.status).toBe("done");
    const input = seen["article.update"] as {
      readonly blocks?: readonly unknown[];
      readonly appendBlocks?: readonly { readonly body: string }[];
    };
    expect(input.blocks).toBeUndefined();
    expect(input.appendBlocks).toHaveLength(1);
    expect(expressionBlockOfArticleBody(input.appendBlocks?.[0]?.body ?? "")?.kind).toBe(kind);
  });

  it("変わっていなければ、保存したと言わない", async () => {
    results["article.update"] = ok({ changed: [], missing: [] });
    const state = await manageBlogArticleAction(IDLE, form(UPDATE));

    expect(state.message).toContain("変わったところがない");
  });

  it("部品がそろっていれば、そろっていると言う", async () => {
    const state = await manageBlogArticleAction(IDLE, form(UPDATE));

    expect(state.message).toContain("そろっています");
  });

  it("部品が欠けていれば、あと何種類かを言う", async () => {
    results["article.update"] = ok({ changed: ["題名"], missing: ["intro-box", "cta"] });
    const state = await manageBlogArticleAction(IDLE, form(UPDATE));

    expect(state.message).toContain("あと 2 種類");
  });

  it("更新を断られたら、原因の欄ごと返す", async () => {
    results["article.update"] = err(domainError("VALIDATION_FAILED", "題名が長すぎます。", { field: "title" }));
    const state = await manageBlogArticleAction(IDLE, form(UPDATE));

    expect(state).toMatchObject({ status: "failed", field: "title" });
  });

  it("消したら、消えた記事の画面に留めず一覧へ戻す", async () => {
    // 留めると、成功した本人に「見つかりません」という断りが出る。
    await expect(
      manageBlogArticleAction(IDLE, form({ intent: "delete", articleId: "bar_1", reason: "重複" })),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(seen["article.delete"]).toMatchObject({ articleId: "bar_1", reason: "重複" });
    expect(redirected[0]).toContain("/admin/blog/articles?deleted=");
    // 読者側の URL も描き直す。消えた記事が公開面に残らない。
    expect(revalidated).toContain("/s/owned-blog/blog/note");
  });

  it("削除を断られたら、行き先を変えずに失敗として返す", async () => {
    results["article.delete"] = err(domainError("FORBIDDEN", "権限がありません。"));
    const state = await manageBlogArticleAction(IDLE, form({ intent: "delete", articleId: "bar_1" }));

    expect(state.status).toBe("failed");
    expect(redirected).toHaveLength(0);
  });

  it("戻したときは、同じ URL で戻ったことを伝える", async () => {
    const state = await manageBlogArticleAction(IDLE, form({ intent: "restore", articleId: "bar_1" }));

    expect(seen["article.restore"]).toMatchObject({ articleId: "bar_1" });
    expect(state.status).toBe("done");
    expect(state.message).toContain("同じ URL");
    expect(revalidated).toContain("/s/owned-blog/blog");
  });

  it("復元を断られたら、失敗として返す", async () => {
    results["article.restore"] = err(domainError("CONFLICT", "すでに戻っています。"));
    const state = await manageBlogArticleAction(IDLE, form({ intent: "restore", articleId: "bar_1" }));

    expect(state.status).toBe("failed");
  });
});
