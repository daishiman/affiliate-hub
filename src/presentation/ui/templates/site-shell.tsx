import Link from "next/link";
import type { ReactNode } from "react";
import { UI_COPY } from "../copy";
import styles from "./site.module.css";

/**
 * 読者向けブログの骨格。
 *
 * **ブログ 1 本ごとに書かない。** ここ 1 つを、すべてのブログが使う。
 * 見た目の違いは `data-brand-theme` によるトークンの差し替えだけで作る。
 * 「このブログのときだけ」の分岐をこのファイルに書いたら設計の失敗。
 *
 * 管理画面の `AppShell` とは別にしている理由:
 * 読者には「作業の途中」が無いため、退避先（保存・戻る・次へ）の概念が要らない。
 * 代わりに要るのは、方針ページへ辿り着ける足元の導線。
 */

export type SiteNavItem = {
  readonly href: string;
  readonly label: string;
};

export type SiteChrome = {
  /** ブログ名。ヘッダーの見出しと、読み上げ時の目印になる。 */
  readonly siteName: string;
  /** 何のブログかの 1 文。 */
  readonly tagline: string;
  /** ブランドテーマの名前。トークンの差し替え集合を指す。 */
  readonly brandTheme: string;
  /** ヘッダーの案内。カテゴリーと探す画面。 */
  readonly nav: readonly SiteNavItem[];
  /** 足元の案内。方針・訂正・問い合わせ。 */
  readonly footer: readonly SiteNavItem[];
};

export function SiteShell({
  chrome,
  currentPath,
  breadcrumbs,
  children,
}: {
  readonly chrome: SiteChrome;
  readonly currentPath: string;
  readonly breadcrumbs?: readonly { readonly label: string; readonly href?: string }[];
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.siteShell} data-brand-theme={chrome.brandTheme}>
      <header className={styles.siteHeader}>
        <div className={styles.siteHeaderInner}>
          <Link href={chrome.nav[0]?.href ?? currentPath} className={styles.siteName}>
            {chrome.siteName}
          </Link>
          <span className={styles.siteTagline}>{chrome.tagline}</span>
          <nav className={styles.siteNav} aria-label="このブログの案内">
            {chrome.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={currentPath === item.href ? "page" : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.siteMain}>
        {breadcrumbs !== undefined && breadcrumbs.length > 0 && (
          <nav className={styles.breadcrumb} aria-label="現在の場所">
            {breadcrumbs.map((crumb, i) => (
              <span key={`${crumb.label}-${i}`}>
                {i > 0 && <span aria-hidden="true"> / </span>}
                {crumb.href !== undefined && i < breadcrumbs.length - 1 ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {children}
      </main>

      <footer className={styles.siteFooter}>
        <div className={styles.siteFooterInner}>
          <nav aria-label="方針と問い合わせ">
            <ul className={styles.footerLinks}>
              {chrome.footer.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <p className={styles.footerNote}>{UI_COPY.disclosure.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * どのブログにも属さない画面の枠（入口ページ）。
 *
 * ブログの枠（`SiteShell`）を流用しない。流用すると、ブログ名も方針リンクも
 * 無いまま読者向けの見た目だけが出て、「どのブログを読んでいるのか」が
 * 分からない画面になる。ここは「まだブログを選んでいない」状態の枠。
 */
export function PublicShell({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.siteShell}>
      <header className={styles.siteHeader}>
        <div className={styles.siteHeaderInner}>
          <Link href="/" className={styles.siteName}>
            {title}
          </Link>
        </div>
      </header>
      <main className={styles.siteMain}>{children}</main>
    </div>
  );
}

/** 読者向けの見出しブロック。記事以外の画面（一覧・探す・方針）で使う。 */
export function SitePage({
  title,
  lead,
  wide = false,
  children,
}: {
  readonly title: string;
  readonly lead?: string;
  /** 表や一覧を出す画面は本文幅より広くする。 */
  readonly wide?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <div className={[styles.article, wide ? styles.wide : null].filter(Boolean).join(" ")}>
      <h1 className={styles.articleTitle}>{title}</h1>
      {lead !== undefined && <p className={styles.articleSummary}>{lead}</p>}
      {children}
    </div>
  );
}
