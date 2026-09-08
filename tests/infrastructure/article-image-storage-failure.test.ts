/** @tier 1 @req REQ-BOPS05 @types boundary, equivalence */
import { describe, expect, it } from "vitest";
import { storageFailure } from "@/infrastructure/persistence/d1/storage-failure";

describe("回収済み画像を参照した保存失敗の案内", () => {
  it.each([
    new Error("D1_ERROR: article_image_unavailable: SQLITE_CONSTRAINT"),
    new Error("article_image_unavailable"),
    new Error("article_image_unavailable: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER)"),
    new Error("Failed query: private query and article content", {
      cause: new Error("D1_ERROR: article_image_unavailable: SQLITE_CONSTRAINT"),
    }),
  ])("正規のD1拒否を、待つだけでは直らない入力エラーにする", (cause) => {
    const result = storageFailure("記事の保存", cause);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION_FAILED");
    expect(result.error.field).toBe("blocks");
    expect(result.error.retryable).toBe(false);
    expect(result.error.message).toContain("画像を選び直して");
    expect(JSON.stringify(result)).not.toContain("private query");
    expect(JSON.stringify(result)).not.toContain("article_image_unavailable");
  });

  it.each([
    new Error("Failed query with text 'article_image_unavailable'"),
    new Error("D1_ERROR: article_image_identity_immutable: SQLITE_CONSTRAINT"),
    new Error("D1_ERROR: connection unavailable"),
    new Error("article_image_unavailable: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_TRIGGER) private SQL"),
    { message: "article_image_unavailable" },
    null,
  ])("本文の文字列や別の故障を画像の入力ミスに置き換えない", (cause) => {
    const result = storageFailure("記事の保存", cause);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.retryable).toBe(true);
  });

  it("causeが循環していても停止する", () => {
    const cause = new Error("connection unavailable");
    cause.cause = cause;
    const result = storageFailure("記事の保存", cause);
    expect(!result.ok && result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});
