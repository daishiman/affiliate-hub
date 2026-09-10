/**
 * @tier 1
 * @req REQ-VIS01
 * @types equivalence, boundary
 *
 * サムネイルの**置き場所**の規則を確かめる。
 *
 * --- ここで見たいこと ---
 * 1. **置いてよくないものが置き場へ届かないこと。** 形式・大きさ・幅の 3 つ。
 * 2. **中身が変われば鍵が変わること。** 変わらないと、差し替えたのに
 *    古い絵が配られ続ける（SNS 側のキャッシュには手が届かない）。
 * 3. **鍵がバケットの外や別の用途へ伸びないこと。**
 *
 * --- ここで見ないこと ---
 * 「どの絵を使うか」の優先順位は `src/domain/blogops/thumbnail.ts` の担当で、
 * `tests/application/blog-ops-usecases.test.ts` が見ている。
 * ここは「決まった絵をどこへ置くか」だけを持つ。
 */
import {
  ALLOWED_THUMBNAIL_MIME,
  MAX_THUMBNAIL_BYTES,
  THUMBNAIL_KEY_PREFIX,
  assertThumbnailIsStorable,
  isDeliverableThumbnailKey,
  thumbnailContentHash,
  thumbnailGenerationPrefix,
  thumbnailGenerationPrefixOfKey,
  thumbnailObjectKey,
  thumbnailVariantKey,
  type ThumbnailKeyParts,
} from "@/domain/blogops/thumbnail-asset";
import { THUMBNAIL_WIDTHS } from "@/domain/blogops/thumbnail";
import { describe, expect, it } from "vitest";

/** 「全部通る良い例」。ここから 1 か所ずつ崩して規則を確かめる。 */
const A_GOOD_KEY: ThumbnailKeyParts = {
  siteSlug: "creator-tools",
  articleSlug: "quiet-laptop",
  contentHash: "1a2b3c4d",
  width: null,
  mimeType: "image/jpeg",
};

function bytesOf(values: readonly number[]): ArrayBuffer {
  return new Uint8Array(values).buffer;
}

describe("置いてよい画像か", () => {
  it("png / jpeg / webp は通る", () => {
    for (const mimeType of ALLOWED_THUMBNAIL_MIME) {
      const result = assertThumbnailIsStorable({ mimeType, byteLength: 1024, width: null });
      expect(result.ok, mimeType).toBe(true);
    }
  });

  it("一覧に無い形式は断る（svg は絵ではなく実行できる文書）", () => {
    const result = assertThumbnailIsStorable({
      mimeType: "image/svg+xml",
      byteLength: 1024,
      width: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(result.error.field).toBe("mimeType");
  });

  it("空の画像は断る", () => {
    const result = assertThumbnailIsStorable({
      mimeType: "image/png",
      byteLength: 0,
      width: null,
    });
    expect(result.ok).toBe(false);
  });

  it("ちょうど上限は通る（線は上限であって、その手前ではない）", () => {
    const result = assertThumbnailIsStorable({
      mimeType: "image/png",
      byteLength: MAX_THUMBNAIL_BYTES,
      width: null,
    });
    expect(result.ok).toBe(true);
  });

  it("上限を 1 バイト超えたら断る", () => {
    const result = assertThumbnailIsStorable({
      mimeType: "image/png",
      byteLength: MAX_THUMBNAIL_BYTES + 1,
      width: null,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("byteLength");
  });

  it("配信しない幅の派生は断る", () => {
    const result = assertThumbnailIsStorable({
      mimeType: "image/png",
      byteLength: 1024,
      // 型の上では通らないが、外から来る値は数字でしかない。
      width: 999 as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.field).toBe("width");
    // 幅の一覧を文言へ手で書き写していないこと。
    expect(result.error.suggestedAction).toContain(String(THUMBNAIL_WIDTHS[0]));
  });

  it("配信する幅はすべて通る", () => {
    for (const width of THUMBNAIL_WIDTHS) {
      const result = assertThumbnailIsStorable({ mimeType: "image/png", byteLength: 1024, width });
      expect(result.ok, String(width)).toBe(true);
    }
  });
});

describe("中身の指紋", () => {
  it("同じバイト列なら同じ値（再デプロイで絵が変わらない）", () => {
    expect(thumbnailContentHash(bytesOf([1, 2, 3]))).toBe(thumbnailContentHash(bytesOf([1, 2, 3])));
  });

  it("1 バイト違えば別の値", () => {
    expect(thumbnailContentHash(bytesOf([1, 2, 3]))).not.toBe(
      thumbnailContentHash(bytesOf([1, 2, 4])),
    );
  });

  it("並びが違えば別の値（合計ではなく順序も見ている）", () => {
    expect(thumbnailContentHash(bytesOf([1, 2]))).not.toBe(thumbnailContentHash(bytesOf([2, 1])));
  });

  it("空でも値を返す（長さで場合分けさせない）", () => {
    expect(thumbnailContentHash(bytesOf([]))).toMatch(/^[0-9a-f]{8}$/);
  });

  it("桁が揃う（短い値が段の名前を変えない）", () => {
    for (let index = 0; index < 32; index += 1) {
      expect(thumbnailContentHash(bytesOf([index]))).toMatch(/^[0-9a-f]{8}$/);
    }
  });
});

describe("R2 の鍵", () => {
  it("原本と派生が同じ段に並ぶ", () => {
    expect(thumbnailObjectKey(A_GOOD_KEY)).toBe(
      "blog-thumbnails/creator-tools/quiet-laptop/1a2b3c4d/original.jpg",
    );
    expect(thumbnailObjectKey({ ...A_GOOD_KEY, width: 640 })).toBe(
      "blog-thumbnails/creator-tools/quiet-laptop/1a2b3c4d/640.jpg",
    );
  });

  it("派生が原本を上書きしない（名前がぶつからない）", () => {
    const original = thumbnailObjectKey(A_GOOD_KEY);
    const derived = THUMBNAIL_WIDTHS.map((width) => thumbnailObjectKey({ ...A_GOOD_KEY, width }));
    expect(new Set([original, ...derived]).size).toBe(derived.length + 1);
  });

  it("中身が変われば鍵が変わる", () => {
    expect(thumbnailObjectKey({ ...A_GOOD_KEY, contentHash: "ffffffff" })).not.toBe(
      thumbnailObjectKey(A_GOOD_KEY),
    );
  });

  it("形式が変われば拡張子が変わる", () => {
    expect(thumbnailObjectKey({ ...A_GOOD_KEY, mimeType: "image/webp" })).toMatch(/\.webp$/);
    expect(thumbnailObjectKey({ ...A_GOOD_KEY, mimeType: "image/png" })).toMatch(/\.png$/);
  });

  it("別の記事・別のサイトなら別の鍵", () => {
    const other = thumbnailObjectKey({ ...A_GOOD_KEY, siteSlug: "other-site" });
    expect(other).not.toBe(thumbnailObjectKey(A_GOOD_KEY));
    expect(thumbnailObjectKey({ ...A_GOOD_KEY, articleSlug: "loud-laptop" })).not.toBe(
      thumbnailObjectKey(A_GOOD_KEY),
    );
  });

  it("鍵に使えない文字は落とす（入口の検査に寄りかからない）", () => {
    const key = thumbnailObjectKey({ ...A_GOOD_KEY, articleSlug: "../../etc/passwd" });
    expect(key.startsWith(THUMBNAIL_KEY_PREFIX)).toBe(true);
    expect(key).not.toContain("..");
    expect(isDeliverableThumbnailKey(key)).toBe(true);
  });

  it("段が消えない（全部落ちる名前でも別の記事とぶつからない）", () => {
    const japanese = thumbnailObjectKey({ ...A_GOOD_KEY, articleSlug: "静かなノートパソコン" });
    expect(japanese.split("/")).toHaveLength(thumbnailObjectKey(A_GOOD_KEY).split("/").length);
    expect(isDeliverableThumbnailKey(japanese)).toBe(true);
  });

  it("大文字は小さくして揃える（同じ記事が 2 つの段に散らない）", () => {
    expect(thumbnailObjectKey({ ...A_GOOD_KEY, articleSlug: "Quiet-Laptop" })).toBe(
      thumbnailObjectKey(A_GOOD_KEY),
    );
  });

  it("世代の頭は、その世代のものだけを指す", () => {
    const prefix = thumbnailGenerationPrefix(A_GOOD_KEY);
    for (const width of [null, ...THUMBNAIL_WIDTHS]) {
      expect(thumbnailObjectKey({ ...A_GOOD_KEY, width }).startsWith(prefix)).toBe(true);
    }
    expect(
      thumbnailObjectKey({ ...A_GOOD_KEY, contentHash: "ffffffff" }).startsWith(prefix),
    ).toBe(false);
  });
});

describe("置いた鍵から世代を辿る", () => {
  const original = thumbnailObjectKey(A_GOOD_KEY);

  it("原本の鍵から、同じ世代の頭が取れる", () => {
    expect(thumbnailGenerationPrefixOfKey(original)).toBe(thumbnailGenerationPrefix(A_GOOD_KEY));
  });

  it("派生の鍵からでも同じ頭が取れる（どれを持っていても世代を消せる）", () => {
    for (const width of THUMBNAIL_WIDTHS) {
      const derived = thumbnailObjectKey({ ...A_GOOD_KEY, width });
      expect(thumbnailGenerationPrefixOfKey(derived)).toBe(thumbnailGenerationPrefixOfKey(original));
    }
  });

  it("配信できない鍵からは頭を取らない（消す側の入口を門にする）", () => {
    expect(thumbnailGenerationPrefixOfKey("feedback-captures/a/b.png")).toBeNull();
    expect(thumbnailGenerationPrefixOfKey(`${THUMBNAIL_KEY_PREFIX}../a/b.png`)).toBeNull();
    expect(thumbnailGenerationPrefixOfKey("")).toBeNull();
  });

  it("原本の鍵から派生の鍵が導ける（材料を持ち回らなくてよい）", () => {
    for (const width of THUMBNAIL_WIDTHS) {
      expect(thumbnailVariantKey(original, width)).toBe(
        thumbnailObjectKey({ ...A_GOOD_KEY, width }),
      );
    }
    expect(thumbnailVariantKey(original, null)).toBe(original);
  });

  it("派生の鍵からでも原本へ戻れる", () => {
    const derived = thumbnailObjectKey({ ...A_GOOD_KEY, width: 640 });
    expect(thumbnailVariantKey(derived, null)).toBe(original);
    expect(thumbnailVariantKey(derived, 1280)).toBe(
      thumbnailObjectKey({ ...A_GOOD_KEY, width: 1280 }),
    );
  });

  it("形式は保つ（webp の世代に jpg を混ぜない）", () => {
    const webp = thumbnailObjectKey({ ...A_GOOD_KEY, mimeType: "image/webp" });
    expect(thumbnailVariantKey(webp, 320)).toMatch(/\.webp$/);
  });

  it("配信できない鍵からは派生を導かない", () => {
    expect(thumbnailVariantKey("exports/sales.csv", 640)).toBeNull();
    expect(thumbnailVariantKey(`${THUMBNAIL_KEY_PREFIX}a/b/c/original.svg`, 640)).toBeNull();
  });
});

describe("配信の口が受け取る鍵", () => {
  it("組み立てた鍵はすべて通る", () => {
    for (const mimeType of ALLOWED_THUMBNAIL_MIME) {
      for (const width of [null, ...THUMBNAIL_WIDTHS]) {
        const key = thumbnailObjectKey({ ...A_GOOD_KEY, mimeType, width });
        expect(isDeliverableThumbnailKey(key), key).toBe(true);
      }
    }
  });

  it("別の用途の置き場は通さない（同じバケットを共有している）", () => {
    expect(isDeliverableThumbnailKey("feedback-captures/abc.png")).toBe(false);
    expect(isDeliverableThumbnailKey("exports/sales.csv")).toBe(false);
  });

  it("上へ辿る形は通さない", () => {
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}../feedback-captures/a.png`)).toBe(
      false,
    );
  });

  it("空の段は通さない", () => {
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}site//640.jpg`)).toBe(false);
  });

  it("画像でない拡張子は通さない", () => {
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}a/b/c/original.svg`)).toBe(false);
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}a/b/c/original.html`)).toBe(false);
  });

  it("長すぎる鍵は通さない", () => {
    const long = `${THUMBNAIL_KEY_PREFIX}${"a".repeat(400)}/original.jpg`;
    expect(isDeliverableThumbnailKey(long)).toBe(false);
  });

  it("知らない文字は通さない（空白・記号・多バイト）", () => {
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}a b/c/original.jpg`)).toBe(false);
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}日本語/c/original.jpg`)).toBe(false);
    expect(isDeliverableThumbnailKey(`${THUMBNAIL_KEY_PREFIX}a?x=1/c/original.jpg`)).toBe(false);
  });
});
