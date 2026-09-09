import {
  ADMIN_NAV,
  ADMIN_NAV_GROUPS,
  ADMIN_ROUTE_METADATA,
  type AdminRouteId,
  type NavItem,
  visibleNav,
} from "@/presentation/ui";

/**
 * ホームの「作業の対象物」ボード (A5)。
 *
 * **サイドバーと同じ `nav.group` から射影する。** ホーム側に第 2 の表を作ると、
 * ルートを 1 本足したときに「サイドバーには出るがホームには出ない」状態が生まれ、
 * どちらが本当の一段目か決められなくなる。それは本 feature が無くそうとしている形である。
 *
 * サイドバーとの違いは 1 点だけで、**その対象物の下に画面が何枚あるか**を添える。
 * ホームは着地点なので、初めて開いた人が「この管理画面は 5 つのことについて
 * 作業する場所で、それぞれこのくらいの厚みがある」と掴めるようにする。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/entry-consolidation-contract.md §2
 */

export type WorkObjectEntry = {
  readonly href: string;
  readonly label: string;
};

export type WorkObjectGroup = {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly WorkObjectEntry[];
  /** その対象物に属する画面の枚数（入口だけでなく子も数える）。 */
  readonly screenCount: number;
};

const ROUTE_BY_ID = new Map(ADMIN_ROUTE_METADATA.map((route) => [route.id, route]));

/**
 * その画面が属する一段目の入口を辿る。
 *
 * `parent` は route id で、一段目は `""`（空文字＝ホーム）を親に持つ。
 * ホーム自身の親だけが `null` なので、そこで止める。
 * 表が壊れて親を辿れない場合に無限に回らないよう、辿る回数にも上限を置く。
 */
function topLevelOf(id: AdminRouteId): AdminRouteId | null {
  let current = ROUTE_BY_ID.get(id);
  for (let hop = 0; hop < ADMIN_ROUTE_METADATA.length; hop += 1) {
    if (current === undefined || current.parent === null) return null;
    if (current.parent === "") return current.id;
    current = ROUTE_BY_ID.get(current.parent);
  }
  return null;
}

/** route id -> その画面が属する一段目の入口。1 回だけ作る。 */
const TOP_LEVEL_BY_ID = new Map(
  ADMIN_ROUTE_METADATA.map((route) => [route.id, topLevelOf(route.id)]),
);

function screenCountFor(hrefs: readonly string[]): number {
  const entryIds = new Set(
    ADMIN_ROUTE_METADATA.filter((route) => hrefs.includes(route.pattern)).map((route) => route.id),
  );
  return ADMIN_ROUTE_METADATA.filter((route) => {
    const top = TOP_LEVEL_BY_ID.get(route.id);
    return top !== undefined && top !== null && entryIds.has(top);
  }).length;
}

/**
 * 見せてよい入口だけを、対象物ごとに束ねる。
 *
 * **入口が 1 つも残らなかった対象物は、見出しごと落とす。**
 * サイドバーの `groupedNav` と同じ扱いにする。見出しだけ残すと
 * 「ここに何かあるが自分には見えない」と伝わってしまう。
 */
export function workObjectBoard(
  capabilities: readonly string[] | undefined,
): readonly WorkObjectGroup[] {
  const visible = new Map<string, NavItem>(
    visibleNav(ADMIN_NAV, capabilities).map((item) => [item.href, item]),
  );

  return ADMIN_NAV_GROUPS.flatMap((group) => {
    const entries = group.hrefs.flatMap((href) => {
      const item = visible.get(href);
      return item === undefined ? [] : [{ href: item.href, label: item.label }];
    });
    if (entries.length === 0) return [];
    return [
      {
        id: group.id,
        label: group.label,
        entries,
        screenCount: screenCountFor(group.hrefs),
      },
    ];
  });
}

/**
 * その人の権限では出ていない入口の数。
 *
 * **数だけを返し、何が隠れているかは返さない。** 権限で隠すというのは
 * 存在を伏せることなので、名前を出すとサイドバー側で伏せた意味が消える。
 * それでも数を出すのは、**何かができなくなったなら、代わりに何かが
 * 増えていなければならない**からである。増えないまま項目だけ減ると、
 * それは黙って消えたのと区別が付かない。
 */
export function hiddenEntryCount(capabilities: readonly string[] | undefined): number {
  const all = ADMIN_NAV_GROUPS.reduce((sum, group) => sum + group.hrefs.length, 0);
  const shown = workObjectBoard(capabilities).reduce((sum, group) => sum + group.entries.length, 0);
  return all - shown;
}
