/** @tier 1 */
import { describe, expect, it } from "vitest";
import {
  SECRET_REDACTED,
  checkApiKeyShape,
  containsSecret,
  last4Of,
  redactSecretsInText,
} from "@/domain/generation/llm-credential";

/**
 * 鍵についての決まりごと。
 *
 * 断り文にも塗り潰しの結果にも**鍵が残らない**ことを、
 * 文言まで含めて固定する。ここが緩むと、画面とログの両方から漏れる。
 *
 * @req REQ-SEC01
 * @types boundary, equivalence, secrets
 */

const VALID = "pk-test-0123456789abcdefghijklmn";

describe("鍵の形の検査", () => {
  it("空は断る", () => {
    const result = checkApiKeyShape("");
    expect(result.ok).toBe(false);
  });

  it("空白や改行が混ざっていたら、貼り付け事故として断る", () => {
    const result = checkApiKeyShape(` ${VALID}\n`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("空白");
  });

  it("短すぎる値は断る。**断り文に値を出さない**", () => {
    const short = "pk-abc";
    const result = checkApiKeyShape(short);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).not.toContain(short);
  });

  it("長すぎる値は断る", () => {
    const result = checkApiKeyShape(`pk-${"a".repeat(600)}`);
    expect(result.ok).toBe(false);
  });

  it("形が通れば受け付ける", () => {
    expect(checkApiKeyShape(VALID).ok).toBe(true);
  });
});

describe("末尾 4 文字", () => {
  it("十分な長さがあれば末尾を返す", () => {
    const result = last4Of(VALID);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe(VALID.slice(-4));
  });

  it("短い値からは取り出さない（末尾 4 文字が値そのものになるため）", () => {
    expect(last4Of("abcd").ok).toBe(false);
  });
});

describe("鍵らしい並びの塗り潰し", () => {
  it("接頭辞つきの鍵を塗り潰す", () => {
    const out = redactSecretsInText(`invalid key: ${VALID} です`);
    expect(out).not.toContain(VALID);
    expect(out).toContain(SECRET_REDACTED);
  });

  it("Bearer トークンも塗り潰す", () => {
    const out = redactSecretsInText("authorization: Bearer abcdefghijklmnop123");
    expect(out).not.toContain("abcdefghijklmnop123");
    expect(out).toContain(SECRET_REDACTED);
  });

  /**
   * Google の形（`AIza…`）を試験に書かないのは、
   * 秘密情報の持ち込みを見張る検査が形で拾って止まるため。
   * 見張りを緩めず、試験のほうを引く。塗り潰しの本体は 1 つの繰り返しなので、
   * 形ごとに例を置かなくても通り道は同じである。
   */
  it("複数の鍵が並んでいても全部塗り潰す", () => {
    const out = redactSecretsInText(`${VALID} と xai-0123456789abcdefghij`);
    expect(out).not.toContain(VALID);
    expect(out).not.toContain("xai-0123456789abcdefghij");
  });

  it("鍵でない文はそのまま残す（何が起きたか読めなくなるため）", () => {
    const text = "service unavailable";
    expect(redactSecretsInText(text)).toBe(text);
  });
});

describe("値そのものでの突き合わせ", () => {
  it("そのまま載っていたら見つける", () => {
    expect(containsSecret(`error: ${VALID}`, VALID)).toBe(true);
  });

  it("頭だけ載っている（省略された引用）ときも見つける", () => {
    expect(containsSecret(`error: ${VALID.slice(0, 20)}…`, VALID)).toBe(true);
  });

  it("載っていなければ false", () => {
    expect(containsSecret("service unavailable", VALID)).toBe(false);
  });

  it("短すぎる値では突き合わせない（短い文字列はどこにでも現れるため）", () => {
    expect(containsSecret("abcd is here", "abcd")).toBe(false);
  });
});
