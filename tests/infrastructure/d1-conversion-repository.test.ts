/** @tier 1 */
import { describe, expect, it } from "vitest";
import { createD1ConversionRepository } from "@/infrastructure/persistence/d1/conversion-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { sampleConversions } from "@/infrastructure/persistence/sample/affiliate-sample-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import type { AffiliateConversionRow } from "@/db/schema";
import { taggedString } from "@/domain/shared";
import type { ConversionId, WorkspaceId } from "@/domain/shared";

/**
 * 成果の保存先（D1）の、行と業務の形の往復。
 *
 * 実際に SQL が通ることは `tests/integration/d1-conversion.test.ts` が
 * 本物の D1 で見ている。ここで見るのは、そこでは確かめにくい 3 つ。
 *
 *   1. **「未取得」が 0 円にならないこと。** 金額の来ていない成果を 0 で埋めると、
 *      合計だけを見ている人には「0 円の成果」と区別が付かない。
 *   2. **保存先が落ちたときに、投げずに読める言葉で返すこと。** 投げると
 *      画面が白くなり、押した人には何が起きたのか分からない。
 *   3. **同じ id なら、保存されたほうが見本に勝つこと。** 逆だと、直した額が
 *      次に開いたとき見本へ戻る。数字なので戻りに気づけない。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const asId = (v: string) => taggedString<"ConversionId">(v) as ConversionId;

function row(over: Partial<AffiliateConversionRow> = {}): AffiliateConversionRow {
  return {
    id: "cv_stored",
    workspaceId: String(WS),
    programId: "prg_amazon_pc",
    linkId: null,
    asp: "amazon_associates",
    externalConversionId: "ext-1",
    status: "approved",
    occurredAt: new Date("2026-08-05T00:00:00.000Z"),
    confirmedAt: null,
    ingestedAmountMinor: 1200,
    ingestedCurrency: "JPY",
    adjustedAmountMinor: null,
    adjustedCurrency: null,
    adjustmentReason: null,
    period: "2026-08",
    periodClosed: false,
    ...over,
  };
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly AffiliateConversionRow[]) {
  const saved: AffiliateConversionRow[] = [];
  const chain = {
    from: () => chain,
    where: () => Promise.resolve(rows),
  };
  const db = {
    select: () => chain,
    insert: () => ({
      values: (v: AffiliateConversionRow) => ({
        onConflictDoUpdate: () => {
          saved.push(v);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db: db as unknown as DrizzleD1, saved };
}

/** どの問い合わせも落ちる接続。保存先が止まっている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table");
  };
  return {
    select: boom,
    insert: boom,
  } as unknown as DrizzleD1;
}

describe("成果の行と業務の形の往復", () => {
  it("金額が未取得の成果は、0 円にならない", async () => {
    const { db } = fakeDb([row({ ingestedAmountMinor: null, ingestedCurrency: null })]);
    const found = await createD1ConversionRepository(db).findById(WS, asId("cv_stored"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");

    // null のまま。0 にすると「0 円の成果」と見分けが付かなくなる。
    expect(found.value.ingestedReward).toBeNull();
  });

  it("取り込んだ額と手で直した額を、別々に読み戻す", async () => {
    const { db } = fakeDb([
      row({ adjustedAmountMinor: 1500, adjustedCurrency: "JPY", adjustmentReason: "確定通知。" }),
    ]);
    const found = await createD1ConversionRepository(db).findById(WS, asId("cv_stored"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");

    expect(found.value.ingestedReward).toEqual({ amountMinor: 1200, currency: "JPY" });
    expect(found.value.adjustedReward).toEqual({ amountMinor: 1500, currency: "JPY" });
    expect(found.value.adjustmentReason).toBe("確定通知。");
  });

  it("保存するときも、取り込んだ額と直した額を別の列へ入れる", async () => {
    const { db, saved } = fakeDb([]);
    const repo = createD1ConversionRepository(db);
    const source = sampleConversions().find((c) => c.id === asId("cv_2026_08_a"));
    if (source === undefined) throw new Error("見本の成果がありません");

    const done = await repo.save({
      ...source,
      adjustedReward: { amountMinor: 1500, currency: "JPY" },
      adjustmentReason: "確定通知。",
    });
    expect(done.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.ingestedAmountMinor).toBe(source.ingestedReward?.amountMinor ?? null);
    expect(saved[0]?.adjustedAmountMinor).toBe(1500);
    expect(saved[0]?.adjustmentReason).toBe("確定通知。");
  });

  it("リンクの分からない成果も、そのまま保存できる", async () => {
    // ASP によっては、どのリンク経由かが返らない。ここで落とすと取り込めなくなる。
    const { db, saved } = fakeDb([]);
    const source = sampleConversions()[0];
    if (source === undefined) throw new Error("見本の成果がありません");

    await createD1ConversionRepository(db).save({ ...source, linkId: null });
    expect(saved[0]?.linkId).toBeNull();
  });

  it("どのリンク経由かが分かっている成果は、その紐づきを保ったまま往復する", async () => {
    // ここが落ちると、どの記事の成果か分からなくなり、次に何を直せばよいか決められない。
    const { db, saved } = fakeDb([row({ linkId: "lnk_amazon_pc" })]);
    const repo = createD1ConversionRepository(db);

    const found = await repo.findById(WS, asId("cv_stored"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");
    expect(String(found.value.linkId)).toBe("lnk_amazon_pc");

    await repo.save(found.value);
    expect(saved[0]?.linkId).toBe("lnk_amazon_pc");
  });
});

describe("見本との重なり", () => {
  it("同じ id なら、保存されたほうが見本に勝つ", async () => {
    const sample = sampleConversions().find((c) => c.id === asId("cv_2026_08_a"));
    if (sample === undefined) throw new Error("見本の成果がありません");

    const { db } = fakeDb([
      row({
        id: "cv_2026_08_a",
        adjustedAmountMinor: 1500,
        adjustedCurrency: "JPY",
        adjustmentReason: "直しました。",
      }),
    ]);
    const found = await createD1ConversionRepository(db).findById(WS, asId("cv_2026_08_a"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");

    // 見本が勝つと、直した額が次に開いたときに戻る。数字なので気づけない。
    expect(found.value.adjustedReward).toEqual({ amountMinor: 1500, currency: "JPY" });
  });

  it("まだ 1 件も保存していなくても、見本が消えない", async () => {
    const { db } = fakeDb([]);
    const listed = await createD1ConversionRepository(db).listByPeriod(WS, "2026-08", {
      limit: 50,
      cursor: null,
    });
    if (!listed.ok) throw listed.error;
    expect(listed.value.items.length).toBeGreaterThan(0);
  });

  it("同じ成果を二度取り込まないよう、見本も含めて探す", async () => {
    const sample = sampleConversions()[0];
    if (sample === undefined) throw new Error("見本の成果がありません");

    const { db } = fakeDb([]);
    const found = await createD1ConversionRepository(db).findByExternalId(
      WS,
      sample.asp,
      sample.externalConversionId,
    );
    if (!found.ok) throw found.error;
    // 保存先だけを見ると、見本と同じ成果をもう一度登録できてしまう。
    expect(found.value?.id).toBe(sample.id);
  });

  it("まだ取り込んでいない成果は、見つからないと返る（落ちない）", async () => {
    // 「無い」は失敗ではない。新しい成果として取り込んでよい、という答え。
    const { db } = fakeDb([]);
    const repo = createD1ConversionRepository(db);

    const byId = await repo.findById(WS, asId("cv_not_yet"));
    if (!byId.ok) throw byId.error;
    expect(byId.value).toBeNull();

    const byExternal = await repo.findByExternalId(WS, "amazon_associates", "まだ無い");
    if (!byExternal.ok) throw byExternal.error;
    expect(byExternal.value).toBeNull();
  });

  it("一覧は、頼まれた件数を超えて返さない", async () => {
    const { db } = fakeDb([]);
    const listed = await createD1ConversionRepository(db).listByPeriod(WS, "2026-08", {
      limit: 1,
      cursor: null,
    });
    if (!listed.ok) throw listed.error;
    expect(listed.value.items).toHaveLength(1);
  });

  it("別の期間の成果は、その期間の一覧に混ざらない", async () => {
    const { db } = fakeDb([]);
    const listed = await createD1ConversionRepository(db).listByPeriod(WS, "2026-07", {
      limit: 50,
      cursor: null,
    });
    if (!listed.ok) throw listed.error;
    // 混ざると、締めた月の合計が後から動く。
    expect(listed.value.items.every((c) => c.period === "2026-07")).toBe(true);
  });
});

describe("保存先が落ちているとき", () => {
  const repo = () => createD1ConversionRepository(brokenDb());

  it("読み出しは、投げずに読める言葉で断る", async () => {
    const found = await repo().findById(WS, asId("cv_stored"));
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.error.message).not.toMatch(/^[A-Z_]+$/);
    // 例外の中身をそのまま画面へ出さない（接続先などが混じる）。
    expect(found.error.message).not.toContain("no such table");
    expect(found.error.retryable).toBe(true);
  });

  it("同じ成果があるかの確認も、投げずに断る", async () => {
    const found = await repo().findByExternalId(WS, "amazon_associates", "ext-1");
    expect(found.ok).toBe(false);
  });

  it("一覧も、投げずに断る", async () => {
    const listed = await repo().listByPeriod(WS, "2026-08", { limit: 50, cursor: null });
    expect(listed.ok).toBe(false);
  });

  it("保存できなかったときに、保存できたと返さない", async () => {
    const source = sampleConversions()[0];
    if (source === undefined) throw new Error("見本の成果がありません");

    const done = await repo().save(source);
    // ここで成功を返すと、画面には直した額が出たまま、次に開くと消えている。
    expect(done.ok).toBe(false);
    if (done.ok) return;
    expect(done.error.message).not.toMatch(/^[A-Z_]+$/);
  });
});
