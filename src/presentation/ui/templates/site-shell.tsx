import Link from "next/link";
import type { ReactNode } from "react";
import type { AppearanceValues } from "../appearance";
import { UI_COPY } from "../copy";
import type { ConsentAnswer } from "../consent";
import { AppearancePicker } from "../patterns/appearance-picker";
import { ConsentBanner } from "../patterns/consent-banner";
import { Icon, type IconName } from "../primitives/icon";
import type { SelectOption } from "../primitives/select";
import { ArticleList, type ArticleCardView } from "./article-view";
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
  /**
   * 一覧の中で形から見分けるための記号。
   *
   * **色は持たせない。** 色で区別すると、色覚の違いや高コントラスト表示で
   * 区別が消える。無いときは文字だけで出す（抜けても壊れない）。
   */
  readonly icon?: IconName;
};

/**
 * ブランドで探すための 1 つ。
 *
 * 件数を持たせるのは、大きさで扱いの多さを見せるため。
 * ただし**大きさだけに頼らない**。数字も併記する
 * （大きさの差は、拡大表示や高コントラスト表示では読み取りづらい）。
 */
export type SiteBrandTag = {
  readonly href: string;
  readonly label: string;
  /** そのブランドを扱っている公開記事の本数。 */
  readonly count: number;
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
  /**
   * ブランドで探すための一覧。
   *
   * 記事から数えて作る。**運営が手で並べる欄にしない。**
   * 手で並べると、記事を書いた日と欄を直す日がずれ、
   * 「載っているのに探せないブランド」が静かに増える。
   * 扱いが 0 本のブランドはここに来ない（押すと空振りする導線を作らない）。
   */
  readonly brands: readonly SiteBrandTag[];
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
      <a className={styles.skipLink} href="#site-main-content">
        本文へ移動
      </a>
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

      <main id="site-main-content" className={styles.siteMain}>
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
          {/*
            サイドバーは 2 段に分ける。

            上の段（探すための道具）は本文と一緒に流れ、
            下の段（目次と広告）は読んでいる間ずっと貼り付く。

            なぜ全部を貼り付けないのか: 検索とカテゴリーは
            **読み終わってから**使うもので、読んでいる最中に必要なのは
            「いま記事のどこにいるか」だけである。全部貼り付けると、
            画面の高さを常に占有した上に、目次が画面外へ押し出される。
          */}
          <aside className={styles.siteSidebar} aria-label="記事を探す">
            <div className={styles.sidebarFlow}>
              <section className={styles.sidebarSection}>
                <h2 className={styles.sidebarHeading}>
                  <Icon name="search" className={styles.sidebarHeadingIcon} />
                  キーワードから探す
                </h2>
                <SiteSearch
                  action={chrome.searchHref}
                  inputId="site-sidebar-search"
                  landmarkLabel="サイドバーから記事を探す"
                />
              </section>
              <section className={styles.sidebarSection}>
                <h2 className={styles.sidebarHeading}>
                  <Icon name="compass" className={styles.sidebarHeadingIcon} />
                  カテゴリーから探す
                </h2>
                <nav aria-label="カテゴリーの案内">
                  <ul className={styles.sidebarLinks}>
                    {chrome.categoryNav.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href}>
                          <Icon
                            name={item.icon ?? "tag"}
                            className={styles.sidebarLinkIcon}
                          />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>
              </section>
              {chrome.brands.length > 0 && (
                <section className={styles.sidebarSection}>
                  <h2 className={styles.sidebarHeading}>
                    <Icon name="tag" className={styles.sidebarHeadingIcon} />
                    ブランドから探す
                  </h2>
                  <BrandTagCloud brands={chrome.brands} />
                </section>
              )}
              <section className={styles.sidebarSection}>
                <h2 className={styles.sidebarHeading}>
                  <Icon name="home" className={styles.sidebarHeadingIcon} />
                  このブログについて
                </h2>
                <p>{chrome.tagline}</p>
                <Link href={chrome.aboutHref}>運営方針を見る</Link>
              </section>
            </div>
            {/*
              **目次を広告より上に置く。** この欄は高さに上限があり、
              入りきらない分は中でスクロールさせる作りなので、
              上に置いたほうが必ず見える。参考にした作りは広告が上だったが、
              読んでいる間ずっと見えていてほしいのは、読者が現在地を確かめる目次のほう。
            */}
            <div className={styles.sidebarSticky}>
              {sidebar}
              <SidebarAdSlot />
            </div>
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

/**
 * ブランドの一覧。扱いの多いものほど大きく出す。
 *
 * --- 大きさの段を 3 つに絞る理由 ---
 * 参考にした作りは件数に比例した連続の大きさ（8pt〜22pt）だった。
 * ここでは 3 段にする。小さい側が本文より小さくなると押しづらくなり、
 * 指で操作する人と拡大して読む人が最初に切り捨てられる。
 * 3 段なら「多い・普通・少ない」は伝わり、下限は本文と同じに保てる。
 *
 * 件数は**数字でも書く**。大きさの差は拡大表示では読み取れない。
 */
function BrandTagCloud({ brands }: { readonly brands: readonly SiteBrandTag[] }) {
  const counts = brands.map((b) => b.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  /*
    全部が同じ本数のときは差を付けない。
    差が無いのに大小を付けると、無い意味を読ませることになる。
  */
  const span = max - min;

  const sizeOf = (count: number): "lg" | "md" | "sm" => {
    if (span === 0) return "md";
    const ratio = (count - min) / span;
    if (ratio >= 0.66) return "lg";
    if (ratio >= 0.33) return "md";
    return "sm";
  };

  return (
    <ul className={styles.brandCloud}>
      {brands.map((brand) => (
        <li key={brand.href}>
          <Link
            href={brand.href}
            className={styles.brandTag}
            data-size={sizeOf(brand.count)}
            /* 読み上げには件数まで含めて 1 度で伝える。 */
            aria-label={`${brand.label}（${brand.count} 件の記事）`}
          >
            <Icon name="tag" className={styles.brandTagIcon} />
            <span>{brand.label}</span>
            <span className={styles.brandTagCount} aria-hidden="true">
              {brand.count}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * 広告の場所。
 *
 * いまは**枠だけ**で、配信の仕組みは入っていない。
 * 空の四角を黙って置かないのは、読者からは読み込み失敗と区別が付かないため。
 * 何も入っていないことを文字で言う。
 *
 * `data-ad-slot` は差し込み側の目印。この属性を目印にすれば、
 * 配信を入れるときにこのファイルを触らずに済む。
 */
function SidebarAdSlot() {
  return (
    <section className={styles.sidebarAd} aria-label="広告の場所">
      <p className={styles.sidebarAdLabel}>
        <Icon name="megaphone" className={styles.sidebarHeadingIcon} />
        広告
      </p>
      <div className={styles.sidebarAdFrame} data-ad-slot="sidebar">
        <span>この場所には広告が入ります。</span>
      </div>
    </section>
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

/** ホームの章。新着とカテゴリーを同じ見出し階層・余白で読むための共通枠。 */
export function SiteSection({
  id,
  eyebrow,
  title,
  lead,
  children,
}: {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly lead: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={styles.siteSection} aria-labelledby={id}>
      <header className={styles.siteSectionHead}>
        <p>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <span>{lead}</span>
      </header>
      {children}
    </section>
  );
}

export type CategoryArticleGroupView = CategoryDirectoryItem & {
  readonly articles: readonly ArticleCardView[];
};

/** カテゴリーごとの代表記事と、そのカテゴリー全体への出口。 */
export function CategoryArticleGroups({
  groups,
}: {
  readonly groups: readonly CategoryArticleGroupView[];
}) {
  return (
    <ul className={styles.categoryArticleGroups}>
      {groups.map((group) => (
        <li key={group.href}>
          <header className={styles.categoryArticleGroupHead}>
            <div>
              <h3>{group.label}</h3>
              <p>{group.description}</p>
            </div>
            <Link href={group.href}>このカテゴリーをすべて見る</Link>
          </header>
          {group.articles.length > 0 ? (
            <ArticleList
              articles={group.articles}
              emptyTitle=""
              emptyBody=""
              headingLevel="h4"
            />
          ) : (
            <p className={styles.categoryArticleGroupEmpty}>
              代表記事は準備中です。<Link href={group.href}>カテゴリーの案内を見る</Link>
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

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
      <a className={styles.skipLink} href="#public-main-content">
        本文へ移動
      </a>
      <header className={styles.siteHeader}>
        <div className={styles.siteHeaderInner}>
          <div className={styles.siteIdentity}>
            <Link href="/" className={styles.siteName}>
              {title}
            </Link>
            <span className={styles.siteTagline}>運営するブログと記事を一か所から案内します</span>
          </div>
        </div>
        <div className={styles.siteNavBar}>
          <nav className={styles.siteNav} aria-label="サイトの案内">
            <Link href="/">ブログ一覧</Link>
            <Link href="/signin">運営者ログイン</Link>
          </nav>
        </div>
      </header>
      <main id="public-main-content" className={styles.siteMain}>
        {children}
      </main>
      <footer className={styles.siteFooter}>
        <div className={styles.siteFooterInner}>
          <div className={styles.footerAbout}>
            <Link href="/" className={styles.footerSiteName}>
              {title}
            </Link>
            <p>ブログを読む人と運営する人の入口です。</p>
          </div>
          <nav aria-label="サイトの足元の案内">
            <ul className={styles.footerLinks}>
              <li><Link href="/">ブログ一覧</Link></li>
              <li><Link href="/signin">運営者ログイン</Link></li>
            </ul>
          </nav>
          <p className={styles.copyright}>© {new Date().getFullYear()} {title}</p>
        </div>
      </footer>
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
