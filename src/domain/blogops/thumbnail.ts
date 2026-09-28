/**
 * 記事のサムネイル（一覧に並ぶ 16:9 の図版）の決め方。
 *
 * ==========================================================================
 * なぜ「どれを使うか」を 1 か所に閉じ込めるのか
 * ==========================================================================
 *
 * サムネイルを出す画面は 8 つある（トップ・記事一覧・カテゴリー・タグ・
 * 検索結果・関連記事・管理画面のブログ一覧/記事一覧）。それぞれの画面で
 * `uploaded ?? eyecatch ?? body[0] ?? 代替` と書くと、**書き忘れた画面だけが
 * 静かに別の絵を出す。**画面は壊れないので、ずれたことに気づく機会が無い。
 *
 * だから「どれを使うか」は `resolveThumbnail` の 1 本だけが決める。
 * 画面側は結果を描くだけで、優先順位を知らない。
 *
 * ==========================================================================
 * なぜ最後が「代替図版」で、空ではないのか
 * ==========================================================================
 *
 * 画像が無い記事だけカードの高さが変わると、一覧が段違いになって
 * 読者の目線が折り返す位置を失う。空にする代わりに **必ず 16:9 の何かを返す。**
 * ただし代替図版は写真ではなく、タイトル・カテゴリー・配色から
 * **外部へ 1 回も接続せずに**組み立てる図形なので、
 * 「写真がある記事」と見間違えない見た目にする責務は描画側が持つ。
 *
 * ==========================================================================
 * なぜ乱数も時刻も使わないのか
 * ==========================================================================
 *
 * 代替図版は OGP 画像としても配られる。同じ記事が再デプロイのたびに
 * 別の絵になると、SNS 側のキャッシュと配信中の絵が食い違い、
 * 「共有したときだけ違う画像が出る」という直せない不具合になる。
 * seed は入力文字列だけから決まる（`thumbnailSeed`）。
 *
 * 参考にした外部サイトの写真・ロゴ・色値は **1 つも持ち込まない。**
 * ここが扱うのは「どこから絵を取るか」という段取りだけである。
 */

/** サムネイルの出どころ。優先順位はこの並び順そのもの。 */
export const THUMBNAIL_SOURCES = ["uploaded", "eyecatch", "body_first_image", "generated"] as const;

export type ThumbnailSource = (typeof THUMBNAIL_SOURCES)[number];

/** 画面に出す言葉（管理画面で「今どれが使われているか」を見せるため）。 */
export const THUMBNAIL_SOURCE_LABEL: Readonly<Record<ThumbnailSource, string>> = {
  uploaded: "この記事にアップロードした画像",
  eyecatch: "アイキャッチ指定",
  body_first_image: "本文の先頭画像",
  generated: "自動生成の代替図版",
};

/** サムネイルの縦横比。16:9 をここだけが持つ。 */
export const THUMBNAIL_ASPECT = { width: 16, height: 9 } as const;

/**
 * 配信する派生サイズ。幅だけを持ち、高さは 16:9 から導く。
 *
 * 高さを一緒に持つと、比率を変えたときに両方直す必要が出て、
 * 片方だけ直した瞬間に潰れた絵が出る。
 */
export const THUMBNAIL_WIDTHS = [320, 640, 1280] as const;

export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

/** 幅から 16:9 の高さを出す。端数は切り上げ（1px 足りない黒帯を出さない）。 */
export function thumbnailHeightFor(width: number): number {
  return Math.ceil((width * THUMBNAIL_ASPECT.height) / THUMBNAIL_ASPECT.width);
}

/**
 * 記事が持ちうる画像の候補。**空文字は「無い」と同じに扱う。**
 *
 * 保存の入口で空文字と null が混ざるのは避けられないので、
 * 判定側が両方を同じに見る。ここで吸収しないと、
 * 「空文字が入った記事だけ壊れた img が出る」ことになる。
 */
export type ThumbnailCandidates = {
  readonly uploadedUrl?: string | null;
  readonly eyecatchUrl?: string | null;
  readonly bodyFirstImageUrl?: string | null;
};

/** 代替図版を組み立てるための入力。ここから先は決定論。 */
export type ThumbnailSeed = {
  /** 図形の配置を決める 32bit 値。 */
  readonly hash: number;
  /** 図版に載せる短い言葉（タイトル）。 */
  readonly title: string;
  /** 図版に載せるカテゴリー名。空なら載せない。 */
  readonly categoryName: string;
  /** 配色の名前。色値そのものは持たない（トークン側が解く）。 */
  readonly brandTheme: string;
};

export type ResolvedThumbnail =
  | {
      readonly kind: "image";
      readonly source: Exclude<ThumbnailSource, "generated">;
      readonly url: string;
    }
  | {
      readonly kind: "generated";
      readonly source: "generated";
      readonly seed: ThumbnailSeed;
    };

/** 代替図版の元になる記事の情報。 */
export type ThumbnailSubject = {
  readonly siteSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly categorySlug: string;
  readonly categoryName?: string | null;
  readonly brandTheme: string;
};

function usable(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * 32bit FNV-1a。**暗号用途ではない。**
 *
 * 求めているのは「同じ入力なら同じ絵」だけで、衝突しにくさは要らない。
 * Web Crypto の digest は非同期で、描画のたびに await が要る。
 * サムネイルは一覧 1 画面で 20 枚以上並ぶので、同期で済ませられる方を取る。
 */
export function thumbnailHash(input: string): number {
  let hash = 0x811c9dc5;
  for (const char of input) {
    hash ^= char.codePointAt(0) ?? 0;
    // FNV prime 16777619 の掛け算を 32bit に収める。
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 代替図版の seed を作る。
 *
 * サイトと slug を混ぜているのは、**別ブログの同名記事が同じ絵にならない**ため。
 * 同じ絵が並ぶと、姉妹サイトを回遊した読者に「同じ記事だ」と誤解される。
 */
export function thumbnailSeed(subject: ThumbnailSubject): ThumbnailSeed {
  const material = [subject.siteSlug, subject.slug, subject.title, subject.categorySlug].join("\n");
  return {
    hash: thumbnailHash(material),
    title: subject.title,
    categoryName: usable(subject.categoryName) ?? "",
    brandTheme: subject.brandTheme,
  };
}

/**
 * サムネイルを決める。**優先順位を持つのはこの関数だけ。**
 *
 * 候補が 1 つも無ければ代替図版を返す。null を返さないので、
 * 呼ぶ側に「無かったときの分岐」は生まれない。
 */
export function resolveThumbnail(
  subject: ThumbnailSubject,
  candidates: ThumbnailCandidates,
): ResolvedThumbnail {
  const uploaded = usable(candidates.uploadedUrl);
  if (uploaded) return { kind: "image", source: "uploaded", url: uploaded };

  const eyecatch = usable(candidates.eyecatchUrl);
  if (eyecatch) return { kind: "image", source: "eyecatch", url: eyecatch };

  const body = usable(candidates.bodyFirstImageUrl);
  if (body) return { kind: "image", source: "body_first_image", url: body };

  return { kind: "generated", source: "generated", seed: thumbnailSeed(subject) };
}

/**
 * 読み上げ用の説明文。
 *
 * 代替図版は「記事の中身を写した絵」ではないので、
 * 写真と同じ説明を付けると読み上げ利用者に嘘を伝えることになる。
 * 出どころによって言い方を変える。
 */
export function thumbnailAltText(resolved: ResolvedThumbnail, title: string): string {
  return resolved.kind === "generated" ? `${title}（自動生成の見出し画像）` : `${title}の画像`;
}

const HTML_IMAGE_SRC = /<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i;
const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)]*)\)/;

/**
 * Markdown の `(...)` から**在り処だけ**を取り出す。
 *
 * `![机](/a.png "640x360")` の後半は題名の場所で URL ではない。URL に生の空白は
 * 入らない（`%20` になる）ので、最初の空白より前だけが在り処である。
 *
 * **`prose-format.ts` とは目的が違う。**あちらは往復のため、寸法として読めない
 * 題名も `src` に残す。ここで同じにすると `/a.png "撮影 2026 年"` が `/` 始まりの
 * 道として `safeImageUrl` を通り、取りに行けない住所が `img` に入る。
 */
function markdownImageTarget(target: string): string {
  return target.trim().split(/\s+/)[0] ?? "";
}

/**
 * 本文から先頭画像の URL を拾う。`<img src="...">` と `![alt](src)` の両方。
 *
 * 本文は拡張 Markdown で保存され、画像は `![alt](src)` になる（`prose-format.ts`）。
 * **`<img>` だけを見ていた間、本文エディタで書いた記事の画像は 1 枚も候補に
 * 上がらなかった。**`body_first_image`（「本文の先頭画像」）は選択肢として画面に
 * 並ぶのに到達しない枝で、運営者には「写真を貼ったのに表紙だけ代替図版のまま」と
 * 見える。アイキャッチ欄は `<img>` のまま入りうるので、両方読む。
 *
 * **採るのは本文に先に現れたほう。**優先するのは記法ではなく順序で、読者が最初に
 * 出会う絵と表紙を一致させる。記法で優先を付けると、書き方を変えた日に表紙が入れ替わる。
 *
 * 正規表現で読むのは、本文が保存時に検査済みの形しか通らないため（`custom-html` が
 * 入口で弾く）。**拾った URL はそのまま `img` に入る**ので、記法が増えても関門
 * （`safeImageUrl`）は 1 か所に保つ。
 */
export function firstImageUrlInBody(body: string): string | null {
  const html = HTML_IMAGE_SRC.exec(body);
  const markdown = MARKDOWN_IMAGE.exec(body);

  if (markdown === null) return safeImageUrl(html?.[1]);
  const markdownUrl = safeImageUrl(markdownImageTarget(markdown[1] ?? ""));
  if (html === null) return markdownUrl;

  return html.index <= markdown.index ? safeImageUrl(html[1]) : markdownUrl;
}

/**
 * `img` の `src` に入れてよい URL か。よくなければ null。
 *
 * ==========================================================================
 * なぜ独立した関数なのか
 * ==========================================================================
 *
 * 画像の URL は `<img>` から抜くとは限らない。アイキャッチのように
 * **URL がそのまま保存されている**欄もある。判定を `firstImageUrlInBody` の
 * 中だけに置くと、`<img>` を通らない経路が検査を素通りし、
 * その経路だけが `javascript:` を画面へ通す。
 *
 * 通さないのは実行に化ける仕組み（`javascript:` / `vbscript:`）と、
 * 中身を URL に埋め込む形（`data:`）。`data:` を落とすのは、
 * 見た目は画像でも、外へ渡したときに取りに行けないためでもある。
 *
 * ==========================================================================
 * 危ないものを数え上げるのではなく、通すものを数え上げる（2026-09-05）
 * ==========================================================================
 *
 * 2026-09-05 まで、ここは上の 3 つを弾くだけで、**URL の形をしているか**を
 * 一度も見ていなかった。アイキャッチ欄は「`<img>` で入ることも、URL が
 * そのまま入ることもある」欄なので、運営者が説明文を書けばそれが通る。
 *
 * 実際に通っていた（`/admin/blog/articles` で実測）:
 *
 *     body = "机の上に道具を並べて、置き場所ごとに測っている様子。"
 *     → <img src="机の上に道具を並べて、…">
 *     → GET /admin/blog/%E6%9C%BA%E3%81%AE… → 404
 *
 * 相対 URL として解決されるので、**同じ絵が画面ごとに違う場所を取りに行く。**
 * 404 は console.error として出ていたが、読者面では黙って絵が欠ける。
 *
 * 数え上げる向きを変えた。通すのは
 *   - `https:` / `http:` の絶対 URL
 *   - `/` で始まるこのサイト内の道（`//` は別ホストなので除く）
 * だけで、それ以外は名前が何であれ通さない。
 *
 * **絵が消えることはない。**候補が 1 つも無ければ `resolveThumbnail` が
 * 代替図版を返すと最初から決めてある。説明文は説明文として残り、
 * 絵の場所には代替図版が出る。
 */
export function safeImageUrl(value: string | null | undefined): string | null {
  const url = usable(value);
  if (!url) return null;
  // 別ホストへ連れて行く形（`//host/…`）は、このサイト内の道ではない。
  if (url.startsWith("//")) return null;
  if (url.startsWith("/")) return url;
  try {
    const { protocol } = new URL(url);
    return protocol === "https:" || protocol === "http:" ? url : null;
  } catch {
    // URL として読めないもの（説明文など）は、絵の在り処ではない。
    return null;
  }
}
