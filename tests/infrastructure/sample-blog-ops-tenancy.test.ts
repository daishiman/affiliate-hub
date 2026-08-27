/**
 * @tier 1
 * @req REQ-BOPS01, REQ-BOPS04, REQ-BOPS05, REQ-BOPS06, REQ-BOPS08, REQ-BOPS09, REQ-BOPS14
 * @types tenant-isolation, state-transition
 *
 * D1 が無い実行でも、見本の保存先が他 workspace の既知 ID を操作可能にしてはいけない。
 */
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceId } from "@/domain/shared";
import {
  BLOG_OPS_SAMPLE_ROUTE_IDS,
  createSampleArticleRatingPort,
  createSampleBlogOpsRepository,
  createSamplePublicBlogPort,
} from "@/infrastructure/persistence/sample/blog-ops-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import {
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  createSampleSiteRepository,
} from "@/infrastructure/persistence/sample/site-sample-repository";

const OWNER = SAMPLE_WORKSPACE_ID as WorkspaceId;
const OUTSIDER = "ws_sample_blog_outsider" as WorkspaceId;
const AT = new Date("2026-08-26T03:00:00.000Z");

describe("見本ブログ保存先の workspace 境界", () => {
  it("hidden のサイトは公開identityを開かない", async () => {
    const repo = createSampleBlogOpsRepository();
    const publicBlog = createSamplePublicBlogPort(createSampleSiteRepository());
    const nodes = await repo.listNetwork(OWNER);
    const target = nodes.ok
      ? nodes.value.find((node) => node.siteSlug === SECOND_SITE_SLUG)
      : undefined;
    if (target === undefined) throw new Error("非公開にする見本サイトがありません。");
    expect((await repo.saveNetworkNode(OWNER, { ...target, status: "hidden" })).ok).toBe(true);

    try {
      const opened = await publicBlog.openSite(SECOND_SITE_SLUG);
      expect(opened.ok && opened.value).toBeNull();
    } finally {
      await repo.saveNetworkNode(OWNER, { ...target, status: "active" });
    }
  });

  it("公開identityをrequestごとに一度だけ解決し、削除中は閉じて同じURLへ戻る", async () => {
    const repo = createSampleBlogOpsRepository();
    const sites = createSampleSiteRepository();
    const findBySlug = vi.spyOn(sites, "findBySlug");
    const publicBlog = createSamplePublicBlogPort(sites);
    const opened = await publicBlog.openSite(SECOND_SITE_SLUG);
    expect(opened.ok && opened.value).not.toBeNull();
    if (!opened.ok || opened.value === null) return;
    await Promise.all([
      opened.value.listPublished(10),
      opened.value.listLayoutSlots(),
      opened.value.listLayoutBands(),
      opened.value.listDeliveryParts(),
      opened.value.listNetwork(),
      opened.value.listTags(),
      opened.value.listFixedPages(),
      opened.value.findArticleBySlug("missing"),
    ]);
    expect(findBySlug).toHaveBeenCalledTimes(1);

    const nodes = await repo.listNetwork(OWNER);
    const target = nodes.ok ? nodes.value.find((node) => node.siteSlug === SECOND_SITE_SLUG) : undefined;
    if (target === undefined) throw new Error("削除対象の見本サイトがありません。");
    expect((await repo.deleteNetworkNode(OWNER, target.id, AT)).ok).toBe(true);
    const closed = await publicBlog.openSite(SECOND_SITE_SLUG);
    expect(closed.ok && closed.value).toBeNull();
    expect((await repo.restoreNetworkNode(OWNER, target.id, AT)).ok).toBe(true);
    const reopened = await publicBlog.openSite(SECOND_SITE_SLUG);
    expect(reopened.ok && reopened.value).not.toBeNull();
  });

  it("別 workspace の通常・削除済み read は空で、既知 ID の詳細も返さない", async () => {
    const repo = createSampleBlogOpsRepository();
    const reads = await Promise.all([
      repo.listNetwork(OUTSIDER),
      repo.listDeletedNetwork(OUTSIDER),
      repo.listLayoutSlots(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listLayoutBands(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listDeliveryParts(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listDeliverySnapshots(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listArticles(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listDeletedArticles(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listTags(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listFixedPages(OUTSIDER, SAMPLE_SITE_SLUG),
      repo.listRatings(OUTSIDER, BLOG_OPS_SAMPLE_ROUTE_IDS.article),
    ]);

    for (const result of reads) expect(result.ok && result.value).toEqual([]);
    const network = await repo.findNetworkNode(OUTSIDER, BLOG_OPS_SAMPLE_ROUTE_IDS.node);
    const article = await repo.findArticle(OUTSIDER, BLOG_OPS_SAMPLE_ROUTE_IDS.article);
    const blockKinds = await repo.listArticleBlockKinds(OUTSIDER, [
      BLOG_OPS_SAMPLE_ROUTE_IDS.article,
    ]);
    expect(network.ok && network.value).toBeNull();
    expect(article.ok && article.value).toBeNull();
    expect(blockKinds.ok && blockKinds.value).toEqual({});
  });

  it("別 workspace は既知 sample ID を save/delete/restore できず、所有データを変えない", async () => {
    const repo = createSampleBlogOpsRepository();
    const ownerNode = await repo.findNetworkNode(OWNER, BLOG_OPS_SAMPLE_ROUTE_IDS.node);
    const ownerArticle = await repo.findArticle(OWNER, BLOG_OPS_SAMPLE_ROUTE_IDS.article);
    const ownerTags = await repo.listTags(OWNER, SAMPLE_SITE_SLUG);
    const ownerSlots = await repo.listLayoutSlots(OWNER, SAMPLE_SITE_SLUG);
    const ownerBands = await repo.listLayoutBands(OWNER, SAMPLE_SITE_SLUG);
    const ownerParts = await repo.listDeliveryParts(OWNER, SAMPLE_SITE_SLUG);
    expect(ownerNode.ok && ownerNode.value).not.toBeNull();
    expect(ownerArticle.ok && ownerArticle.value).not.toBeNull();
    if (!ownerNode.ok || ownerNode.value === null || !ownerArticle.ok || ownerArticle.value === null) {
      throw new Error("所有者の見本がありません。");
    }
    if (!ownerTags.ok || !ownerSlots.ok || !ownerBands.ok || !ownerParts.ok) {
      throw new Error("所有者の見本設定がありません。");
    }
    const tag = ownerTags.value[0];
    const slot = ownerSlots.value[0];
    const band = ownerBands.value[0];
    const part = ownerParts.value[0];
    if (tag === undefined || slot === undefined || band === undefined || part === undefined) {
      throw new Error("所有者の見本設定が空です。");
    }

    const attempts = await Promise.all([
      repo.saveNetworkNode(OUTSIDER, { ...ownerNode.value, name: "他社が変更" }),
      repo.deleteNetworkNode(OUTSIDER, ownerNode.value.id, AT),
      repo.restoreNetworkNode(OUTSIDER, ownerNode.value.id, AT),
      repo.saveArticle(OUTSIDER, {
        ...ownerArticle.value.article,
        title: "他社が変更",
        blocks: ownerArticle.value.blocks,
        tagIds: ownerArticle.value.tagIds,
      }),
      repo.deleteArticle(OUTSIDER, ownerArticle.value.article.id, AT),
      repo.restoreArticle(OUTSIDER, ownerArticle.value.article.id, AT),
      repo.saveTag(OUTSIDER, { ...tag, name: "他社が変更" }),
      repo.deleteTag(OUTSIDER, tag.id),
      repo.saveLayoutSlot(OUTSIDER, { ...slot, title: "他社が変更" }),
      repo.saveLayoutBand(OUTSIDER, { ...band, title: "他社が変更" }),
      repo.saveDeliveryPart(OUTSIDER, { ...part, note: "他社が変更" }),
    ]);

    expect(attempts.every((result) => !result.ok)).toBe(true);
    const afterNode = await repo.findNetworkNode(OWNER, ownerNode.value.id);
    const afterArticle = await repo.findArticle(OWNER, ownerArticle.value.article.id);
    const afterTag = await repo.listTags(OWNER, SAMPLE_SITE_SLUG);
    expect(afterNode.ok && afterNode.value?.name).toBe(ownerNode.value.name);
    expect(afterArticle.ok && afterArticle.value?.article.title).toBe(
      ownerArticle.value.article.title,
    );
    expect(afterTag.ok && afterTag.value[0]?.name).toBe(tag.name);
  });

  it("所有者が作った固定ページ・点検・評価も別 workspace へ漏らさない", async () => {
    const repo = createSampleBlogOpsRepository();
    const page = {
      id: "lgp_sample_tenant_test",
      siteSlug: SAMPLE_SITE_SLUG,
      kind: "profile" as const,
      title: "所有者のページ",
      body: "所有者の本文",
      status: "published" as const,
      deletedAt: null,
      updatedAt: AT,
    };
    const snapshot = {
      id: "bds_sample_tenant_test",
      siteSlug: SAMPLE_SITE_SLUG,
      part: "rss_feeds" as const,
      ok: true,
      detail: "所有者の点検",
      checkedAt: AT,
    };
    expect((await repo.saveFixedPage(OWNER, page)).ok).toBe(true);
    expect((await repo.saveDeliverySnapshot(OWNER, snapshot)).ok).toBe(true);

    const rating = createSampleArticleRatingPort();
    expect(
      (
        await rating.put({
          id: "brt_sample_tenant_test",
          articleId: BLOG_OPS_SAMPLE_ROUTE_IDS.article,
          readerKey: "reader-sample-tenant-test",
          score: 5,
          comment: "所有者の記事への評価",
          createdAt: AT,
        })
      ).ok,
    ).toBe(true);

    const attempts = await Promise.all([
      repo.saveFixedPage(OUTSIDER, { ...page, title: "他社が変更" }),
      repo.deleteFixedPage(OUTSIDER, page.id),
      repo.saveDeliverySnapshot(OUTSIDER, { ...snapshot, detail: "他社が変更" }),
      repo.setRatingHidden(OUTSIDER, "brt_sample_tenant_test", true),
    ]);
    expect(attempts.every((result) => !result.ok)).toBe(true);
    const outsiderPages = await repo.listFixedPages(OUTSIDER, SAMPLE_SITE_SLUG);
    const outsiderSnapshots = await repo.listDeliverySnapshots(OUTSIDER, SAMPLE_SITE_SLUG);
    const outsiderSummary = await repo.summarizeRatings(OUTSIDER, [
      BLOG_OPS_SAMPLE_ROUTE_IDS.article,
    ]);
    expect(outsiderPages.ok && outsiderPages.value).toEqual([]);
    expect(outsiderSnapshots.ok && outsiderSnapshots.value).toEqual([]);
    expect(
      outsiderSummary.ok && outsiderSummary.value[BLOG_OPS_SAMPLE_ROUTE_IDS.article],
    ).toEqual({ count: 0, average: null });

    const ownerPages = await repo.listFixedPages(OWNER, SAMPLE_SITE_SLUG);
    const ownerSnapshots = await repo.listDeliverySnapshots(OWNER, SAMPLE_SITE_SLUG);
    const ownerRatings = await repo.listRatings(OWNER, BLOG_OPS_SAMPLE_ROUTE_IDS.article);
    expect(ownerPages.ok && ownerPages.value[0]?.title).toBe(page.title);
    expect(ownerSnapshots.ok && ownerSnapshots.value[0]?.detail).toBe(snapshot.detail);
    expect(ownerRatings.ok && ownerRatings.value[0]?.hidden).toBe(false);

    const activePage = ownerPages.ok ? ownerPages.value[0] : undefined;
    if (activePage === undefined) throw new Error("所有者の固定ページがありません。");
    expect((await repo.deleteFixedPage(OWNER, activePage.id)).ok).toBe(true);
    const deletedPages = await repo.listDeletedFixedPages(OWNER, SAMPLE_SITE_SLUG);
    expect(deletedPages.ok && deletedPages.value[0]).toMatchObject({
      id: activePage.id,
      title: activePage.title,
      body: activePage.body,
      status: activePage.status,
    });
    const implicitRestore = await repo.saveFixedPage(OWNER, {
      ...activePage,
      title: "暗黙上書き",
      deletedAt: null,
      updatedAt: AT,
    });
    expect(implicitRestore.ok).toBe(false);
    expect((await repo.restoreFixedPage(OUTSIDER, activePage.id, AT)).ok).toBe(false);
    expect((await repo.restoreFixedPage(OWNER, activePage.id, AT)).ok).toBe(true);
    expect((await repo.restoreFixedPage(OWNER, activePage.id, AT)).ok).toBe(false);
    const restoredPages = await repo.listFixedPages(OWNER, SAMPLE_SITE_SLUG);
    expect(restoredPages.ok && restoredPages.value[0]).toMatchObject({
      id: activePage.id,
      title: activePage.title,
      body: activePage.body,
      status: activePage.status,
      deletedAt: null,
    });
  });

  it("記事タグが重複・不存在・別site・別workspaceなら記事全体を変更しない", async () => {
    const repo = createSampleBlogOpsRepository();
    const before = await repo.findArticle(OWNER, BLOG_OPS_SAMPLE_ROUTE_IDS.article);
    if (!before.ok || before.value === null) throw new Error("所有者の記事がありません。");

    const sameWorkspaceOtherSite = "bt_sample_other_site";
    const outsiderTag = "bt_sample_outsider";
    expect((await repo.saveTag(OWNER, {
      id: sameWorkspaceOtherSite,
      siteSlug: "sample-other-site",
      slug: "other-site",
      name: "別サイト",
      description: "",
      kind: "topic",
    })).ok).toBe(true);
    expect((await repo.saveTag(OUTSIDER, {
      id: outsiderTag,
      siteSlug: SAMPLE_SITE_SLUG,
      slug: "outsider",
      name: "別workspace",
      description: "",
      kind: "topic",
    })).ok).toBe(true);

    const validTag = before.value.tagIds[0];
    expect(validTag).toBeDefined();
    if (validTag === undefined) return;
    for (const tagIds of [
      [validTag, validTag],
      ["bt_missing"],
      [sameWorkspaceOtherSite],
      [outsiderTag],
    ]) {
      const result = await repo.saveArticle(OWNER, {
        ...before.value.article,
        title: "変更されてはいけない題名",
        updatedAt: AT,
        blocks: [{
          id: "bab_should_not_replace",
          kind: "summary-section",
          heading: "変更禁止",
          body: "変更禁止",
          position: 0,
        }],
        tagIds,
      });
      expect(result.ok, tagIds.join(",")).toBe(false);
      const after = await repo.findArticle(OWNER, BLOG_OPS_SAMPLE_ROUTE_IDS.article);
      expect(after.ok && after.value).toEqual(before.value);
    }
  });
});
