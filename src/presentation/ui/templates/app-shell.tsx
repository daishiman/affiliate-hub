import Link from "next/link";
import type { ReactNode } from "react";
import styles from "../primitives/ui.module.css";

/**
 * 画面の骨格。
 *
 * **現在地と退避先は常に見える。** これを画面ごとに書くと、
 * ある画面だけ「戻る」が無い、という抜けが必ず起きる。
 * 共通レイアウト部品 1 箇所に集約する (ux-design §2-2)。
 *
 *   現在地 … 左の一覧で太字 + パンくず
 *   退避先 … 右上に固定（保存・戻る・次へ）
 *
 * 適用しない画面: ログイン画面と、公開ブログの読者向けページ。
 * どちらも「作業の途中」が無いため、退避先の概念が要らない。
 */
export type NavItem = {
  readonly href: string;
  readonly label: string;
  /**
   * この項目を見せてよい人が持っている「できること」。
   *
   * ここに書くのは名前だけで、誰が持っているかの判定は domain 側が決める
   * （部品に業務判断を持たせない）。null は「誰にでも見せる」。
   *
   * **見せない判断を画面ごとに書かない。** 1 画面でも書き忘れると、
   * 押しても必ず断られるリンクが残る。
   */
  readonly requires: string | null;
};

/**
 * 案内の一覧。
 *
 * ここに載っていない画面は、どこからも辿り着けない孤立ページになる。
 * 画面を足したらこの表にも足す。
 */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "ホーム", requires: null },
  { href: "/admin/products", label: "商品", requires: "product.read" },
  { href: "/admin/evidence", label: "根拠", requires: "content.read" },
  { href: "/admin/rankings", label: "評価基準と順位", requires: "content.read" },
  { href: "/admin/content", label: "記事", requires: "content.read" },
  { href: "/admin/personas", label: "書き手と読者像", requires: "content.read" },
  { href: "/admin/sites", label: "サイト", requires: "content.read" },
  { href: "/admin/distribution", label: "配信", requires: "content.read" },
  { href: "/admin/affiliate", label: "提携と成果", requires: "affiliate.read_revenue" },
  { href: "/admin/inbox", label: "成果リンクの受信箱", requires: "affiliate.read_revenue" },
  { href: "/admin/analytics", label: "数字", requires: "analytics.read" },
  { href: "/admin/settings", label: "設定", requires: "content.read" },
];

/**
 * その人に見せる案内だけを残す。
 *
 * `capabilities` を渡さないときは全部見せる（読者向けの画面や、
 * 権限の概念が無い場面で使えるようにするため）。
 */
export function visibleNav(
  items: readonly NavItem[],
  capabilities: readonly string[] | undefined,
): readonly NavItem[] {
  if (capabilities === undefined) return items;
  const held = new Set(capabilities);
  return items.filter((item) => item.requires === null || held.has(item.requires));
}

export type Breadcrumb = {
  readonly label: string;
  readonly href?: string;
};

export function AppShell({
  currentPath,
  breadcrumbs,
  actions,
  capabilities,
  children,
}: {
  readonly currentPath: string;
  readonly breadcrumbs: readonly Breadcrumb[];
  /** 退避先。保存・戻る・次へ。無い画面でも「一覧へ戻る」は置く。 */
  readonly actions?: ReactNode;
  /** その人が持っている「できること」。渡すと案内が絞られる。 */
  readonly capabilities?: readonly string[];
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="主な案内">
        <span className={styles.brandName}>affiliate-hub</span>
        {visibleNav(ADMIN_NAV, capabilities).map((item) => {
          const current = currentPath === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[styles.navLink, current ? styles.navLinkCurrent : null]
                .filter(Boolean)
                .join(" ")}
              // 色と太さだけでなく、読み上げにも現在地を伝える
              aria-current={current ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.main}>
        <header className={styles.header}>
          <nav className={styles.breadcrumb} aria-label="現在の場所">
            {breadcrumbs.map((crumb, i) => {
              const last = i === breadcrumbs.length - 1;
              return (
                <span key={crumb.label}>
                  {i > 0 && <span aria-hidden="true"> / </span>}
                  {crumb.href !== undefined && !last ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span className={last ? styles.breadcrumbCurrent : undefined}>{crumb.label}</span>
                  )}
                </span>
              );
            })}
          </nav>
          {actions !== undefined && <div className={styles.headerActions}>{actions}</div>}
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}

export function Page({
  title,
  lead,
  children,
}: {
  readonly title: string;
  /** この画面で何ができるかの 1 文。機能名の言い換えにしない。 */
  readonly lead: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>{title}</h1>
      <p className={styles.pageLead}>{lead}</p>
      {children}
    </div>
  );
}

export function Card({ children }: { readonly children: ReactNode }) {
  return <section className={styles.card}>{children}</section>;
}
