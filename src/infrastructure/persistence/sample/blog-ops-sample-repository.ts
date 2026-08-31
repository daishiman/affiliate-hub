import type {
  ArticleRatingPort,
  BlogDeliveryPartRecord,
  BlogDeliverySnapshotRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogOpsRepositoryPort,
  BlogTagRecord,
  DeletedBlogArticleRecord,
  DeletedSiteNetworkRecord,
  PublicBlogPort,
  SaveBlogArticleInput,
  SaveSiteNetworkInput,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import type { ArticleRating, BlogArticle, BlogArticleBlock, RatingSummary } from "@/domain/blogops";
import { summarizeRatings } from "@/domain/blogops";
import type { WorkspaceId } from "@/domain/shared";
import { err, notFound, ok, validationError } from "@/domain/shared";
import { registerStub } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./ranking-sample-repository";
import {
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  createSampleSiteRepository,
} from "./site-sample-repository";

/**
 * これは仮置きの見本データです（スタブ）。
 *
 * 読者に見える面（記事一覧・記事 1 本・評価）の控え。
 * 保存先 (D1) がつながっていないところ（`pnpm dev` と自動テスト）で使う。
 *
 * **「保存先が無いので出せません」で済ませない。**
 * 済ませると、記事の画面はどこでも 200 を返すようになり、
 * 「無い記事は 404」という約束を確かめる場所が本番だけになる。
 * ここに見本の記事を置くことで、
 *   - 在る記事 → 200 で本文が出る
 *   - 無い記事 → 404
 * の両方が、保存先の無いところでも同じように起きる。
 *
 * 見本の文章はすべてこの製品のために書いた説明文で、
 * 参考サイトの文言は 1 文字も含まない。
 */
const readStub = registerStub({
  id: "blog-ops:public-sample",
  port: "PublicBlogPort",
  label: "読者に見える記事（見本データ）",
  blockedBy: "済み。見本は保存先がつながったあとも残す（空の画面を作らないため）",
  fallbackFor: "src/infrastructure/persistence/d1/blog-ops-repository.ts",
});

/**
 * 評価の控えは**処理中のメモリ**に置く。
 *
 * cookie や localStorage へ逃がさない。逃がすと「保存できているつもり」になり、
 * 本物（D1 の `blog_article_ratings`）を用意する動機が消える。
 * 再起動で消えてよい。ここは動きを確かめるための場所である。
 */
const ratingStub = registerStub({
  id: "blog-ops:rating-memory",
  port: "ArticleRatingPort",
  label: "記事の評価（処理中のメモリ）",
  blockedBy: "済み。見本は保存先がつながったあとも残す",
  fallbackFor: "src/infrastructure/persistence/d1/blog-ops-repository.ts",
});

/**
 * 作成者向けの控え。**読者側と同じ置き場を触る。**
 *
 * 分けて持つと、AI が道具で作った記事が読者側の一覧に出ず、
 * 「作れたのに出ない」を保存先の無いところで再現できなくなる。
 */
const opsStub = registerStub({
  id: "blog-ops:authoring-memory",
  port: "BlogOpsRepositoryPort",
  label: "ブログ運用の編集（処理中のメモリ）",
  blockedBy: "済み。見本は保存先がつながったあとも残す（空の画面を作らないため）",
  fallbackFor: "src/infrastructure/persistence/d1/blog-ops-repository.ts",
});

export const BLOG_OPS_SAMPLE_STUB_IDS = {
  read: readStub.id,
  rating: ratingStub.id,
  ops: opsStub.id,
} as const;

/**
 * 画面 1 枚を開くのに要る見本の識別子。
 *
 * **テスト側で文字列を手で作らせないために出している。**
 * 2026-08-26 に実測: `tests/ui/route-table.ts` が `art_sample_review` /
 * `net_sample_root` という**存在しない id** で 2 枚を開いていた。
 * 画面は「見つかりません」を描き、それでも 200 なので描画検査も axe も緑だった。
 * つまり記事 1 本の画面とサイト網 1 節点の画面は、中身を 1 度も見られていない。
 *
 * ここから取れば、見本側の id を変えた日に**型が合わなくなって**気づける。
 */
export const BLOG_OPS_SAMPLE_ROUTE_IDS = {
  /** `/admin/blog/articles/[article]` — 公開済みの記事 1 本。 */
  article: "ba_sample_starter_kit",
  /**
   * `/s/[site]/blog/[article]` — 読者側で開く公開記事の URL 名。
   *
   * **保存先がある環境でも同じ名前で開ける必要がある。** 見本は D1 が無いときの
   * 代役なので、代役と本物が別の記事を語っていると、
   * vitest（見本で描く）は緑のまま E2E（seed 済みの D1 を本物の通信で開く）だけが
   * 404 になる。2026-08-26 に実際そうなった。
   *
   * `scripts/seed/local-seed-data.ts` が同じ名前の記事を必ず 1 本入れることを
   * `tests/architecture/seed-and-sample-agree.test.ts` が見ている。
   */
  articleSlug: "starter-kit-2026",
  /** `/admin/site-network/[node]` — ハブの節点。 */
  node: "snn_sample_hub",
} as const;

const NOW = new Date("2026-08-01T00:00:00.000Z");

function block(
  id: string,
  kind: BlogArticleBlock["kind"],
  heading: string,
  body: string,
  position: number,
): BlogArticleBlock {
  return { id, kind, heading, body, position };
}

/**
 * 見本の記事 3 本。
 *
 * **記事型を 3 つに散らしてある。** 1 型だけだと、画面が型ごとに
 * 分岐していても気づけない（`BlogArticleView` は分岐しない作りである）。
 * 3 本目は `draft` にしてある。読者側の一覧に出ないこと、
 * 直に住所を叩いても 404 になることを、見本だけで確かめられるようにするため。
 */
type SampleArticle = { readonly siteSlug: string } & {
  article: BlogArticle;
  blocks: readonly BlogArticleBlock[];
  tagIds: readonly string[];
};

/*
  **書ける置き場にしてある。**読むだけの控えだったころは、
  AI が道具で記事を作っても保存先 (D1) が無い手元では何も起きず、
  「作れたのか、黙って捨てられたのか」が呼んだ側から見分けられなかった。
  ここに積むことで、作った記事がそのまま読者側の一覧にも出る。
  処理が終われば消える。ここは動きを確かめるための場所である。
*/
const ARTICLES: SampleArticle[] = [
  {
    siteSlug: SAMPLE_SITE_SLUG,
    article: {
      id: "ba_sample_starter_kit",
      siteSlug: SAMPLE_SITE_SLUG,
      slug: "starter-kit-2026",
      template: "T1",
      title: "【2026年】はじめての編集机まわり おすすめ 5 選",
      lead: "予算・置き場所・音の 3 点で絞り込み、迷いどころを先に片づけます。",
      status: "published",
      authorName: "編集部",
      publishedAt: new Date("2026-07-20T09:00:00.000Z"),
      updatedAt: new Date("2026-07-28T09:00:00.000Z"),
    },
    blocks: [
      block("bb_kit_1", "disclosure-notice", "広告表記", "この記事には広告が含まれます。", 1),
      block(
        "bb_kit_2",
        "intro-box",
        "この記事の要点",
        "最初に用途を 3 つに分けます。用途が決まると、必要な性能はほぼ自動で決まります。",
        2,
      ),
      /*
        目次と執筆者の箱は、この版面 (T1) の必須部品 (`REQUIRED_BLOCKS`) である。
        **公開済みの見本に欠けていると、記事を 1 文字直すだけで
        「公開に要る部品が揃っていません」と断られる。**
        公開済みなのに公開できない記事が見本として在ると、
        運営者も AI も「自分の入力が悪い」と読み違える。
      */
      block("bb_kit_toc", "hierarchical-toc", "目次", "", 3),
      block(
        "bb_kit_editor",
        "editor-credential-box",
        "この記事を書いた人",
        "編集部で機材の検証を担当しています。実際に置いて使ったものだけを取り上げます。",
        4,
      ),
      block(
        "bb_kit_3",
        "criterion-section",
        "選ぶときの 3 つの軸",
        "1) 置ける大きさ 2) 動かす頻度 3) 音の許容範囲。3 つとも譲れない場合は予算を上げるほかありません。",
        5,
      ),
      block(
        "bb_kit_4",
        "pick-section",
        "用途別に選んだもの",
        "在宅中心なら静かさを、持ち歩くなら重さを最優先にします。",
        6,
      ),
      block(
        "bb_kit_5",
        "summary-section",
        "まとめ",
        "迷ったら「置ける大きさ」から決めると、選択肢が一気に減ります。",
        7,
      ),
    ],
    tagIds: ["bt_sample_beginner"],
  },
  {
    siteSlug: SAMPLE_SITE_SLUG,
    article: {
      id: "ba_sample_desk_review",
      siteSlug: SAMPLE_SITE_SLUG,
      slug: "quiet-desk-review",
      template: "T2",
      title: "静かな作業机をレビュー：音の数値と体感のずれ",
      lead: "カタログの数値と、実際に机に向かったときの感じ方の差を確かめました。",
      status: "published",
      authorName: "編集部",
      publishedAt: new Date("2026-07-05T09:00:00.000Z"),
      updatedAt: new Date("2026-07-06T09:00:00.000Z"),
    },
    blocks: [
      block("bb_rev_1", "disclosure-notice", "広告表記", "この記事には広告が含まれます。", 1),
      block(
        "bb_rev_intro",
        "intro-box",
        "この記事の要点",
        "カタログの数値だけでは、静かさの体感は決まりません。置き場所のほうが効きます。",
        2,
      ),
      block("bb_rev_toc", "hierarchical-toc", "目次", "", 3),
      block(
        "bb_rev_editor",
        "editor-credential-box",
        "この記事を書いた人",
        "編集部で機材の検証を担当しています。測った条件は記事の中に書いています。",
        4,
      ),
      block(
        "bb_rev_2",
        "spec-section",
        "必要な条件",
        "奥行 60cm 以上、耐荷重 40kg 以上を前提にしています。",
        5,
      ),
      block(
        "bb_rev_3",
        "summary-section",
        "まとめ",
        "数値の差より、置き場所の反響のほうが体感に効きました。",
        6,
      ),
    ],
    tagIds: ["bt_sample_review"],
  },
  {
    siteSlug: SAMPLE_SITE_SLUG,
    article: {
      id: "ba_sample_draft",
      siteSlug: SAMPLE_SITE_SLUG,
      slug: "unpublished-draft",
      template: "T3",
      title: "（下書き）用語のまとめ",
      lead: "",
      status: "draft",
      authorName: "編集部",
      publishedAt: null,
      updatedAt: NOW,
    },
    blocks: [block("bb_draft_1", "intro-box", "書きかけ", "まだ公開していません。", 1)],
    tagIds: [],
  },
];

/**
 * 見本のタグ。**ブランドと話題を両方入れてある。**
 *
 * 片方しか無いと、`brand-tag-cloud` が「ブランドだけを出す」のか
 * 「たまたま全部出しているだけ」なのかが、見本を開いた人には区別が付かない。
 */
const TAGS: BlogTagRecord[] = [
  {
    id: "bt_sample_beginner",
    siteSlug: SAMPLE_SITE_SLUG,
    slug: "beginner",
    name: "はじめて",
    description: "最初の 1 台を選ぶ人向け。",
    kind: "topic",
  },
  {
    id: "bt_sample_review",
    siteSlug: SAMPLE_SITE_SLUG,
    slug: "review",
    name: "レビュー",
    description: "実際に使って確かめた記録。",
    kind: "topic",
  },
  {
    id: "bt_sample_maker_north",
    siteSlug: SAMPLE_SITE_SLUG,
    slug: "maker-north",
    name: "ノース工房",
    description: "見本用の作り手。実在しません。",
    kind: "brand",
  },
  {
    id: "bt_sample_maker_hazel",
    siteSlug: SAMPLE_SITE_SLUG,
    slug: "maker-hazel",
    name: "ヘーゼル製作所",
    description: "見本用の作り手。実在しません。",
    kind: "brand",
  },
];

const SLOTS: BlogLayoutSlotRecord[] = [
  {
    id: "bls_sample_header_nav",
    siteSlug: SAMPLE_SITE_SLUG,
    region: "header",
    slotKey: "global-nav",
    title: "案内",
    body: "",
    position: 1,
    enabled: true,
  },
  {
    id: "bls_sample_sidebar_profile",
    siteSlug: SAMPLE_SITE_SLUG,
    region: "sidebar",
    slotKey: "profile",
    title: "この編集部について",
    body: "実際に使って確かめたことだけを書いています。",
    position: 1,
    enabled: true,
  },
];

const BANDS: BlogLayoutBandRecord[] = [
  {
    id: "blb_sample_latest",
    siteSlug: SAMPLE_SITE_SLUG,
    band: "latest_posts",
    title: "新着記事",
    enabled: true,
    position: 1,
    itemLimit: 6,
  },
  {
    id: "blb_sample_sister",
    siteSlug: SAMPLE_SITE_SLUG,
    band: "sister_sites",
    title: "姉妹サイト",
    enabled: true,
    position: 2,
    itemLimit: 4,
  },
];

const PARTS: BlogDeliveryPartRecord[] = [
  {
    id: "bdp_sample_canonical",
    siteSlug: SAMPLE_SITE_SLUG,
    part: "canonical",
    enabled: true,
    note: "重複した住所を 1 つに寄せます。",
    position: 1,
  },
  {
    id: "bdp_sample_rss",
    siteSlug: SAMPLE_SITE_SLUG,
    part: "rss_feeds",
    enabled: true,
    note: "新着を購読できるようにします。",
    position: 2,
  },
];

const NETWORK: SiteNetworkRecord[] = [
  {
    id: "snn_sample_hub",
    siteSlug: SAMPLE_SITE_SLUG,
    role: "hub",
    parentSlug: null,
    name: "編集機材の総合案内",
    oneLine: "用途から機材を選ぶための入口。",
    position: 1,
    status: "active",
  },
  {
    id: "snn_sample_sub",
    siteSlug: SECOND_SITE_SLUG,
    role: "sub",
    parentSlug: SAMPLE_SITE_SLUG,
    name: "小さな台所の道具",
    oneLine: "置き場所の制約から選ぶ姉妹サイト。",
    position: 2,
    status: "active",
  },
];

const SAMPLE_WORKSPACE = String(SAMPLE_WORKSPACE_ID);

function initialOwners(rows: readonly { readonly id: string }[]): Map<string, string> {
  return new Map(rows.map((row) => [row.id, SAMPLE_WORKSPACE]));
}

const networkOwners = initialOwners(NETWORK);
const articleOwners = initialOwners(ARTICLES.map((row) => row.article));
const tagOwners = initialOwners(TAGS);
const slotOwners = initialOwners(SLOTS);
const bandOwners = initialOwners(BANDS);
const partOwners = initialOwners(PARTS);

function owns(
  owners: ReadonlyMap<string, string>,
  id: string,
  workspaceId: WorkspaceId | string,
): boolean {
  return owners.get(id) === String(workspaceId);
}

function maySave(
  owners: ReadonlyMap<string, string>,
  id: string,
  workspaceId: WorkspaceId,
): boolean {
  const owner = owners.get(id);
  return owner === undefined || owner === String(workspaceId);
}

/** 記事 id + 読者の目印 → 点。押し直しは上書き（票が増えない）。 */
/** 見本の票。伏せた印も一緒に持つ（本物と同じ形にしないと、見本だけ通る書き方が残る）。 */
const ratingMemory = new Map<string, ArticleRating>();

function ratingKey(articleId: string, readerKey: string): string {
  return `${articleId} ${readerKey}`;
}

/**
 * 見本の読み取り口。
 *
 * `listPublished` が `published` だけを返すのは本物と同じ。
 * ここを緩めると、本物では出ない下書きが見本でだけ出てしまい、
 * 「見本で確かめた」ことが本物の保証にならなくなる。
 */
async function resolveSamplePublicSiteIdentity(
  sites: EditorialSiteRepositoryPort,
  siteSlug: string,
) {
  const site = await sites.findBySlug(siteSlug);
  if (!site.ok) return err(site.error);
  if (site.value === null) return ok(null);
  const active = NETWORK.filter((node) => node.siteSlug === siteSlug);
  const deleted = DELETED_NETWORK.filter((row) => row.node.siteSlug === siteSlug);
  if (active.length + deleted.length !== 1) return ok(null);
  const node = active[0];
  if (
    node === undefined ||
    node.status !== "active" ||
    !owns(networkOwners, node.id, site.value.workspaceId)
  ) {
    return ok(null);
  }
  const { workspaceId: _workspaceId, ...blueprint } = site.value;
  return ok({ workspaceId: site.value.workspaceId, siteSlug, blueprint });
}

export function createSamplePublicBlogPort(
  sites: EditorialSiteRepositoryPort = createSampleSiteRepository(),
): PublicBlogPort {
  return {
    async openSite(siteSlug) {
      const identity = await resolveSamplePublicSiteIdentity(sites, siteSlug);
      if (!identity.ok) return err(identity.error);
      if (identity.value === null) return ok(null);
      const scoped = identity.value;
      return ok({
        blueprint: scoped.blueprint,
        async findArticleBySlug(slug) {
          const found = ARTICLES.find(
            (article) =>
              owns(articleOwners, article.article.id, scoped.workspaceId) &&
              article.siteSlug === scoped.siteSlug &&
              article.article.slug === slug &&
              article.article.status === "published",
          );
          return ok(
            found === undefined
              ? null
              : { article: found.article, blocks: found.blocks, tagIds: found.tagIds },
          );
        },
        async listPublished(limit) {
          const rows: readonly BlogArticle[] = ARTICLES.filter(
            (article) =>
              owns(articleOwners, article.article.id, scoped.workspaceId) &&
              article.siteSlug === scoped.siteSlug &&
              article.article.status === "published",
          )
            .map((article) => article.article)
            .sort((left, right) =>
              (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0))
            .slice(0, limit);
          return ok(rows);
        },
        async listLayoutSlots() {
          return ok(SLOTS.filter((slot) => owns(slotOwners, slot.id, scoped.workspaceId) && slot.siteSlug === scoped.siteSlug && slot.enabled));
        },
        async listLayoutBands() {
          return ok(BANDS.filter((band) => owns(bandOwners, band.id, scoped.workspaceId) && band.siteSlug === scoped.siteSlug && band.enabled));
        },
        async listDeliveryParts() {
          return ok(PARTS.filter((part) => owns(partOwners, part.id, scoped.workspaceId) && part.siteSlug === scoped.siteSlug));
        },
        async listNetwork() {
          return ok(NETWORK.filter((node) => owns(networkOwners, node.id, scoped.workspaceId) && node.status === "active" && (node.siteSlug === scoped.siteSlug || node.parentSlug === scoped.siteSlug)));
        },
        async listTags() {
          return ok(TAGS.filter((tag) => owns(tagOwners, tag.id, scoped.workspaceId) && tag.siteSlug === scoped.siteSlug));
        },
      });
    },
  };
}

function votesOf(articleId: string): readonly ArticleRating[] {
  return [...ratingMemory.values()].filter((vote) => vote.articleId === articleId);
}

export function createSampleArticleRatingPort(): ArticleRatingPort {
  return {
    async put(input) {
      if (!ARTICLES.some((row) => row.article.id === input.articleId && row.article.status === "published")) {
        return err(notFound("公開中の記事", input.articleId));
      }
      const key = ratingKey(input.articleId, input.readerKey);
      // 押し直しで伏せ字は解けない（本物の `onConflictDoUpdate` と同じ）。
      const before = ratingMemory.get(key);
      ratingMemory.set(key, {
        id: before?.id ?? input.id,
        articleId: input.articleId,
        readerKey: input.readerKey,
        score: input.score,
        comment: input.comment,
        hidden: before?.hidden ?? false,
        createdAt: before?.createdAt ?? input.createdAt,
      });
      return ok(true);
    },

    async summarize(articleId) {
      if (!ARTICLES.some((row) => row.article.id === articleId && row.article.status === "published")) {
        return ok({ count: 0, average: null });
      }
      return ok(summarizeRatings(votesOf(articleId)));
    },
  };
}

const SNAPSHOTS: BlogDeliverySnapshotRecord[] = [];
const DELETED_NETWORK: DeletedSiteNetworkRecord[] = [];
const DELETED_ARTICLES: DeletedBlogArticleRecord[] = [];
const snapshotOwners = initialOwners(SNAPSHOTS);

/** id が同じ行を差し替える。無ければ足す。本物の `onConflictDoUpdate` と同じ振る舞い。 */
function upsert<T extends { readonly id: string }>(store: T[], row: T): void {
  const at = store.findIndex((existing) => existing.id === row.id);
  if (at === -1) store.push(row);
  else store[at] = row;
}

function dropById<T extends { readonly id: string }>(store: T[], id: string): void {
  const at = store.findIndex((existing) => existing.id === id);
  if (at !== -1) store.splice(at, 1);
}

/**
 * 作成者向けの見本の保管庫。
 *
 * 見本も D1 と同じ workspace 境界を守る。開発時だけ既知 ID を別 workspace から
 * 書き換えられる状態にすると、本番 adapter へ切り替えたときだけ失敗するためである。
 *
 * 読者に見える面 (`createSamplePublicBlogPort`) と**同じ置き場を触る**。
 * 別々に持つと、AI が道具で作った記事が読者側の一覧に出ず、
 * 「作れたのに出ない」を手元で再現できなくなる。
 */
export function createSampleBlogOpsRepository(): BlogOpsRepositoryPort {
  return {
    async listNetwork(workspaceId) {
      return ok(NETWORK.filter((node) => owns(networkOwners, node.id, workspaceId)));
    },
    async listDeletedNetwork(workspaceId) {
      return ok(
        DELETED_NETWORK.filter((row) => owns(networkOwners, row.node.id, workspaceId)),
      );
    },
    async findNetworkNode(workspaceId, nodeId) {
      return ok(
        NETWORK.find(
          (node) => node.id === nodeId && owns(networkOwners, node.id, workspaceId),
        ) ?? null,
      );
    },
    async saveNetworkNode(workspaceId, input: SaveSiteNetworkInput) {
      if (!maySave(networkOwners, input.id, workspaceId)) {
        return err(notFound("サイト網の節点", input.id));
      }
      upsert(NETWORK, { ...input });
      networkOwners.set(input.id, String(workspaceId));
      return ok(true);
    },
    async deleteNetworkNode(workspaceId, nodeId, deletedAt) {
      const at = NETWORK.findIndex(
        (node) => node.id === nodeId && owns(networkOwners, node.id, workspaceId),
      );
      const target = NETWORK[at];
      if (target === undefined) return err(notFound("サイト網の節点", nodeId));
      NETWORK.splice(at, 1);
      DELETED_NETWORK.push({ node: target, deletedAt });
      return ok(true);
    },
    async restoreNetworkNode(workspaceId, nodeId) {
      const at = DELETED_NETWORK.findIndex(
        (row) => row.node.id === nodeId && owns(networkOwners, row.node.id, workspaceId),
      );
      const target = DELETED_NETWORK[at];
      if (target === undefined) return err(notFound("削除済みサイト網の節点", nodeId));
      DELETED_NETWORK.splice(at, 1);
      NETWORK.push(target.node);
      return ok(true);
    },

    async listLayoutSlots(workspaceId, siteSlug) {
      return ok(
        SLOTS.filter(
          (slot) => slot.siteSlug === siteSlug && owns(slotOwners, slot.id, workspaceId),
        ),
      );
    },
    async saveLayoutSlot(workspaceId, input) {
      if (!maySave(slotOwners, input.id, workspaceId)) {
        return err(notFound("枠の設定", input.id));
      }
      upsert(SLOTS, { ...input });
      slotOwners.set(input.id, String(workspaceId));
      return ok(true);
    },
    async listLayoutBands(workspaceId, siteSlug) {
      return ok(
        BANDS.filter(
          (band) => band.siteSlug === siteSlug && owns(bandOwners, band.id, workspaceId),
        ),
      );
    },
    async saveLayoutBand(workspaceId, input) {
      if (!maySave(bandOwners, input.id, workspaceId)) {
        return err(notFound("帯の設定", input.id));
      }
      upsert(BANDS, { ...input });
      bandOwners.set(input.id, String(workspaceId));
      return ok(true);
    },

    async listDeliveryParts(workspaceId, siteSlug) {
      return ok(
        PARTS.filter(
          (part) =>
            (siteSlug === null || part.siteSlug === siteSlug) &&
            owns(partOwners, part.id, workspaceId),
        ),
      );
    },
    async saveDeliveryPart(workspaceId, input) {
      if (!maySave(partOwners, input.id, workspaceId)) {
        return err(notFound("配信部品", input.id));
      }
      upsert(PARTS, { ...input });
      partOwners.set(input.id, String(workspaceId));
      return ok(true);
    },
    async listDeliverySnapshots(workspaceId, siteSlug) {
      return ok(
        SNAPSHOTS.filter(
          (snapshot) =>
            (siteSlug === null || snapshot.siteSlug === siteSlug) &&
            owns(snapshotOwners, snapshot.id, workspaceId),
        ),
      );
    },
    async saveDeliverySnapshot(workspaceId, input) {
      if (!maySave(snapshotOwners, input.id, workspaceId)) {
        return err(notFound("配信の点検結果", input.id));
      }
      // 点検の記録は**積む**。上書きにすると「いつ壊れたか」が消える。
      SNAPSHOTS.push({ ...input });
      snapshotOwners.set(input.id, String(workspaceId));
      return ok(true);
    },

    async listArticles(workspaceId, siteSlug) {
      const rows = ARTICLES.filter(
        (row) =>
          owns(articleOwners, row.article.id, workspaceId) &&
          (siteSlug === null || row.siteSlug === siteSlug),
      ).map((row) => row.article);
      return ok(rows);
    },
    async listDeletedArticles(workspaceId, siteSlug) {
      return ok(
        DELETED_ARTICLES.filter(
          (row) =>
            owns(articleOwners, row.article.id, workspaceId) &&
            (siteSlug === null || row.article.siteSlug === siteSlug),
        ),
      );
    },
    async findArticle(workspaceId, articleId) {
      const found = ARTICLES.find(
        (row) =>
          row.article.id === articleId &&
          owns(articleOwners, row.article.id, workspaceId),
      );
      if (found === undefined) return ok(null);
      return ok({ article: found.article, blocks: found.blocks, tagIds: found.tagIds });
    },
    async listArticleBlockKinds(workspaceId, articleIds) {
      return ok(
        Object.fromEntries(
          ARTICLES.filter(
            (row) =>
              articleIds.includes(row.article.id) &&
              owns(articleOwners, row.article.id, workspaceId),
          ).map((row) => [row.article.id, row.blocks.map((block) => block.kind)]),
        ),
      );
    },
    async saveArticle(workspaceId, input: SaveBlogArticleInput) {
      if (!maySave(articleOwners, input.id, workspaceId)) {
        return err(notFound("ブログ記事", input.id));
      }
      if (new Set(input.tagIds).size !== input.tagIds.length) {
        return err(validationError("同じタグを記事へ複数回付けることはできません。", "tagIds"));
      }
      if (
        input.tagIds.some((tagId) => {
          const tag = TAGS.find((candidate) => candidate.id === tagId);
          return (
            tag === undefined ||
            !owns(tagOwners, tagId, workspaceId) ||
            tag.siteSlug !== input.siteSlug
          );
        })
      ) {
        return err(
          validationError(
            "記事と同じワークスペース・サイトにあるタグだけを指定してください。",
            "tagIds",
          ),
        );
      }
      const article: BlogArticle = {
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
      };
      const blocks: readonly BlogArticleBlock[] = input.blocks.map((b) => ({ ...b }));
      const at = ARTICLES.findIndex((a) => a.article.id === input.id);
      const row = { siteSlug: input.siteSlug, article, blocks, tagIds: [...input.tagIds] };
      if (at === -1) ARTICLES.push(row);
      else ARTICLES[at] = row;
      articleOwners.set(input.id, String(workspaceId));
      return ok(true);
    },
    async deleteArticle(workspaceId, articleId, deletedAt) {
      const at = ARTICLES.findIndex(
        (row) =>
          row.article.id === articleId &&
          owns(articleOwners, row.article.id, workspaceId),
      );
      const target = ARTICLES[at];
      if (target === undefined) return err(notFound("ブログ記事", articleId));
      ARTICLES.splice(at, 1);
      DELETED_ARTICLES.push({
        article: target.article,
        blocks: target.blocks,
        tagIds: target.tagIds,
        deletedAt,
      });
      return ok(true);
    },
    async restoreArticle(workspaceId, articleId, restoredAt) {
      const at = DELETED_ARTICLES.findIndex(
        (row) =>
          row.article.id === articleId &&
          owns(articleOwners, row.article.id, workspaceId),
      );
      const target = DELETED_ARTICLES[at];
      if (target === undefined) return err(notFound("削除済みブログ記事", articleId));
      DELETED_ARTICLES.splice(at, 1);
      ARTICLES.push({
        siteSlug: target.article.siteSlug,
        article: { ...target.article, updatedAt: restoredAt },
        blocks: target.blocks,
        tagIds: target.tagIds,
      });
      return ok(true);
    },

    async listTags(workspaceId, siteSlug) {
      return ok(
        TAGS.filter(
          (tag) => tag.siteSlug === siteSlug && owns(tagOwners, tag.id, workspaceId),
        ),
      );
    },
    async saveTag(workspaceId, input) {
      if (!maySave(tagOwners, input.id, workspaceId)) {
        return err(notFound("タグ", input.id));
      }
      upsert(TAGS, { ...input });
      tagOwners.set(input.id, String(workspaceId));
      return ok(true);
    },
    async deleteTag(workspaceId, tagId) {
      if (!owns(tagOwners, tagId, workspaceId) || !TAGS.some((tag) => tag.id === tagId)) {
        return err(notFound("タグ", tagId));
      }
      dropById(TAGS, tagId);
      for (let index = 0; index < ARTICLES.length; index += 1) {
        const row = ARTICLES[index];
        if (row === undefined || !owns(articleOwners, row.article.id, workspaceId)) continue;
        ARTICLES[index] = { ...row, tagIds: row.tagIds.filter((id) => id !== tagId) };
      }
      return ok(true);
    },

    async summarizeRatings(workspaceId, articleIds) {
      const found: Record<string, RatingSummary> = {};
      for (const articleId of articleIds) {
        found[articleId] = owns(articleOwners, articleId, workspaceId)
          ? summarizeRatings(votesOf(articleId))
          : { count: 0, average: null };
      }
      return ok(found);
    },
    async listRatings(workspaceId, articleId) {
      // **伏せたものも返す。**集計と違い、ここは「何を伏せたか」を確かめる口である。
      return ok(owns(articleOwners, articleId, workspaceId) ? votesOf(articleId) : []);
    },
    async setRatingHidden(workspaceId, ratingId, hidden) {
      for (const [key, vote] of ratingMemory.entries()) {
        if (vote.id !== ratingId) continue;
        if (!owns(articleOwners, vote.articleId, workspaceId)) {
          return err(notFound("評価", ratingId));
        }
        ratingMemory.set(key, { ...vote, hidden });
        return ok(true);
      }
      return err(notFound("評価", ratingId));
    },
  };
}
