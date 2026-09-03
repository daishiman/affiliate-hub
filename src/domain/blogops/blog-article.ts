import { type DomainError, type Result, err, ok, validationError } from "../shared";
import type { ArticleType } from "../authoring";
import { type ArticleBlockKind } from "./blueprint-parts";

/**
 * ブログ記事 (§4)。
 *
 * 生成・校正・公開ゲートとブログ CRUD は、どちらも canonical
 * `articles` を書き込む。この型は、そのうちサイトと T1〜T4 が決まった読者向け記事を
 * アプリケーション境界で扱う view であり、別の保存正本ではない。
 */

export const ARTICLE_TEMPLATES = ["T1", "T2", "T3", "T4"] as const;
export type ArticleTemplate = (typeof ARTICLE_TEMPLATES)[number];

export const ARTICLE_TEMPLATE_LABEL: Readonly<Record<ArticleTemplate, string>> = {
  T1: "まとめ (比較・順位づけ)",
  T2: "単品レビュー",
  T3: "ガイド・用語",
  T4: "カテゴリーのハブ",
};

/** canonical `articles.type` へ保存する値。adapterごとに対応を書き写さない。 */
export const ARTICLE_TYPE_BY_TEMPLATE: Readonly<Record<ArticleTemplate, ArticleType>> = {
  T1: "ranking",
  T2: "review",
  T3: "guide",
  T4: "guide",
};

/** 題名の付け方。画面の説明文に出す。参考サイトの文言ではなく規則だけを持つ。 */
export const ARTICLE_TEMPLATE_TITLE_RULE: Readonly<Record<ArticleTemplate, string>> = {
  T1: "【年】用途 + おすすめ + N 選",
  T2: "製品名 + をレビュー + 要点 1 句",
  T3: "用語 + とは / 選び方",
  T4: "カテゴリー名 + まとめ",
};

/** ブログ記事の状態。既存 `articles.status` と同じ語彙を使う。 */
export const BLOG_ARTICLE_STATUSES = ["draft", "review", "published", "archived"] as const;
export type BlogArticleStatus = (typeof BLOG_ARTICLE_STATUSES)[number];

export const BLOG_ARTICLE_STATUS_LABEL: Readonly<Record<BlogArticleStatus, string>> = {
  draft: "下書き",
  review: "確認中",
  published: "公開中",
  archived: "取り下げ",
};

export type BlogArticleBlock = {
  readonly id: string;
  readonly kind: ArticleBlockKind;
  readonly heading: string;
  readonly body: string;
  readonly position: number;
};

export type BlogArticle = {
  readonly id: string;
  readonly siteSlug: string;
  readonly slug: string;
  readonly template: ArticleTemplate;
  readonly title: string;
  readonly lead: string;
  readonly status: BlogArticleStatus;
  readonly authorName: string;
  /**
   * サイト設計図にある公開カテゴリのslug。下書き中は未選択を許す。
   * グローバルcategory masterのIDとは責務が違う。
   */
  readonly categorySlug: string | null;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
  /** 同時編集の古い保存を断る版番。legacy fixture は未指定=1と読む。 */
  readonly revision?: number;
};

/** 0042より前の公開記事でカテゴリを持たなかった事実を、架空カテゴリにせず表す。 */
export const UNCATEGORIZED_ARTICLE_CATEGORY = {
  slug: "uncategorized",
  name: "未分類",
  oneLine: "移行前に公開され、カテゴリが記録されていない記事です。",
} as const;

/** 0042より前の公開記事で署名が無かった事実を、架空の編集者名にせず表す。 */
export const UNKNOWN_ARTICLE_AUTHOR = {
  slug: "unknown-author",
  name: "著者未設定",
} as const;

export function validateArticleCategorySlug(slug: string): Result<string, DomainError> {
  const value = slug.trim();
  if (value === "") {
    return err(validationError("公開するカテゴリを選んでください。", "categorySlug"));
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return err(
      validationError(
        "カテゴリのURL名は、小文字の英数字とハイフンだけで、ハイフンで終われません。",
        "categorySlug",
      ),
    );
  }
  return ok(value);
}

/**
 * 記事型ごとに欠かせない部品列 (§4)。
 *
 * **全部品を並べない。** 全部並べると「型を選ぶ意味」が消える。
 * ここに載せるのは、欠けると読者にとって記事の体を成さないものだけ。
 */
export const REQUIRED_BLOCKS: Readonly<Record<ArticleTemplate, readonly ArticleBlockKind[]>> = {
  T1: [
    "disclosure-notice",
    "intro-box",
    "hierarchical-toc",
    "editor-credential-box",
    "criterion-section",
    "pick-section",
    "summary-section",
  ],
  T2: [
    "disclosure-notice",
    "intro-box",
    "hierarchical-toc",
    "editor-credential-box",
    "summary-section",
  ],
  T3: ["intro-box", "hierarchical-toc"],
  T4: ["intro-box"],
};

/** 欠けている必須部品。空なら揃っている。 */
export function missingBlocks(
  template: ArticleTemplate,
  blocks: readonly { readonly kind: ArticleBlockKind }[],
): readonly ArticleBlockKind[] {
  const present = new Set(blocks.map((b) => b.kind));
  return REQUIRED_BLOCKS[template].filter((kind) => !present.has(kind));
}

/**
 * 記事の URL 名。
 *
 * サイトの URL 名と同じ決まりにしてある。決まりを 2 つ持つと、
 * どちらの決まりで断られたのかを利用者が読み分けられない。
 */
export function validateArticleSlug(slug: string): Result<string, DomainError> {
  const value = slug.trim();
  if (value === "") return err(validationError("記事の URL 名を入れてください。", "slug"));
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return err(
      validationError(
        "記事の URL 名は、小文字の英数字とハイフンだけで、ハイフンで終われません。",
        "slug",
      ),
    );
  }
  return ok(value);
}

/** 削除済みの記事を、元のサイト・元の URL へ戻せるかを現在の状態で再検証する。 */
export function validateArticleRestore(
  article: BlogArticle,
  activeArticles: readonly BlogArticle[],
  activeSiteSlugs: readonly string[],
): Result<true, DomainError> {
  if (!activeSiteSlugs.includes(article.siteSlug)) {
    return err(
      validationError(
        `元のブログ「${article.siteSlug}」が現在のサイト網にありません。先にブログを戻してください。`,
        "siteSlug",
      ),
    );
  }
  if (
    activeArticles.some(
      (candidate) =>
        candidate.siteSlug === article.siteSlug && candidate.slug === article.slug,
    )
  ) {
    return err(
      validationError(
        `URL の名前「${article.slug}」はこのブログで使われているため戻せません。`,
        "slug",
      ),
    );
  }
  return ok(true);
}

/**
 * 鮮度 (§7 の更新頻度の観点)。
 *
 * 「何日で古いか」を画面に書かせない。書かせると、画面ごとに違う日数で
 * 「古い」と言い始める。
 */
export const FRESHNESS_AGING_DAYS = 180;
export const FRESHNESS_STALE_DAYS = 365;

export type Freshness = "fresh" | "aging" | "stale";

export const FRESHNESS_LABEL: Readonly<Record<Freshness, string>> = {
  fresh: "新しい",
  aging: "そろそろ見直し",
  stale: "古い",
};

export function freshnessOf(updatedAt: Date, now: Date): Freshness {
  const days = Math.floor((now.getTime() - updatedAt.getTime()) / 86_400_000);
  if (days >= FRESHNESS_STALE_DAYS) return "stale";
  if (days >= FRESHNESS_AGING_DAYS) return "aging";
  return "fresh";
}
