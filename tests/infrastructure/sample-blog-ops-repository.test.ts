/**
 * @tier 1
 * @req REQ-BOPS01, REQ-BOPS02, REQ-BOPS03, REQ-BOPS06, REQ-BOPS07, REQ-BOPS08, REQ-BOPS09
 * @types idempotency, state-transition, equivalence, tenant-isolation
 *
 * D1 が無いときの保存先（見本）が、本物と同じ約束を守るか。
 *
 * --- なぜ見本にテストが要るのか ---
 *
 * 見本の保存先は「動かすため」の飾りではない。**手元での確認も、
 * D1 を持たない環境の CI も、実際に走るのはこちら側である。**
 * ここが本物より甘いと、手元では通った操作が本番で落ちる——しかも
 * 落ちるのは利用者の画面で、開発中には一度も見えない。
 *
 * `sample-blog-ops-tenancy.test.ts` が見ているのは workspace の境界だけである。
 * ここで見るのは**往復**（保存したものが同じ形で戻るか）と、
 * **本物が断るものをここでも断るか**（重複タグ・他サイトのタグ・
 * 削除済みの上書き）。
 */
import { describe, expect, it } from "vitest";
import type { SaveBlogArticleInput, SaveSiteNetworkInput } from "@/application/ports/blog-ops";
import type { WorkspaceId } from "@/domain/shared";
import { createSampleBlogOpsRepository } from "@/infrastructure/persistence/sample/blog-ops-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { SAMPLE_SITE_SLUG } from "@/infrastructure/persistence/sample/site-sample-repository";

const OWNER = SAMPLE_WORKSPACE_ID as WorkspaceId;
const OUTSIDER = "ws_sample_blog_repo_outsider" as WorkspaceId;
const AT = new Date("2026-08-27T00:00:00.000Z");

/**
 * 見本の入れ物は**モジュールごと**に持たれているので、同じファイルの中では
 * テスト同士が同じ棚を触る。ID を毎回変えて、隣のテストの結果を読まないようにする。
 */
let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}_t${seq}`;
}

function networkNode(over: Partial<SaveSiteNetworkInput> = {}): SaveSiteNetworkInput {
  const id = over.id ?? uniq("snn");
  return {
    id,
    siteSlug: over.siteSlug ?? uniq("slug"),
    role: over.role ?? "sub",
    parentSlug: over.parentSlug ?? null,
    name: over.name ?? "試しのブログ",
    oneLine: over.oneLine ?? "",
    position: over.position ?? 9,
    status: over.status ?? "active",
  };
}

function articleInput(over: Partial<SaveBlogArticleInput> = {}): SaveBlogArticleInput {
  const id = over.id ?? uniq("art");
  return {
    id,
    siteSlug: over.siteSlug ?? SAMPLE_SITE_SLUG,
    slug: over.slug ?? id,
    template: over.template ?? "T4",
    title: over.title ?? "試しの記事",
    lead: over.lead ?? "",
    status: over.status ?? "draft",
    authorName: over.authorName ?? "編集部",
    categorySlug: over.categorySlug ?? "chairs",
    publishedAt: over.publishedAt ?? null,
    updatedAt: over.updatedAt ?? AT,
    blocks: over.blocks ?? [],
    tagIds: over.tagIds ?? [],
  };
}

describe("サイト網の往復", () => {
  it("足したものが一覧に出て、削除で削除済みへ移り、復元で戻る", async () => {
    const repo = createSampleBlogOpsRepository();
    const node = networkNode({ name: "道具の話" });

    expect((await repo.saveNetworkNode(OWNER, node)).ok).toBe(true);
    const listed = await repo.listNetwork(OWNER);
    expect(listed.ok && listed.value.some((n) => n.id === node.id)).toBe(true);

    expect((await repo.deleteNetworkNode(OWNER, node.id, AT)).ok).toBe(true);
    const afterDelete = await repo.listNetwork(OWNER);
    expect(afterDelete.ok && afterDelete.value.some((n) => n.id === node.id)).toBe(false);
    const deleted = await repo.listDeletedNetwork(OWNER);
    // **消さずに退ける。**消してしまうと「間違えて消した」が取り返せない。
    expect(deleted.ok && deleted.value.some((row) => row.node.id === node.id)).toBe(true);

    expect((await repo.restoreNetworkNode(OWNER, node.id, AT)).ok).toBe(true);
    const back = await repo.findNetworkNode(OWNER, node.id);
    expect(back.ok && back.value?.name).toBe("道具の話");
  });

  it("同じ ID で 2 回足しても 1 件のまま、中身は後の方になる", async () => {
    const repo = createSampleBlogOpsRepository();
    const node = networkNode({ name: "はじめの名前" });

    await repo.saveNetworkNode(OWNER, node);
    await repo.saveNetworkNode(OWNER, { ...node, name: "直した名前" });

    const listed = await repo.listNetwork(OWNER);
    const hits = listed.ok ? listed.value.filter((n) => n.id === node.id) : [];
    expect(hits).toHaveLength(1);
    expect(hits[0]?.name).toBe("直した名前");
  });

  it("知らない ID の削除・復元は、成功と言わない", async () => {
    const repo = createSampleBlogOpsRepository();

    expect((await repo.deleteNetworkNode(OWNER, "snn_unknown", AT)).ok).toBe(false);
    expect((await repo.restoreNetworkNode(OWNER, "snn_unknown", AT)).ok).toBe(false);
  });

  it("他社は、こちらの ID を書き換えられない", async () => {
    const repo = createSampleBlogOpsRepository();
    const node = networkNode();
    await repo.saveNetworkNode(OWNER, node);

    const stolen = await repo.saveNetworkNode(OUTSIDER, { ...node, name: "乗っ取り" });
    // **「権限がありません」ではなく「見つかりません」を返す。**
    // 前者は「その ID は在る」ことを他社へ教えてしまう。
    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.error.code).toBe("NOT_FOUND");
  });
});

describe("版面と配信物", () => {
  it("枠・帯・配信部品は、同じ ID で 2 回保存しても増えない", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const slot = {
      id: uniq("slot"),
      siteSlug: site,
      region: "sidebar" as const,
      slotKey: "profile" as const,
      title: "運営者について",
      body: "本文",
      position: 0,
      enabled: true,
    };
    const band = {
      id: uniq("band"),
      siteSlug: site,
      band: "latest_posts" as const,
      title: "新着",
      enabled: true,
      position: 0,
      itemLimit: 6,
    };
    const part = {
      id: uniq("part"),
      siteSlug: site,
      part: "rss_feeds" as const,
      enabled: true,
      note: "",
      position: 0,
    };

    for (const _ of [1, 2]) {
      await repo.saveLayoutSlot(OWNER, slot);
      await repo.saveLayoutBand(OWNER, band);
      await repo.saveDeliveryPart(OWNER, part);
    }

    const slots = await repo.listLayoutSlots(OWNER, site);
    const bands = await repo.listLayoutBands(OWNER, site);
    const parts = await repo.listDeliveryParts(OWNER, site);
    expect(slots.ok && slots.value).toHaveLength(1);
    expect(bands.ok && bands.value).toHaveLength(1);
    expect(parts.ok && parts.value).toHaveLength(1);
  });

  it("点検の結果は上書きせずに積む", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const base = {
      siteSlug: site,
      part: "rss_feeds" as const,
      ok: true,
      detail: "",
      checkedAt: AT,
    };

    await repo.saveDeliverySnapshot(OWNER, { ...base, id: uniq("snap") });
    await repo.saveDeliverySnapshot(OWNER, { ...base, id: uniq("snap") });

    const snapshots = await repo.listDeliverySnapshots(OWNER, site);
    // 上書きにすると「いつ壊れたか」が消え、直った後に気づけなくなる。
    expect(snapshots.ok && snapshots.value).toHaveLength(2);
  });
});

describe("記事とタグ", () => {
  it("保存した記事が、断片と一緒に戻る", async () => {
    const repo = createSampleBlogOpsRepository();
    const input = articleInput({
      title: "選び方の話",
      blocks: [
        { id: uniq("blk"), kind: "intro-box", heading: "はじめに", body: "本文", position: 0 },
        { id: uniq("blk"), kind: "spec-section", heading: "比べる", body: "本文", position: 1 },
      ],
    });

    expect((await repo.saveArticle(OWNER, input)).ok).toBe(true);

    const found = await repo.findArticle(OWNER, input.id);
    expect(found.ok && found.value?.article.title).toBe("選び方の話");
    expect(found.ok && found.value?.blocks).toHaveLength(2);

    const kinds = await repo.listArticleBlockKinds(OWNER, [input.id]);
    // 種類だけを引く口。本文を持ってこないので、一覧が重くならない。
    expect(kinds.ok && kinds.value[input.id]).toEqual(["intro-box", "spec-section"]);
  });

  it("知らない記事は、見つからないと言うだけで落ちない", async () => {
    const repo = createSampleBlogOpsRepository();

    const found = await repo.findArticle(OWNER, "art_unknown");
    // **例外ではなく `null` を返す。**「まだ無い」は異常ではない。
    expect(found.ok && found.value).toBeNull();
  });

  it("記事は削除で退き、復元で戻る", async () => {
    const repo = createSampleBlogOpsRepository();
    const input = articleInput();
    await repo.saveArticle(OWNER, input);

    expect((await repo.deleteArticle(OWNER, input.id, AT)).ok).toBe(true);
    const deleted = await repo.listDeletedArticles(OWNER, input.siteSlug);
    expect(deleted.ok && deleted.value.some((row) => row.article.id === input.id)).toBe(true);

    const restoredAt = new Date("2026-08-28T00:00:00.000Z");
    expect((await repo.restoreArticle(OWNER, input.id, restoredAt)).ok).toBe(true);
    const back = await repo.findArticle(OWNER, input.id);
    // 戻した時刻を `updatedAt` に入れる。入れないと、戻した記事が
    // 一覧の底に沈んだままになり、運営者から見て「戻っていない」。
    expect(back.ok && back.value?.article.updatedAt).toEqual(restoredAt);
  });

  it("知らない記事の削除・復元は、成功と言わない", async () => {
    const repo = createSampleBlogOpsRepository();

    expect((await repo.deleteArticle(OWNER, "art_unknown", AT)).ok).toBe(false);
    expect((await repo.restoreArticle(OWNER, "art_unknown", AT)).ok).toBe(false);
  });

  it("同じタグを 2 回付けた記事は断る", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const tag = {
      id: uniq("tag"),
      siteSlug: site,
      slug: "camera",
      name: "カメラ",
      description: "",
      kind: "topic" as const,
    };
    await repo.saveTag(OWNER, tag);

    const saved = await repo.saveArticle(
      OWNER,
      articleInput({ siteSlug: site, tagIds: [tag.id, tag.id] }),
    );

    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.code).toBe("VALIDATION_FAILED");
  });

  it("別のサイトのタグ、知らないタグは付けさせない", async () => {
    const repo = createSampleBlogOpsRepository();
    const other = uniq("site");
    const tag = {
      id: uniq("tag"),
      siteSlug: other,
      slug: "lens",
      name: "レンズ",
      description: "",
      kind: "topic" as const,
    };
    await repo.saveTag(OWNER, tag);

    // サイトが違う。タグはサイトごとの分類なので、またいで付くと
    // 別サイトの一覧に他所の記事が並ぶ。
    const crossSite = await repo.saveArticle(
      OWNER,
      articleInput({ siteSlug: uniq("site"), tagIds: [tag.id] }),
    );
    expect(crossSite.ok).toBe(false);

    const unknown = await repo.saveArticle(
      OWNER,
      articleInput({ siteSlug: other, tagIds: ["tag_unknown"] }),
    );
    expect(unknown.ok).toBe(false);
  });

  it("タグを消すと、付いていた記事からも外れる", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const tag = {
      id: uniq("tag"),
      siteSlug: site,
      slug: "tripod",
      name: "三脚",
      description: "",
      kind: "topic" as const,
    };
    await repo.saveTag(OWNER, tag);
    const input = articleInput({ siteSlug: site, tagIds: [tag.id] });
    await repo.saveArticle(OWNER, input);

    expect((await repo.deleteTag(OWNER, tag.id)).ok).toBe(true);

    const listed = await repo.listTags(OWNER, site);
    expect(listed.ok && listed.value.some((t) => t.id === tag.id)).toBe(false);
    const found = await repo.findArticle(OWNER, input.id);
    // 外し忘れると、記事は消えたタグを指したままになり、
    // 一覧の絞り込みが「0 件」を返す原因になる。
    expect(found.ok && found.value?.tagIds).toEqual([]);
  });

  it("知らないタグの削除は、成功と言わない", async () => {
    const repo = createSampleBlogOpsRepository();

    expect((await repo.deleteTag(OWNER, "tag_unknown")).ok).toBe(false);
  });
});

describe("固定ページ", () => {
  const page = (siteSlug: string) => ({
    id: uniq("page"),
    siteSlug,
    kind: "profile" as const,
    title: "運営者について",
    body: "だれが書いているか。",
    status: "published" as const,
    deletedAt: null,
    updatedAt: AT,
  });

  it("同じ種類は 2 枚に増えず、後の内容で置き換わる", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const first = page(site);
    await repo.saveFixedPage(OWNER, first);
    await repo.saveFixedPage(OWNER, { ...page(site), title: "書いている人" });

    const listed = await repo.listFixedPages(OWNER, site);
    expect(listed.ok && listed.value).toHaveLength(1);
    // ID は最初のものを保つ。差し替えるたびに ID が変わると、
    // 監査履歴が別ページを指しているように見える。
    expect(listed.ok && listed.value[0]?.id).toBe(first.id);
    expect(listed.ok && listed.value[0]?.title).toBe("書いている人");
  });

  it("削除は退けるだけで、削除済み一覧から復元できる", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const target = page(site);
    await repo.saveFixedPage(OWNER, target);

    expect((await repo.deleteFixedPage(OWNER, target.id)).ok).toBe(true);
    const alive = await repo.listFixedPages(OWNER, site);
    expect(alive.ok && alive.value).toHaveLength(0);
    const deleted = await repo.listDeletedFixedPages(OWNER, site);
    expect(deleted.ok && deleted.value).toHaveLength(1);

    expect((await repo.restoreFixedPage(OWNER, target.id, AT)).ok).toBe(true);
    const back = await repo.listFixedPages(OWNER, site);
    expect(back.ok && back.value).toHaveLength(1);
  });

  it("削除済みの種類は、保存では戻せない", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const target = page(site);
    await repo.saveFixedPage(OWNER, target);
    await repo.deleteFixedPage(OWNER, target.id);

    const saved = await repo.saveFixedPage(OWNER, page(site));

    // 保存で黙って生き返らせると、削除済み一覧に残ったまま
    // 表にも出る二重状態になる。**復元は復元の口を通す。**
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.code).toBe("CONFLICT");
  });

  it("同じ種類を持つ他社のページには触れない", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    await repo.saveFixedPage(OWNER, page(site));

    const stolen = await repo.saveFixedPage(OUTSIDER, page(site));

    expect(stolen.ok).toBe(false);
    if (!stolen.ok) expect(stolen.error.code).toBe("NOT_FOUND");
  });

  it("二重の削除、知らない ID の復元は、成功と言わない", async () => {
    const repo = createSampleBlogOpsRepository();
    const site = uniq("site");
    const target = page(site);
    await repo.saveFixedPage(OWNER, target);
    await repo.deleteFixedPage(OWNER, target.id);

    expect((await repo.deleteFixedPage(OWNER, target.id)).ok).toBe(false);
    expect((await repo.restoreFixedPage(OWNER, "page_unknown", AT)).ok).toBe(false);
  });
});

describe("評価", () => {
  it("他社の記事の集計は、件数 0 として返す", async () => {
    const repo = createSampleBlogOpsRepository();
    const input = articleInput();
    await repo.saveArticle(OWNER, input);

    const summary = await repo.summarizeRatings(OUTSIDER, [input.id]);

    // **断らずに 0 を返す。**ここで断ると、記事一覧の集計が
    // 1 件の他社データで丸ごと落ちる。見えないことと落ちることは違う。
    expect(summary.ok && summary.value[input.id]).toEqual({ count: 0, average: null });
  });

  it("他社の記事の票は、1 件も見えない", async () => {
    const repo = createSampleBlogOpsRepository();
    const input = articleInput();
    await repo.saveArticle(OWNER, input);

    const votes = await repo.listRatings(OUTSIDER, input.id);
    expect(votes.ok && votes.value).toEqual([]);
  });

  it("知らない票を伏せようとしても、成功と言わない", async () => {
    const repo = createSampleBlogOpsRepository();

    const hidden = await repo.setRatingHidden(OWNER, "rating_unknown", true);

    expect(hidden.ok).toBe(false);
    if (!hidden.ok) expect(hidden.error.code).toBe("NOT_FOUND");
  });
});
