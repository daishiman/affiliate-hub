/**
 * @tier 1
 * @req REQ-BOPS14, FRONT-REQ-005
 */
import { describe, expect, it } from "vitest";
import {
  ARTICLE_IMAGE_UNREFERENCED_GRACE_MS,
  ARTICLE_IMAGE_UPLOAD_GRACE_MS,
  articleImageHref,
  articleImageKey,
  assertArticleImageIsStorable,
  detectArticleImageMimeType,
  shouldReclaimArticleImage,
} from "@/domain/blogops/article-image-policy";
import { asArticleId, asWorkspaceId } from "@/domain/shared";

const NOW = new Date("2026-09-06T00:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("記事の画像は、送られた側が形式と大きさを測る", () => {
  const signatures = [
    ["image/png", "png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
    ["image/jpeg", "jpg", [0xff, 0xd8, 0xff, 0xe0]],
    ["image/webp", "webp", [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]],
    ["image/gif", "gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  ] as const;

  it("png・jpeg・webp・gif をバイト列から見分ける", () => {
    for (const [mimeType, , bytes] of signatures) {
      expect(detectArticleImageMimeType(Uint8Array.from(bytes))).toBe(mimeType);
    }
  });

  it("申告とバイト列が一致する png・jpeg・webp・gif は受け取る", () => {
    for (const [mimeType, extension, bytes] of signatures) {
      const result = assertArticleImageIsStorable({
        declaredMimeType: mimeType,
        byteSize: 1024,
        signatureBytes: Uint8Array.from(bytes),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual({ extension, mimeType });
      }
    }
  });

  it("申告が png でも中身が jpeg なら受け取らない", () => {
    const result = assertArticleImageIsStorable({
      declaredMimeType: "image/png",
      byteSize: 1024,
      signatureBytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.field).toBe("mimeType");
  });

  it("画像と判定できないバイト列は受け取らない", () => {
    expect(detectArticleImageMimeType(Uint8Array.from([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
    expect(
      assertArticleImageIsStorable({
        declaredMimeType: "image/png",
        byteSize: 4,
        signatureBytes: Uint8Array.from([0x3c, 0x73, 0x76, 0x67]),
      }).ok,
    ).toBe(false);
  });

  it("SVG は受け取らない（画像の顔をした、script を書ける文書だから）", () => {
    const result = assertArticleImageIsStorable({
      declaredMimeType: "image/svg+xml",
      byteSize: 512,
      signatureBytes: Uint8Array.from([0x3c, 0x73, 0x76, 0x67]),
    });
    expect(result.ok).toBe(false);
  });

  it("中身の無いものと、大きすぎるものは受け取らない", () => {
    const png = Uint8Array.from(signatures[0][2]);
    expect(
      assertArticleImageIsStorable({
        declaredMimeType: "image/png",
        byteSize: 0,
        signatureBytes: png,
      }).ok,
    ).toBe(false);
    expect(
      assertArticleImageIsStorable({
        declaredMimeType: "image/png",
        byteSize: 8 * 1024 * 1024 + 1,
        signatureBytes: png,
      }).ok,
    ).toBe(false);
  });
});

describe("公開 URL には置き場の鍵を出さない", () => {
  it("鍵は作業場所と記事で階層が分かれる", () => {
    expect(articleImageKey(asWorkspaceId("ws1"), asArticleId("a1"), "img1", "png")).toBe(
      "article-images/ws1/a1/img1.png",
    );
  });

  it("URL には作業場所も記事も現れない（覚えのない 1 語だけ）", () => {
    const href = articleImageHref("img1");
    expect(href).toBe("/api/article-images/img1");
    expect(href).not.toContain("ws1");
    expect(href).not.toContain("article-images/ws1");
  });
});

describe("使われなくなった画像を、いつ消してよいか", () => {
  it("いま使われているものは、どれだけ古くても消さない", () => {
    expect(
      shouldReclaimArticleImage(
        {
          referencedNow: true,
          createdAt: ago(10 * ARTICLE_IMAGE_UNREFERENCED_GRACE_MS),
          lastReferencedAt: ago(10 * ARTICLE_IMAGE_UNREFERENCED_GRACE_MS),
        },
        NOW,
      ),
    ).toBe(false);
  });

  it("一度も貼られなかったものは、送信から 24 時間で回収する", () => {
    const candidate = (age: number) => ({
      referencedNow: false,
      createdAt: ago(age),
      lastReferencedAt: null,
    });
    expect(shouldReclaimArticleImage(candidate(ARTICLE_IMAGE_UPLOAD_GRACE_MS - 1), NOW)).toBe(false);
    expect(shouldReclaimArticleImage(candidate(ARTICLE_IMAGE_UPLOAD_GRACE_MS), NOW)).toBe(true);
  });

  it("貼られていたが外されたものは、外れてから 30 日待つ", () => {
    // 送信は遥か昔でよい。数えるのは「最後に参照されていた時刻」からである。
    const candidate = (sinceReferenced: number) => ({
      referencedNow: false,
      createdAt: ago(365 * 24 * 60 * 60 * 1000),
      lastReferencedAt: ago(sinceReferenced),
    });
    expect(
      shouldReclaimArticleImage(candidate(ARTICLE_IMAGE_UNREFERENCED_GRACE_MS - 1), NOW),
    ).toBe(false);
    expect(shouldReclaimArticleImage(candidate(ARTICLE_IMAGE_UNREFERENCED_GRACE_MS), NOW)).toBe(
      true,
    );
  });

  it("外された画像を、送信の古さだけで消さない（戻す余地を残す）", () => {
    // 1 年前に送られ、昨日まで貼られていた画像。送信基準なら即座に消える。
    expect(
      shouldReclaimArticleImage(
        {
          referencedNow: false,
          createdAt: ago(365 * 24 * 60 * 60 * 1000),
          lastReferencedAt: ago(24 * 60 * 60 * 1000),
        },
        NOW,
      ),
    ).toBe(false);
  });
});
