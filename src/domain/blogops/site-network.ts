import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * サイト網 (§1)。
 *
 * ハブが 1 つ、その下にサブサイト、さらに下にミニサイトが付く木。
 * 「どのブログがどのブログの下にあるか」を型で持つ理由は、
 * 姉妹サイトの帯・フッターのカテゴリー木・パンくずが同じ木を見るためで、
 * 画面ごとに親子を書くと、片方だけ古い並びが残る。
 */

export const NETWORK_ROLES = ["hub", "sub", "mini"] as const;
export type NetworkRole = (typeof NETWORK_ROLES)[number];

export const NETWORK_ROLE_LABEL: Readonly<Record<NetworkRole, string>> = {
  hub: "ハブ (網の中心)",
  sub: "サブサイト",
  mini: "ミニサイト",
};

export const NETWORK_STATUSES = ["active", "hidden"] as const;
export type NetworkStatus = (typeof NETWORK_STATUSES)[number];

export type SiteNetworkNode = {
  readonly id: string;
  readonly siteSlug: string;
  readonly role: NetworkRole;
  /** 上位の URL 名。ハブは必ず null。 */
  readonly parentSlug: string | null;
  readonly name: string;
  readonly oneLine: string;
  readonly position: number;
  readonly status: NetworkStatus;
};

/**
 * 上限のある URL の名前の決まり（サイト網の名前と固定ページの名前）。
 *
 * 小文字・数字・ハイフンだけ。大文字を許すと、大文字小文字だけが違う
 * 2 本のブログが同じ住所を取り合う。
 *
 * 名前に `Short` が付くのは **60 文字の上限を持つ**からで、
 * 上限を持たない記事側は `validateArticleSlug` が受け持つ。
 * 上限の有無が違うので、1 つの名前に寄せられない。
 */
export function validateShortSlug(slug: string): Result<string, DomainError> {
  const value = slug.trim();
  if (value === "") return err(validationError("URL の名前を入れてください。", "slug"));
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(value)) {
    return err(
      validationError(
        "URL の名前は、小文字の英数字とハイフンだけで、ハイフンで終われません。",
        "slug",
      ),
    );
  }
  if (value.length > 60) {
    return err(validationError("URL の名前は 60 文字までです。", "slug"));
  }
  return ok(value);
}

/**
 * 親子の決まり。
 *
 * - ハブに親は付かない (網の中心が 2 つあると、どちらが上か決まらない)
 * - サブ・ミニには親が要る (親の無いサブサイトは、どの網にも属さない)
 * - 自分自身を親にできない
 */
export function validateParent(
  role: NetworkRole,
  siteSlug: string,
  parentSlug: string | null,
): Result<string | null, DomainError> {
  if (role === "hub") {
    if (parentSlug !== null && parentSlug !== "") {
      return err(validationError("ハブに上位のサイトは付けられません。", "parentSlug"));
    }
    return ok(null);
  }
  const parent = (parentSlug ?? "").trim();
  if (parent === "") {
    return err(
      validationError(
        `${NETWORK_ROLE_LABEL[role]}には上位のサイトが要ります。どのハブの下に置くかを選んでください。`,
        "parentSlug",
      ),
    );
  }
  if (parent === siteSlug) {
    return err(validationError("自分自身を上位のサイトにはできません。", "parentSlug"));
  }
  return ok(parent);
}

/**
 * サイト網を保存する直前に、節点単体では見えない不変条件をまとめて検査する。
 *
 * create / update / restore / delete が別々の部分検査を持つと、update だけが
 * 存在しない親や子孫を親にできてしまう。そのため全 mutation が、変更後の
 * **網全体**をこの関数へ渡す。
 */
export function validateSiteNetworkGraph(
  nodes: readonly SiteNetworkNode[],
): Result<true, DomainError> {
  const bySlug = new Map<string, SiteNetworkNode>();
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id) || bySlug.has(node.siteSlug)) {
      return err(
        validationError(
          `サイト網に重複した節点「${node.siteSlug}」があります。`,
          "siteSlug",
        ),
      );
    }
    ids.add(node.id);
    bySlug.set(node.siteSlug, node);

    const parent = validateParent(node.role, node.siteSlug, node.parentSlug);
    if (!parent.ok) return parent;
    if (parent.value !== null && !nodes.some((candidate) => candidate.siteSlug === parent.value)) {
      return err(
        validationError(
          `上位に指定した「${parent.value}」がサイト網にありません。先に上位を登録してください。`,
          "parentSlug",
        ),
      );
    }
  }

  // 役割の検査より先に辿る。子孫を親にした操作は、役割違反でもあるが、
  // 利用者が直すべき本質は循環なので、こちらを優先して知らせる。
  for (const node of nodes) {
    const seen = new Set<string>([node.siteSlug]);
    let cursor = node.parentSlug;
    while (cursor !== null) {
      if (seen.has(cursor)) {
        return err(
          validationError(
            `「${node.siteSlug}」から上位を辿ると循環します。子孫を親にはできません。`,
            "parentSlug",
          ),
        );
      }
      seen.add(cursor);
      cursor = bySlug.get(cursor)?.parentSlug ?? null;
    }
  }

  const expectedParentRole: Readonly<Partial<Record<NetworkRole, NetworkRole>>> = {
    sub: "hub",
    mini: "sub",
  };
  if (nodes.filter((node) => node.role === "hub").length > 1) {
    return err(validationError("1つのサイト網にハブは1つだけ置けます。", "role"));
  }
  for (const node of nodes) {
    if (node.parentSlug === null) continue;
    const parent = bySlug.get(node.parentSlug);
    const expected = expectedParentRole[node.role];
    if (parent !== undefined && expected !== undefined && parent.role !== expected) {
      return err(
        validationError(
          `${NETWORK_ROLE_LABEL[node.role]}の上位には${NETWORK_ROLE_LABEL[expected]}を指定してください。`,
          "role",
        ),
      );
    }
  }

  return ok(true);
}

/**
 * 削除済みの節点を同じ住所へ戻せるかを判定する。
 *
 * 削除時点では正しかった親子関係も、戻す時点では親が削除されていることがある。
 * そのため復元を単なるフラグ解除にせず、現在の通常一覧に対して再検証する。
 */
export function validateNetworkRestore(
  node: SiteNetworkNode,
  activeNodes: readonly SiteNetworkNode[],
): Result<true, DomainError> {
  if (activeNodes.some((candidate) => candidate.siteSlug === node.siteSlug)) {
    return err(
      validationError(
        `URL の名前「${node.siteSlug}」は現在のサイト網で使われているため戻せません。`,
        "siteSlug",
      ),
    );
  }

  return validateSiteNetworkGraph([...activeNodes, node]);
}

/** ある節点を上位に持つ節点。削除の前に数える。 */
export function childrenOf(
  nodes: readonly SiteNetworkNode[],
  siteSlug: string,
): readonly SiteNetworkNode[] {
  return nodes.filter((n) => n.parentSlug === siteSlug);
}

/**
 * 網を木の形に並べる。並びは `position`、同じなら URL 名。
 *
 * 親の見つからない節点は**捨てない**。捨てると、親を消し損ねた節点が
 * 画面から消えて、直す手立てが無くなる。根の隣に並べて見えるようにする。
 */
export type NetworkTreeRow = {
  readonly node: SiteNetworkNode;
  readonly depth: number;
  readonly orphaned: boolean;
};

export function buildNetworkTree(nodes: readonly SiteNetworkNode[]): readonly NetworkTreeRow[] {
  const bySlug = new Map(nodes.map((n) => [n.siteSlug, n]));
  const sorted = [...nodes].sort(
    (a, b) => a.position - b.position || a.siteSlug.localeCompare(b.siteSlug),
  );
  const rows: NetworkTreeRow[] = [];

  const walk = (parent: string | null, depth: number): void => {
    for (const node of sorted) {
      if (node.parentSlug !== parent) continue;
      rows.push({ node, depth, orphaned: false });
      walk(node.siteSlug, depth + 1);
    }
  };
  walk(null, 0);

  const placed = new Set(rows.map((r) => r.node.id));
  for (const node of sorted) {
    if (placed.has(node.id)) continue;
    rows.push({ node, depth: 0, orphaned: bySlug.get(node.parentSlug ?? "") === undefined });
  }
  return rows;
}
