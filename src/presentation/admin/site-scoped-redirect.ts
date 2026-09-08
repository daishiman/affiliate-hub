/**
 * 旧 URL から site 配下の新しい住所を決める規則。
 *
 * 転送先の組み立てを各 `page.tsx` に散らすと、
 * 「`/admin/personas` は送れているのに `/admin/personas/new` だけ送られない」
 * のような片肺の状態が作れる。作れるものはいつか作られる。
 *
 * 判断は 2 つに分かれる。
 *
 * 1. **どのブログか** (`resolveSiteSlug`) — cookie や DB を読んだ結果を受け取る
 * 2. **どこへ送るか** (`siteScopedRedirectTarget`) — 入力が揃えば決まる純粋関数
 *
 * 2 を純粋にしておくと、対応表の全件を単体テストで一度に検査できる。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md
 */

/** ブログを 1 本に決められなかったときの行き先 (A3)。 */
export const SITE_PICKER_PATH = "/admin/sites";

/**
 * 旧 URL と新しい住所の対応表。
 *
 * `/admin/content` 系はここに入れない。転送先 `/admin/sites/[site]/articles` が
 * まだ存在せず、存在しない先へ送ると 404 になって転送しない今より悪くなるためである。
 * 理由は `redirect-map-draft.json` の `not_redirected` に残してある。
 */
export const LEGACY_SITE_SCOPED_ROUTES: Readonly<Record<string, string>> = {
  "/admin/personas": "/admin/sites/[site]/authors",
  "/admin/personas/new": "/admin/sites/[site]/authors/new",
  "/admin/personas/audiences": "/admin/sites/[site]/audience/personas",
  "/admin/personas/audiences/new": "/admin/sites/[site]/audience/personas/new",
  "/admin/writing": "/admin/sites/[site]/writing",
};

export type SiteResolutionInput = {
  /** 旧 URL 自身が持つ site セグメント。 */
  readonly pathSite?: string | null;
  /** `?site=<slug>` で明示されたブログ。 */
  readonly querySite?: string | null;
  /** 直近に開いていたブログ (cookie)。 */
  readonly cookieSite?: string | null;
  /** このワークスペースで実在するブログの slug。 */
  readonly siteSlugs: readonly string[];
};

/**
 * ブログを 1 本に決める。決まらなければ `null`。
 *
 * **どの段でも `siteSlugs` に含まれることを確かめる。** 確かめないと、
 * 消したブログの slug が cookie に残っている人だけが存在しない住所へ送られ、
 * そこで 404 に当たる。入口で弾けば、その人はブログ選択へ出る。
 */
export function resolveSiteSlug(input: SiteResolutionInput): string | null {
  const known = new Set(input.siteSlugs);
  /*
    cookie を query より後ろに置く。先に見ると、リンクで明示的に指定したブログを
    「前に開いていた別のブログ」で上書きしてしまう。明示は常に記憶より強い。
  */
  for (const candidate of [input.pathSite, input.querySite, input.cookieSite]) {
    if (candidate != null && known.has(candidate)) return candidate;
  }
  /*
    「1 本しか無ければそれ」を最後に置く。2 本目を作った瞬間に挙動が変わるので、
    これより上に置くと cookie を持っている人と持っていない人で行き先が食い違う。
  */
  if (input.siteSlugs.length === 1) return input.siteSlugs[0];
  return null;
}

/** クエリ 1 件が複数値を持ちうる形。複数選択の絞り込みを 1 件に畳まないため。 */
export type LegacyQuery = Readonly<Record<string, string | readonly string[] | undefined>>;

/**
 * 旧 URL の行き先を決める。
 *
 * - 対応表に無い → `null` (転送しない)
 * - 対応表にあり `siteSlug` が `null` → ブログ選択 (A3)
 * - 対応表にあり `siteSlug` がある → `[site]` を差し替えた URL (A2)
 */
export function siteScopedRedirectTarget(
  legacyPath: string,
  siteSlug: string | null,
  query: LegacyQuery = {},
): string | null {
  const template = LEGACY_SITE_SCOPED_ROUTES[legacyPath];
  if (template === undefined) return null;
  if (siteSlug === null) return SITE_PICKER_PATH;

  /*
    slug は `encodeURIComponent` を通す。通さないと、slug に `/` を含む値を
    作れた日に、転送先が別の画面になる。
  */
  const [path, presetQuery] = template
    .replace("[site]", encodeURIComponent(siteSlug))
    .split("?");

  const params = new URLSearchParams(presetQuery ?? "");
  /*
    行き先の意味を決めているのは対応表であって旧 URL のクエリではないので、
    表が持つ鍵 (`state` など) は上書きさせない。
    `site` はブログの解決に使い切ったので引き継がない。
  */
  const reserved = new Set([...params.keys(), "site"]);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || reserved.has(key)) continue;
    for (const one of Array.isArray(value) ? value : [value as string]) {
      params.append(key, one);
    }
  }

  const search = params.toString();
  return search.length > 0 ? `${path}?${search}` : path;
}
