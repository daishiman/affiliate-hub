/** @tier 1 @req REQ-SEO12 @types boundary, equivalence, secrets */
import { describe, expect, it } from "vitest";
import { jsonArrayChunks } from "@/infrastructure/persistence/d1/json-array-chunks";

describe("D1 JSON array chunks", () => {
  it("日本語をUTF-8 byteで測り、各payloadを上限内に分けても行を変えない", () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({ query: `静かな検索語-${index}`, page: `/記事/${index}` }));
    const chunks = jsonArrayChunks(rows, { maxBytes: 180, maxRows: 4_000 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => new TextEncoder().encode(chunk).byteLength <= 180)).toBe(true);
    expect(chunks.flatMap((chunk) => JSON.parse(chunk) as typeof rows)).toEqual(rows);
  });

  it("単独で上限を超える行を拒否しても本文をerrorへ出さない", () => {
    const secret = "検索してはいけない秘密".repeat(20);
    expect(() => jsonArrayChunks([{ query: secret }], { maxBytes: 64 }))
      .toThrowError(/payload limit/);
    try { jsonArrayChunks([{ query: secret }], { maxBytes: 64 }); }
    catch (cause) { expect(String(cause)).not.toContain(secret); }
  });
});
