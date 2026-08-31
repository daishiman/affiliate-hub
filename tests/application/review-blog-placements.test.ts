/**
 * @tier 1
 * @req REQ-BOPS06, REQ-BOPS07
 * @types decision-table, equivalence, boundary
 *
 * ブログ×成果リンクの掲載状況を見る／直すユースケース（受入 A6・A7）。
 *
 * --- ここで何を固定するか ---
 *
 * この層は台帳と記事表という**2 つの口を突き合わせる**唯一の場所である。
 * 突き合わせ方が崩れたときに壊れるのは、型ではなく数である。
 *
 * 1. 掲載漏れの数え方 — 分母は記事の全体集合。台帳は「載っているもの」しか
 *    知らないので、記事表を渡さないと 0 件の記事は 1 件も見えない
 * 2. 未指定の意味が場所で逆になる — 検索の未指定は「絞らない」、
 *    保存・削除の未指定は「コード無しの掲載」。混ぜると
 *    「コード無しを消したつもりで全部消える」になる
 * 3. 保存前の記事実在確認 — 台帳は `article_slug` に外部キーを持たない。
 *    ここで見ないと、打ち間違えた slug の掲載がどの一覧にも出ないまま残る
 * 4. 権限の振り分け — 読むのは `content.read`（掲載漏れは編集の判断材料）、
 *    書き換えは `site.manage`
 *
 * **金額は 1 つも出てこない。**この台帳が答えるのは「どこに出ていないか」
 * だけで、報酬は `affiliate_links` と `conversion` の担当である（不変条件 I4）。
 */
import { describe, expect, it } from "vitest";
import type {
  AffiliatePlacement,
  BlogAffiliatePlacementPort,
} from "@/application/ports/blog-affiliate-placement";
import type { BlogOpsRepositoryPort } from "@/application/ports/blog-ops";
import { createReviewBlogPlacementsUseCase } from "@/application/usecases/authoring/review-blog-placements";
import type { BlogArticle } from "@/domain/blogops";
import { type ActorContext, domainError, err, ok } from "@/domain/shared";
import { taggedString } from "@/domain/shared/tagged";

const manager: ActorContext = {
  userId: taggedString("user_manager"),
  workspaceId: taggedString("ws_test"),
  roles: ["owner"],
  scopedBrandIds: [],
  isAiServiceAccount: false,
  identified: true,
};

/** 記事を書く人。`content.read` はあるが `site.manage` は無い。 */
const writer: ActorContext = { ...manager, userId: taggedString("user_writer"), roles: ["writer"] };

function article(slug: string, siteSlug = "blog", status: BlogArticle["status"] = "published"): BlogArticle {
  return {
    id: `art_${slug}`,
    siteSlug,
    slug,
    template: "T1",
    title: slug,
    lead: "",
    status,
    authorName: "編集部",
    publishedAt: null,
    updatedAt: new Date("2026-08-31T00:00:00Z"),
  };
}

function placement(
  articleSlug: string,
  slot: string,
  extra: Partial<AffiliatePlacement> = {},
): AffiliatePlacement {
  return { siteSlug: "blog", articleSlug, placement: slot, position: 0, ...extra };
}

type Fixture = {
  articles?: readonly BlogArticle[];
  ledger?: readonly AffiliatePlacement[];
};

/**
 * 台帳と記事表の差し替え。
 *
 * 台帳の `listBySite` は本物と同じく `knownArticleSlugs` を尊重する
 * ——**掲載 0 件の記事も空の行として返す**。ここを手を抜いて
 * 「台帳にあるものだけ」にすると、掲載漏れの検査そのものが空振りする。
 */
function fakes(fixture: Fixture = {}) {
  const articles = fixture.articles ?? [];
  const ledger = [...(fixture.ledger ?? [])];
  const calls: { op: string; arg: unknown }[] = [];

  const placements: BlogAffiliatePlacementPort = {
    async listBySite(input) {
      calls.push({ op: "listBySite", arg: input });
      const slugs = input.knownArticleSlugs ?? [...new Set(ledger.map((p) => p.articleSlug))];
      return ok(
        slugs.map((slug) => ({
          articleSlug: slug,
          placements: ledger.filter((p) => p.siteSlug === input.siteSlug && p.articleSlug === slug),
        })),
      );
    },
    async listByAffiliate(input) {
      calls.push({ op: "listByAffiliate", arg: input });
      return ok(
        ledger.filter(
          (p) =>
            (input.trackingCode === undefined || p.trackingCode === input.trackingCode) &&
            (input.placement === undefined || p.placement === input.placement),
        ),
      );
    },
    async save(input) {
      calls.push({ op: "save", arg: input });
      ledger.push(input.placement);
      return ok(input.placement);
    },
    async remove(input) {
      calls.push({ op: "remove", arg: input });
      return ok(undefined);
    },
  };

  const blogOps: Pick<BlogOpsRepositoryPort, "listArticles"> = {
    async listArticles(_workspaceId, siteSlug) {
      calls.push({ op: "listArticles", arg: siteSlug });
      return ok(siteSlug === null ? articles : articles.filter((a) => a.siteSlug === siteSlug));
    },
  };

  return {
    placements,
    blogOps,
    ledger,
    calls,
    opsOf: () => calls.map((c) => c.op),
    uc: createReviewBlogPlacementsUseCase({ placements, blogOps }),
  };
}

/**
 * 逆引きへ渡った絞り込み条件だけを取り出す。
 *
 * `workspaceId` はどの問い合わせにも必ず付くテナント境界で、絞り込みではない。
 * 混ぜて比べると「条件を 1 つも足していない」を言い表せなくなる。
 */
function filterOf(calls: readonly { op: string; arg: unknown }[]): Record<string, unknown> {
  const arg = calls.find((c) => c.op === "listByAffiliate")?.arg as Record<string, unknown>;
  const { workspaceId: _workspaceId, ...rest } = arg;
  return rest;
}

describe("掲載状況 — 権限の振り分け", () => {
  it.each(["by_site", "by_affiliate"] as const)("%s は記事を読める人なら見られる", async (action) => {
    const { uc } = fakes({ articles: [article("a")] });
    const result = await uc.execute(
      writer,
      action === "by_site" ? { action, siteSlug: "blog" } : { action },
    );

    // 掲載漏れは編集の判断材料であって報酬の数字ではない。
    expect(result.ok).toBe(true);
  });

  it.each([
    { action: "save", siteSlug: "blog", articleSlug: "a", placement: "intro" },
    { action: "remove", siteSlug: "blog", articleSlug: "a", placement: "intro" },
  ] as const)("$action は site.manage が無いと断られ、台帳に触らない", async (input) => {
    const { uc, opsOf } = fakes({ articles: [article("a")] });
    const result = await uc.execute(writer, input);

    expect(result.ok).toBe(false);
    expect(opsOf()).toEqual([]);
  });
});

describe("掲載状況 — ブログ 1 つぶんの一覧（A6）", () => {
  it("掲載 0 件の記事も行として出し、その数を主役として返す", async () => {
    const { uc } = fakes({
      articles: [article("a"), article("b"), article("c")],
      ledger: [placement("a", "intro")],
    });
    const result = await uc.execute(manager, { action: "by_site", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_site") return;
    expect(result.value.articles.map((a) => a.articleSlug)).toEqual(["a", "b", "c"]);
    // 画面で数え直させない。数え方が 2 つに割れると見出しと一覧がずれる。
    expect(result.value.missingCount).toBe(2);
  });

  it("記事の全体集合を分母として台帳へ渡す", async () => {
    const { uc, calls } = fakes({ articles: [article("a"), article("b")] });
    await uc.execute(manager, { action: "by_site", siteSlug: "blog" });

    const listed = calls.find((c) => c.op === "listBySite")?.arg as
      | { knownArticleSlugs?: readonly string[] }
      | undefined;
    // 渡さなければ台帳は「載っているもの」しか返せず、0 件の記事が消える。
    expect(listed?.knownArticleSlugs).toEqual(["a", "b"]);
  });

  it("記事が 1 本も無ければ、漏れも 0 件である", async () => {
    const { uc } = fakes();
    const result = await uc.execute(manager, { action: "by_site", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_site") return;
    expect(result.value.articles).toEqual([]);
    expect(result.value.missingCount).toBe(0);
  });

  it("全記事に掲載があれば、漏れは 0 件である", async () => {
    const { uc } = fakes({
      articles: [article("a"), article("b")],
      ledger: [placement("a", "intro"), placement("b", "conclusion")],
    });
    const result = await uc.execute(manager, { action: "by_site", siteSlug: "blog" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_site") return;
    expect(result.value.missingCount).toBe(0);
  });

  it("記事表が落ちたら台帳を読まずに失敗を返す", async () => {
    const base = fakes();
    const uc = createReviewBlogPlacementsUseCase({
      placements: base.placements,
      blogOps: {
        async listArticles() {
          return err(domainError("UPSTREAM_UNAVAILABLE", "記事表が落ちています"));
        },
      },
    });
    const result = await uc.execute(manager, { action: "by_site", siteSlug: "blog" });

    // 読めなかったものを 0 件と受け取ると、画面には「漏れなし」と出る。
    expect(result.ok).toBe(false);
    expect(base.opsOf()).toEqual([]);
  });
});

describe("掲載状況 — 成果リンクから逆に引く（A7）", () => {
  it("絞り込みを渡さなければ、条件を足さずに全件を返す", async () => {
    const { uc, calls } = fakes({
      articles: [article("a")],
      ledger: [placement("a", "intro", { trackingCode: "X1" }), placement("a", "conclusion")],
    });
    const result = await uc.execute(manager, { action: "by_affiliate" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_affiliate") return;
    expect(result.value.placements).toHaveLength(2);
    // 検索の未指定は「絞らない」。保存・削除の未指定（＝コード無し）と逆である。
    expect(filterOf(calls)).toEqual({});
  });

  it("追跡コードの空白だけの入力は、絞り込みとして扱わない", async () => {
    const { uc, calls } = fakes({ articles: [article("a")], ledger: [placement("a", "intro")] });
    const result = await uc.execute(manager, { action: "by_affiliate", trackingCode: "   " });

    expect(result.ok).toBe(true);
    expect(filterOf(calls)).toEqual({});
  });

  it("追跡コードと位置の両方で絞れる", async () => {
    const { uc, calls } = fakes({
      articles: [article("a")],
      ledger: [
        placement("a", "intro", { trackingCode: "X1" }),
        placement("a", "conclusion", { trackingCode: "X1" }),
        placement("a", "intro", { trackingCode: "X2" }),
      ],
    });
    const result = await uc.execute(manager, {
      action: "by_affiliate",
      trackingCode: " X1 ",
      placement: "intro",
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_affiliate") return;
    expect(result.value.placements).toHaveLength(1);
    // 前後の空白は落とす。落とさないと 1 件も当たらない。
    expect(filterOf(calls)).toEqual({ trackingCode: "X1", placement: "intro" });
  });

  it("記事の状態を添える。下書きの掲載も隠さない", async () => {
    const { uc } = fakes({
      articles: [article("a", "blog", "draft")],
      ledger: [placement("a", "intro")],
    });
    const result = await uc.execute(manager, { action: "by_affiliate" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_affiliate") return;
    // 隠すと「公開したのに出ない」の原因が画面から見えなくなる。
    expect(result.value.placements[0]?.articleStatus).toBe("draft");
  });

  it("記事が消えている掲載は missing と示す", async () => {
    const { uc } = fakes({ articles: [], ledger: [placement("ghost", "intro")] });
    const result = await uc.execute(manager, { action: "by_affiliate" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_affiliate") return;
    expect(result.value.placements[0]?.articleStatus).toBe("missing");
  });

  it("同じ slug でもブログが違えば別の記事として状態を引く", async () => {
    const { uc } = fakes({
      articles: [article("a", "blog", "published"), article("a", "other", "draft")],
      ledger: [placement("a", "intro", { siteSlug: "other" })],
    });
    const result = await uc.execute(manager, { action: "by_affiliate" });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_affiliate") return;
    // slug だけを鍵にすると、別ブログの同名記事の状態を取り違える。
    expect(result.value.placements[0]?.articleStatus).toBe("draft");
  });
});

describe("掲載状況 — 記録する", () => {
  it.each(["intro", "comparison", "conclusion"])("位置 %s は受け付ける", async (slot) => {
    const { uc, ledger } = fakes({ articles: [article("a")] });
    const result = await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: slot,
    });

    expect(result.ok).toBe(true);
    expect(ledger.map((p) => p.placement)).toEqual([slot]);
  });

  it("語彙に無い位置は断り、記事表も台帳も読まない", async () => {
    const { uc, opsOf } = fakes({ articles: [article("a")] });
    const result = await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "sidebar",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("placement");
    expect(opsOf()).toEqual([]);
  });

  it("そのブログに無い記事への掲載は断り、台帳へ書かない", async () => {
    const { uc, ledger } = fakes({ articles: [article("a")] });
    const result = await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "typo",
      placement: "intro",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("articleSlug");
    // 打ち間違えた slug の掲載はどの一覧にも出ないまま、数だけ増える。
    expect(ledger).toEqual([]);
  });

  it("並びを渡さなければ 0 として記録する", async () => {
    const { uc, ledger } = fakes({ articles: [article("a")] });
    await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    expect(ledger[0]?.position).toBe(0);
  });

  it("渡した並びをそのまま記録する", async () => {
    const { uc, ledger } = fakes({ articles: [article("a")] });
    await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
      position: 3,
    });

    expect(ledger[0]?.position).toBe(3);
  });

  it("追跡コードの空文字は「コード無し」へ寄せる", async () => {
    const { uc, ledger } = fakes({ articles: [article("a")] });
    await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
      trackingCode: "  ",
    });

    // '' の行と NULL の行が別物として並ぶと、片方だけが消える。
    expect(ledger[0]).not.toHaveProperty("trackingCode");
  });

  it("公開記事側の CTA も同じ保存へ含める（3 面一致）", async () => {
    const { uc, calls } = fakes({ articles: [article("a")] });
    await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    const saved = calls.find((c) => c.op === "save")?.arg as
      | { publicArticleBlock?: { articleId: string } }
      | undefined;
    // 台帳だけ書いて記事側を書かないと、A7 の 3 面一致が崩れる。
    expect(saved?.publicArticleBlock?.articleId).toBe("art_a");
  });

  it("保存できたら、そのブログの一覧を読み直して返す", async () => {
    const { uc } = fakes({ articles: [article("a"), article("b")] });
    const result = await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    expect(result.ok).toBe(true);
    if (!result.ok || result.value.kind !== "by_site") return;
    // 画面が自前で状態を継ぎ足さないよう、必ず読み直した数を返す。
    expect(result.value.missingCount).toBe(1);
  });

  it("台帳への書き込みが落ちたら、一覧を読み直さず失敗を返す", async () => {
    const base = fakes({ articles: [article("a")] });
    const uc = createReviewBlogPlacementsUseCase({
      placements: {
        ...base.placements,
        async save() {
          return err(domainError("UPSTREAM_UNAVAILABLE", "書き込めません"));
        },
      },
      blogOps: base.blogOps,
    });
    const result = await uc.execute(manager, {
      action: "save",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    expect(result.ok).toBe(false);
    expect(base.opsOf()).not.toContain("listBySite");
  });
});

describe("掲載状況 — 取り消す", () => {
  it("消したあと、そのブログの一覧を読み直して返す", async () => {
    const { uc, calls } = fakes({ articles: [article("a")], ledger: [placement("a", "intro")] });
    const result = await uc.execute(manager, {
      action: "remove",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    expect(result.ok).toBe(true);
    expect(calls.map((c) => c.op)).toContain("listBySite");
  });

  it("記事の実在は確かめない。消すのは台帳の行だけである", async () => {
    const { uc, opsOf } = fakes({ articles: [], ledger: [placement("ghost", "intro")] });
    const result = await uc.execute(manager, {
      action: "remove",
      siteSlug: "blog",
      articleSlug: "ghost",
      placement: "intro",
    });

    // 記事が消えたあとに残った行を、掃除できなくなるのを避ける。
    expect(result.ok).toBe(true);
    expect(opsOf()).toContain("remove");
  });

  it("公開記事側の CTA の ID も渡し、同じ削除へ含める", async () => {
    const { uc, calls } = fakes({ articles: [article("a")], ledger: [placement("a", "intro")] });
    await uc.execute(manager, {
      action: "remove",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    const removed = calls.find((c) => c.op === "remove")?.arg as
      | { publicArticleBlockId?: string }
      | undefined;
    expect(removed?.publicArticleBlockId).toBeTruthy();
  });

  it("語彙に無い位置は断り、台帳に触らない", async () => {
    const { uc, opsOf } = fakes({ articles: [article("a")] });
    const result = await uc.execute(manager, {
      action: "remove",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "sidebar",
    });

    expect(result.ok).toBe(false);
    expect(opsOf()).toEqual([]);
  });

  it("追跡コードの空文字は「コード無しの掲載」を指す", async () => {
    const { uc, calls } = fakes({ articles: [article("a")] });
    await uc.execute(manager, {
      action: "remove",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
      trackingCode: "",
    });

    const removed = calls.find((c) => c.op === "remove")?.arg as
      | Record<string, unknown>
      | undefined;
    // ここで '' を渡すと、コード無しの行に当たらないまま「消した」と返る。
    expect(removed).not.toHaveProperty("trackingCode");
  });

  it("台帳の削除が落ちたら、一覧を読み直さず失敗を返す", async () => {
    const base = fakes({ articles: [article("a")] });
    const uc = createReviewBlogPlacementsUseCase({
      placements: {
        ...base.placements,
        async remove() {
          return err(domainError("UPSTREAM_UNAVAILABLE", "消せません"));
        },
      },
      blogOps: base.blogOps,
    });
    const result = await uc.execute(manager, {
      action: "remove",
      siteSlug: "blog",
      articleSlug: "a",
      placement: "intro",
    });

    expect(result.ok).toBe(false);
    expect(base.opsOf()).not.toContain("listBySite");
  });
});
