import Link from "next/link";
import type { ReactNode } from "react";
import { APPEARANCE_ATTR, type AppearanceValues } from "../appearance";
import { UI_COPY } from "../copy";
import type { ConsentAnswer } from "../consent";
import { AppearancePicker } from "../patterns/appearance-picker";
import { ConsentBanner } from "../patterns/consent-banner";
import type { SelectOption } from "../primitives/select";
import uiStyles from "../primitives/ui.module.css";
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
  appearance,
  consent,
  telemetry,
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
  readonly children: ReactNode;
}) {
  return (
    <div className={styles.siteShell} {...{ [APPEARANCE_ATTR.scheme]: chrome.brandTheme }}>
      {telemetry}
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
 *
 * **`SiteShell` と違って `data-brand-theme` を当てない。これは付け忘れではない。**
 * ブランド配色は「このブログの色」であり、当てるにはどのブログかが決まっていないと
 * いけない。入口ページ（`/`・`/signin`・見つからないブログ）は、まさにそれが
 * 決まっていない画面である。ここで何かのブログの色を当てれば、
 * 無関係なブログの見た目でログイン画面が出ることになる。
 * だから `chrome` を受け取る口ごと持たない。**揃っていないのが正しい状態**であり、
 * 揃えると壊れる。（`tests/ui/public-shell-appearance.test.tsx` が見ている）
 *
 * では何色で出るのか: `src/app/layout.tsx` が `<html>` に、その人が選んだ配色を
 * 当てている。属性セレクタで宣言されたトークンは子孫へ継承されるので、
 * ここに出るのは**製品の既定色ではなく、その人自身が選んだ配色**である。
 * `SiteShell` は、それをブログのブランドで上書きしている側。
 *
 * 明暗（`data-color-mode`）も同じく `<html>` 側にある。**`SiteShell` も
 * `PublicShell` も明暗を持たない**ので、ログイン前だけ暗い画面の選択が
 * 無視される、ということは起きない。枠が明暗を持ち始めたら、
 * 持たない側の画面だけ選択が効かなくなる。持たせないこと。
 *
 * --- 足元に何を出すか（UX-04）---
 * `SiteShell` の足元は `chrome.footer`（そのブログの方針・訂正・問い合わせ）と
 * 同意の帯と読みやすさの切り替えを持つが、**ここはそのどれも出せない。**
 * ブログが決まっていないので方針リンクの行き先が無く（製品としての方針ページは
 * まだ 1 枚も無い。方針は全部 `s/[site]/…` の下にある）、同意はブログごとの話で、
 * どのブログでもない画面で聞いても**誰に対する同意か決まらない**。
 *
 * **読みやすさの切り替え（`AppearancePicker`）も置かない。これも意図である。**
 * 「ログイン前に眩しい画面を出されて、直す手段がその画面に無い」形を避けたくなるが、
 * その形はここでは起きない。明暗の既定は `auto`（`DEFAULT_THEME.colorScheme`）で、
 * `auto` のとき `layout.tsx` は `data-color-mode` を出さず、`:root` の
 * `color-scheme: light dark` が残る。つまり**何も選んでいない人には端末の設定が
 * そのまま出る**。選んだ人の選択は `<html>` に載って効いている。
 * どちらの人も、この画面で困らない。
 * 置く側にも値段がある: ここに切り替えを出すには、3 つの呼び出し元
 * （`app/page.tsx` / `s/[site]/not-found.tsx` / `signin/page.tsx`）がそれぞれ
 * `readAppearance()` を呼んで渡す配線が要り、**cookie を読む場所を数える決まり**
 * （`presentation/appearance.ts` の「呼ぶのは 3 箇所だけ」）が 6 箇所に増える。
 * 通り過ぎる 3 画面のために払う値段ではない。
 *
 * 出しているのは広告の断り 1 文だけ。`UI_COPY.disclosure.footerNote` の説明が
 * 「全ページの足元に常時出す。記事だけに出すと、**一覧経由の読者に伝わらない**」
 * と言っており、入口ページ（`/`）はまさにその一覧そのものだから。
 * ログイン画面にも同じ 1 文が出るが、景品表示法で問題になるのは**出し漏れ**であって
 * 出しすぎではないので、枠に分岐を足してまで消し分けない。
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
      <footer className={styles.siteFooter}>
        <div className={styles.siteFooterInner}>
          <p className={styles.footerNote}>{UI_COPY.disclosure.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * 1 つの作業だけの画面を、真ん中の 1 枚に収める型。
 *
 * ログイン・招待を受ける・設定が済むまでの案内——**その画面ですることが 1 つしか
 * 無い**画面のための型。画面幅いっぱいの中に文が左端から並ぶと、
 * 「読むところ」と「操作するところ」の境目が無く、
 * ここで何かを終わらせる画面には見えない。
 *
 * **画面側に書かない。**1 枚のためだけなら型にする意味が無く、
 * 2 枚目が来たときに必ず微妙に違う箱ができる。
 *
 * 箱の見た目は共通部品の `.card` をそのまま使う（枠 + 影）。
 * **影だけで浮かせない。**強制配色（Windows のハイコントラスト）では
 * `box-shadow` が落ちるので、影しか無い箱は境目ごと消える。
 * ここが持つのは幅の上限と中央寄せと中身の間隔だけ。
 *
 * **縦中央にはしていない。**`.siteMain` は `align-content: start`（UX-01 で直した所。
 * `tests/ui/design-tokens.test.ts` が見張っている）なので、行は中身の高さのまま
 * 上に詰められ、余った高さは行の外に残る。grid 項目の `margin-block: auto` が
 * 吸えるのは**自分の行の中の余り**だけなので、ここで縦中央は作れない。
 * 作るには `.siteMain` 側の配ぶんを変えることになり、それは UX-01 の戻しになる。
 */
export function FocusedTask({ children }: { readonly children: ReactNode }) {
  return <div className={[styles.focusedTask, uiStyles.card].join(" ")}>{children}</div>;
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
