/**
 * 抽象ブループリント `review-media-classic` の部品目録。
 *
 * 正本は `docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md`。
 * ここに置いてあるのは**部品の名前と並びだけ**で、文言・色・画像は 1 つも無い。
 * 参考サイト由来の固有名・素材は、この feature のどこにも書かない。
 *
 * なぜ名前を型にするのか: 枠の名前を画面側の文字列で持つと、
 * 綴りを 1 文字間違えた枠が「保存はできるが誰も描かない」状態で残る。
 */

/** ヘッダーの部品 (§3.1)。 */
export const HEADER_SLOT_KEYS = [
  "header-brand",
  "header-search-modal",
  "mega-nav",
  "hero-banner",
] as const;

/** サイドバーの通常枠 8 種 (§3.4 の 1〜8)。 */
export const SIDEBAR_SLOT_KEYS = [
  "site-search",
  "nested-category-list",
  "brand-tag-cloud",
  "quick-link-menu",
  "custom-html-slot-upper",
  "profile-card",
  "recent-comments",
  "custom-html-slot-lower",
] as const;

/** サイドバーの追従枠 2 種 (§3.4 の 9〜10)。 */
export const SIDEBAR_STICKY_SLOT_KEYS = ["sticky-promo-slot", "sticky-toc"] as const;

/** フッターの 3 層 (§3.5)。 */
export const FOOTER_SLOT_KEYS = [
  "footer-profile",
  "footer-category-tree",
  "footer-logo-nav",
  "legal-nav",
] as const;

export const LAYOUT_REGIONS = ["header", "sidebar", "sidebar_sticky", "footer"] as const;
export type LayoutRegion = (typeof LAYOUT_REGIONS)[number];

/**
 * 枠の名前は領域ごとに決まっている。
 *
 * 領域と名前の組を表にしておくと、「フッターの枠にサイドバーの名前が入る」が
 * 保存の時点で断れる。画面側に条件を書かずに済む。
 */
export const SLOT_KEYS_BY_REGION: Readonly<Record<LayoutRegion, readonly string[]>> = {
  header: HEADER_SLOT_KEYS,
  sidebar: SIDEBAR_SLOT_KEYS,
  sidebar_sticky: SIDEBAR_STICKY_SLOT_KEYS,
  footer: FOOTER_SLOT_KEYS,
};

/**
 * 枠の名前を、読者と運営者に見せる言葉にする。
 *
 * **見出しが空のときの逃げ先はここ 1 か所。**画面ごとに当て字を書くと、
 * 同じ枠が管理画面では「brand-tag-cloud」、読者側では「ブランド」と出る。
 * 運営者は自分が触った枠がどれか分からなくなる。
 */
export const LAYOUT_SLOT_LABEL: Readonly<Record<string, string>> = {
  // ヘッダー
  "header-brand": "ブログ名とロゴ",
  "header-search-modal": "探す（重ねて開く）",
  "mega-nav": "大きな案内",
  "hero-banner": "先頭の帯",
  // サイドバー（通常）
  "site-search": "このブログから探す",
  "nested-category-list": "カテゴリー",
  "brand-tag-cloud": "ブランドから探す",
  "quick-link-menu": "よく見られている入口",
  "custom-html-slot-upper": "お知らせ（上）",
  "profile-card": "運営者について",
  "recent-comments": "最近のコメント",
  "custom-html-slot-lower": "お知らせ（下）",
  // サイドバー（追従）
  "sticky-promo-slot": "おすすめ",
  "sticky-toc": "この記事の目次",
  // フッター
  "footer-profile": "運営者",
  "footer-category-tree": "カテゴリー一覧",
  "footer-logo-nav": "ブログの案内",
  "legal-nav": "方針と表記",
};

/** 見出しは運営者が上書きできる。空なら枠の名前に落とす。 */
export function slotHeading(slotKey: string, title: string): string {
  const trimmed = title.trim();
  if (trimmed !== "") return trimmed;
  return LAYOUT_SLOT_LABEL[slotKey] ?? slotKey;
}

export const LAYOUT_REGION_LABEL: Readonly<Record<LayoutRegion, string>> = {
  header: "ヘッダー",
  sidebar: "サイドバー (通常)",
  sidebar_sticky: "サイドバー (追従)",
  footer: "フッター",
};

/** ハブトップの 4 帯 (§3.2)。 */
export const TOP_BANDS = [
  "latest_posts",
  "sister_sites",
  "category_hub",
  "navigator",
] as const;
export type TopBand = (typeof TOP_BANDS)[number];

export const TOP_BAND_LABEL: Readonly<Record<TopBand, string>> = {
  latest_posts: "新着記事の帯",
  sister_sites: "姉妹サイトの帯",
  category_hub: "カテゴリー別のタイル",
  navigator: "用途別ナビゲータへの入口",
};

/** 記事本文の部品 (§3.3)。並びは記事型が決める。 */
export const ARTICLE_BLOCK_KINDS = [
  "breadcrumb",
  "article-title",
  "article-meta",
  "featured-image",
  "disclosure-notice",
  "intro-box",
  "hierarchical-toc",
  "editor-credential-box",
  "spec-section",
  "criterion-section",
  "pick-section",
  "product-card",
  "summary-section",
  "comment-form",
  "prev-next",
] as const;
export type ArticleBlockKind = (typeof ARTICLE_BLOCK_KINDS)[number];

export const ARTICLE_BLOCK_LABEL: Readonly<Record<ArticleBlockKind, string>> = {
  breadcrumb: "パンくず",
  "article-title": "題名",
  "article-meta": "更新日",
  "featured-image": "アイキャッチ",
  "disclosure-notice": "広告表記",
  "intro-box": "導入ボックス",
  "hierarchical-toc": "目次",
  "editor-credential-box": "執筆者・監修者",
  "spec-section": "必要な条件の節",
  "criterion-section": "判断軸の節",
  "pick-section": "選んだものの節",
  "product-card": "商品カード",
  "summary-section": "まとめ",
  "comment-form": "コメント欄",
  "prev-next": "前後の記事",
};

/** 配信部品 9 種 (§6)。 */
export const DELIVERY_PARTS = [
  "canonical",
  "og_twitter_meta",
  "jsonld_website",
  "jsonld_article",
  "jsonld_collection",
  "rss_feeds",
  "sitemap_index",
  "llms_txt",
  "robots",
] as const;
export type DeliveryPart = (typeof DELIVERY_PARTS)[number];

export const DELIVERY_PART_LABEL: Readonly<Record<DeliveryPart, string>> = {
  canonical: "正規 URL の指定",
  og_twitter_meta: "SNS 共有用の情報",
  jsonld_website: "サイトの構造化データ",
  jsonld_article: "記事の構造化データ",
  jsonld_collection: "一覧ページの構造化データ",
  rss_feeds: "RSS 配信",
  sitemap_index: "サイトマップ",
  llms_txt: "AI 向けの案内文",
  robots: "クローラーへの指示",
};
