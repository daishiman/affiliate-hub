/**
 * @tier 1
 * @req REQ-VIS02
 * @types fault-injection, idempotency, equivalence, boundary
 *
 * サムネイルを R2 へ置き・配り・消す側。
 *
 * --- ここで見たいこと ---
 * 1. **置き場が落ちたときに何が残るか。**原本が置けなければ進まない。
 *    派生が落ちても原本は残る（運営者の作業を無駄にしない）。
 * 2. **同じ絵を 2 度上げても増えないこと。**鍵が中身から決まるので、
 *    2 度目は同じ場所へ同じものを書く。
 * 3. **同じバケットの別用途へ手が伸びないこと。**
 */
import {
  THUMBNAIL_CACHE_CONTROL,
  blogThumbnailHref,
  deleteThumbnailGeneration,
  putThumbnailGeneration,
  readBlogThumbnail,
  type ThumbnailBucket,
} from "@/infrastructure/platform/blog-thumbnail-r2";
import { THUMBNAIL_KEY_PREFIX } from "@/domain/blogops";
import { beforeEach, describe, expect, it } from "vitest";

type Stored = { body: ArrayBuffer; contentType?: string; cacheControl?: string };

/** 置き場の代わり。**どの鍵へ何を書いたか**を見たいだけなので中身は Map。 */
function fakeBucket(options: { failOn?: (key: string) => boolean } = {}) {
  const objects = new Map<string, Stored>();
  const bucket: ThumbnailBucket = {
    async put(key, body, opts) {
      if (options.failOn?.(key) === true) throw new Error("R2 down");
      objects.set(key, {
        body,
        contentType: opts?.httpMetadata?.contentType,
        cacheControl: opts?.httpMetadata?.cacheControl,
      });
    },
    async get(key) {
      const found = objects.get(key);
      if (found === undefined) return null;
      return {
        async arrayBuffer() {
          return found.body;
        },
        httpMetadata: { contentType: found.contentType },
      };
    },
    async delete(key) {
      objects.delete(key);
    },
    async list(opts) {
      const prefix = opts?.prefix ?? "";
      return {
        objects: [...objects.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
        truncated: false,
      };
    },
  };
  return { bucket, objects };
}

function bytes(size: number, fill = 1): ArrayBuffer {
  return new Uint8Array(size).fill(fill).buffer;
}

const AN_UPLOAD = {
  siteSlug: "creator-tools",
  articleSlug: "quiet-laptop",
  mimeType: "image/jpeg" as const,
  original: bytes(4096, 7),
  derived: [
    { width: 320 as const, bytes: bytes(512, 3) },
    { width: 640 as const, bytes: bytes(1024, 4) },
    { width: 1280 as const, bytes: bytes(2048, 5) },
  ],
};

describe("1 世代を置く", () => {
  let store: ReturnType<typeof fakeBucket>;
  beforeEach(() => {
    store = fakeBucket();
  });

  it("原本と派生 3 枚が同じ段に入る", async () => {
    const result = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(store.objects.size).toBe(4);
    expect(result.value.derivedWidths).toEqual([320, 640, 1280]);
    for (const key of store.objects.keys()) {
      expect(key.startsWith(THUMBNAIL_KEY_PREFIX)).toBe(true);
    }
  });

  it("置いた全部に「1 年・書き換えない」を付ける", async () => {
    await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    for (const stored of store.objects.values()) {
      expect(stored.cacheControl).toBe(THUMBNAIL_CACHE_CONTROL);
      expect(stored.contentType).toBe("image/jpeg");
    }
  });

  it("同じ絵を 2 度上げても増えない（鍵が中身から決まる）", async () => {
    const first = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    const second = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.objectKey).toBe(first.value.objectKey);
    expect(store.objects.size).toBe(4);
  });

  it("絵を変えると別の段になる（古い絵が残り、参照だけが移る）", async () => {
    const first = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    const second = await putThumbnailGeneration(store.bucket, {
      ...AN_UPLOAD,
      original: bytes(4096, 8),
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.value.objectKey).not.toBe(first.value.objectKey);
    expect(store.objects.size).toBe(8);
  });

  it("置けない形式は R2 に触れる前に断る", async () => {
    const result = await putThumbnailGeneration(store.bucket, {
      ...AN_UPLOAD,
      mimeType: "image/svg+xml" as never,
    });
    expect(result.ok).toBe(false);
    expect(store.objects.size).toBe(0);
  });

  it("8MB を超える原本は断る", async () => {
    const result = await putThumbnailGeneration(store.bucket, {
      ...AN_UPLOAD,
      original: bytes(8 * 1024 * 1024 + 1),
    });
    expect(result.ok).toBe(false);
    expect(store.objects.size).toBe(0);
  });

  it("配信しない幅の派生は、その 1 枚だけを落とす", async () => {
    const result = await putThumbnailGeneration(store.bucket, {
      ...AN_UPLOAD,
      derived: [
        { width: 640 as const, bytes: bytes(1024) },
        { width: 999 as never, bytes: bytes(1024) },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.derivedWidths).toEqual([640]);
    expect(store.objects.size).toBe(2);
  });
});

describe("置き場が落ちたとき", () => {
  it("原本が置けなければ派生へ進まない", async () => {
    const store = fakeBucket({ failOn: (key) => key.endsWith("original.jpg") });
    const result = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.retryable).toBe(true);
    // 原本の無い世代を残さない。残すと `srcset` の親が居ない状態になる。
    expect(store.objects.size).toBe(0);
  });

  it("派生が落ちても原本は残り、置けた幅だけが返る", async () => {
    const store = fakeBucket({ failOn: (key) => key.endsWith("640.jpg") });
    const result = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.derivedWidths).toEqual([320, 1280]);
    expect(store.objects.has(result.value.objectKey)).toBe(true);
  });

  it("派生が全部落ちても原本 1 枚で成立する", async () => {
    const store = fakeBucket({ failOn: (key) => !key.endsWith("original.jpg") });
    const result = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.derivedWidths).toEqual([]);
  });

  it("消せなかったら「消えた」と言わない", async () => {
    const store = fakeBucket();
    const stored = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    store.bucket.list = async () => {
      throw new Error("R2 down");
    };
    const result = await deleteThumbnailGeneration(store.bucket, stored.value.objectKey);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("読み出しの門", () => {
  it("置いたものは置いたときの形式で返る", async () => {
    const store = fakeBucket();
    const stored = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const found = await readBlogThumbnail(store.bucket, stored.value.objectKey);
    expect(found?.contentType).toBe("image/jpeg");
    expect(found?.bytes.byteLength).toBe(4096);
  });

  it("別用途の鍵では R2 を引きにも行かない", async () => {
    const store = fakeBucket();
    let asked = 0;
    store.bucket.get = async () => {
      asked += 1;
      return null;
    };
    expect(await readBlogThumbnail(store.bucket, "feedback-captures/a/b.png")).toBeNull();
    expect(await readBlogThumbnail(store.bucket, `${THUMBNAIL_KEY_PREFIX}../a/b.png`)).toBeNull();
    // 引きに行くと、別用途の名前を総当たりで試せる口になる。
    expect(asked).toBe(0);
  });

  it("鍵はあるが物が無ければ null", async () => {
    const store = fakeBucket();
    expect(await readBlogThumbnail(store.bucket, `${THUMBNAIL_KEY_PREFIX}a/b/c/640.jpg`)).toBeNull();
  });
});

describe("1 世代を消す", () => {
  it("原本と派生をまとめて消し、別の世代は残す", async () => {
    const store = fakeBucket();
    const older = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    const newer = await putThumbnailGeneration(store.bucket, {
      ...AN_UPLOAD,
      original: bytes(4096, 9),
    });
    expect(older.ok && newer.ok).toBe(true);
    if (!older.ok || !newer.ok) return;

    const result = await deleteThumbnailGeneration(store.bucket, older.value.objectKey);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.deleted).toBe(4);
    expect(store.objects.size).toBe(4);
    expect(store.objects.has(newer.value.objectKey)).toBe(true);
  });

  it("消したあともう一度消しても壊れない", async () => {
    const store = fakeBucket();
    const stored = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    await deleteThumbnailGeneration(store.bucket, stored.value.objectKey);
    const second = await deleteThumbnailGeneration(store.bucket, stored.value.objectKey);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.deleted).toBe(0);
  });

  it("別用途の鍵では消しに行かない", async () => {
    const store = fakeBucket();
    await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    const result = await deleteThumbnailGeneration(store.bucket, "feedback-captures/");
    expect(result.ok).toBe(false);
    expect(store.objects.size).toBe(4);
  });
});

describe("取り出す口の住所", () => {
  it("鍵の段はそのまま URL の段になる", () => {
    expect(blogThumbnailHref(`${THUMBNAIL_KEY_PREFIX}site/article/1a2b3c4d/640.jpg`)).toBe(
      "/api/blog-thumbnails/blog-thumbnails/site/article/1a2b3c4d/640.jpg",
    );
  });

  it("置いた鍵から作った住所は、口の門を通る形へ戻る", async () => {
    const store = fakeBucket();
    const stored = await putThumbnailGeneration(store.bucket, AN_UPLOAD);
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    const path = blogThumbnailHref(stored.value.objectKey).replace("/api/blog-thumbnails/", "");
    expect(path.split("/").map(decodeURIComponent).join("/")).toBe(stored.value.objectKey);
  });
});
