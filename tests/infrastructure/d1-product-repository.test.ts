/**
 * @tier 1
 * @req REQ-B01
 * @types equivalence, boundary, decision-table
 *
 * 商品の保存先（D1）が、見本と保存分をどう重ね、落ちたときどう断るか。
 *
 * --- ここで守りたいこと ---
 * 1. **見本は消えない。** 1 件も作っていない状態で一覧が空になると、
 *    「まだ作っていない」のか「壊れている」のかを画面から見分けられない。
 * 2. **保存したほうが勝つ。** 見本と同じ ID を保存し直したのに古い見本が返ると、
 *    「操作したはずのものが次に開くと元へ戻る」。いちばん気づきにくい壊れ方。
 * 3. **見本は消せない。** 行を消しても次の読み出しでまた現れるので、
 *    「消えた」と返してはいけない。断る。
 * 4. **落ちても投げない。** 投げれば画面が 500 になり、押した人には何も伝わらない。
 */
import { describe, expect, it } from "vitest";
import type { CatalogProductRow } from "@/db/schema";
import type { WorkspaceId } from "@/domain/shared";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { createD1ProductRepository } from "@/infrastructure/persistence/d1/product-repository";
import { sampleProducts } from "@/infrastructure/persistence/sample/product-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const SAMPLE = sampleProducts();

/** 見本が 1 つも無い前提で書くと、重ねる話が検証できない。母集団の床。 */
const MIN_SAMPLES = 4;

function aRow(over: Partial<CatalogProductRow> = {}): CatalogProductRow {
  return {
    id: "p_stored_01",
    workspaceId: String(WS),
    brand: "Kobo",
    name: "Kobo Studio 15",
    manufacturer: null,
    categoryId: "cat_laptop",
    identityKeys: [{ kind: "model_number", value: "KS-15" }],
    description: "保存された商品の説明。",
    specifications: { weight: "1.2kg" },
    imageAssetIds: [],
    releaseDate: null,
    discontinuedAt: null,
    officialUrl: null,
    officialSourceIds: [],
    provenanceSourceType: "manual",
    provenanceSourceName: "手入力",
    provenanceSourceUrl: null,
    provenanceRetrievedAt: new Date("2026-08-01T00:00:00.000Z"),
    provenanceValidUntil: null,
    provenanceConfidence: 0.5,
    provenancePermittedUsage: "社内のみ",
    ...over,
  };
}

type Log = { saved: CatalogProductRow[] };

/** 読み書きできる接続。`deleted` は削除が何行に当たったかの見立て。 */
function fakeDb(opts: { rows?: readonly CatalogProductRow[]; deleted?: number; log?: Log }): DrizzleD1 {
  const rows = opts.rows ?? [];
  const deleted = opts.deleted ?? 1;
  return {
    select: () => ({ from: () => ({ where: () => Promise.resolve([...rows]) }) }),
    insert: () => ({
      values: (row: CatalogProductRow) => ({
        onConflictDoUpdate: () => {
          opts.log?.saved.push(row);
          return Promise.resolve(undefined);
        },
      }),
    }),
    delete: () => ({
      where: () => ({
        returning: () => Promise.resolve(Array.from({ length: deleted }, (_, i) => ({ id: `x${i}` }))),
      }),
    }),
  } as unknown as DrizzleD1;
}

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: catalog_products");
  };
  return { select: boom, insert: boom, delete: boom } as unknown as DrizzleD1;
}

describe("商品の保存先（D1）が見本と保存分を重ねる", () => {
  it("1 件も保存していなくても、見本の商品は引ける", async () => {
    // 母集団の床。見本が空なら以下の検査はすべて空振りで緑になる。
    expect(SAMPLE.length, "見本の商品が 1 つも取れていません").toBeGreaterThanOrEqual(MIN_SAMPLES);

    const repo = createD1ProductRepository(fakeDb({}));
    const result = await repo.findById(WS, SAMPLE[0]!.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value?.name).toBe(SAMPLE[0]!.name);
  });

  it("見本と同じ ID を保存し直したら、保存したほうが返る", async () => {
    const overwritten = aRow({ id: String(SAMPLE[0]!.id), name: "書き換えた名前" });
    const repo = createD1ProductRepository(fakeDb({ rows: [overwritten] }));

    const result = await repo.findById(WS, SAMPLE[0]!.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // ここが見本のままだと、直した内容が次に開くと元へ戻る。
    expect(result.value?.name).toBe("書き換えた名前");
  });

  it("無い ID を引いたら、落ちずに「無い」と返す", async () => {
    const result = await createD1ProductRepository(fakeDb({})).findById(
      WS,
      "p_nonexistent" as never,
    );

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });

  it("識別キーは、種類と値の両方が合ったときだけ引ける", async () => {
    const repo = createD1ProductRepository(fakeDb({ rows: [aRow()] }));

    const hit = await repo.findByIdentityKey(WS, "model_number", "KS-15");
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value?.id).toBe("p_stored_01");

    // 値が同じでも種類が違えば別物。ここを緩めると型番と JAN が混ざる。
    const miss = await repo.findByIdentityKey(WS, "jan", "KS-15");
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value).toBeNull();
  });
});

describe("商品の絞り込み", () => {
  const rows = [aRow(), aRow({ id: "p_stored_02", brand: "Nagi", name: "Nagi Air 13", categoryId: "cat_tablet", description: null })];

  it("文字は、作り手・名前・説明をまたいで、大文字小文字を問わずに当たる", async () => {
    const repo = createD1ProductRepository(fakeDb({ rows }));

    const byBrand = await repo.search(WS, { text: "  nagi  " }, { limit: 50, cursor: null });
    expect(byBrand.ok).toBe(true);
    if (byBrand.ok) expect(byBrand.value.items.map((p) => String(p.id))).toEqual(["p_stored_02"]);

    const byDescription = await repo.search(WS, { text: "保存された商品" }, { limit: 50, cursor: null });
    if (byDescription.ok) {
      expect(byDescription.value.items.map((p) => String(p.id))).toEqual(["p_stored_01"]);
    }
  });

  it("文字が空なら、絞り込まずに全部返す（見本も含む）", async () => {
    const result = await createD1ProductRepository(fakeDb({ rows })).search(WS, {}, { limit: 50, cursor: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.length).toBe(rows.length + SAMPLE.length);
  });

  it("分類で絞ると、その分類のものだけになる", async () => {
    const result = await createD1ProductRepository(fakeDb({ rows })).search(
      WS,
      { categoryId: "cat_tablet" },
      { limit: 50, cursor: null },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((p) => String(p.id))).toEqual(["p_stored_02"]);
  });

  it("件数の上限で打ち切り、続きの印は置かない", async () => {
    const result = await createD1ProductRepository(fakeDb({ rows })).search(WS, {}, { limit: 1, cursor: null });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    // 続きがある体裁だけ返して実際は辿れない、を作らない。
    expect(result.value.nextCursor).toBeNull();
  });
});

describe("商品の保存と削除", () => {
  it("保存は、業務の形を行の形へ移してから書く", async () => {
    const log: Log = { saved: [] };
    const result = await createD1ProductRepository(fakeDb({ log })).save(SAMPLE[0]!);

    expect(result.ok).toBe(true);
    expect(log.saved).toHaveLength(1);
    const row = log.saved[0]!;
    expect(row.id).toBe(String(SAMPLE[0]!.id));
    expect(row.workspaceId).toBe(String(WS));
    // 識別キーは配列のまま持つ。文字列へ潰すと引き直せなくなる。
    expect(row.identityKeys[0]?.kind).toBe(SAMPLE[0]!.identityKeys[0]?.kind);
    expect(row.provenanceSourceType).toBe(SAMPLE[0]!.provenance.sourceType);
  });

  it("行が消えたなら、消えたと返す", async () => {
    const result = await createD1ProductRepository(fakeDb({ deleted: 1 })).remove(
      WS,
      "p_stored_01" as never,
    );

    expect(result.ok).toBe(true);
  });

  it("見本の商品は消せない（行が無いので断る）", async () => {
    const result = await createD1ProductRepository(fakeDb({ deleted: 0 })).remove(
      WS,
      SAMPLE[0]!.id,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // 「消えた」と返して次に開いたら居る、がいちばん質の悪い壊れ方。
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.suggestedAction ?? "").not.toBe("");
  });
});

describe("商品の保存先（D1）が落ちたとき", () => {
  const repo = () => createD1ProductRepository(brokenDb());

  it("読み出し・絞り込み・保存・削除のどれも、投げずに断りとして返す", async () => {
    const results = [
      await repo().findById(WS, SAMPLE[0]!.id),
      await repo().findByIdentityKey(WS, "model_number", "KS-15"),
      await repo().search(WS, { text: "x" }, { limit: 10, cursor: null }),
      await repo().save(SAMPLE[0]!),
      await repo().remove(WS, SAMPLE[0]!.id),
    ];

    // 5 つの入口すべてを通す。1 つでも抜けると、その経路だけ画面が 500 になる。
    expect(results).toHaveLength(5);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("UPSTREAM_UNAVAILABLE");
      expect(result.error.retryable).toBe(true);
    }
  });

  it("例外の中身を、画面へ出す言葉に混ぜない", async () => {
    const result = await repo().findById(WS, SAMPLE[0]!.id);
    if (result.ok) throw new Error("落ちているのに通っています");

    expect(result.error.message).not.toContain("catalog_products");
    expect(result.error.suggestedAction ?? "").not.toContain("catalog_products");
    expect(result.error.details).toEqual({ reason: "Error" });
  });
});
