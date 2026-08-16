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
};

/**
 * 案内の一覧。
 *
 * ここに載っていない画面は、どこからも辿り着けない孤立ページになる。
 * 画面を足したらこの表にも足す。
 */
export const ADMIN_NAV: readonly NavItem[] = [
  { href: "/admin", label: "ホーム" },
  { href: "/admin/products", label: "商品" },
  { href: "/admin/evidence", label: "根拠" },
  { href: "/admin/rankings", label: "評価基準と順位" },
  { href: "/admin/content", label: "記事" },
  { href: "/admin/personas", label: "書き手と読者像" },
  { href: "/admin/sites", label: "サイト" },
  { href: "/admin/distribution", label: "配信" },
  { href: "/admin/affiliate", label: "提携と成果" },
  { href: "/admin/inbox", label: "成果リンクの受信箱" },
  { href: "/admin/analytics", label: "数字" },
  { href: "/admin/settings", label: "設定" },
];

export type Breadcrumb = {
  readonly label: string;
  readonly href?: string;
};

export function AppShell({
  currentPath,
  breadcrumbs,
  actions,
  children,
}: {
  readonly currentPath: string;
  readonly breadcrumbs: readonly Breadcrumb[];
  /** 退避先。保存・戻る・次へ。無い画面でも「一覧へ戻る」は置く。 */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="主な案内">
        <span className={styles.brandName}>affiliate-hub</span>
        {ADMIN_NAV.map((item) => {
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
