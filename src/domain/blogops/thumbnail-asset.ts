/**
 * サムネイル画像の**置き場所**の決まりごと。
 *
 * ==========================================================================
 * この層が持つもの・持たないもの
 * ==========================================================================
 *
 * `thumbnail.ts` が決めるのは「どの絵を使うか」（登録経路の優先順位）。
 * こちらが決めるのは「その絵を R2 のどこに、どういう名前で置くか」である。
 * 置き場（R2）にも画面にも触らない純粋な規則だけを持つ。
 *
 * ==========================================================================
 * なぜ派生（複数幅）をサーバーで作らないのか
 * ==========================================================================
 *
 * この製品は Cloudflare Workers（workerd）で動く。**workerd には画像の
 * デコーダが無い。**`wrangler.jsonc` に Images バインディングも置いていない。
 * つまりサーバー側で JPEG を開いて縮小することは、外部サービスを 1 つ増やす
 * まではできない。
 *
 * だから派生は**投稿する側のブラウザが Canvas で作り**、サーバーは
 * 受け取ったものを検査して置くだけにする。この分担には副作用がある:
 *
 *   - サーバーは「送られてきた幅が本当にその幅か」を画素では確かめられない。
 *     確かめられるのは形式・大きさ（バイト数）・鍵の形だけである。
 *   - よって**鍵は原本の中身から決まる指紋を含み、一度置いたら書き換えない。**
 *     嘘の幅が入っても、それは 1 つの記事の 1 世代に閉じ、他所へ波及しない。
 *
 * 縮小をサーバーへ移すなら（Images バインディングを入れるなら）、変わるのは
 * 「誰が派生バイト列を作るか」だけで、この鍵の形は変えなくてよい。
 *
 * ==========================================================================
 * なぜ書き換えない（immutable）のか
 * ==========================================================================
 *
 * サムネイルは一覧・OGP・SNS のキャッシュに同時に載る。同じ URL が
 * 別の絵を返す瞬間を作ると、**どこかだけ古い絵が残り、消し方が無い。**
 * 差し替えは「同じ鍵へ上書き」ではなく「新しい鍵を作って参照を移す」。
 * 古い鍵は参照されなくなってから消す（消す担当はこの層ではない）。
 */
import { domainError, type DomainError } from "@/domain/shared/errors";
import { err, ok, type Result } from "@/domain/shared/result";
import { THUMBNAIL_WIDTHS, type ThumbnailWidth } from "./thumbnail";

/**
 * 受け付ける形式。
 *
 * png / jpeg / webp の 3 つに絞る。avif を入れないのは、作れないブラウザが
 * まだあり、**「投稿者の環境によっては保存できない」という分かりにくい
 * 壊れ方**になるため。svg を入れないのは、SVG が実行できる文書だからで、
 * 読者のブラウザで開く絵に脚本を持たせない。
 */
export const ALLOWED_THUMBNAIL_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

export type AllowedThumbnailMime = (typeof ALLOWED_THUMBNAIL_MIME)[number];

/** 形式から拡張子へ。**鍵に入る文字はここでしか決めない。** */
export const THUMBNAIL_EXTENSION: Readonly<Record<AllowedThumbnailMime, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * 原本の上限。
 *
 * 8MB は「一眼で撮った写真がそのまま通る」あたりに置いてある。ここを
 * 小さくしすぎると投稿者が縮小の手作業を強いられ、大きくしすぎると
 * R2 の課金と派生生成（ブラウザ側）の待ち時間に直に響く。
 */
export const MAX_THUMBNAIL_BYTES = 8 * 1024 * 1024;

/** 派生の上限。原本より緩くする理由が無いので同じ天井を使う。 */
export const MAX_DERIVED_THUMBNAIL_BYTES = MAX_THUMBNAIL_BYTES;

/**
 * 鍵の頭。**この文字列で始まらないものは配信の口が受け取らない。**
 *
 * 置き場は改善要望の写し（`feedback-captures/`）や書き出しファイルと
 * 同じバケットを共有する。頭を固定しておかないと、配信の口が
 * バケット内の**別の用途のもの**を渡せてしまう。
 */
export const THUMBNAIL_KEY_PREFIX = "blog-thumbnails/";

/** 鍵の長さの天井。R2 の上限（1024 バイト）より十分手前で断る。 */
const MAX_KEY_LENGTH = 320;

export type ThumbnailSubmission = {
  readonly mimeType: string;
  readonly byteLength: number;
  /** 派生なら幅、原本なら null。 */
  readonly width: ThumbnailWidth | null;
};

/** 形式が一覧にあるか。`string` を絞り込む。 */
export function isAllowedThumbnailMime(value: string): value is AllowedThumbnailMime {
  return (ALLOWED_THUMBNAIL_MIME as readonly string[]).includes(value);
}

/** 幅が配信する派生の一覧にあるか。 */
export function isThumbnailWidth(value: number): value is ThumbnailWidth {
  return (THUMBNAIL_WIDTHS as readonly number[]).includes(value);
}

/**
 * 置いてよい画像かを確かめる。
 *
 * 通らないものは置き場へ渡さない。「置いてから消す」ではなく「入れない」
 * （先例: `src/domain/feedback/capture-policy.ts`）。
 */
export function assertThumbnailIsStorable(
  submission: ThumbnailSubmission,
): Result<ThumbnailSubmission, DomainError> {
  if (!isAllowedThumbnailMime(submission.mimeType)) {
    return err(
      domainError("VALIDATION_FAILED", "画像の形式が違います（png / jpeg / webp のみ）。", {
        field: "mimeType",
        suggestedAction: "png・jpeg・webp のいずれかで保存し直してから選び直してください。",
      }),
    );
  }
  if (submission.byteLength <= 0) {
    return err(domainError("VALIDATION_FAILED", "画像が空です。", { field: "byteLength" }));
  }
  if (submission.byteLength > MAX_THUMBNAIL_BYTES) {
    return err(
      domainError("VALIDATION_FAILED", "画像が大きすぎます（8MB まで）。", {
        field: "byteLength",
        suggestedAction: "書き出しの品質を下げるか、長辺を小さくしてからもう一度選んでください。",
      }),
    );
  }
  if (submission.width !== null && !isThumbnailWidth(submission.width)) {
    return err(
      domainError("VALIDATION_FAILED", "配信しない幅の派生です。", {
        field: "width",
        // 幅は `THUMBNAIL_WIDTHS` が正本。ここで別の並びを書かない。
        suggestedAction: `作る派生の幅は ${THUMBNAIL_WIDTHS.join(" / ")} です。`,
      }),
    );
  }
  return ok(submission);
}

/**
 * 原本の中身から指紋を作る。**暗号用途ではない。**
 *
 * 求めているのは「中身が変われば鍵が変わる」だけで、当てにくさは要らない
 * （当てられて困る絵はここへ置かない ─ サムネイルは読者に配る絵である）。
 * `thumbnail.ts` の `thumbnailHash` と同じ FNV-1a を、バイト列に対して回す。
 */
export function thumbnailContentHash(bytes: ArrayBuffer): string {
  let hash = 0x811c9dc5;
  for (const byte of new Uint8Array(bytes)) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export type ThumbnailKeyParts = {
  readonly siteSlug: string;
  readonly articleSlug: string;
  /** `thumbnailContentHash` の値。**原本と、その派生すべてで同じ値を使う。** */
  readonly contentHash: string;
  /** 派生の幅。原本そのものなら null。 */
  readonly width: ThumbnailWidth | null;
  readonly mimeType: AllowedThumbnailMime;
};

/**
 * 鍵に入れてよい形へ均す。
 *
 * `slug` は入口で検査済みだが、**鍵を組む側がそれに寄りかからない。**
 * 検査の緩い経路（取り込み・移行スクリプト）が後から増えたとき、
 * 寄りかかっていると、その経路だけがバケットの外へ手を伸ばす形の鍵を作る。
 * ここで落ちない文字は 1 つも無い、という状態にしておく。
 */
function keySegment(value: string): string {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
  // 全部落ちた（日本語だけの slug など）ときに段を消さない。段が消えると
  // 別の記事と同じ鍵になり、一覧に他の記事の絵が出る。
  return normalized.length > 0 ? normalized : "_";
}

/**
 * R2 に置くときの鍵を組み立てる。
 *
 * ```
 * blog-thumbnails/<サイト>/<記事>/<指紋>/original.jpg
 * blog-thumbnails/<サイト>/<記事>/<指紋>/640.jpg
 * ```
 *
 * ==========================================================================
 * なぜ指紋を「段」にしたのか（ファイル名の一部にしなかったのか）
 * ==========================================================================
 *
 * これは**差し替えたあと古い絵をどう消すか**の答えそのものである。
 *
 * 指紋を段にすると、1 回の差し替えで生まれた原本と派生 3 枚が
 * 1 つの段にまとまる。古い世代を消すのは `list({ prefix })` →
 * `delete` の 1 往復で済み、**消し忘れた 1 枚が残らない。**
 *
 * ファイル名側（`<指紋>-640.jpg`）に置くと、同じ段に世代が混ざる。
 * 一覧して名前を読み分ける処理が要り、その読み分けが鍵の組み立てと
 * 二重管理になる。**二重に持った規則は、片方だけ直された日に壊れる。**
 *
 * ==========================================================================
 * なぜ原本が `original` で、幅が数字なのか
 * ==========================================================================
 *
 * 幅は `THUMBNAIL_WIDTHS` の数字しか来ない（`assertThumbnailIsStorable` が門）。
 * 数字と `original` はぶつかりようがない。ここがぶつかると
 * **派生が原本を上書きし、一覧に 8MB の絵が並ぶ。**
 */
export function thumbnailObjectKey(parts: ThumbnailKeyParts): string {
  const site = keySegment(parts.siteSlug);
  const article = keySegment(parts.articleSlug);
  const generation = keySegment(parts.contentHash);
  const name = parts.width === null ? "original" : String(parts.width);
  const extension = THUMBNAIL_EXTENSION[parts.mimeType];
  return `${THUMBNAIL_KEY_PREFIX}${site}/${article}/${generation}/${name}.${extension}`;
}

/**
 * 鍵から、その 1 世代ぶん（原本と派生すべて）を指す頭を取る。
 *
 * ==========================================================================
 * なぜ「組み立て直す」のではなく「置いた鍵から取る」のか
 * ==========================================================================
 *
 * 記事の URL 名（slug）は後から変えられる。変えたあとに材料から組み直すと、
 * **置いたときとは違う鍵ができて、古い世代を消しに行っても空振りする。**
 * 消し残った絵は誰も参照しないまま R2 に積み上がり、気付く手立てが無い。
 *
 * だから置いた鍵そのものを持ち回り、消すときはそこから頭を取る。
 * 鍵は「そのとき何を置いたか」の記録であって、材料から再計算できる値ではない。
 */
export function thumbnailGenerationPrefixOfKey(key: string): string | null {
  if (!isDeliverableThumbnailKey(key)) return null;
  const cut = key.lastIndexOf("/");
  if (cut < 0) return null;
  return key.slice(0, cut + 1);
}

/**
 * 原本の鍵から、同じ世代の派生（または原本）の鍵を導く。
 *
 * 幅ごとの鍵を呼ぶ側に組み立てさせないため。組み立てさせると、
 * 材料（サイト名・記事名・指紋）を持ち回る必要が出て、
 * `thumbnailGenerationPrefixOfKey` の説明と同じ「slug を変えた日に空振り」が
 * 派生の側でも起きる。
 */
export function thumbnailVariantKey(
  originalKey: string,
  width: ThumbnailWidth | null,
): string | null {
  const prefix = thumbnailGenerationPrefixOfKey(originalKey);
  if (prefix === null) return null;
  const name = originalKey.slice(prefix.length);
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const extension = name.slice(dot + 1);
  if (!Object.values(THUMBNAIL_EXTENSION).includes(extension)) return null;
  return `${prefix}${width === null ? "original" : String(width)}.${extension}`;
}

/**
 * 1 世代ぶんを指す頭を、材料から組み立てる。
 *
 * 置く側（まだ鍵を持っていない）だけが使う。**既に置いたものを消すときは
 * `thumbnailGenerationPrefixOfKey` を使うこと。**
 */
export function thumbnailGenerationPrefix(
  parts: Pick<ThumbnailKeyParts, "siteSlug" | "articleSlug" | "contentHash">,
): string {
  const key = thumbnailObjectKey({ ...parts, width: null, mimeType: "image/png" });
  return key.slice(0, key.lastIndexOf("/") + 1);
}

/**
 * 配信の口が受け取ってよい鍵か。
 *
 * ==========================================================================
 * なぜ「組み立て直して比べる」のではなく、形だけを見るのか
 * ==========================================================================
 *
 * 配信の口に届くのは URL の一部で、そこから記事やサイトを引き直すと
 * 「絵を 1 枚渡すために D1 を引く」ことになる。サムネイルは 1 画面で
 * 20 枚以上並ぶので、そこは通らない道にしたい。
 *
 * 代わりにここでは**形だけ**を見る。鍵が当てにくいかどうかには頼らない
 * （サムネイルは読者に配る絵で、隠す対象ではない）。見ているのは
 * 「バケット内の別の用途へ手が伸びないこと」の 1 点である。
 */
export function isDeliverableThumbnailKey(key: string): boolean {
  if (!key.startsWith(THUMBNAIL_KEY_PREFIX)) return false;
  if (key.length > MAX_KEY_LENGTH) return false;
  // `..` は上へ、`//` は空の段。どちらも置く側が作らない形なので、来たら断る。
  if (key.includes("..") || key.includes("//")) return false;
  if (!/^[a-z0-9/_.-]+$/.test(key)) return false;
  const extensions = Object.values(THUMBNAIL_EXTENSION);
  return extensions.some((extension) => key.endsWith(`.${extension}`));
}
