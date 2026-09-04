/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 根拠・言えること・検証記録の保存先（D1）。
 *
 * 順位の保存先（`d1-ranking-repository.test.ts`）と同じ 4 つに加えて、
 * **主張だけの決めごと**を 3 つ見る。
 *   5. 上書きの対象に `product_id` が入っていないこと
 *      （入れると、期限を延ばすたびに主張が商品から外れる）
 *   6. 作業場所が食い違う主張を入れないこと
 *      （入れると、別の作業場所の商品ページへ他人の主張が現れる）
 *   7. 頼まれた根拠が 0 件のときに問い合わせないこと
 *      （空の `inArray` は保存先によっては全件を返す。
 *        **根拠の無い主張に根拠が付いて見える。**）
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 */
import { describe, expect, it } from "vitest";
import { asWorkspaceId, taggedString } from "@/domain/shared";
import type { EvidenceId, ProductId, WorkspaceId } from "@/domain/shared";
import {
  createD1ClaimRepository,
  createD1EvidenceRepository,
  createD1TestRunRepository,
} from "@/infrastructure/persistence/d1/evidence-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { CLAIMS_BY_PRODUCT } from "@/infrastructure/persistence/sample/product-sample-repository";

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const OTHER_WS = asWorkspaceId("ws_other") as WorkspaceId;
const PRODUCT = taggedString<"ProductId">("p_alpha_15") as ProductId;
const CLAIM = CLAIMS_BY_PRODUCT.p_alpha_15[0];

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: evidence_records");
  };
  return { select: boom, insert: boom } as unknown as DrizzleD1;
}

/** 問い合わせが組み立てられたかどうかだけを覚えておく、読み出し用の接続。 */
function countingDb(): { db: DrizzleD1; asked: () => number } {
  let asked = 0;
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve([]),
    orderBy: () => Promise.resolve([]),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve),
  };
  return {
    db: {
      select: () => {
        asked += 1;
        return chain;
      },
    } as unknown as DrizzleD1,
    asked: () => asked,
  };
}

/** 保存の問い合わせだけを受け取って、何を渡されたかを覚えておく接続。 */
function recordingDb(): {
  db: DrizzleD1;
  saved: Record<string, unknown>[];
  conflicts: { set: Record<string, unknown> }[];
} {
  const saved: Record<string, unknown>[] = [];
  const conflicts: { set: Record<string, unknown> }[] = [];
  const chain = {
    values: (v: Record<string, unknown>) => {
      saved.push(v);
      return chain;
    },
    onConflictDoUpdate: (arg: { set: Record<string, unknown> }) => {
      conflicts.push(arg);
      return Promise.resolve(undefined);
    },
  };
  return { db: { insert: () => chain } as unknown as DrizzleD1, saved, conflicts };
}

describe("根拠の保存先（D1）が落ちたとき", () => {
  it("検索は投げずに断りを返し、表の名前を漏らさない", async () => {
    const repo = createD1EvidenceRepository(brokenDb());
    const result = await repo.search(WS, {}, { limit: 50, cursor: null });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    // 断り文に表の名前と D1 の符丁が出ると、外から中の作りが読める。
    expect(result.error.message).not.toContain("evidence_records");
    expect(result.error.message).not.toContain("D1_ERROR");
  });

  it("保存も投げずに断りを返す", async () => {
    const repo = createD1EvidenceRepository(brokenDb());
    const result = await repo.save({
      id: taggedString<"EvidenceId">("ev_new") as EvidenceId,
      workspaceId: WS,
      type: "official_source",
      title: "公式の仕様表",
      sourceOwner: "製造元",
      urlOrAssetId: "https://example.com/spec",
      excerptOrSummary: "書き出しは 6 分",
      capturedAt: new Date("2026-08-26T00:00:00.000Z"),
      integrityHash: "sha256:dummy",
      licenseOrPermission: "引用",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });
});

describe("根拠を番号で引くとき", () => {
  it("頼まれた番号が 0 件なら保存先へ問い合わせない", async () => {
    const { db, asked } = countingDb();
    const repo = createD1EvidenceRepository(db);

    const result = await repo.listByIds(WS, []);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([]);
    expect(asked()).toBe(0);
  });
});

describe("言えることを入れるとき", () => {
  it("商品の番号を列へ入れる", async () => {
    const { db, saved } = recordingDb();
    const repo = createD1ClaimRepository(db);

    const result = await repo.saveForProduct(WS, PRODUCT, CLAIM);

    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0].productId).toBe("p_alpha_15");
  });

  it("上書きの対象に商品の番号を入れない", async () => {
    const { db, conflicts } = recordingDb();
    const repo = createD1ClaimRepository(db);

    await repo.saveForProduct(WS, PRODUCT, CLAIM);

    expect(conflicts).toHaveLength(1);
    // ここに `productId` が入ると、期限を延ばしただけで紐付けが上書きされる。
    expect(Object.keys(conflicts[0].set)).not.toContain("productId");
  });

  it("直す経路（save）は商品の番号を空で入れ、紐付けへ触れない", async () => {
    const { db, saved, conflicts } = recordingDb();
    const repo = createD1ClaimRepository(db);

    await repo.save(CLAIM);

    expect(saved[0].productId).toBe("");
    expect(Object.keys(conflicts[0].set)).not.toContain("productId");
  });

  it("作業場所が食い違う主張は入れずに断る", async () => {
    const { db, saved } = recordingDb();
    const repo = createD1ClaimRepository(db);

    const result = await repo.saveForProduct(OTHER_WS, PRODUCT, CLAIM);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    // 断るだけでなく、**問い合わせ自体が起きていない**ことを見る。
    expect(saved).toHaveLength(0);
  });
});

describe("検証記録の保存先（D1）が落ちたとき", () => {
  it("商品ごとの読み出しは投げずに断り、表の名前を漏らさない", async () => {
    const repo = createD1TestRunRepository(brokenDb());
    const result = await repo.listByProduct(WS, PRODUCT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(result.error.message).not.toContain("test_runs");
  });
});
