/**
 * ブログ運用の保管庫の偽物。
 *
 * **1 か所に置く理由。** 同じ形の偽物を各テストが自前で持つと、本物の口が
 * 1 つ増えた日に、直し忘れたファイルだけが古い形のまま緑になる。
 * 偽物が本物より甘くなっていることは、テストの結果からは見えない。
 *
 * ここが持つのは「覚えておくだけ」の振る舞いで、決まりは持たない。
 * 決まりはユースケース側にあり、それを確かめるのが `tests/application` の役目である。
 */
import type {
  BlogArticleDetail,
  BlogDeliveryPartRecord,
  BlogDeliverySnapshotRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogOpsRepositoryPort,
  BlogTagRecord,
  DeletedBlogArticleRecord,
  DeletedSiteNetworkRecord,
  FixedPageRecord,
  SaveBlogArticleInput,
  SaveSiteNetworkInput,
} from "@/application/ports/blog-ops";
import type { ArticleRating, BlogArticle, RatingSummary, SiteNetworkNode } from "@/domain/blogops";
import { type DomainError, type Result, domainError, err, notFound, ok } from "@/domain/shared";
import { NOW } from "./clock";
import { WORKSPACE } from "./actors";

/** 連番の ID。乱数を使うと、落ちたときに同じ状況を作り直せない。 */
export function sequentialIds() {
  let n = 0;
  return {
    newId: () => {
      n += 1;
      return `id${n}`;
    },
  };
}

export type Store = {
  network: SaveSiteNetworkInput[];
  deletedNetwork: DeletedSiteNetworkRecord[];
  slots: BlogLayoutSlotRecord[];
  bands: BlogLayoutBandRecord[];
  delivery: BlogDeliveryPartRecord[];
  snapshots: BlogDeliverySnapshotRecord[];
  articles: BlogArticleDetail[];
  deletedArticles: DeletedBlogArticleRecord[];
  tags: BlogTagRecord[];
  pages: FixedPageRecord[];
  deletedPages: FixedPageRecord[];
  ratings: Record<string, RatingSummary>;
  /** 記事ごとの票を 1 件ずつ。集計 (`ratings`) とは別に持つ。 */
  votes: ArticleRating[];
};

export function emptyStore(): Store {
  return {
    network: [],
    deletedNetwork: [],
    slots: [],
    bands: [],
    delivery: [],
    snapshots: [],
    articles: [],
    deletedArticles: [],
    tags: [],
    pages: [],
    deletedPages: [],
    ratings: {},
    votes: [],
  };
}

/**
 * 覚えておくだけの保管庫。
 *
 * **作業場所ごとに分けて持つ。** 1 つの入れ物にまとめて `workspaceId` を無視すると、
 * 「他社のブログが見える」不具合をこのテストが素通しする。
 */
export function fakeRepository(seed: Partial<Store> = {}): {
  readonly port: BlogOpsRepositoryPort;
  readonly store: Store;
} {
  const store: Store = { ...emptyStore(), ...seed } as Store;
  const byWorkspace = new Map<string, Store>([[WORKSPACE, store]]);
  const of = (ws: string): Store => {
    const hit = byWorkspace.get(ws);
    if (hit === undefined) {
      const fresh = emptyStore();
      byWorkspace.set(ws, fresh);
      return fresh;
    }
    return hit;
  };
  const done = async (): Promise<Result<true, DomainError>> => ok(true as const);

  const port: BlogOpsRepositoryPort = {
    listNetwork: async (ws) => ok(of(ws).network as readonly SiteNetworkNode[]),
    listDeletedNetwork: async (ws) => ok(of(ws).deletedNetwork),
    findNetworkNode: async (ws, id) =>
      ok((of(ws).network.find((n) => n.id === id) ?? null) as SiteNetworkNode | null),
    saveNetworkNode: async (ws, input) => {
      const s = of(ws);
      const at = s.network.findIndex((n) => n.id === input.id);
      if (at >= 0) s.network[at] = input;
      else s.network.push(input);
      return done();
    },
    deleteNetworkNode: async (ws, id, deletedAt) => {
      const s = of(ws);
      const target = s.network.find((n) => n.id === id);
      if (target === undefined) return err(notFound("サイト網", id));
      s.network = s.network.filter((n) => n.id !== id);
      s.deletedNetwork.push({ node: target, deletedAt });
      return done();
    },
    restoreNetworkNode: async (ws, id, _restoredAt) => {
      const s = of(ws);
      const target = s.deletedNetwork.find((n) => n.node.id === id);
      if (target === undefined) return err(notFound("削除済みサイト網", id));
      s.deletedNetwork = s.deletedNetwork.filter((n) => n.node.id !== id);
      s.network.push({ ...target.node });
      return done();
    },

    listLayoutSlots: async (ws, siteSlug) => ok(of(ws).slots.filter((x) => x.siteSlug === siteSlug)),
    saveLayoutSlot: async (ws, input) => {
      const s = of(ws);
      s.slots = [...s.slots.filter((x) => x.id !== input.id), input];
      return done();
    },
    listLayoutBands: async (ws, siteSlug) => ok(of(ws).bands.filter((x) => x.siteSlug === siteSlug)),
    saveLayoutBand: async (ws, input) => {
      const s = of(ws);
      s.bands = [...s.bands.filter((x) => x.id !== input.id), input];
      return done();
    },
    listDeliveryParts: async (ws, siteSlug) =>
      ok(of(ws).delivery.filter((x) => x.siteSlug === siteSlug)),
    saveDeliveryPart: async (ws, input) => {
      const s = of(ws);
      s.delivery = [...s.delivery.filter((x) => x.id !== input.id), input];
      return done();
    },
    listDeliverySnapshots: async (ws, siteSlug) =>
      ok(of(ws).snapshots.filter((x) => x.siteSlug === siteSlug)),
    saveDeliverySnapshot: async (ws, input) => {
      // 本物と同じく**積む**。上書きにすると履歴の検査が見本でだけ通ってしまう。
      of(ws).snapshots = [...of(ws).snapshots, input];
      return done();
    },

    listArticles: async (ws, siteSlug) =>
      ok(
        of(ws)
          .articles.map((d) => d.article)
          .filter((a) => siteSlug === null || a.siteSlug === siteSlug),
      ),
    listDeletedArticles: async (ws, siteSlug) =>
      ok(
        of(ws).deletedArticles.filter(
          (row) => siteSlug === null || row.article.siteSlug === siteSlug,
        ),
      ),
    findArticle: async (ws, id) => ok(of(ws).articles.find((d) => d.article.id === id) ?? null),
    listArticleBlockKinds: async (ws, ids) =>
      ok(
        Object.fromEntries(
          of(ws)
            .articles.filter((detail) => ids.includes(detail.article.id))
            .map((detail) => [detail.article.id, detail.blocks.map((block) => block.kind)]),
        ),
      ),
    saveArticle: async (ws, input: SaveBlogArticleInput) => {
      const s = of(ws);
      const current = s.articles.find((detail) => detail.article.id === input.id);
      const currentRevision = current?.article.revision ?? 1;
      if (
        current !== undefined &&
        input.expectedRevision !== undefined &&
        input.expectedRevision !== null &&
        input.expectedRevision !== currentRevision
      ) {
        return err(domainError("CONFLICT", "ほかの人が先に保存しました。", { field: "revision" }));
      }
      const detail: BlogArticleDetail = {
        article: {
          id: input.id,
          siteSlug: input.siteSlug,
          slug: input.slug,
          template: input.template,
          title: input.title,
          lead: input.lead,
          status: input.status,
          authorName: input.authorName,
          publishedAt: input.publishedAt,
          updatedAt: input.updatedAt,
          revision: current === undefined ? 1 : currentRevision + 1,
        },
        blocks: input.blocks,
        tagIds: input.tagIds,
      };
      s.articles = [...s.articles.filter((d) => d.article.id !== input.id), detail];
      return done();
    },
    deleteArticle: async (ws, id, deletedAt) => {
      const s = of(ws);
      const target = s.articles.find((d) => d.article.id === id);
      if (target === undefined) return err(notFound("ブログ記事", id));
      s.articles = s.articles.filter((d) => d.article.id !== id);
      s.deletedArticles.push({ ...target, deletedAt });
      return done();
    },
    restoreArticle: async (ws, id, restoredAt) => {
      const s = of(ws);
      const target = s.deletedArticles.find((d) => d.article.id === id);
      if (target === undefined) return err(notFound("削除済みブログ記事", id));
      s.deletedArticles = s.deletedArticles.filter((d) => d.article.id !== id);
      s.articles.push({
        article: { ...target.article, updatedAt: restoredAt },
        blocks: target.blocks,
        tagIds: target.tagIds,
      });
      return done();
    },

    listTags: async (ws, siteSlug) => ok(of(ws).tags.filter((t) => t.siteSlug === siteSlug)),
    saveTag: async (ws, input) => {
      const s = of(ws);
      s.tags = [...s.tags.filter((t) => t.id !== input.id), input];
      return done();
    },
    deleteTag: async (ws, id) => {
      const s = of(ws);
      s.tags = s.tags.filter((t) => t.id !== id);
      return done();
    },

    listFixedPages: async (ws, siteSlug) => ok(of(ws).pages.filter((p) => p.siteSlug === siteSlug)),
    listDeletedFixedPages: async (ws, siteSlug) =>
      ok(of(ws).deletedPages.filter((p) => p.siteSlug === siteSlug)),
    saveFixedPage: async (ws, input) => {
      const s = of(ws);
      if (s.deletedPages.some((p) => p.siteSlug === input.siteSlug && p.kind === input.kind)) {
        return err(notFound("固定ページ", `${input.siteSlug}:${input.kind}`));
      }
      s.pages = [...s.pages.filter((p) => p.id !== input.id), input];
      return done();
    },
    deleteFixedPage: async (ws, id) => {
      const s = of(ws);
      const target = s.pages.find((p) => p.id === id);
      if (target === undefined) return err(notFound("固定ページ", id));
      s.pages = s.pages.filter((p) => p.id !== id);
      s.deletedPages.push({ ...target, deletedAt: NOW });
      return done();
    },
    restoreFixedPage: async (ws, id, restoredAt) => {
      const s = of(ws);
      const target = s.deletedPages.find((p) => p.id === id);
      if (target === undefined) return err(notFound("削除済み固定ページ", id));
      s.deletedPages = s.deletedPages.filter((p) => p.id !== id);
      s.pages.push({ ...target, deletedAt: null, updatedAt: restoredAt });
      return done();
    },

    summarizeRatings: async (ws, ids) => {
      const s = of(ws);
      const out: Record<string, RatingSummary> = {};
      for (const id of ids) out[id] = s.ratings[id] ?? { count: 0, average: null };
      return ok(out);
    },

    listRatings: async (ws, articleId) =>
      ok(of(ws).votes.filter((v) => v.articleId === articleId) as readonly ArticleRating[]),

    setRatingHidden: async (ws, ratingId, hidden) => {
      const s = of(ws);
      // **消さずに書き換える。**本物と同じ形にしないと、見本だけ通る書き方が残る。
      s.votes = s.votes.map((v) => (v.id === ratingId ? { ...v, hidden } : v));
      return done();
    },
  };
  return { port, store };
}

export function node(
  over: Partial<SaveSiteNetworkInput> & { siteSlug: string },
): SaveSiteNetworkInput {
  return {
    id: `snn_${over.siteSlug}`,
    siteSlug: over.siteSlug,
    role: over.role ?? "sub",
    parentSlug: over.parentSlug ?? null,
    name: over.name ?? over.siteSlug,
    oneLine: over.oneLine ?? "",
    position: over.position ?? 0,
    status: over.status ?? "active",
  };
}

export function article(over: Partial<BlogArticle> & { id: string }): BlogArticle {
  return {
    id: over.id,
    siteSlug: over.siteSlug ?? "hub",
    slug: over.slug ?? over.id,
    template: over.template ?? "T4",
    title: over.title ?? "見出し",
    lead: over.lead ?? "",
    status: over.status ?? "draft",
    authorName: over.authorName ?? "編集部",
    publishedAt: over.publishedAt ?? null,
    updatedAt: over.updatedAt ?? NOW,
    revision: over.revision ?? 1,
  };
}
