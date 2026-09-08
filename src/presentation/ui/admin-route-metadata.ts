/**
 * 管理画面のroute metadataの正本。
 *
 * 画面ファイル、実URL、親子関係、パンくず、サイドバー、分類を別々の表へ
 * 書き写さない。route IDを1件追加すれば、各射影が同時に増える。
 */

import type { IconName } from "./primitives/icon";

/**
 * 一段目の分類は**作業の対象物**である。動詞ではない。
 *
 * 動詞 (素材/書く/出す/稼ぐ/見る/整える) で切っていたとき、1 つの対象物についての
 * 作業が複数の見出しに散っていた。「商品」は *素材*（登録する）と *稼ぐ*（提携と成果）の
 * 両方にあり、運営者はどちらを開くか決められず、結局両方開いていた。
 *
 * 設定・AI の利用と費用・道具・画面部品の見本はここに入れない。
 * 「これについて作業する」と言える対象物ではないからで、5 つに無理に混ぜると
 * ラベルから中身が言い当てられなくなる。`nav.group` を `null` にして分類の外へ置く。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/entry-consolidation-contract.md
 */
export const ADMIN_NAV_GROUP_LABELS = {
  blog: "ブログ",
  article: "記事",
  reader: "読者",
  product: "商品",
  delivery: "配信",
} as const;

export type AdminNavGroupId = keyof typeof ADMIN_NAV_GROUP_LABELS;

type NavDefinition = {
  readonly group: AdminNavGroupId | null;
  readonly requires: string | null;
  readonly icon: IconName;
};

type RouteDefinition = {
  readonly label: string | null;
  readonly parent: string | null;
  readonly nav: NavDefinition | null;
  /** DOMを持たずcanonical画面へ移すだけのlegacy adapter。 */
  readonly redirectOnly?: boolean;
};

const nav = (
  label: string,
  group: AdminNavGroupId | null,
  requires: string | null,
  icon: IconName,
): RouteDefinition => ({ label, parent: "", nav: { group, requires, icon } });

const child = (parent: string, label: string | null): RouteDefinition => ({
  label,
  parent,
  nav: null,
});

/**
 * キーは `/admin/` より後ろのroute pattern。空文字だけが `/admin` を表す。
 * 並び順はそのままサイドバーの業務順になる。
 */
const ADMIN_ROUTE_DEFINITIONS = {
  "": { label: "ホーム", parent: null, nav: { group: null, requires: null, icon: "home" } },
  products: nav("商品", "product", "product.read", "product"),
  "products/[product]": child("products", null),
  "products/[product]/edit": child("products/[product]", "編集"),
  "products/compare": child("products", "商品を比べる"),
  "products/new": child("products", "商品を追加"),
  evidence: nav("根拠", "article", "content.read", "evidence"),
  "evidence/new": child("evidence", "根拠を登録する"),
  "evidence/claims/new": child("evidence", "言えることを登録する"),
  "evidence/test-runs/new": child("evidence", "検証記録を登録する"),
  rankings: nav("評価基準と順位", "article", "content.read", "ranking"),
  "rankings/criteria": child("rankings", "評価基準"),
  "rankings/models": child("rankings", "評価基準を管理する"),
  "rankings/models/new": child("rankings/models", "評価基準を作る"),
  "rankings/scores": child("rankings", "点を入れる"),
  content: nav("記事", "article", "content.read", "article"),
  "content/[variant]": child("content", null),
  "content/[variant]/edit": child("content/[variant]", "文章を直す"),
  "content/[variant]/progress": child("content/[variant]", "公開までの進み具合"),
  "content/matrix": child("content", "記事案をまとめて作る"),
  "content/packages": child("content", "企画"),
  "content/packages/new": child("content/packages", "企画を立てる"),
  "content/new": child("content", "記事を作る"),
  "content/published": child("content", "公開済み記事"),
  // 公開済みの記事は「どのブログの、どの記事か」で 1 本に決まる。
  // 下書き（`content/[variant]`）と id の体系が別なので、親を分けている。
  "content/published/[site]/[slug]/edit": child("content/published", "公開済み記事を直す"),
  /*
    書き手と読者像は `sites/[site]/` の下へ移った。ここに残る 4 本は
    **転送だけを行う殻**で、DOM を持たない (`redirectOnly`)。
    消さないのは、消すと 1 クリックで開けていた画面が 2 クリックになるからで、
    サイドバーの入口としては残す (`shortcut-contract.md`)。

    ラベルを「書き手と読者像」から「書き手」へ変えた。書き手は読者ではないので
    「読者」の分類には置けず、記事を書く人なので `article` に置く。
    2 つの対象物を 1 つのラベルに束ねたままだと、ラベルから中身が言い当てられない。
  */
  personas: { ...nav("書き手", "article", "content.read", "audience"), redirectOnly: true },
  "personas/new": { ...child("personas", "書き手を作る"), redirectOnly: true },
  "personas/audiences": { ...child("personas", "読者像"), redirectOnly: true },
  "personas/audiences/new": {
    ...child("personas/audiences", "読者像を作る"),
    redirectOnly: true,
  },
  writing: {
    ...nav("書き方の決めごと", "article", "content.read", "writing"),
    redirectOnly: true,
  },
  "writing/template": child("writing", "共通の雛形"),
  generation: nav("生成の仕組み", "article", "content.read", "generation"),
  "generation/inputs": child("generation", "生成に使う情報"),
  "generation/prompt": child("generation", "生成指示"),
  "site-network": nav("ブログのつながり", "blog", "content.read", "siteNetwork"),
  "site-network/[node]": child("site-network", null),
  "site-network/deleted": child("site-network", "削除済み"),
  "site-network/new": child("site-network", "つながりに 1 本足す"),
  blog: nav("ブログの版面", "blog", "content.read", "blogLayout"),
  "blog/articles": child("blog", "記事"),
  "blog/articles/[article]": child("blog/articles", null),
  "blog/articles/deleted": child("blog/articles", "削除済み"),
  "blog/articles/new": child("blog/articles", "記事を 1 本作る"),
  "blog/delivery": child("blog", "配信の部品"),
  "blog/evaluate": child("blog", "読者の評価"),
  // 一覧の「評価件数」から飛ぶ先。1 本の記事に付いた票を 1 件ずつ見る画面。
  "blog/evaluate/[article]": child("blog/evaluate", null),
  "blog/layout": child("blog", "版面の枠と帯"),
  "blog/pages": { ...child("blog", "固定ページ"), redirectOnly: true },
  "blog/tags": child("blog", "タグ"),
  sites: nav("サイト", "blog", "content.read", "site"),
  "sites/[site]": child("sites", null),
  "sites/[site]/edit": child("sites/[site]", "サイトを直す"),
  "sites/[site]/documents": child("sites/[site]", "固定ページ"),
  "sites/[site]/appearance": child("sites/[site]", "見せ方と配色"),
  "sites/[site]/placements": child("sites/[site]", "成果リンクの掲載"),
  /*
    ブログ運営コンソール (arch-blog-operations-console) の 4 層を、
    ブログ 1 本の下にぶら下げる。**`analytics` の下に置かない。**
    横断の分析画面と同じ場所に置くと、「どのブログの数字か」を
    画面の中の選択欄で切り替えることになり、選び忘れたまま
    別のブログの数字を読む形が作れる。住所の下なら取り違えようがない。
  */
  "sites/[site]/domains": child("sites/[site]", "住所（独自ドメイン）"),
  "sites/[site]/audience": child("sites/[site]", "読者の行動"),
  /*
    読者像は「読者の行動」の下に置く。「誰が読んでいるか」と
    「誰に向けて書くと決めたか」は同じ問いの表と裏で、別の枝に分けると
    片方を見た人がもう片方に辿り着けない。

    書き手はここに置かない。書き手は読者ではないので、`audience` の下に入れると
    住所そのものが「読者の下に書き手がいる」と言うことになる。
  */
  "sites/[site]/audience/personas": child("sites/[site]/audience", "読者像"),
  "sites/[site]/audience/personas/new": child(
    "sites/[site]/audience/personas",
    "読者像を作る",
  ),
  "sites/[site]/authors": child("sites/[site]", "書き手"),
  "sites/[site]/authors/new": child("sites/[site]/authors", "書き手を作る"),
  "sites/[site]/writing": child("sites/[site]", "書き方の決めごと"),
  "sites/[site]/revenue": child("sites/[site]", "記事ごとの成果"),
  "sites/[site]/seo": child("sites/[site]", "SEO 診断"),
  "sites/[site]/aeo": child("sites/[site]", "AEO（回答エンジン）"),
  "sites/new": child("sites", "サイトを作る"),
  distribution: nav("配信", "delivery", "content.read", "distribution"),
  "distribution/[publication]": child("distribution", null),
  "distribution/[publication]/edit": child("distribution/[publication]", "配信を直す"),
  "distribution/calendar": child("distribution", "配信カレンダー"),
  "distribution/new": child("distribution", "配信を作る"),
  affiliate: nav("提携と成果", "product", "affiliate.read_revenue", "affiliate"),
  "affiliate/[conversion]": child("affiliate", null),
  // 登録の 2 口は一覧の下へ置く。提携先が先で、提携条件はその下にぶら下がる。
  // 並びを逆にすると、まだ提携先が無い人が条件の画面から入ってしまう。
  "affiliate/accounts/new": child("affiliate", "提携先を登録する"),
  "affiliate/programs/new": child("affiliate", "提携条件を登録する"),
  // 登録済みのリンクと、止める操作。**受信箱（inbox）とは別の場所にする。**
  // 受信箱は「まだ記事に出ていないものを片付ける場所」で、ここは
  // 「すでに読者に出ているものを見る場所」。混ぜると、出ているリンクが
  // 片付け待ちの列に埋もれて、表記が古くなっても誰も気付かない。
  "affiliate/links": child("affiliate", "登録したリンク"),
  inbox: nav("成果リンクの受信箱", "product", "affiliate.read_revenue", "inbox"),
  analytics: nav("数字", "blog", "analytics.read", "analytics"),
  "ai-usage": nav("AI の利用と費用", null, "analytics.read", "aiUsage"),
  improvement: nav("改善の状況", "article", "analytics.read", "improvement"),
  "improvement/dimensions": child("improvement", "改善の観点"),
  // 読者から届く問い合わせ。改善要望（画面の右下から届く社内向け）とは別に置く。
  // 混ぜると、読者へ返事をする必要があるものが、社内の作業一覧に埋もれる。
  contact: nav("読者からの問い合わせ", "reader", "feedback.read", "opinion"),
  feedback: nav("使い勝手を直す", "reader", "feedback.read", "feedback"),
  "feedback/[report]": child("feedback", null),
  tools: nav("AI から使える道具", null, "content.read", "tool"),
  "ui-catalog": nav("画面部品の見本", null, "content.read", "component"),
  settings: nav("設定", null, "content.read", "settings"),
  "settings/appearance": child("settings", "見た目"),
  "settings/audit": child("settings", "操作の記録"),
  "settings/compliance": child("settings", "広告表記ときまり"),
  "settings/integration-access": child("settings", "外部連携の権限"),
  "settings/llm": child("settings", "AI 接続"),
  "settings/members": child("settings", "メンバー"),
  "settings/roles": child("settings", "役割"),
  "settings/seo": child("settings", "SEO/AI 検索の指針"),
  "settings/workspaces": child("settings", "作業場所"),
  // 直す画面を見るだけの画面の下へ置く。上限や広告表記を確かめに来ただけの人が、
  // 契約の区分に触れる位置に立たないため（区分は上限そのもの）。
  "settings/workspaces/edit": child("settings/workspaces", "設定を直す"),
  "settings/brands/new": child("settings/workspaces", "ブランドを作る"),
  "settings/brands/[brand]": child("settings/workspaces", "ブランドを直す"),
} as const satisfies Record<string, RouteDefinition>;

export type AdminRouteId = keyof typeof ADMIN_ROUTE_DEFINITIONS;

export type AdminRouteMetadata = {
  readonly id: AdminRouteId;
  readonly file: string;
  readonly pattern: string;
  readonly label: string | null;
  readonly parent: AdminRouteId | null;
  readonly nav: NavDefinition | null;
  readonly redirectOnly: boolean;
};

const patternOf = (id: AdminRouteId): string => (id === "" ? "/admin" : `/admin/${id}`);
const fileOf = (id: AdminRouteId): string =>
  id === "" ? "admin/page.tsx" : `admin/${id}/page.tsx`;

export const ADMIN_ROUTE_METADATA: readonly AdminRouteMetadata[] = Object.entries(
  ADMIN_ROUTE_DEFINITIONS,
).map(([id, definition]) => ({
  id: id as AdminRouteId,
  file: fileOf(id as AdminRouteId),
  pattern: patternOf(id as AdminRouteId),
  label: definition.label,
  parent: definition.parent as AdminRouteId | null,
  nav: definition.nav,
  redirectOnly: (definition as RouteDefinition).redirectOnly ?? false,
}));

const ROUTE_BY_ID = new Map(ADMIN_ROUTE_METADATA.map((route) => [route.id, route]));

function metadataOf(id: AdminRouteId): AdminRouteMetadata {
  const route = ROUTE_BY_ID.get(id);
  if (route === undefined) throw new Error(`Unknown admin route: ${id}`);
  return route;
}

function fillPattern(
  pattern: string,
  params: Readonly<Record<string, string>>,
): string {
  return pattern.replace(/\[([^\]]+)\]/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`Missing admin route parameter: ${name}`);
    return encodeURIComponent(value);
  });
}

function ancestorsOf(route: AdminRouteMetadata): readonly AdminRouteMetadata[] {
  const ancestors: AdminRouteMetadata[] = [];
  let parent = route.parent;
  while (parent !== null) {
    const metadata = metadataOf(parent);
    ancestors.unshift(metadata);
    parent = metadata.parent;
  }
  return ancestors;
}

export type AdminBreadcrumb = { readonly label: string; readonly href?: string };

export type ResolvedAdminRoute = {
  readonly actualRoutePath: string;
  readonly navContextPath: string;
  readonly breadcrumbs: (
    currentLabel: string,
    dynamicLabels?: Readonly<Partial<Record<AdminRouteId, string>>>,
  ) => readonly AdminBreadcrumb[];
};

/** 実route、選択中ナビ、パンくずを同じroute IDから別々に射影する。 */
export function resolveAdminRoute(
  id: AdminRouteId,
  params: Readonly<Record<string, string>> = {},
): ResolvedAdminRoute {
  const route = metadataOf(id);
  const ancestors = ancestorsOf(route);
  const navRoute = [...ancestors, route].findLast((candidate) => candidate.nav !== null);
  if (navRoute === undefined) throw new Error(`Admin route has no nav ancestor: ${id}`);

  return {
    actualRoutePath: fillPattern(route.pattern, params),
    navContextPath: navRoute.pattern,
    breadcrumbs: (currentLabel, dynamicLabels = {}) => [
      ...ancestors.map((ancestor) => {
        const label = ancestor.label ?? dynamicLabels[ancestor.id];
        if (label === undefined) {
          throw new Error(`Missing breadcrumb label for admin route: ${ancestor.id}`);
        }
        return { label, href: fillPattern(ancestor.pattern, params) };
      }),
      { label: route.label ?? currentLabel },
    ],
  };
}
