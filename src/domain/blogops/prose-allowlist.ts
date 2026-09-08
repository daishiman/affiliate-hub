/**
 * 本文を描く前に、通してよいものだけへ絞る (SEC-REQ-009)。
 *
 * ## 何が守られていて、何をここで守るのか
 *
 * 本文は React の部品として描く。だから**要素そのものは既に許可リストである**
 * ——`ProseNode` の 19 種以外は組み立てられず、属性は部品が決めた分しか付かない。
 * `custom-html.ts` のように文字列の HTML を解く必要はない。
 *
 * 残る入口は 3 つだけで、それがこのファイルの担当である。
 *
 * 1. **行き先の URL** (`href` / `src`)。`javascript:` と `data:` を通さない。
 * 2. **埋め込みの宛先ホスト**。任意のホストを `iframe` にすると、
 *    そのホストが読者の画面の中で好きなものを描ける。
 * 3. **色**。名前付きの値だけを受け、任意の文字列を `style` へ渡さない。
 *
 * ## 描く直前に絞る理由
 *
 * `custom-html.ts` は保存の入口で削っている。本文はそうしない。**本文は
 * 運営者が書いた文章そのもので、削った結果しか残らないと書き直せない。**
 * 通せない URL は「通さない」だけにして、文字は本文に残す。
 * 直せる形で残すほうが、消えるより運営者にとって安全である。
 */

/**
 * 通してよい scheme。
 *
 * `mailto:` は入れていない。本文の中の連絡先は文字で書けばよく、
 * 押せるようにする必要が無い。**要らないものを入れないのが一番安い。**
 */
const SAFE_SCHEMES = ["http:", "https:"] as const;

/**
 * 埋め込みを許すホスト。
 *
 * **`iframe` は宛先のホストへ読者の画面の一区画を明け渡す操作である。**
 * だから増やすときは「このホストが描くものを読者に見せてよいか」を
 * 決めてから増やす。ワイルドカードは置かない。
 */
export const ALLOWED_EMBED_HOSTS: readonly string[] = [
  "www.youtube-nocookie.com",
  "www.youtube.com",
  "player.vimeo.com",
  "open.spotify.com",
  "www.google.com",
];

/*
  判定の前に、大文字小文字と空白・制御文字を潰す。
  `java\tscript:` のような書き方で抜けられないようにするため
  (`custom-html.ts` と同じ理由・同じ潰し方)。
*/
function normalize(url: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: 制御文字で scheme を割るのを止めるのが目的
  return url.trim().replace(/[\u0000-\u0020\u007f]/g, "");
}

/**
 * サイトの中を指す書き方か。
 *
 * `/` 始まりだけを通す。`//example.com` は**別のホストを指す**ので通さない
 * (scheme を省いた絶対 URL であり、見た目だけが相対に似ている)。
 */
function isSiteRelative(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}

/**
 * リンクの行き先として通してよいか。通せなければ `null`。
 *
 * `null` を返したとき、呼ぶ側は**押せない文字として描く**。
 * リンクごと消すと、運営者は何が落ちたのか分からない。
 */
export function safeHref(url: string): string | null {
  const value = normalize(url);
  if (value === "") return null;
  if (isSiteRelative(value)) return value;
  return hasSafeScheme(value) ? value : null;
}

/** 画像の場所として通してよいか。判定はリンクと同じでよい。 */
export function safeImageSrc(url: string): string | null {
  return safeHref(url);
}

/**
 * 埋め込みの宛先として通してよいか。
 *
 * **scheme が通っただけでは足りない。**ホストが一覧に無ければ通さない。
 */
export function safeEmbedUrl(url: string): string | null {
  const value = normalize(url);
  if (value === "" || !hasSafeScheme(value)) return null;
  const host = readHost(value);
  if (host === null) return null;
  return ALLOWED_EMBED_HOSTS.includes(host) ? value : null;
}

function hasSafeScheme(url: string): boolean {
  const scheme = readScheme(url);
  return scheme !== null && (SAFE_SCHEMES as readonly string[]).includes(scheme);
}

function readScheme(url: string): string | null {
  /*
    `URL` に投げて判定しない。**投げた時点で相対 URL は基準を必要とし**、
    基準を渡すと `javascript:` 以外の危ない書き方が基準側の scheme を
    もらって通る。文字として scheme を読むほうが、通す条件が目で追える。
  */
  const hit = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(url);
  return hit === null ? null : (hit[1] as string).toLowerCase() + ":";
}

function readHost(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}
