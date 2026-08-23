import Link from "next/link";
import type { ReactNode } from "react";
import { FeedbackButton, type FeedbackSubmission } from "../patterns/feedback-button";
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
  { href: "/admin/writing", label: "書き方の決めごと", requires: "content.read" },
  { href: "/admin/generation", label: "生成の仕組み", requires: "content.read" },
  { href: "/admin/sites", label: "サイト", requires: "content.read" },
  { href: "/admin/distribution", label: "配信", requires: "content.read" },
  { href: "/admin/affiliate", label: "提携と成果", requires: "affiliate.read_revenue" },
  { href: "/admin/inbox", label: "成果リンクの受信箱", requires: "affiliate.read_revenue" },
  { href: "/admin/analytics", label: "数字", requires: "analytics.read" },
  { href: "/admin/ai-usage", label: "AI の利用と費用", requires: "analytics.read" },
  { href: "/admin/improvement", label: "改善の状況", requires: "analytics.read" },
  { href: "/admin/feedback", label: "使い勝手を直す", requires: "feedback.read" },
  { href: "/admin/tools", label: "AI から使える道具", requires: "content.read" },
  { href: "/admin/ui-catalog", label: "画面部品の見本", requires: "content.read" },
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

export type NavGroup = {
  readonly id: string;
  readonly label: string;
  /** この分類に入る項目の行き先。`ADMIN_NAV` から作らず、ここに書き出す。 */
  readonly hrefs: readonly string[];
};

/**
 * 分類の外に置く項目。
 *
 * ホームは「どこかの仕事」ではなく全部の入口なので、分類に入れると
 * どの分類に入れても嘘になる。例外は 1 つだけにして、ここに書き出す。
 */
export const UNGROUPED_NAV_HREFS: readonly string[] = ["/admin"];

/** 運営画面の根。現在地を決めるときに、前置きの側へ数えない唯一の項目。 */
export const ADMIN_ROOT = "/admin";

/**
 * 案内の分類。
 *
 * **この表は `ADMIN_NAV` から作らない。** 作ると、`ADMIN_NAV` から項目が
 * 1 つ消えたときに分類表も一緒に消えてしまい、「消えたこと」を誰も言えなくなる。
 * 別々に書いて突き合わせるから、片方だけが変わったときに検査が赤くなる。
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
export const ADMIN_NAV_GROUPS: readonly NavGroup[] = [
  {
    id: "material",
    label: "素材",
    hrefs: ["/admin/products", "/admin/evidence", "/admin/rankings"],
  },
  {
    id: "write",
    label: "書く",
    hrefs: ["/admin/content", "/admin/personas", "/admin/writing", "/admin/generation"],
  },
  { id: "publish", label: "出す", hrefs: ["/admin/sites", "/admin/distribution"] },
  { id: "earn", label: "稼ぐ", hrefs: ["/admin/affiliate", "/admin/inbox"] },
  {
    id: "observe",
    label: "見る",
    hrefs: ["/admin/analytics", "/admin/ai-usage", "/admin/improvement"],
  },
  {
    id: "maintain",
    label: "整える",
    hrefs: ["/admin/feedback", "/admin/tools", "/admin/ui-catalog", "/admin/settings"],
  },
];

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
 * いま開いている経路が、案内のどの項目に属するかを返す。
 *
 * **一致ではなく、いちばん長い前置きで決める。**
 * 一致で決めていたときは、`/admin/settings/llm` や
 * `/admin/improvement/dimensions` のような下の階層の画面で
 * **現在地の印がどこにも付かなかった**（2026-08-21 に実測）。
 * 目で見る人には太字が消えるだけだが、読み上げでは現在地そのものが消える。
 *
 * `/admin`（ホーム）はすべての経路の前置きになるので、
 * いちばん長いものだけを採らないと全画面でホームが現在地になる。
 * 見せていない項目（権限で消えたもの）は候補にしない——
 * 出ていないものに印は付けられない。
 */
export function navHrefFor(currentPath: string, nav: GroupedNav): string | null {
  const visible = [...nav.ungrouped, ...nav.groups.flatMap((g) => g.items)];
  let best: string | null = null;
  for (const item of visible) {
    // ホーム（`/admin`）はすべての経路の前置きになるので、前置きの側に数えない。
    // 数えると、どの画面を開いてもホームが現在地になる。
    const matches =
      currentPath === item.href ||
      (item.href !== ADMIN_ROOT && currentPath.startsWith(`${item.href}/`));
    if (!matches) continue;
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
  currentPath,
  breadcrumbs,
  actions,
  capabilities,
  feedback,
  children,
}: {
  readonly currentPath: string;
  readonly breadcrumbs: readonly Breadcrumb[];
  /** 退避先。保存・戻る・次へ。無い画面でも「一覧へ戻る」は置く。 */
  readonly actions?: ReactNode;
  /** その人が持っている「できること」。渡すと案内が絞られる。 */
  readonly capabilities?: readonly string[];
  /** 渡さない場面（権限の概念が無い画面）では、ボタンを出さない。 */
  readonly feedback?: ShellFeedback;
  readonly children: ReactNode;
}) {
  const nav = groupedNav(ADMIN_NAV, ADMIN_NAV_GROUPS, capabilities);
  const currentHref = navHrefFor(currentPath, nav);
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
        {item.label}
      </Link>
    );
  };

  return (
    <div className={styles.shell}>
      <nav className={styles.sidebar} aria-label="主な案内">
        <span className={styles.brandName}>affiliate-hub</span>
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
                    // 末尾はこの画面そのもの。**太字だけでは読み上げに現在地が出ない。**
                    // 案内の側の印は権限で項目が消えると一緒に消えるが、
                    // パンくずはどの画面にも必ず出るので、ここが現在地の最後の砦になる。
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

        <main className={styles.content}>{children}</main>
      </div>

      {feedback !== undefined && (
        <FeedbackButton
          screenName={feedback.screenName}
          route={currentPath}
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
