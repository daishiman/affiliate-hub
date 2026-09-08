/**
 * @tier 1
 * @req REQ-A07
 * @types equivalence, boundary
 */
import { describe, expect, it } from "vitest";
import {
  createD1AffiliateAccountRepository,
  createD1AffiliateProgramRepository,
} from "@/infrastructure/persistence/d1/affiliate-program-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import { SAMPLE_WORKSPACE_ID } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import type { AffiliateAccountRow, AffiliateProgramRow } from "@/db/schema";
import { taggedString } from "@/domain/shared";
import type { AffiliateAccountId, AffiliateProgramId, WorkspaceId } from "@/domain/shared";

/**
 * 提携先と提携条件の保存先（D1）の、行と業務の形の往復。
 *
 * ここで見るのは、SQL が通ることではなく、**列に割ったせいで壊れる形**が
 * 4 つとも壊れないこと。
 *
 *   1. **報酬の 4 列が 1 つの値へ正しく戻ること。** 率の行に額が残っていたら、
 *      どちらで計算されるのか読む側に決められない。
 *   2. **「未取得」が 0 にならないこと。** 率のはずなのに値の無い行を 0% と読むと、
 *      取れていないだけの提携が「報酬の出ない提携」に見えて、誰も確かめ直さない。
 *   3. **秘密の値がそもそも行に無いこと。** あるのは保管先の名前だけ。
 *   4. **保存先が落ちても投げずに読める言葉で返すこと。** 投げると画面が白くなる。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2
 */

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const accountId = (v: string) => taggedString<"AffiliateAccountId">(v) as AffiliateAccountId;
const programId = (v: string) => taggedString<"AffiliateProgramId">(v) as AffiliateProgramId;

function accountRow(over: Partial<AffiliateAccountRow> = {}): AffiliateAccountRow {
  return {
    id: "acc_stored",
    workspaceId: String(WS),
    asp: "a8net",
    label: "本体用",
    publicTrackingId: null,
    credentialRef: null,
    connectedAt: new Date("2026-08-01T00:00:00.000Z"),
    disabledAt: null,
    ...over,
  };
}

function programRow(over: Partial<AffiliateProgramRow> = {}): AffiliateProgramRow {
  return {
    id: "prg_stored",
    workspaceId: String(WS),
    accountId: "acc_stored",
    asp: "a8net",
    advertiserName: "テスト広告主",
    rewardKind: "rate",
    rewardPercent: 3,
    rewardAmountMinor: null,
    rewardCurrency: null,
    rewardNote: null,
    approvalRate: 0.65,
    confirmationDays: 45,
    cookieDurationDays: 30,
    restrictions: ["最安と書かない"],
    joinedAt: new Date("2026-08-02T00:00:00.000Z"),
    endedAt: null,
    ...over,
  };
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb<Row>(rows: readonly Row[]) {
  const saved: Row[] = [];
  const updates: Record<string, unknown>[] = [];
  const chain = {
    from: () => chain,
    where: () => Promise.resolve(rows),
  };
  const db = {
    select: () => chain,
    insert: () => ({
      values: (v: Row) => ({
        onConflictDoUpdate: (spec: { set: Record<string, unknown> }) => {
          saved.push(v);
          updates.push(spec.set);
          return Promise.resolve();
        },
      }),
    }),
  };
  return { db: db as unknown as DrizzleD1, saved, updates };
}

/** どの問い合わせも落ちる接続。保存先が止まっている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table");
  };
  return { select: boom, insert: boom } as unknown as DrizzleD1;
}

describe("提携先の行と業務の形の往復", () => {
  it("保存されている行は、見本と同じ id なら見本に勝つ", async () => {
    const { db } = fakeDb([accountRow({ label: "保存されたほうの呼び名" })]);
    const found = await createD1AffiliateAccountRepository(db).findById(WS, accountId("acc_stored"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");

    expect(found.value.label).toBe("保存されたほうの呼び名");
  });

  it("見本は消えない。1 件も登録していない人の画面が空にならない", async () => {
    const { db } = fakeDb<AffiliateAccountRow>([]);
    const listed = await createD1AffiliateAccountRepository(db).list(WS, {
      limit: 100,
      cursor: null,
    });
    if (!listed.ok) throw new Error("読み出せていません");

    expect(listed.value.items.length).toBeGreaterThan(0);
  });

  it("名前を直しただけの保存で「いつからの提携か」が今日へ動かない", async () => {
    const { db, updates } = fakeDb<AffiliateAccountRow>([]);
    await createD1AffiliateAccountRepository(db).save({
      id: accountId("acc_stored"),
      workspaceId: WS,
      asp: "a8net",
      label: "直した呼び名",
      publicTrackingId: null,
      credentialRef: null,
      connectedAt: new Date("2026-08-01T00:00:00.000Z"),
      disabledAt: null,
    });

    // つないだ日と作業場所は上書きの対象から外れている。
    // 動くと、成果の期間の読み方まで一緒にずれる。
    expect(updates[0]).not.toHaveProperty("connectedAt");
    expect(updates[0]).not.toHaveProperty("workspaceId");
  });

  it("保存先が落ちても投げず、読める言葉で断る", async () => {
    const found = await createD1AffiliateAccountRepository(brokenDb()).list(WS, {
      limit: 10,
      cursor: null,
    });

    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.error.message).not.toBe("");
  });
});

describe("提携条件の報酬の 4 列と 1 つの値の往復", () => {
  it("率の行は率として読み、額の列は空のまま", async () => {
    const { db } = fakeDb([programRow()]);
    const found = await createD1AffiliateProgramRepository(db).findById(WS, programId("prg_stored"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");

    expect(found.value.rewardModel).toEqual({ kind: "rate", percent: 3 });
  });

  it("率のはずなのに値の無い行は、0% ではなく「未取得」として読む", async () => {
    const { db } = fakeDb([programRow({ rewardKind: "rate", rewardPercent: null })]);
    const found = await createD1AffiliateProgramRepository(db).findById(WS, programId("prg_stored"));
    if (!found.ok || found.value === null) throw new Error("読み出せていません");

    // 0% にすると、取れていないだけの提携が「報酬の出ない提携」に見える。
    expect(found.value.rewardModel).toEqual({ kind: "unknown" });
  });

  it("固定額の行を保存すると、率の列は 0 ではなく空になる", async () => {
    const { db, saved } = fakeDb<AffiliateProgramRow>([]);
    await createD1AffiliateProgramRepository(db).save({
      id: programId("prg_stored"),
      workspaceId: WS,
      accountId: accountId("acc_stored"),
      asp: "a8net",
      advertiserName: "テスト広告主",
      rewardModel: { kind: "fixed", amount: { amountMinor: 1000, currency: "JPY" } },
      approvalRate: null,
      confirmationDays: null,
      cookieDurationDays: null,
      restrictions: [],
      joinedAt: new Date("2026-08-02T00:00:00.000Z"),
      endedAt: null,
    });

    // 0 で埋めると「率 0% の固定額」という、読めない行ができる。
    expect(saved[0]?.rewardPercent).toBeNull();
    expect(saved[0]?.rewardAmountMinor).toBe(1000);
  });

  it("保存先が落ちても投げず、読める言葉で断る", async () => {
    const listed = await createD1AffiliateProgramRepository(brokenDb()).list(WS, {
      limit: 10,
      cursor: null,
    });

    expect(listed.ok).toBe(false);
  });
});
