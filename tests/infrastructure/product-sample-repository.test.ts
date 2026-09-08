/**
 * @tier 1
 * @req REQ-B01
 * @types equivalence, boundary
 *
 * 保存先がまだ無い時期の、商品まわりの見本の保管庫。
 *
 * --- ここで守りたいこと ---
 * 1. **保存できない保管庫は、消すこともできない。** 見本はコードの中にあるので、
 *    「消えました」と返しても次に開けばまた居る。断るのが正しい。
 * 2. **断りの理由が、次の一手まで含んでいる。** 「できません」だけだと、
 *    待てば済むのか自分で直すのかが分からない。
 * 3. **0 件は「無い」であって「未実装」ではない。** 期限切れの主張も検証記録も、
 *    空で返るのが仕様。ここを断りにすると、画面が空を出せなくなる。
 * 4. **編集側の印が付いている。** 印が落ちると、商業データと混ざった組み立てを
 *    止められなくなる。
 */
import { describe, expect, it } from "vitest";
import type { ProductId, WorkspaceId } from "@/domain/shared";
import {
  createSampleClaimRepository,
  createSampleEvidenceRepository,
  createSampleProductRepository,
  createSampleTestRunRepository,
  sampleProductNotice,
  sampleProducts,
} from "@/infrastructure/persistence/sample/product-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const PAGE = { limit: 50, cursor: null };
const SAMPLE = sampleProducts();

/** 見本が空だと、以下の検査はすべて空振りで緑になる。母集団の床。 */
const MIN_SAMPLES = 4;

describe("見本の商品を引く", () => {
  it("見本が複数あり、どれも同一性の鍵と出どころを持っている", () => {
    expect(SAMPLE.length).toBeGreaterThanOrEqual(MIN_SAMPLES);
    for (const p of SAMPLE) {
      expect(p.identityKeys.length, `${p.name} に鍵がありません`).toBeGreaterThan(0);
      expect(p.provenance.sourceName, `${p.name} に出どころがありません`).not.toBe("");
    }
  });

  it("この一覧が見本であることを、画面へ出す言葉で説明できる", () => {
    expect(sampleProductNotice()).not.toBe("");
  });

  it("ID で引ける。無い ID は落ちずに「無い」と返る", async () => {
    const repo = createSampleProductRepository();

    const hit = await repo.findById(WS, SAMPLE[0]!.id);
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value?.name).toBe(SAMPLE[0]!.name);

    const miss = await repo.findById(WS, "p_nonexistent" as ProductId);
    expect(miss.ok).toBe(true);
    if (miss.ok) expect(miss.value).toBeNull();
  });

  it("同一性の鍵は、種類と値の両方が合ったときだけ当たる", async () => {
    const repo = createSampleProductRepository();
    const key = SAMPLE[0]!.identityKeys[0]!;

    const hit = await repo.findByIdentityKey(WS, key.kind, key.value);
    expect(hit.ok).toBe(true);
    if (hit.ok) expect(hit.value?.id).toBe(SAMPLE[0]!.id);

    // 値が同じでも種類が違えば別物。ここを緩めると型番と JAN が混ざる。
    const wrongKind = await repo.findByIdentityKey(WS, "no_such_kind", key.value);
    expect(wrongKind.ok).toBe(true);
    if (wrongKind.ok) expect(wrongKind.value).toBeNull();
  });
});

describe("見本の商品を絞り込む", () => {
  const repo = createSampleProductRepository();

  it("文字が空なら、全部返す", async () => {
    const result = await repo.search(WS, {}, PAGE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items).toHaveLength(SAMPLE.length);
  });

  it("文字は、作り手・名前・説明をまたいで、大文字小文字を問わずに当たる", async () => {
    const result = await repo.search(WS, { text: `  ${SAMPLE[0]!.name.toUpperCase()}  ` }, PAGE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items.map((p) => String(p.id))).toContain(String(SAMPLE[0]!.id));
  });

  it("当たらない文字なら、0 件で返る（断りではない）", async () => {
    const result = await repo.search(WS, { text: "該当しないはずの語" }, PAGE);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.items).toHaveLength(0);
  });

  it("分類で絞ると、その分類のものだけになる", async () => {
    const category = String(SAMPLE[0]!.categoryId);

    const same = await repo.search(WS, { categoryId: category }, PAGE);
    expect(same.ok).toBe(true);
    if (same.ok) expect(same.value.items.length).toBeGreaterThan(0);

    const other = await repo.search(WS, { categoryId: "cat_nothing_here" }, PAGE);
    expect(other.ok).toBe(true);
    if (other.ok) expect(other.value.items).toHaveLength(0);
  });

  it("件数の上限で打ち切り、続きの印は置かない", async () => {
    const result = await repo.search(WS, {}, { limit: 1, cursor: null });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.items).toHaveLength(1);
    // 続きがある体裁だけ返して実際は辿れない、を作らない。
    expect(result.value.nextCursor).toBeNull();
  });
});

describe("見本の保管庫は書けない", () => {
  it("商品の保存も削除も、理由と次の一手を添えて断る", async () => {
    const repo = createSampleProductRepository();
    const results = [await repo.save(SAMPLE[0]!), await repo.remove(WS, SAMPLE[0]!.id)];

    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("NOT_IMPLEMENTED");
      // 「できません」だけだと、待てば済むのか自分で直すのかが分からない。
      expect(result.error.suggestedAction ?? "").not.toBe("");
      expect(result.error.details).toHaveProperty("blockedBy");
    }
  });
});

describe("見本の主張・根拠・検証記録", () => {
  it("主張は商品ごとに引ける。無い商品は 0 件で返る", async () => {
    const repo = createSampleClaimRepository();

    const some = await repo.listByProduct(WS, SAMPLE[0]!.id);
    expect(some.ok).toBe(true);
    if (!some.ok) return;
    expect(some.value.length).toBeGreaterThan(0);

    const none = await repo.listByProduct(WS, "p_nonexistent" as ProductId);
    expect(none.ok).toBe(true);
    if (none.ok) expect(none.value).toHaveLength(0);

    // ID 引きは商品をまたいで探す。見つかったものは同じ中身。
    const byId = await repo.findById(WS, some.value[0]!.id);
    expect(byId.ok).toBe(true);
    if (byId.ok) expect(byId.value?.id).toBe(some.value[0]!.id);
  });

  it("期限切れの主張が 0 件なのは「無い」であって、断りではない", async () => {
    const result = await createSampleClaimRepository().listExpiringBefore(
      WS,
      new Date("2030-01-01T00:00:00Z"),
      50,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toHaveLength(0);
  });

  it("主張の保存は断る", async () => {
    const result = await createSampleClaimRepository().save({} as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("根拠は ID でも、まとめてでも、文字でも引ける", async () => {
    const repo = createSampleEvidenceRepository();

    const all = await repo.search(WS, {}, PAGE);
    expect(all.ok).toBe(true);
    if (!all.ok) return;
    expect(all.value.items.length).toBeGreaterThan(0);
    const first = all.value.items[0]!;

    const byId = await repo.findById(WS, first.id);
    if (byId.ok) expect(byId.value?.title).toBe(first.title);

    const byIds = await repo.listByIds(WS, [first.id]);
    if (byIds.ok) expect(byIds.value).toHaveLength(1);

    const byText = await repo.search(WS, { text: first.title.toUpperCase() }, PAGE);
    if (byText.ok) expect(byText.value.items.map((e) => String(e.id))).toContain(String(first.id));

    const missing = await repo.findById(WS, "ev_nonexistent" as never);
    expect(missing.ok).toBe(true);
    if (missing.ok) expect(missing.value).toBeNull();
  });

  it("根拠の保存は断る", async () => {
    const result = await createSampleEvidenceRepository().save({} as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_IMPLEMENTED");
  });

  it("検証記録は 1 件も無い状態で返る（記録が無い画面を必ず一度は通す）", async () => {
    const repo = createSampleTestRunRepository();

    const byId = await repo.findById(WS, "tr_any" as never);
    expect(byId.ok).toBe(true);
    if (byId.ok) expect(byId.value).toBeNull();

    const byProduct = await repo.listByProduct(WS, SAMPLE[0]!.id);
    expect(byProduct.ok).toBe(true);
    if (byProduct.ok) expect(byProduct.value).toHaveLength(0);

    const saved = await repo.save({} as never);
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(saved.error.code).toBe("NOT_IMPLEMENTED");
  });
});
