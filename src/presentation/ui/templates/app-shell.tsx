import Link from "next/link";
import type { ReactNode } from "react";
import {
  ADMIN_NAV_GROUP_LABELS,
  ADMIN_ROUTE_METADATA,
  type AdminNavGroupId,
} from "../admin-route-metadata";
import { FeedbackButton, type FeedbackSubmission } from "../patterns/feedback-button";
import { NavCollapseToggle } from "../patterns/nav-collapse-toggle";
import { Icon, type IconName } from "../primitives/icon";
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
  /**
   * 目印のアイコン。畳んだときに残るのはこれだけになる。
   *
   * **項目ごとに違う絵にする。** 重なった 2 項目は、畳んだ時点で見分けが付かない。
   * 型を必須にしてあるので、項目を足して絵を忘れると型検査で止まる。
   *
   * アイコンは意味を持たない。意味は `label` が持ち、読み上げから隠す。
   * アイコンに意味を持たせると、絵柄を知らない人に何も伝わらない画面になる。
   */
  readonly icon: IconName;
};

/**
 * 案内の一覧。
 *
 * route metadataで `nav` を持つ画面だけを、業務順のまま射影する。
 */
export const ADMIN_NAV: readonly NavItem[] = ADMIN_ROUTE_METADATA.flatMap((route) =>
  route.nav === null || route.label === null
    ? []
    : [
        {
          href: route.pattern,
          label: route.label,
          requires: route.nav.requires,
          icon: route.nav.icon,
        },
      ],
);

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

export type NavGroup = {
  readonly id: string;
  readonly label: string;
  /** route metadataで同じ分類IDを持つ項目の行き先。 */
  readonly hrefs: readonly string[];
};

/**
 * 分類の外に置く項目。
 *
 * ホームは「どこかの仕事」ではなく全部の入口なので、分類に入れると
 * どの分類に入れても嘘になる。例外は 1 つだけにして、ここに書き出す。
 */
export const UNGROUPED_NAV_HREFS: readonly string[] = ADMIN_ROUTE_METADATA.filter(
  (route) => route.nav !== null && route.nav.group === null,
).map((route) => route.pattern);

/**
 * 案内の分類。
 *
 * `ADMIN_NAV` と別書きにせず、同じroute metadataの `nav.group` から作る。
 * 項目を足す場所が1箇所なので、ナビだけ増えて分類だけ古い状態を作れない。
 *
 * 分類は、機能名からではなく「誰がどの場面で開くか」から導いている。
 * 各画面の `lead`（この画面で何ができるかの 1 文）が根拠。
 *
 *   素材 … 記事のもとになるものを集めて確かめる
 *   書く … 何を・誰に向けて・どう書くかを決めて書く
 *   出す … どのブログへ、どの経路で出すか
 *   稼ぐ … 提携と、そこから返ってくるお金
 *   見る … 出したあとに何が起きたか
 *   整える … 作業場所そのものの手入れ
 */
export const ADMIN_NAV_GROUPS: readonly NavGroup[] = (
  Object.entries(ADMIN_NAV_GROUP_LABELS) as readonly [AdminNavGroupId, string][]
).map(([id, label]) => ({
  id,
  label,
  hrefs: ADMIN_ROUTE_METADATA.filter((route) => route.nav?.group === id).map(
    (route) => route.pattern,
  ),
}));

export type GroupedNav = {
  /** 分類の外の項目。先頭に単独で置く。 */
  readonly ungrouped: readonly NavItem[];
  readonly groups: readonly { readonly group: NavGroup; readonly items: readonly NavItem[] }[];
};

/**
 * 見せてよい項目だけを分類に割り付ける。
 *
 * **項目が 1 つも残らなかった分類は、見出しごと消す。** 見出しだけが残ると、
 * 「ここに何かあるが自分には見えない」と伝わってしまう。権限で隠すというのは
 * 存在を伏せることなので、空の見出しはその目的を裏切る。
 *
 * `ADMIN_NAV` にあって分類表に無い項目は、黙って落とさず分類の外へ回す。
 * 落とすと、案内から消えた画面が孤立ページになる。
 */
export function groupedNav(
  items: readonly NavItem[],
  groups: readonly NavGroup[],
  capabilities: readonly string[] | undefined,
): GroupedNav {
  const visible = visibleNav(items, capabilities);
  const byHref = new Map(visible.map((item) => [item.href, item]));
  const claimed = new Set<string>();
  const built: { group: NavGroup; items: NavItem[] }[] = [];
  for (const group of groups) {
    const members: NavItem[] = [];
    for (const href of group.hrefs) {
      claimed.add(href);
      const item = byHref.get(href);
      if (item !== undefined) members.push(item);
    }
    if (members.length > 0) built.push({ group, items: members });
  }
  return {
    ungrouped: visible.filter((item) => !claimed.has(item.href)),
    groups: built,
  };
}

/**
 * いま案内のどの項目の中にいるか。
 *
 * 完全一致だけで判定すると、`/admin/settings/appearance` のような
 * 案内に載せていない子画面で現在地が消える。**現在地が消えると、
 * 自分がどの分類の中にいるか分からなくなる。** 画面を単一用途へ割ったことで
 * 子画面は増える一方なので、親が代わりに現在地を示す。
 *
 * 最も長く一致した 1 つだけを選ぶ。前方一致した全部を現在地にすると、
 * `/admin`（ホーム）が常に現在地になり、どの項目も等しく光ってしまう。
 *
 * 一致が無いときは null。無理にどこかを現在地にしない。
 */
export function currentNavHref(
  items: readonly NavItem[],
  navContextPath: string,
): string | null {
  let best: string | null = null;
  for (const item of items) {
    const hit = navContextPath === item.href || navContextPath.startsWith(`${item.href}/`);
    if (!hit) continue;
    if (best === null || item.href.length > best.length) best = item.href;
  }
  return best;
}

export type Breadcrumb = {
  readonly label: string;
  readonly href?: string;
};

/**
 * 改善したいことを送る口。
 *
 * **骨格から 1 回だけ出す。** 画面ごとに置くと、置き忘れた画面の不満だけが
 * どこにも届かず、しかも届いていないことに誰も気づかない。
 */
export type ShellFeedback = {
  /** いま開いている画面の名前。パンくずの末尾をそのまま使う。 */
  readonly screenName: string;
  readonly canSubmit: boolean;
  readonly onSubmit: (submission: FeedbackSubmission) => Promise<{ readonly message: string }>;
};

export function AppShell({
  actualRoutePath,
  navContextPath,
  breadcrumbs,
  actions,
  capabilities,
  feedback,
  navCollapsed = false,
  children,
}: {
  /** いま実際に開いているURL。計測・改善要望の出所へ使う。 */
  readonly actualRoutePath: string;
  /** サイドバーで現在地として示す親route。実URLとは混用しない。 */
  readonly navContextPath: string;
  readonly breadcrumbs: readonly Breadcrumb[];
  /** 退避先。保存・戻る・次へ。無い画面でも「一覧へ戻る」は置く。 */
  readonly actions?: ReactNode;
  /** その人が持っている「できること」。渡すと案内が絞られる。 */
  readonly capabilities?: readonly string[];
  /** 渡さない場面（権限の概念が無い画面）では、ボタンを出さない。 */
  readonly feedback?: ShellFeedback;
  /**
   * 案内を最初から畳んでおくか。前回の選択を復元するときに渡す。
   *
   * 畳んでも項目は HTML から消えない。消えるのは見た目だけで、
   * 名前も行き先も残る（潰すのは CSS の仕事）。
   */
  readonly navCollapsed?: boolean;
  readonly children: ReactNode;
}) {
  const nav = groupedNav(ADMIN_NAV, ADMIN_NAV_GROUPS, capabilities);
  const currentHref = currentNavHref(ADMIN_NAV, navContextPath);
  const navLink = (item: NavItem) => {
    const current = currentHref === item.href;
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
        {/* 目印は意味を持たない。意味は次の文字が持ち、Icon 自身が読み上げから隠れる。 */}
        <span className={styles.navIcon}>
          <Icon name={item.icon} size="md" />
        </span>
        {/* 畳んだときに潰れるのはこの文字だけ。読み上げには残る。 */}
        <span className={styles.navLabel}>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className={styles.shell} data-nav-collapsed={navCollapsed}>
      <a className={styles.skipLink} href="#admin-main-content">
        本文へ移動
      </a>
      <nav className={styles.sidebar} aria-label="主な案内">
        <div className={styles.sidebarHead}>
          <div className={styles.brandBlock}>
            <Link href="/admin" className={styles.brandName}>
              affiliate-hub
            </Link>
            <span className={styles.brandContext}>ブログ運営メニュー</span>
          </div>
          <NavCollapseToggle defaultCollapsed={navCollapsed} />
        </div>
        {/*
          項目は案内の直下に置く。**間の隙間は `.sidebar` の gap が持つ。**
          まとめ役の要素を 1 枚挟むと、隙間を持つ要素が入れ替わり、
          分類の境目の比を測っている検査 (tests/ui/layout-density.test.ts) が
          読む値と、実際に効く値が食い違う。
        */}
        {nav.ungrouped.map(navLink)}
        {nav.groups.map(({ group, items }) => (
          // 分類の境目を、見た目の隙間だけでなく読み上げにも伝える。
          // 隙間だけで分けると、読み上げでは 19 項目が続けて読まれるだけになる。
          <div
            key={group.id}
            className={styles.navGroup}
            role="group"
            aria-labelledby={`nav-group-${group.id}`}
          >
            <h2 id={`nav-group-${group.id}`} className={styles.navGroupLabel}>
              {group.label}
            </h2>
            {items.map(navLink)}
          </div>
        ))}
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
                    <span
                      className={last ? styles.breadcrumbCurrent : undefined}
                      aria-current={last ? "page" : undefined}
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
          {actions !== undefined && <div className={styles.headerActions}>{actions}</div>}
        </header>

        <main id="admin-main-content" className={styles.content}>
          {children}
        </main>
      </div>

      {feedback !== undefined && (
        <FeedbackButton
          screenName={feedback.screenName}
          route={actualRoutePath}
          canSubmit={feedback.canSubmit}
          onSubmit={feedback.onSubmit}
        />
      )}
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
      {/* 見出しと説明文をひとまとめにする。ばらばらに置くと、
          画面全体の縦の間隔と、見出し・説明文の間隔を 1 箇所で決められない。 */}
      <header className={styles.pageHead}>
        <p className={styles.pageEyebrow}>運営画面</p>
        <h1 className={styles.pageTitle}>{title}</h1>
        <p className={styles.pageLead}>{lead}</p>
      </header>
      {children}
    </div>
  );
}

export function Card({ children }: { readonly children: ReactNode }) {
  return <section className={styles.card}>{children}</section>;
}
