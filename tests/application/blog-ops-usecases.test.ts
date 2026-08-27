/**
 * @tier 1
 * @req REQ-BLOG04, REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS04, REQ-BOPS05
 * @req REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09, REQ-BOPS10
 * 受入条件 A1, A3, A5, A7, A9, A11, A12（`docs/spec/feat-blog-ops-crud/requirements-baseline.md`）に対応する。
 * `@req` は要件表の ID しか拾わないので、受入 ID はここに文章で残す。
 * @types boundary, equivalence, decision-table, state-transition, permission-matrix, tenant-isolation, audit-log
 *
 * ブログ運用のユースケース（サイト網・版面・記事・固定ページ・タグ・評価）。
 *
 * ここで見るのは**画面が守れない決まり**だけに絞ってある。
 *   - 権限（誰が触れるか）と作業場所（誰のデータか）
 *   - 保存を断る条件（重複・欠落・理由なし削除）
 *   - 記録が書けなかったときに「保存できた」と言わないこと
 *
 * 画面の見た目は `tests/ui` が、SQL は `tests/integration` が見る。
 * ここで DOM を触ると、決まりが変わっていないのに文言だけで落ちるようになる。
 */
import { describe, expect, it } from "vitest";
import type {
  BlogArticleDetail,
  DeletedBlogArticleRecord,
  DeletedSiteNetworkRecord,
  BlogDeliveryPartRecord,
  BlogDeliverySnapshotRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogOpsRepositoryPort,
  BlogTagRecord,
  FixedPageRecord,
  SaveBlogArticleInput,
  SaveSiteNetworkInput,
} from "@/application/ports/blog-ops";
import {
  createCreateBlogArticleUseCase,
  createCreateSiteNetworkNodeUseCase,
  createDeleteBlogArticleUseCase,
  createDeleteBlogTagUseCase,
  createDeleteFixedPageUseCase,
  createDeleteSiteNetworkNodeUseCase,
  createEvaluateBlogArticlesUseCase,
  createGetBlogArticleUseCase,
  createListArticleRatingsUseCase,
  createListBlogArticlesUseCase,
  createListBlogTagsUseCase,
  createListFixedPagesUseCase,
  createListDeletedFixedPagesUseCase,
  createListSiteNetworkUseCase,
  createListDeletedBlogArticlesUseCase,
  createListDeletedSiteNetworkUseCase,
  createCheckBlogDeliveryUseCase,
  createReadBlogLayoutUseCase,
  createSaveBlogLayoutBandUseCase,
  createSaveBlogLayoutSlotUseCase,
  createSaveBlogTagUseCase,
  createSaveDeliveryPartUseCase,
  createSaveFixedPageUseCase,
  createSetArticleRatingHiddenUseCase,
  createRestoreBlogArticleUseCase,
  createRestoreSiteNetworkNodeUseCase,
  createRestoreFixedPageUseCase,
  createSubmitArticleRatingUseCase,
  createUpdateBlogArticleUseCase,
  createUpdateSiteNetworkNodeUseCase,
} from "@/application/usecases/blog-ops";
import {
  DELIVERY_PARTS,
  FIXED_PAGE_KINDS,
  SIDEBAR_SLOT_KEYS,
  TOP_BANDS,
} from "@/domain/blogops";
import { createUnavailableAuditLog } from "@/infrastructure/persistence/sample/audit-log-sample-repository";
import type { ArticleRating, BlogArticle, RatingSummary, SiteNetworkNode } from "@/domain/blogops";
import {
  type DomainError,
  type Result,
  err,
  isErr,
  isOk,
  markCommercial,
  notFound,
  ok,
} from "@/domain/shared";
import { WORKSPACE, aNobody, anOutsider, anOwner, aWriter } from "../support/actors";
import { NOW, daysFrom } from "../support/clock";
import { recordingAuditLog } from "../support/doubles";
import {
  type Store,
  article,
  fakeRepository,
  node,
  sequentialIds,
} from "../support/blog-ops-fake";

function depsWith(seed: Partial<Store> = {}) {
  const repo = fakeRepository(seed);
  const audit = recordingAuditLog();
  return {
    repo,
    audit,
    deps: {
      repository: repo.port,
      ids: sequentialIds(),
      auditLog: audit.port,
      now: () => NOW,
    },
  };
}


describe("サイト網の一覧", () => {
  it("権限の無い人には出さない", async () => {
    const { deps } = depsWith();
    const r = await createListSiteNetworkUseCase(deps).execute(aNobody(), {});
    expect(r.ok).toBe(false);
  });

  it("別の作業場所の人には、自分の網（空）しか見えない", async () => {
    const { deps } = depsWith({ network: [node({ siteSlug: "hub", role: "hub" })] });
    const mine = await createListSiteNetworkUseCase(deps).execute(anOwner(), {});
    const theirs = await createListSiteNetworkUseCase(deps).execute(anOutsider(), {});
    expect(isOk(mine) && mine.value.total).toBe(1);
    expect(isOk(theirs) && theirs.value.total).toBe(0);
  });

  it("1 件も無ければ、何をすればよいかを言葉で返す", async () => {
    const { deps } = depsWith();
    const r = await createListSiteNetworkUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.emptyReason).toContain("ハブ");
  });

  it("親を失った節点を落とさず、数えて返す", async () => {
    const { deps } = depsWith({
      network: [node({ siteSlug: "hub", role: "hub" }), node({ siteSlug: "lost", parentSlug: "gone" })],
    });
    const r = await createListSiteNetworkUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.total).toBe(2);
    expect(isOk(r) && r.value.orphanCount).toBe(1);
  });
});

describe("サイト網への追加", () => {
  it("ハブを 1 本足せる", async () => {
    const { deps, repo, audit } = depsWith();
    const r = await createCreateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      role: "hub",
      parentSlug: null,
      name: "中心のブログ",
      oneLine: "",
    });
    expect(isOk(r) && r.value.siteSlug).toBe("hub");
    expect(repo.store.network).toHaveLength(1);
    expect(audit.actions()).toContain("site_network.created");
  });

  it("同じ URL 名を 2 つ置けない", async () => {
    const { deps } = depsWith({ network: [node({ siteSlug: "hub", role: "hub" })] });
    const r = await createCreateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      role: "hub",
      parentSlug: null,
      name: "もう 1 つの中心",
      oneLine: "",
    });
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.field).toBe("siteSlug");
  });

  it("削除済みの URL 名を新規作成で横取りできない", async () => {
    const deleted = node({ siteSlug: "hub", role: "hub" });
    const { deps } = depsWith({
      deletedNetwork: [{ node: deleted, deletedAt: NOW }],
    });
    const r = await createCreateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      role: "hub",
      parentSlug: null,
      name: "別の中心",
      oneLine: "",
    });

    expect(isErr(r) && r.error.field).toBe("siteSlug");
  });

  it("上位がまだ無いサブサイトは断る", async () => {
    const { deps } = depsWith();
    const r = await createCreateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      siteSlug: "sub",
      role: "sub",
      parentSlug: "hub",
      name: "配下",
      oneLine: "",
    });
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.field).toBe("parentSlug");
  });

  it("名前が空なら断る", async () => {
    const { deps } = depsWith();
    const r = await createCreateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      role: "hub",
      parentSlug: null,
      name: "   ",
      oneLine: "",
    });
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.field).toBe("name");
  });

  it("記事は書けるが設定は触れない人には断る", async () => {
    const { deps } = depsWith();
    const r = await createCreateSiteNetworkNodeUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      role: "hub",
      parentSlug: null,
      name: "中心",
      oneLine: "",
    });
    expect(r.ok).toBe(false);
  });
});

describe("サイト網の変更", () => {
  it("何も変わらなければ保存も記録もしない", async () => {
    const { deps, audit } = depsWith({ network: [node({ siteSlug: "hub", role: "hub", name: "中心" })] });
    const r = await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_hub",
      name: "中心",
    });
    expect(isOk(r) && r.value.changed).toEqual([]);
    expect(audit.entries()).toHaveLength(0);
  });

  it("変わった項目名だけを返す", async () => {
    const { deps } = depsWith({ network: [node({ siteSlug: "hub", role: "hub", name: "中心" })] });
    const r = await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_hub",
      name: "新しい名前",
      status: "hidden",
    });
    expect(isOk(r) && [...r.value.changed].sort()).toEqual(["name", "status"]);
  });

  it("居ない節点は見つからないとして断る", async () => {
    const { deps } = depsWith();
    const r = await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), { nodeId: "no" });
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("ハブに上位を付けようとしたら断る", async () => {
    const { deps } = depsWith({ network: [node({ siteSlug: "hub", role: "hub" })] });
    const r = await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_hub",
      parentSlug: "other",
    });
    expect(r.ok).toBe(false);
  });

  it("存在しない親への付け替えは保存せず断る", async () => {
    const { deps, repo } = depsWith({
      network: [
        node({ siteSlug: "hub", role: "hub", parentSlug: null }),
        node({ siteSlug: "sub", role: "sub", parentSlug: "hub" }),
      ],
    });
    const r = await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_sub",
      parentSlug: "missing",
    });
    expect(isErr(r) && r.error.field).toBe("parentSlug");
    expect(repo.store.network.find((row) => row.id === "snn_sub")?.parentSlug).toBe("hub");
  });

  it("子孫を親にする循環は保存せず断る", async () => {
    const { deps, repo } = depsWith({
      network: [
        node({ siteSlug: "hub", role: "hub", parentSlug: null }),
        node({ siteSlug: "sub", role: "sub", parentSlug: "hub" }),
        node({ siteSlug: "mini", role: "mini", parentSlug: "sub" }),
      ],
    });
    const r = await createUpdateSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_sub",
      parentSlug: "mini",
    });
    expect(isErr(r) && r.error.message).toContain("循環");
    expect(repo.store.network.find((row) => row.id === "snn_sub")?.parentSlug).toBe("hub");
  });
});

describe("サイト網からの削除", () => {
  it("理由が無ければ消させない", async () => {
    const { deps } = depsWith({ network: [node({ siteSlug: "hub", role: "hub" })] });
    const r = await createDeleteSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_hub",
      reason: "  ",
    });
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.field).toBe("reason");
  });

  it("参照中の子がある節点は消さず、監査にも成功を残さない", async () => {
    const { deps, repo, audit } = depsWith({
      network: [
        node({ siteSlug: "hub", role: "hub" }),
        node({ siteSlug: "a", parentSlug: "hub" }),
        node({ siteSlug: "b", parentSlug: "hub" }),
      ],
    });
    const r = await createDeleteSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_hub",
      reason: "統合したため",
    });
    expect(isErr(r) && r.error.message).toContain("先に配下");
    expect(repo.store.network.map((n) => n.siteSlug)).toEqual(["hub", "a", "b"]);
    expect(repo.store.deletedNetwork).toEqual([]);
    expect(audit.entries()).toEqual([]);
  });

  it("二重削除は見つからないとして断る", async () => {
    const { deps } = depsWith({
      deletedNetwork: [{ node: node({ siteSlug: "hub", role: "hub" }), deletedAt: NOW }],
    });

    const r = await createDeleteSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: "snn_hub",
      reason: "もう一度",
    });

    expect(isErr(r) && r.error.code).toBe("NOT_FOUND");
  });
});

describe("削除済みサイト網の一覧と復元", () => {
  it("削除済み一覧は通常一覧と分けて返す", async () => {
    const { deps } = depsWith({
      network: [node({ siteSlug: "hub", role: "hub" })],
      deletedNetwork: [
        { node: node({ siteSlug: "old", parentSlug: "hub" }), deletedAt: NOW },
      ],
    });

    const normal = await createListSiteNetworkUseCase(deps).execute(anOwner(), {});
    const deleted = await createListDeletedSiteNetworkUseCase(deps).execute(anOwner(), {});

    expect(isOk(normal) && normal.value.rows.map((row) => row.siteSlug)).toEqual(["hub"]);
    expect(isOk(deleted) && deleted.value.rows.map((row) => row.siteSlug)).toEqual(["old"]);
  });

  it("親が残っていれば同じ ID・URL 名で戻し、監査へ残す", async () => {
    const target = node({ siteSlug: "sub", parentSlug: "hub" });
    const { deps, repo, audit } = depsWith({
      network: [node({ siteSlug: "hub", role: "hub" })],
      deletedNetwork: [{ node: target, deletedAt: daysFrom(NOW, -1) }],
    });

    const r = await createRestoreSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: target.id,
    });

    expect(isOk(r) && r.value).toMatchObject({ nodeId: target.id, siteSlug: "sub" });
    expect(repo.store.network.find((row) => row.id === target.id)?.siteSlug).toBe("sub");
    expect(repo.store.deletedNetwork).toEqual([]);
    expect(audit.actions()).toContain("site_network.restored");
  });

  it("親も削除済みなら戻さず、二重復元も断る", async () => {
    const target = node({ siteSlug: "sub", parentSlug: "hub" });
    const { deps } = depsWith({
      deletedNetwork: [{ node: target, deletedAt: NOW }],
    });
    const missingParent = await createRestoreSiteNetworkNodeUseCase(deps).execute(anOwner(), {
      nodeId: target.id,
    });

    expect(isErr(missingParent) && missingParent.error.field).toBe("parentSlug");

    const { deps: activeDeps } = depsWith({ network: [target] });
    const twice = await createRestoreSiteNetworkNodeUseCase(activeDeps).execute(anOwner(), {
      nodeId: target.id,
    });
    expect(isErr(twice) && twice.error.code).toBe("NOT_FOUND");
  });
});

describe("版面の設定", () => {
  it("保存していない枠も設計図の分だけ全部並ぶ", async () => {
    const { deps } = depsWith();
    const r = await createReadBlogLayoutUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.slots.length).toBe(4 + 8 + 2 + 4);
    expect(isOk(r) && r.value.bands.length).toBe(TOP_BANDS.length);
    expect(isOk(r) && r.value.deliveryParts.length).toBe(DELIVERY_PARTS.length);
    // 何も保存していないので、全部が「未整備」。
    expect(isOk(r) && r.value.untouchedCount).toBe(18 + TOP_BANDS.length + DELIVERY_PARTS.length);
  });

  it("サイドバーの通常枠は 8 種ある（設計図の数を画面が減らせない）", async () => {
    const { deps } = depsWith();
    const r = await createReadBlogLayoutUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.slots.filter((s) => s.region === "sidebar").length).toBe(
      SIDEBAR_SLOT_KEYS.length,
    );
    expect(SIDEBAR_SLOT_KEYS).toHaveLength(8);
  });

  it("領域に無い枠の名前は保存で断る", async () => {
    const { deps } = depsWith();
    const r = await createSaveBlogLayoutSlotUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      region: "footer",
      slotKey: "site-search",
      title: "",
      body: "",
      position: 0,
      enabled: true,
    });
    expect(r.ok).toBe(false);
    if (isErr(r)) expect(r.error.field).toBe("slotKey");
  });

  it("保存した枠は未整備でなくなる", async () => {
    const { deps } = depsWith();
    const saved = await createSaveBlogLayoutSlotUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      region: "sidebar",
      slotKey: "profile-card",
      title: "書き手について",
      body: "",
      position: 5,
      enabled: true,
    });
    expect(saved.ok).toBe(true);
    const read = await createReadBlogLayoutUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    const hit = isOk(read) ? read.value.slots.find((s) => s.slotKey === "profile-card") : undefined;
    expect(hit?.untouched).toBe(false);
    expect(hit?.enabled).toBe(true);
  });

  for (const bad of [-1, 25, 1.5]) {
    it(`帯の件数 ${bad} は断る`, async () => {
      const { deps } = depsWith();
      const r = await createSaveBlogLayoutBandUseCase(deps).execute(anOwner(), {
        siteSlug: "hub",
        band: "latest_posts",
        title: "",
        enabled: true,
        position: 0,
        itemLimit: bad,
      });
      expect(r.ok).toBe(false);
      if (isErr(r)) expect(r.error.field).toBe("itemLimit");
    });
  }

  for (const good of [0, 24]) {
    it(`帯の件数 ${good} は通る（境目）`, async () => {
      const { deps } = depsWith();
      const r = await createSaveBlogLayoutBandUseCase(deps).execute(anOwner(), {
        siteSlug: "hub",
        band: "latest_posts",
        title: "",
        enabled: true,
        position: 0,
        itemLimit: good,
      });
      expect(r.ok).toBe(true);
    });
  }

  it("配信部品は 9 種すべてを設定できる", async () => {
    const { deps, repo } = depsWith();
    for (const part of DELIVERY_PARTS) {
      const r = await createSaveDeliveryPartUseCase(deps).execute(anOwner(), {
        siteSlug: "hub",
        part,
        enabled: true,
        note: "",
        position: 0,
      });
      expect(r.ok).toBe(true);
    }
    expect(repo.store.delivery).toHaveLength(DELIVERY_PARTS.length);
  });

  it("2 度保存しても枠が 2 行に増えない", async () => {
    const { deps, repo } = depsWith();
    const save = createSaveDeliveryPartUseCase(deps);
    const input = { siteSlug: "hub", part: "robots" as const, enabled: true, note: "", position: 0 };
    await save.execute(anOwner(), input);
    await save.execute(anOwner(), { ...input, enabled: false });
    expect(repo.store.delivery).toHaveLength(1);
    expect(repo.store.delivery[0]?.enabled).toBe(false);
  });
});

describe("記事の一覧と閲覧", () => {
  it("古い記事の数を数えて返す", async () => {
    const { deps } = depsWith({
      articles: [
        { article: article({ id: "a1", updatedAt: daysFrom(NOW, -400) }), blocks: [], tagIds: [] },
        { article: article({ id: "a2", updatedAt: NOW }), blocks: [], tagIds: [] },
      ],
    });
    const r = await createListBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.total).toBe(2);
    expect(isOk(r) && r.value.staleCount).toBe(1);
  });

  it("ブログを指定すると、そのブログの記事だけになる", async () => {
    const { deps } = depsWith({
      articles: [
        { article: article({ id: "a1", siteSlug: "hub" }), blocks: [], tagIds: [] },
        { article: article({ id: "a2", siteSlug: "sub" }), blocks: [], tagIds: [] },
      ],
    });
    const r = await createListBlogArticlesUseCase(deps).execute(anOwner(), { siteSlug: "sub" });
    expect(isOk(r) && r.value.rows.map((x) => x.articleId)).toEqual(["a2"]);
  });

  it("1 本を開くと、足りない部品を名前で返す", async () => {
    const { deps } = depsWith({
      articles: [{ article: article({ id: "a1", template: "T1" }), blocks: [], tagIds: [] }],
    });
    const r = await createGetBlogArticleUseCase(deps).execute(anOwner(), { articleId: "a1" });
    expect(isOk(r) && r.value.missing).toHaveLength(7);
    expect(isOk(r) && r.value.missingLabels.length).toBe(7);
  });

  it("本文の部品は位置の順に並ぶ", async () => {
    const { deps } = depsWith({
      articles: [
        {
          article: article({ id: "a1", template: "T4" }),
          blocks: [
            { id: "b2", kind: "comment-form", heading: "後", body: "", position: 2 },
            { id: "b1", kind: "intro-box", heading: "先", body: "", position: 0 },
          ],
          tagIds: [],
        },
      ],
    });
    const r = await createGetBlogArticleUseCase(deps).execute(anOwner(), { articleId: "a1" });
    expect(isOk(r) && r.value.blocks.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(isOk(r) && r.value.missing).toEqual([]);
  });

  it("居ない記事は見つからないとして断る", async () => {
    const { deps } = depsWith();
    const r = await createGetBlogArticleUseCase(deps).execute(anOwner(), { articleId: "no" });
    expect(isErr(r) && r.error.code).toBe("NOT_FOUND");
  });
});

describe("記事の作成・変更・削除", () => {
  it("作った直後は下書きで、要る部品を全部返す", async () => {
    const { deps, repo } = depsWith();
    const r = await createCreateBlogArticleUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "how-to-choose",
      template: "T1",
      title: "選び方",
      lead: "",
      authorName: "編集部",
    });
    expect(isOk(r) && r.value.requiredBlocks).toHaveLength(7);
    expect(repo.store.articles[0]?.article.status).toBe("draft");
    expect(repo.store.articles[0]?.article.publishedAt).toBeNull();
  });

  it("同じブログに同じ URL 名の記事を 2 本置けない", async () => {
    const { deps } = depsWith({
      articles: [{ article: article({ id: "a1", siteSlug: "hub", slug: "dup" }), blocks: [], tagIds: [] }],
    });
    const r = await createCreateBlogArticleUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "dup",
      template: "T4",
      title: "別の記事",
      lead: "",
      authorName: "編集部",
    });
    expect(isErr(r) && r.error.field).toBe("slug");
  });

  it("削除済みの記事 URL を新規作成で横取りできない", async () => {
    const deleted = { article: article({ id: "old", slug: "reserved" }), blocks: [], tagIds: [] };
    const { deps } = depsWith({
      deletedArticles: [{ ...deleted, deletedAt: NOW }],
    });
    const r = await createCreateBlogArticleUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "reserved",
      template: "T4",
      title: "別の記事",
      lead: "",
      authorName: "編集部",
    });

    expect(isErr(r) && r.error.field).toBe("slug");
  });

  it("題名が空なら断る", async () => {
    const { deps } = depsWith();
    const r = await createCreateBlogArticleUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "ok",
      template: "T4",
      title: "  ",
      lead: "",
      authorName: "編集部",
    });
    expect(isErr(r) && r.error.field).toBe("title");
  });

  it("部品が欠けたままでも下書きなら保存できる", async () => {
    const { deps } = depsWith({
      articles: [{ article: article({ id: "a1", template: "T1" }), blocks: [], tagIds: [] }],
    });
    const r = await createUpdateBlogArticleUseCase(deps).execute(aWriter(), {
      articleId: "a1",
      status: "draft",
      title: "途中まで",
    });
    expect(r.ok).toBe(true);
    expect(isOk(r) && r.value.missing.length).toBe(7);
  });

  it("部品が欠けたままの公開だけを断る", async () => {
    const { deps } = depsWith({
      articles: [{ article: article({ id: "a1", template: "T1" }), blocks: [], tagIds: [] }],
    });
    const r = await createUpdateBlogArticleUseCase(deps).execute(aWriter(), {
      articleId: "a1",
      status: "published",
    });
    expect(isErr(r) && r.error.field).toBe("blocks");
  });

  it("部品が揃えば公開でき、公開日が入る", async () => {
    const blocks = [
      { kind: "intro-box" as const, heading: "はじめに", body: "" },
      { kind: "hierarchical-toc" as const, heading: "目次", body: "" },
    ];
    const { deps, repo } = depsWith({
      articles: [{ article: article({ id: "a1", template: "T3" }), blocks: [], tagIds: [] }],
    });
    const r = await createUpdateBlogArticleUseCase(deps).execute(aWriter(), {
      articleId: "a1",
      status: "published",
      blocks,
    });
    expect(r.ok).toBe(true);
    expect(repo.store.articles[0]?.article.publishedAt).toEqual(NOW);
  });

  it("2 度目の公開で公開日を書き換えない", async () => {
    const first = daysFrom(NOW, -30);
    const { deps, repo } = depsWith({
      articles: [
        {
          article: article({ id: "a1", template: "T4", status: "published", publishedAt: first }),
          blocks: [{ id: "b1", kind: "intro-box", heading: "", body: "", position: 0 }],
          tagIds: [],
        },
      ],
    });
    const r = await createUpdateBlogArticleUseCase(deps).execute(aWriter(), {
      articleId: "a1",
      title: "題名を直した",
    });
    expect(r.ok).toBe(true);
    expect(repo.store.articles[0]?.article.publishedAt).toEqual(first);
  });

  it("理由の無い削除は断る", async () => {
    const { deps } = depsWith({
      articles: [{ article: article({ id: "a1" }), blocks: [], tagIds: [] }],
    });
    const r = await createDeleteBlogArticleUseCase(deps).execute(aWriter(), {
      articleId: "a1",
      reason: "",
    });
    expect(isErr(r) && r.error.field).toBe("reason");
  });

  it("理由を書けば通常一覧から外れ、部品とタグを保ったまま記録が残る", async () => {
    const { deps, repo, audit } = depsWith({
      articles: [{
        article: article({ id: "a1", title: "消す記事" }),
        blocks: [{ id: "b1", kind: "intro-box", heading: "", body: "本文", position: 0 }],
        tagIds: ["tag-1"],
      }],
    });
    const r = await createDeleteBlogArticleUseCase(deps).execute(aWriter(), {
      articleId: "a1",
      reason: "内容が重複したため",
    });
    expect(isOk(r) && r.value.title).toBe("消す記事");
    expect(repo.store.articles).toHaveLength(0);
    expect(repo.store.deletedArticles[0]).toMatchObject({
      article: { id: "a1", slug: "a1" },
      blocks: [{ id: "b1", body: "本文" }],
      tagIds: ["tag-1"],
    });
    expect(audit.actions()).toContain("blog_article.deleted");
  });
});

describe("削除済み記事の一覧と復元", () => {
  const deletedDetail = {
    article: article({ id: "a1", siteSlug: "hub", slug: "same-address", title: "戻す記事" }),
    blocks: [{ id: "b1", kind: "intro-box" as const, heading: "", body: "本文", position: 0 }],
    tagIds: ["tag-1"],
  };

  it("作成者が削除済み一覧を通常一覧と分けて見られる", async () => {
    const { deps } = depsWith({
      deletedArticles: [{ ...deletedDetail, deletedAt: NOW }],
    });

    const normal = await createListBlogArticlesUseCase(deps).execute(aWriter(), { siteSlug: "hub" });
    const deleted = await createListDeletedBlogArticlesUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
    });

    expect(isOk(normal) && normal.value.total).toBe(0);
    expect(isOk(deleted) && deleted.value.rows[0]).toMatchObject({
      articleId: "a1",
      slug: "same-address",
    });
  });

  it("元のサイトと URL が使えるとき、同じ ID・URL と部品で戻す", async () => {
    const { deps, repo, audit } = depsWith({
      network: [node({ siteSlug: "hub", role: "hub" })],
      deletedArticles: [{ ...deletedDetail, deletedAt: daysFrom(NOW, -1) }],
    });

    const r = await createRestoreBlogArticleUseCase(deps).execute(aWriter(), { articleId: "a1" });

    expect(isOk(r) && r.value).toMatchObject({ articleId: "a1", slug: "same-address" });
    expect(repo.store.articles[0]).toMatchObject({
      article: { id: "a1", slug: "same-address" },
      blocks: [{ id: "b1", body: "本文" }],
      tagIds: ["tag-1"],
    });
    expect(audit.actions()).toContain("blog_article.restored");
  });

  it("元サイトが削除済み・URL 競合・二重復元は fail-closed", async () => {
    const { deps: missingSite } = depsWith({
      deletedArticles: [{ ...deletedDetail, deletedAt: NOW }],
    });
    const noSite = await createRestoreBlogArticleUseCase(missingSite).execute(aWriter(), {
      articleId: "a1",
    });
    expect(isErr(noSite) && noSite.error.field).toBe("siteSlug");

    const { deps: duplicate } = depsWith({
      network: [node({ siteSlug: "hub", role: "hub" })],
      articles: [{ ...deletedDetail, article: article({ id: "other", slug: "same-address" }) }],
      deletedArticles: [{ ...deletedDetail, deletedAt: NOW }],
    });
    const conflict = await createRestoreBlogArticleUseCase(duplicate).execute(aWriter(), {
      articleId: "a1",
    });
    expect(isErr(conflict) && conflict.error.field).toBe("slug");

    const { deps: active } = depsWith({ articles: [deletedDetail] });
    const twice = await createRestoreBlogArticleUseCase(active).execute(aWriter(), {
      articleId: "a1",
    });
    expect(isErr(twice) && twice.error.code).toBe("NOT_FOUND");
  });

  it("別 workspace からは削除済み一覧も復元対象も見えない", async () => {
    const { deps } = depsWith({
      network: [node({ siteSlug: "hub", role: "hub" })],
      deletedArticles: [{ ...deletedDetail, deletedAt: NOW }],
    });

    const list = await createListDeletedBlogArticlesUseCase(deps).execute(anOutsider(), {});
    const restore = await createRestoreBlogArticleUseCase(deps).execute(anOutsider(), {
      articleId: "a1",
    });

    expect(isOk(list) && list.value.total).toBe(0);
    expect(isErr(restore) && restore.error.code).toBe("NOT_FOUND");
  });
});

describe("固定ページ", () => {
  it("8 種を必ず並べ、無いものに印を立てる", async () => {
    const { deps } = depsWith();
    const r = await createListFixedPagesUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.pages.length).toBe(FIXED_PAGE_KINDS.length);
    expect(FIXED_PAGE_KINDS).toHaveLength(8);
    expect(isOk(r) && r.value.missingCount).toBe(8);
    expect(isOk(r) && r.value.launchBlockedReason).not.toBeNull();
  });

  it("無いページを既定文で埋めない", async () => {
    const { deps } = depsWith();
    const r = await createListFixedPagesUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.pages.every((p) => p.title === "" && p.body === "")).toBe(true);
  });

  it("8 種が揃えば公開を止める理由が消える", async () => {
    const { deps } = depsWith();
    const save = createSaveFixedPageUseCase(deps);
    for (const kind of FIXED_PAGE_KINDS) {
      const r = await save.execute(anOwner(), {
        siteSlug: "hub",
        kind,
        title: "題名",
        body: "本文",
        status: "published",
      });
      expect(r.ok).toBe(true);
    }
    const r = await createListFixedPagesUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.missingCount).toBe(0);
    expect(isOk(r) && r.value.launchBlockedReason).toBeNull();
  });

  it("題名か本文が空なら保存を断る", async () => {
    const { deps } = depsWith();
    const save = createSaveFixedPageUseCase(deps);
    const noTitle = await save.execute(anOwner(), { siteSlug: "hub", kind: "contact", title: " ", body: "本文", status: "draft" });
    const noBody = await save.execute(anOwner(), { siteSlug: "hub", kind: "contact", title: "題名", body: " ", status: "draft" });
    expect(isErr(noTitle) && noTitle.error.field).toBe("title");
    expect(isErr(noBody) && noBody.error.field).toBe("body");
  });

  it("同じ種類を 2 度保存しても 2 枚に増えない", async () => {
    const { deps, repo } = depsWith();
    const save = createSaveFixedPageUseCase(deps);
    await save.execute(anOwner(), { siteSlug: "hub", kind: "contact", title: "1", body: "1", status: "draft" });
    await save.execute(anOwner(), { siteSlug: "hub", kind: "contact", title: "2", body: "2", status: "published" });
    expect(repo.store.pages).toHaveLength(1);
    expect(repo.store.pages[0]?.title).toBe("2");
  });

  it("理由の無い削除は断り、無いページの削除は見つからないとして断る", async () => {
    const { deps } = depsWith();
    const del = createDeleteFixedPageUseCase(deps);
    const noReason = await del.execute(anOwner(), { siteSlug: "hub", kind: "contact", reason: "" });
    expect(isErr(noReason) && noReason.error.field).toBe("reason");
    const missing = await del.execute(anOwner(), { siteSlug: "hub", kind: "contact", reason: "廃止" });
    expect(isErr(missing) && missing.error.code).toBe("NOT_FOUND");
  });

  it("削除後も本文と公開状態を保って別一覧に出し、保存では暗黙復活しない", async () => {
    const page: FixedPageRecord = {
      id: "page-contact",
      siteSlug: "hub",
      kind: "contact",
      title: "問い合わせ",
      body: "保存してある本文",
      status: "published",
      deletedAt: null,
      updatedAt: NOW,
    };
    const { deps, repo } = depsWith({ pages: [page] });
    const deleted = await createDeleteFixedPageUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      kind: "contact",
      reason: "内容を見直すため",
    });
    expect(deleted.ok).toBe(true);

    const list = await createListDeletedFixedPagesUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
    });
    expect(isOk(list) && list.value.pages[0]).toMatchObject({
      pageId: page.id,
      title: page.title,
      body: page.body,
      status: page.status,
    });

    const save = await createSaveFixedPageUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      kind: "contact",
      title: "上書き",
      body: "上書き本文",
      status: "draft",
    });
    expect(isErr(save) && save.error.code).toBe("CONFLICT");
    expect(repo.store.deletedPages[0]).toMatchObject({ title: page.title, body: page.body });
  });

  it("所有者だけが同じID・本文・公開状態で明示復元でき、二重復元を断る", async () => {
    const page: FixedPageRecord = {
      id: "page-profile",
      siteSlug: "hub",
      kind: "profile",
      title: "運営者",
      body: "元の本文",
      status: "published",
      deletedAt: NOW,
      updatedAt: daysFrom(NOW, -1),
    };
    const { deps, repo, audit } = depsWith({ deletedPages: [page] });
    const outsider = await createRestoreFixedPageUseCase(deps).execute(anOutsider(), {
      siteSlug: "hub",
      pageId: page.id,
    });
    expect(isErr(outsider) && outsider.error.code).toBe("NOT_FOUND");

    const restored = await createRestoreFixedPageUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      pageId: page.id,
    });
    expect(isOk(restored) && restored.value.pageId).toBe(page.id);
    expect(repo.store.pages[0]).toMatchObject({
      id: page.id,
      title: page.title,
      body: page.body,
      status: page.status,
      deletedAt: null,
    });
    expect(audit.actions()).toContain("blog_page.restored");

    const twice = await createRestoreFixedPageUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
      pageId: page.id,
    });
    expect(isErr(twice) && twice.error.code).toBe("NOT_FOUND");
  });
});

describe("タグ", () => {
  it("1 件も無ければ、サイドバーが空になることを言葉で返す", async () => {
    const { deps } = depsWith();
    const r = await createListBlogTagsUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.emptyReason).not.toBeNull();
  });

  it("URL 名の重なるタグは断る", async () => {
    const { deps } = depsWith({
      tags: [
        { id: "t1", siteSlug: "hub", slug: "camera", name: "カメラ", description: "", kind: "topic" as const },
      ],
    });
    const r = await createSaveBlogTagUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "camera",
      name: "べつのカメラ",
      description: "",
      kind: "topic",
    });
    expect(isErr(r) && r.error.field).toBe("slug");
  });

  it("自分自身の URL 名は重なりとして数えない（名前だけ直せる）", async () => {
    const { deps, repo } = depsWith({
      tags: [
        { id: "t1", siteSlug: "hub", slug: "camera", name: "カメラ", description: "", kind: "topic" as const },
      ],
    });
    const r = await createSaveBlogTagUseCase(deps).execute(aWriter(), {
      tagId: "t1",
      siteSlug: "hub",
      slug: "camera",
      name: "カメラ機材",
      description: "",
      kind: "topic",
    });
    expect(r.ok).toBe(true);
    expect(repo.store.tags).toHaveLength(1);
    expect(repo.store.tags[0]?.name).toBe("カメラ機材");
  });

  it("表示名が空なら断る", async () => {
    const { deps } = depsWith();
    const r = await createSaveBlogTagUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "camera",
      name: "  ",
      description: "",
      kind: "topic",
    });
    expect(isErr(r) && r.error.field).toBe("name");
  });

  it("理由を書けば消せる", async () => {
    const { deps, repo } = depsWith({
      tags: [
        { id: "t1", siteSlug: "hub", slug: "camera", name: "カメラ", description: "", kind: "topic" as const },
      ],
    });
    const noReason = await createDeleteBlogTagUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      tagId: "t1",
      reason: " ",
    });
    expect(noReason.ok).toBe(false);
    const r = await createDeleteBlogTagUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      tagId: "t1",
      reason: "使わなくなったため",
    });
    expect(isOk(r) && r.value.name).toBe("カメラ");
    expect(repo.store.tags).toHaveLength(0);
  });

  it("種類を選ばずに送ると断る（既定を勝手に決めない）", async () => {
    // **省略を許すと、画面が種類を送り忘れた日に保存だけが通る。**
    // 枠（サイドバーのブランド一覧）の中身が静かに変わり、
    // 運営者は読者の画面を開くまで気づけない。だから断って気づかせる。
    const { deps } = depsWith();
    const r = await createSaveBlogTagUseCase(deps).execute(aWriter(), {
      siteSlug: "hub",
      slug: "camera",
      name: "カメラ",
      description: "",
      kind: "",
    });
    expect(isErr(r) && r.error.field).toBe("kind");
  });

  it("ブランドが 1 件も無ければ、枠が空になることを言葉で返す", async () => {
    // 総数だけでは「タグはあるのに枠は空」を運営者が判別できない。
    const { deps } = depsWith({
      tags: [
        { id: "t1", siteSlug: "hub", slug: "camera", name: "カメラ", description: "", kind: "topic" as const },
      ],
    });
    const r = await createListBlogTagsUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.total).toBe(1);
    expect(isOk(r) && r.value.brandCount).toBe(0);
    expect(isOk(r) && r.value.emptyReason).not.toBeNull();
  });

  it("ブランドがあれば brandCount がその数になり、言葉は出ない", async () => {
    const { deps } = depsWith({
      tags: [
        { id: "t1", siteSlug: "hub", slug: "camera", name: "カメラ", description: "", kind: "topic" as const },
        { id: "t2", siteSlug: "hub", slug: "north", name: "ノース工房", description: "", kind: "brand" as const },
      ],
    });
    const r = await createListBlogTagsUseCase(deps).execute(anOwner(), { siteSlug: "hub" });
    expect(isOk(r) && r.value.total).toBe(2);
    expect(isOk(r) && r.value.brandCount).toBe(1);
    expect(isOk(r) && r.value.emptyReason).toBeNull();
  });
});

describe("記事の評価の一覧", () => {
  function evalDeps(seed: Partial<Store>) {
    const repo = fakeRepository(seed);
    return { repository: repo.port, now: () => NOW };
  }

  it("票が 1 つも無い記事の平均は 0 ではなく null", async () => {
    const deps = evalDeps({
      articles: [{ article: article({ id: "a1" }), blocks: [], tagIds: [] }],
    });
    const r = await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.rows[0]?.ratingAverage).toBeNull();
    expect(isOk(r) && r.value.rows[0]?.ratingCount).toBe(0);
  });

  it("票が 5 件に満たないうちは、平均が低くても目安を出さない", async () => {
    const deps = evalDeps({
      articles: [{ article: article({ id: "a1", updatedAt: NOW }), blocks: [], tagIds: [] }],
      ratings: { a1: { count: 4, average: 1.5 } },
    });
    const r = await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.rows[0]?.attentionReason).toBeNull();
    expect(isOk(r) && r.value.attentionCount).toBe(0);
  });

  it("票が 5 件そろって平均が 3 を下回ると目安を出す", async () => {
    const deps = evalDeps({
      articles: [{ article: article({ id: "a1", updatedAt: NOW }), blocks: [], tagIds: [] }],
      ratings: { a1: { count: 5, average: 2.8 } },
    });
    const r = await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.rows[0]?.attentionReason).toContain("2.8");
  });

  it("平均 3 ちょうどでは目安を出さない（境目）", async () => {
    const deps = evalDeps({
      articles: [{ article: article({ id: "a1", updatedAt: NOW }), blocks: [], tagIds: [] }],
      ratings: { a1: { count: 9, average: 3 } },
    });
    const r = await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.rows[0]?.attentionReason).toBeNull();
  });

  it("1 年以上更新が無ければ、票と関係なく目安を出す", async () => {
    const deps = evalDeps({
      articles: [{ article: article({ id: "a1", updatedAt: daysFrom(NOW, -400) }), blocks: [], tagIds: [] }],
      ratings: { a1: { count: 20, average: 5 } },
    });
    const r = await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.rows[0]?.attentionReason).toContain("1 年以上");
  });

  it("半年以上更新が無く票も 0 なら、届いているかを問う", async () => {
    const deps = evalDeps({
      articles: [{ article: article({ id: "a1", updatedAt: daysFrom(NOW, -200) }), blocks: [], tagIds: [] }],
    });
    const r = await createEvaluateBlogArticlesUseCase(deps).execute(anOwner(), {});
    expect(isOk(r) && r.value.rows[0]?.attentionReason).toContain("読者に届いているか");
  });

  it("報酬に関わるポートを渡すと、組み立ての時点で止まる", () => {
    const repo = fakeRepository();
    expect(() =>
      createEvaluateBlogArticlesUseCase({
        repository: repo.port,
        now: () => NOW,
        // 報酬額の入る口を評価の並び順へ持ち込ませない。
        // 印を付けた偽物でないと素通りする（印そのものが検査の目印）。
        affiliateLinks: markCommercial({ listByProduct: async () => ok([]) }) as never,
      }),
    ).toThrow(/商業データ/);
  });
});

describe("読者の評価の受け取り", () => {
  function ratingDeps(seed: {
    readonly published?: boolean;
    readonly summary?: RatingSummary;
  } = {}) {
    const puts: unknown[] = [];
    const detail: BlogArticleDetail = {
      article: article({
        id: "a1",
        siteSlug: "hub",
        slug: "review",
        status: seed.published === false ? "draft" : "published",
      }),
      blocks: [],
      tagIds: [],
    };
    return {
      puts,
      deps: {
        ratings: {
          put: async (input: unknown) => {
            puts.push(input);
            return ok(true as const);
          },
          summarize: async () => ok(seed.summary ?? { count: 1, average: 5 }),
        },
        publicBlog: {
          openSite: async (siteSlug: string) =>
            ok(siteSlug !== "hub" ? null : {
              blueprint: {} as never,
              findArticleBySlug: async (slug: string) => ok(slug === "review" ? detail : null),
              listPublished: async () => ok([]),
              listLayoutSlots: async () => ok([]),
              listLayoutBands: async () => ok([]),
              listDeliveryParts: async () => ok([]),
              listNetwork: async () => ok([]),
              listTags: async () => ok([]),
              listFixedPages: async () => ok([]),
            }),
        },
        ids: sequentialIds(),
        now: () => NOW,
      },
    };
  }

  const base = {
    siteSlug: "hub",
    articleSlug: "review",
    readerKey: "reader-1",
    score: 5,
    comment: null,
  };

  it("権限を 1 つも持たない人でも押せる（読者は誰でも押す）", async () => {
    const { deps } = ratingDeps();
    const r = await createSubmitArticleRatingUseCase(deps).execute(aNobody(), base);
    expect(r.ok).toBe(true);
  });

  it("1 から 5 の外は断る", async () => {
    const { deps } = ratingDeps();
    const use = createSubmitArticleRatingUseCase(deps);
    for (const score of [0, 6, 2.5]) {
      const r = await use.execute(aNobody(), { ...base, score });
      expect(isErr(r) && r.error.field).toBe("score");
    }
  });

  it("読者の鍵が空なら、二重投票を止められないので断る", async () => {
    const { deps } = ratingDeps();
    const r = await createSubmitArticleRatingUseCase(deps).execute(aNobody(), {
      ...base,
      readerKey: "  ",
    });
    expect(isErr(r)).toBe(true);
    /*
     * **欄の名前を付けない**ことを固定する。
     *
     * `FormResult` は `field` が付いた断りを出さない約束で、欄の側が出すことになっている
     * (`src/presentation/ui/patterns/form-result.tsx`)。`readerKey` は端末の目印で、
     * 読者が触れる欄ではない。名前を付けると出す担当が誰もいなくなり、
     * 断りは正しく作られたまま画面に届かない (2026-08-26 に実測)。
     */
    expect(isErr(r) && r.error.field).toBeUndefined();
  });

  it("公開していない記事には付けられない", async () => {
    const { deps } = ratingDeps({ published: false });
    const r = await createSubmitArticleRatingUseCase(deps).execute(aNobody(), base);
    expect(isErr(r) && r.error.code).toBe("NOT_FOUND");
  });

  it("居ない記事には付けられない", async () => {
    const { deps } = ratingDeps();
    const r = await createSubmitArticleRatingUseCase(deps).execute(aNobody(), {
      ...base,
      articleSlug: "no-such",
    });
    expect(isErr(r) && r.error.code).toBe("NOT_FOUND");
  });

  it("空の一言は null として置く（空文字を本文として残さない）", async () => {
    const { deps, puts } = ratingDeps();
    await createSubmitArticleRatingUseCase(deps).execute(aNobody(), { ...base, comment: "   " });
    expect((puts[0] as { comment: string | null }).comment).toBeNull();
  });

  it("押した後の件数と平均を返す", async () => {
    const { deps } = ratingDeps({ summary: { count: 3, average: 4.7 } });
    const r = await createSubmitArticleRatingUseCase(deps).execute(aNobody(), base);
    expect(isOk(r) && r.value).toEqual({ count: 3, average: 4.7 });
  });

  it("記事を書き換える口を渡していない（読者の操作で本文が変わらない）", () => {
    const { deps } = ratingDeps();
    expect(Object.keys(deps).sort()).toEqual(["ids", "now", "publicBlog", "ratings"]);
  });
});

/* ==========================================================================
 * 受入条件 A11: 運営者が票を伏せられる／伏せた票は公開面に出ない
 * ========================================================================== */

describe("読者の評価を伏せる", () => {
  /** 票 1 件。伏せていない状態を既定にする。 */
  const vote = (over: Partial<ArticleRating> & { id: string }): ArticleRating => ({
    articleId: "a1",
    readerKey: `rk_${over.id}`,
    score: 5,
    comment: null,
    hidden: false,
    createdAt: NOW,
    ...over,
  });

  const seeded = () =>
    depsWith({
      votes: [
        vote({ id: "brt_1", score: 5, comment: "参考になった" }),
        vote({ id: "brt_2", score: 1, comment: "宣伝の書き込み" }),
        vote({ id: "brt_3", score: 4, articleId: "a2" }),
      ],
    });

  it("その記事の票だけを、伏せたものも含めて返す", async () => {
    const { deps } = seeded();
    const r = await createListArticleRatingsUseCase(deps).execute(anOwner(), { articleId: "a1" });
    expect(isOk(r) && r.value.rows.map((x) => x.id)).toEqual(["brt_1", "brt_2"]);
    expect(isOk(r) && r.value.shownCount).toBe(2);
    expect(isOk(r) && r.value.hiddenCount).toBe(0);
  });

  it("伏せると、行は残ったまま印だけが変わる", async () => {
    const { deps, repo } = seeded();
    const r = await createSetArticleRatingHiddenUseCase(deps).execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: true,
      reason: "本文と関係のない宣伝",
    });
    expect(isOk(r)).toBe(true);
    // **消えていない。**「伏せた」と「最初から無かった」を別のものとして残す。
    const kept = repo.store.votes;
    expect(kept.map((v) => v.id)).toEqual(["brt_1", "brt_2", "brt_3"]);
    expect(kept.find((v) => v.id === "brt_2")?.hidden).toBe(true);
  });

  it("伏せた票は一覧で伏せた数に数えられる", async () => {
    const { deps } = seeded();
    await createSetArticleRatingHiddenUseCase(deps).execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: true,
      reason: "宣伝",
    });
    const r = await createListArticleRatingsUseCase(deps).execute(anOwner(), { articleId: "a1" });
    expect(isOk(r) && r.value.shownCount).toBe(1);
    expect(isOk(r) && r.value.hiddenCount).toBe(1);
  });

  it("戻すこともできる（片道ではない）", async () => {
    const { deps, repo } = seeded();
    const use = createSetArticleRatingHiddenUseCase(deps);
    await use.execute(anOwner(), { articleId: "a1", ratingId: "brt_2", hidden: true, reason: "宣伝" });
    await use.execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: false,
      reason: "見直した結果、宣伝ではなかった",
    });
    expect(repo.store.votes.find((v) => v.id === "brt_2")?.hidden).toBe(false);
  });

  it("理由が空なら断る", async () => {
    const { deps, repo } = seeded();
    const r = await createSetArticleRatingHiddenUseCase(deps).execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: true,
      reason: "   ",
    });
    expect(isErr(r) && r.error.code).toBe("VALIDATION_FAILED");
    // 断ったのだから、印も変わっていない。
    expect(repo.store.votes.find((v) => v.id === "brt_2")?.hidden).toBe(false);
  });

  it("別の記事の票の id を渡しても伏せられない", async () => {
    const { deps, repo } = seeded();
    const r = await createSetArticleRatingHiddenUseCase(deps).execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_3", // これは a2 の票
      hidden: true,
      reason: "宣伝",
    });
    expect(isErr(r) && r.error.code).toBe("NOT_FOUND");
    expect(repo.store.votes.find((v) => v.id === "brt_3")?.hidden).toBe(false);
  });

  it("権限の無い人は伏せられない", async () => {
    const { deps } = seeded();
    const r = await createSetArticleRatingHiddenUseCase(deps).execute(aNobody(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: true,
      reason: "宣伝",
    });
    expect(isErr(r) && r.error.code).toBe("FORBIDDEN");
  });

  it("伏せた／戻したことが記録に残る", async () => {
    const { deps, audit } = seeded();
    await createSetArticleRatingHiddenUseCase(deps).execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: true,
      reason: "本文と関係のない宣伝",
    });
    const last = audit.entries().at(-1);
    expect(last?.action).toBe("blog_rating.hidden");
    expect(last?.targetType).toBe("blog_article_rating");
    expect(last?.targetId).toBe("brt_2");
    // **理由は理由の欄に残る。**`after`（操作の後の状態）に混ぜると、
    // 理由が必須かどうかを機械（`REASON_REQUIRED`）が見られなくなる。
    expect(last?.reason).toBe("本文と関係のない宣伝");
  });

  it("記録が書けなかったときに「伏せました」で終わらせない", async () => {
    const { deps, repo } = seeded();
    // 記録の置き場だけを、必ず断る側へ差し替える。
    const failing = { ...deps, auditLog: createUnavailableAuditLog() };
    const r = await createSetArticleRatingHiddenUseCase(failing).execute(anOwner(), {
      articleId: "a1",
      ratingId: "brt_2",
      hidden: true,
      reason: "宣伝",
    });
    expect(isErr(r) && r.error.code).toBe("UPSTREAM_UNAVAILABLE");
    // **印は付いたままにする。**戻すと、押した人には「効かなかった」に見えるのに
    // 実際は効いている、という食い違いが起きうる。効いたことは事実として残し、
    // 記録が無いことを文面で言う。
    expect(repo.store.votes.find((v) => v.id === "brt_2")?.hidden).toBe(true);
  });
});

/**
 * 受入 A9。設定の表と点検結果の表を分けたことが、使う側から見て
 * 「入になっているのに出せていない」を言い分けられるところまで届いているか。
 */
describe("配信物の点検 (A9)", () => {
  const CHECK = {
    siteSlug: "hub",
    siteName: "見本の道具帳",
    purpose: "置き場所から道具を選ぶための案内。",
    origin: "https://example.test",
    basePath: "/s/hub",
    emitLlmsTxt: true,
  } as const;

  function withPublished() {
    return depsWith({
      articles: [
        {
          article: article({ id: "a1", slug: "stand-a1", status: "published" }),
          blocks: [],
          tagIds: [],
        },
      ],
    });
  }

  it("押すと 9 種ぶんの結果が積まれる", async () => {
    const { deps, repo } = withPublished();
    const r = await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), CHECK);

    expect(isOk(r) && r.value.checked).toBe(DELIVERY_PARTS.length);
    expect(repo.store.snapshots).toHaveLength(DELIVERY_PARTS.length);
    // 結果はすべて同じ時刻を持つ。1 回の点検が 1 組であることが読めなくなるため。
    expect(new Set(repo.store.snapshots.map((s) => s.checkedAt.getTime())).size).toBe(1);
  });

  it("二度押しても前の結果を消さず、履歴として積み上がる", async () => {
    const { deps, repo } = withPublished();
    await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), CHECK);
    await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), CHECK);

    expect(repo.store.snapshots).toHaveLength(DELIVERY_PARTS.length * 2);
  });

  it("一覧は最新の 1 組だけを見せ、欠落はそこから数える", async () => {
    const { deps } = withPublished();
    await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), CHECK);

    const layout = await createReadBlogLayoutUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
    });
    expect(isOk(layout) && layout.value.deliveryHealth).toHaveLength(DELIVERY_PARTS.length);
    expect(isOk(layout) && layout.value.deliveryHealth.every((row) => row.state === "ok")).toBe(
      true,
    );
  });

  it("一度も点検していないブログは、一覧で 9 種すべてが「まだ点検していない」", async () => {
    const { deps } = withPublished();
    const layout = await createReadBlogLayoutUseCase(deps).execute(anOwner(), {
      siteSlug: "hub",
    });

    expect(
      isOk(layout) && layout.value.deliveryHealth.every((row) => row.state === "unchecked"),
    ).toBe(true);
  });

  it("公開していない記事は数に入れない（下書きで sitemap を緑にしない）", async () => {
    const { deps, repo } = depsWith({
      articles: [
        { article: article({ id: "a1", slug: "draft", status: "draft" }), blocks: [], tagIds: [] },
      ],
    });
    const r = await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), CHECK);

    expect(isOk(r) && r.value.missing).toContain("sitemap_index");
    expect(repo.store.snapshots.find((s) => s.part === "sitemap_index")?.ok).toBe(false);
  });

  it("住所の起点が無いまま点検させない", async () => {
    const { deps, repo } = withPublished();
    const r = await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), {
      ...CHECK,
      origin: "  ",
    });

    expect(isErr(r) && r.error.code).toBe("VALIDATION_FAILED");
    // 断ったのだから、結果も 1 件も積まない。
    expect(repo.store.snapshots).toStrictEqual([]);
  });

  it("設定を触る権限が無い人は点検できない", async () => {
    const { deps } = withPublished();
    const r = await createCheckBlogDeliveryUseCase(deps).execute(aWriter(), CHECK);
    expect(isErr(r) && r.error.code).toBe("FORBIDDEN");
  });

  it("点検したことが記録に残る", async () => {
    const { deps, audit } = withPublished();
    await createCheckBlogDeliveryUseCase(deps).execute(anOwner(), CHECK);

    const last = audit.entries().at(-1);
    expect(last?.action).toBe("blog_delivery.checked");
    expect(last?.targetType).toBe("blog_delivery_snapshot");
    expect(last?.targetId).toBe("hub");
  });
});
