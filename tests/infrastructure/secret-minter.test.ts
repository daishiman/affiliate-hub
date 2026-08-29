/** @tier 1 @req REQ-FB12 @types boundary, equivalence */
import { describe, expect, it } from "vitest";
import { MIN_KEY_VALUE_LENGTH } from "@/domain/feedback";
import { hashSecret, mintSecret } from "@/infrastructure/platform/secret-minter";

/**
 * 取りに来るときの合言葉を作るところ。
 *
 * ここを足した理由。**`MIN_KEY_VALUE_LENGTH` を 32 から 0 に落としても
 * 7990 件すべて緑だった**（実測、2026-08-28）。本物の `mintSecret` を呼ぶ検査が
 * 1 件も無く（使う側はどこも差し替えていた）、下限が消えても誰も気づかなかった。
 * 「短い鍵は総当たりで通る」と書いてある下限が、丸ごと飾りになっていた状態である。
 *
 * **期待値を定数から組み立てない。**下限そのものを手で書き写す。
 */
describe("取りに来るときの合言葉を作る", () => {
  /** `integration-access.ts` が「短い鍵は総当たりで通る」として決めた下限。 */
  const DECLARED_MIN_LENGTH = 32;

  it("床: domain の下限が、ここに書き写した 32 文字と一致している", () => {
    expect(MIN_KEY_VALUE_LENGTH, "鍵の長さの下限が動いている").toBe(DECLARED_MIN_LENGTH);
  });

  it("作った合言葉は、下限を満たす長さがある", async () => {
    const { plainValue } = await mintSecret();
    expect(plainValue.length).toBeGreaterThanOrEqual(DECLARED_MIN_LENGTH);
    // 16 進の文字だけでできている（そのまま URL や見出しへ置いても壊れない）。
    expect(plainValue).toMatch(/^[0-9a-f]+$/u);
  });

  it("呼ぶたびに違う合言葉になる", async () => {
    // 同じ値が返ると、1 本漏れた時点で全部が漏れたのと同じことになる。
    const values = await Promise.all([mintSecret(), mintSecret(), mintSecret()]);
    expect(new Set(values.map((v) => v.plainValue)).size).toBe(3);
  });

  it("返すのは平文と潰した値の 2 つで、潰した値は平文と一致しない", async () => {
    const { plainValue, hashedValue } = await mintSecret();
    expect(hashedValue).not.toBe(plainValue);
    expect(hashedValue).toBe(await hashSecret(plainValue));
  });

  it("同じ平文からは必ず同じ潰した値になる（照合に使うため）", async () => {
    // ここが揺れると、正しい鍵で来た人を弾いてしまう。
    expect(await hashSecret("a")).toBe(await hashSecret("a"));
    expect(await hashSecret("a")).not.toBe(await hashSecret("b"));
  });
});
