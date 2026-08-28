import Link from "next/link";
import type { ReactNode } from "react";
import type { AppearanceValues } from "../appearance";
import { UI_COPY } from "../copy";
import type { ConsentAnswer } from "../consent";
import { AppearancePicker } from "../patterns/appearance-picker";
import { ConsentBanner } from "../patterns/consent-banner";
import type { SelectOption } from "../primitives/select";
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
  /** サイドバーに出すカテゴリーだけの案内。 */
  readonly categoryNav: readonly SiteNavItem[];
  /** ロゴとサイドバーから戻るブログの入口。 */
  readonly homeHref: string;
  /** 共通検索フォームの送信先。 */
  readonly searchHref: string;
  /** ブログの運営方針。フッター配列の並びに依存させない。 */
  readonly aboutHref: string;
  /** 足元の案内。方針・訂正・問い合わせ。 */
  readonly footer: readonly SiteNavItem[];
};

export function SiteShell({
  chrome,
  currentPath,
  breadcrumbs,
  appearance,
  consent,
  telemetry,
  sidebar,
  children,
}: {
  readonly chrome: SiteChrome;
  readonly currentPath: string;
  readonly breadcrumbs?: readonly { readonly label: string; readonly href?: string }[];
  /**
   * 読者がいま選んでいる明るさ。
   *
   * **配色の選択肢は渡さない。** 配色はブログのブランドであり、読者が選ぶものではない。
   * 明るさだけを読者に開けているのは、暗い場所で読む人が
   * ブログの都合で眩しい画面を強制されないようにするため。
   */
  readonly appearance?: {
    readonly current: AppearanceValues;
    readonly modeOptions: readonly SelectOption[];
  };
  /**
   * 計測についての回答。
   *
   * **ここ 1 箇所からしか出さない。** 画面ごとに置くと、
   * どこかの画面だけ聞かずに測る状態になる。
   */
  readonly consent?: {
    readonly current: ConsentAnswer;
    readonly detailHref: string;
  };
  /** 計測を拾う部品。画面ではなく骨格に置く（置き忘れを起こさないため）。 */
  readonly telemetry?: ReactNode;
  /** 記事目次など、その画面にだけ必要な補助導線。 */
  readonly sidebar?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.siteShell} data-brand-theme={chrome.brandTheme}>
      {telemetry}
      <header className={styles.siteHeader}>
        <div className={styles.siteHeaderInner}>
          <div className={styles.siteIdentity}>
            <Link href={chrome.homeHref} className={styles.siteName}>
              {chrome.siteName}
            </Link>
            <span className={styles.siteTagline}>{chrome.tagline}</span>
          </div>
          <SiteSearch
            action={chrome.searchHref}
            inputId="site-header-search"
            landmarkLabel="ヘッダーから記事を探す"
            compact
          />
        </div>
        <div className={styles.siteNavBar}>
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
        <div className={styles.siteBody}>
          <div className={styles.siteContent}>{children}</div>
          <aside className={styles.siteSidebar} aria-label="記事を探す">
            {sidebar}
            <section className={styles.sidebarSection}>
              <h2 className={styles.sidebarHeading}>キーワードから探す</h2>
              <SiteSearch
                action={chrome.searchHref}
                inputId="site-sidebar-search"
                landmarkLabel="サイドバーから記事を探す"
              />
            </section>
            <section className={styles.sidebarSection}>
              <h2 className={styles.sidebarHeading}>カテゴリーから探す</h2>
              <nav aria-label="カテゴリーの案内">
                <ul className={styles.sidebarLinks}>
                  {chrome.categoryNav.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href}>{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </section>
            <section className={styles.sidebarSection}>
              <h2 className={styles.sidebarHeading}>このブログについて</h2>
              <p>{chrome.tagline}</p>
              <Link href={chrome.aboutHref}>運営方針を見る</Link>
            </section>
          </aside>
        </div>
      </main>

      <footer className={styles.siteFooter}>
        <div className={styles.siteFooterInner}>
          <div className={styles.footerAbout}>
            <Link href={chrome.homeHref} className={styles.footerSiteName}>
              {chrome.siteName}
            </Link>
            <p>{chrome.tagline}</p>
          </div>
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
          {consent !== undefined && (
            <ConsentBanner current={consent.current} detailHref={consent.detailHref} />
          )}
          {appearance !== undefined && (
            /*
              管理画面と同じ部品。読者用に別の切り替えを作らない。
              足元に置くのは、読み終わったところで目に入る位置であり、
              かつ本文より先に現れて読む邪魔をしない位置だから。
            */
            <AppearancePicker
              current={appearance.current}
              modeOptions={appearance.modeOptions}
              legend="読みやすさ"
              description="暗い場所で読むときは「暗い画面」を選べます。"
            />
          )}
          <p className={styles.copyright}>© {new Date().getFullYear()} {chrome.siteName}</p>
        </div>
      </footer>
    </div>
  );
}

function SiteSearch({
  action,
  inputId,
  landmarkLabel,
  compact = false,
}: {
  readonly action: string;
  readonly inputId: string;
  readonly landmarkLabel: string;
  readonly compact?: boolean;
}) {
  return (
    <form
      action={action}
      role="search"
      aria-label={landmarkLabel}
      className={[styles.siteSearch, compact ? styles.siteSearchCompact : null]
        .filter(Boolean)
        .join(" ")}
    >
      <label htmlFor={inputId} className={styles.srOnly}>
        記事をキーワードで探す
      </label>
      <input
        id={inputId}
        type="search"
        name="q"
        placeholder="記事を検索"
      />
      <button type="submit">検索</button>
    </form>
  );
}

export type CategoryDirectoryItem = SiteNavItem & { readonly description: string };

/** ホームの主役。ブログの対象と探し始める場所を 1 画面内に置く。 */
export function SiteHomeHero({
  name,
  purpose,
  searchHref,
}: {
  readonly name: string;
  readonly purpose: string;
  readonly searchHref: string;
}) {
  return (
    <section className={styles.homeHero}>
      <p className={styles.homeEyebrow}>知りたいことから、記事を探せます</p>
      <h1>{name}</h1>
      <p>{purpose}</p>
      <SiteSearch
        action={searchHref}
        inputId="site-home-search"
        landmarkLabel="ホームから記事を探す"
      />
    </section>
  );
}

/** カテゴリーは色分けせず、名前と 1 文で選べる索引にする。 */
export function CategoryDirectory({ items }: { readonly items: readonly CategoryDirectoryItem[] }) {
  return (
    <ul className={styles.categoryDirectory}>
      {items.map((item) => (
        <li key={item.href}>
          <Link href={item.href}>{item.label}</Link>
          <p>{item.description}</p>
        </li>
      ))}
    </ul>
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
