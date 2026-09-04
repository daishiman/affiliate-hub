/**
 * ブログの URL 名と、読者が打つホスト名の**唯一の対応表**。
 *
 * サブドメイン方式を採る。`first-lens` というブログは
 * `first-lens.example.com` で開く。
 *
 * ここが 1 か所である理由は 2 つある。
 *
 *   1. **作る側と読む側で組み立て方が食い違わないようにするため。**
 *      作成時に住所を決める処理と、届いた要求からブログを探す処理が
 *      別々に文字列を組むと、片方だけが `www` を特別扱いする、
 *      片方だけが大文字を許す、といった差が入る。差が入った日から
 *      「作れたのに開けない」が再発する。
 *   2. **予約語の判断を 1 か所にするため。** `admin` という URL 名の
 *      ブログを許すと `admin.example.com` が管理画面と衝突する。
 *      作成を断る側と、要求を振り分ける側で予約語の一覧がずれると、
 *      作れてしまったブログが永久に開けない。
 *
 * 基底ドメインは環境ごとの構成値なので、**引数で受け取る。**
 * ここから環境を読みに行かない。読みに行くと、手元と本番で
 * 同じ入力に別の答えを返す関数になり、テストで固定できなくなる。
 */

/**
 * ブログの URL 名として使えない札。
 *
 * 管理画面・API・資産配信など、**ブログ以外の用途で既に使う名前**と、
 * 慣習上ブログを指さない名前 (`www`) を並べる。
 */
export const RESERVED_SITE_HOSTNAME_LABELS: readonly string[] = [
  "www",
  "admin",
  "api",
  "app",
  "assets",
  "cdn",
  "mail",
  "static",
  "s",
  "signin",
];

/** 末尾のドット・大文字・ポート番号を落として比べられる形にする。 */
function normalizeHost(raw: string): string {
  const host = raw.trim().toLowerCase();
  // IPv6 リテラル (`[::1]:8787`) はブログの住所として使わない。
  if (host.startsWith("[")) return "";
  const withoutPort = host.split(":")[0] ?? "";
  return withoutPort.replace(/\.+$/, "");
}

/** URL 名として妥当な札か。半角小英数とハイフン、先頭末尾はハイフン以外。 */
function isUsableLabel(label: string): boolean {
  if (label.length === 0 || label.length > 63) return false;
  if (!/^[a-z0-9-]+$/.test(label)) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return true;
}

/** この URL 名をブログの住所に使えるか。予約語と形の両方を見る。 */
export function isUsableSiteLabel(slug: string): boolean {
  const label = slug.trim().toLowerCase();
  if (!isUsableLabel(label)) return false;
  return !RESERVED_SITE_HOSTNAME_LABELS.includes(label);
}

/**
 * URL 名 → 読者が打つホスト名。
 *
 * 基底ドメインが無い環境（手元・自動テスト）は `null` を返す。
 * **`null` は「まだ住所が無い」であって、失敗ではない。**
 * 住所が無くても `/s/<URL名>` では開けるので、作成そのものは止めない。
 */
export function siteHostname(slug: string, baseDomain: string | null): string | null {
  if (baseDomain === null) return null;
  const base = normalizeHost(baseDomain);
  if (base === "" || !base.includes(".")) return null;
  const label = slug.trim().toLowerCase();
  if (!isUsableSiteLabel(label)) return null;
  return `${label}.${base}`;
}

/**
 * 届いた要求のホスト名 → ブログの URL 名。
 *
 * 対応するブログが無い形はすべて `null`。**`null` を「本体の画面」として
 * 扱ってよい**のは呼び出し側の判断で、ここでは判断しない。
 *
 * 基底ドメインそのもの (`example.com`) と `www.example.com` は
 * 本体の画面なので `null`。多段のラベル (`a.b.example.com`) も `null` —
 * 1 段だけを住所にすると決めた以上、2 段目を黙って受けない。
 */
export function siteSlugFromHost(host: string, baseDomain: string | null): string | null {
  if (baseDomain === null) return null;
  const base = normalizeHost(baseDomain);
  if (base === "") return null;
  const target = normalizeHost(host);
  if (target === "" || target === base) return null;
  const suffix = `.${base}`;
  if (!target.endsWith(suffix)) return null;
  const label = target.slice(0, target.length - suffix.length);
  if (label.includes(".")) return null;
  if (!isUsableSiteLabel(label)) return null;
  return label;
}
