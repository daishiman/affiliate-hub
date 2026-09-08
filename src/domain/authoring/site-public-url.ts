import { siteBasePathBySlug } from "./site";
import { siteHostname } from "./site-hostname";

/**
 * 読者へ配る**正本の URL** の組み立て。ここも文字列しか触らない。
 *
 * --- なぜ要るのか ---
 * 同じ記事に、住所の付け方だけが違う URL が最大 3 通りできる。
 *
 * 1. 独自ドメイン        `https://blog.example.jp/guides/x`
 * 2. 既定のサブドメイン  `https://gadget.example.com/guides/x`
 * 3. path 直指定        `https://example.com/s/gadget/guides/x`
 *
 * 検索エンジンから見ると、これは中身の同じ 3 ページである。どれが正本かを
 * 言わないと、評価が 3 つに割れる。`<link rel="canonical">` はその宣言で、
 * **住所の付け方が変わっても同じ 1 本を指し続けなければならない**。
 *
 * --- 優先順位の理由 ---
 * 生きた canonical の独自ドメインがあればそれが正本である。運用者が
 * 「この住所で読ませたい」と明示的に立てた印だからで、ここを既定住所より
 * 下に置くと、独自ドメインを繋いだ意味が無くなる。
 *
 * 次が既定のサブドメイン。基底ドメインが設定されている環境では、入口が
 * `/s/<URL名>` を**外から開けない形**へ差し替えている。そこを canonical に
 * 書くと、読者にも検索エンジンにも 404 を指し示すことになる。
 *
 * path 形は基底ドメインが未設定の環境（手元・`*.workers.dev`）だけの姿で、
 * その環境では `/s/<URL名>` が唯一の開き方なのでこれが正本になる。
 */

export type SiteCanonicalInput = {
  /** ブログの URL 名。 */
  readonly slug: string;
  /** ブログの中での path。表紙は `""`、子ページは `"/guides/x"`。 */
  readonly path: string;
  /** 生きた canonical の独自ドメイン。無ければ `null`。 */
  readonly canonicalHostname: string | null;
  /** 基底ドメイン。未設定の環境では `null`。 */
  readonly baseDomain: string | null;
  /**
   * 要求が届いた origin (`https://host`)。path 形のときだけ使う。
   * 読めない・信用できないときは `null`。
   */
  readonly requestOrigin: string | null;
};

/**
 * 正本の URL を返す。組み立てられないときは `null`。
 *
 * `null` を返すのは推測した canonical を配るより無い方がましだからで、
 * この判断は既存の `siteMetadataUrl` から引き継いでいる。
 */
export function siteCanonicalUrl(input: SiteCanonicalInput): string | null {
  const { slug, path, canonicalHostname, baseDomain, requestOrigin } = input;

  if (canonicalHostname !== null) return `https://${canonicalHostname}${path}`;

  const subdomain = siteHostname(slug, baseDomain);
  if (subdomain !== null) return `https://${subdomain}${path}`;

  if (requestOrigin === null) return null;
  return `${requestOrigin}${siteBasePathBySlug(slug)}${path}`;
}
