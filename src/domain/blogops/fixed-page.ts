/**
 * 固定ページの名前・表示名・公開 URL の正本。
 *
 * repository や画面で別の対応表を持たない。名前と URL が離れると、
 * 管理画面で公開したのに footer から到達できないページが生まれる。
 */
export const FIXED_PAGE_KINDS = [
  "profile",
  "sitemap",
  "site_policy",
  "privacy_policy",
  "commercial_transaction",
  "contact",
  "review_guidelines",
  "company",
] as const;
export type FixedPageKind = (typeof FIXED_PAGE_KINDS)[number];

export const FIXED_PAGE_LABEL: Readonly<Record<FixedPageKind, string>> = {
  profile: "運営者プロフィール",
  sitemap: "サイトマップ",
  site_policy: "サイトポリシー",
  privacy_policy: "プライバシーポリシー",
  commercial_transaction: "特定商取引法に基づく表記",
  contact: "お問い合わせ",
  review_guidelines: "レビュー方針",
  company: "運営会社",
};

export const FIXED_PAGE_PATH: Readonly<Record<FixedPageKind, string>> = {
  profile: "/profile",
  sitemap: "/sitemap",
  site_policy: "/site-policy",
  privacy_policy: "/privacy-policy",
  commercial_transaction: "/commercial-transaction",
  contact: "/contact",
  review_guidelines: "/review-guidelines",
  company: "/company",
};

export const FIXED_PAGE_STATUSES = ["draft", "published"] as const;
export type FixedPageStatus = (typeof FIXED_PAGE_STATUSES)[number];

export const FIXED_PAGE_STATUS_LABEL: Readonly<Record<FixedPageStatus, string>> = {
  draft: "下書き",
  published: "公開中",
};
