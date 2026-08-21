import { eq } from "drizzle-orm";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type { CommercialConversionRepositoryPort } from "@/application/ports/monetization";
import type { Conversion } from "@/domain/monetization";
import {
  type AffiliateLinkId,
  type AffiliateProgramId,
  type ConversionId,
  type CurrencyCode,
  type Money,
  type WorkspaceId,
  markCommercial,
  ok,
  taggedString,
} from "@/domain/shared";
import { affiliateConversions, type AffiliateConversionRow } from "@/db/schema";
import { sampleConversions } from "../sample/affiliate-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 成果の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約を満たす、実際に保存する実装。
 *
 * ここを本物にしたのは、**金額を直す入口が画面にあるから**。
 * 入口があるのに保存先が無いと、直した額が返り値にだけ現れ、次に開くと
 * 元へ戻っている。文章と違って数字は見ただけでは戻りに気づけず、
 * そのまま締めの報告に使われる。
 *
 * 見本は消さずに重ねる。ASP との接続は利用者ご自身の申請と登録が要るので、
 * 消すとその日まで成果が 1 件も無い画面になり、金額の修正も締めの扱いも
 * 誰も確かめられない。**同じ id なら保存されたほうが勝つ**
 * （直したはずの額が次の読み出しで見本へ戻る、という一番たちの悪い形を避ける）。
 *
 * 取り込んだ額（`ingested_*`）と手で直した額（`adjusted_*`）は別の列。
 * 片方に寄せると、次の取込との差分が出せず、誤りに気づけなくなる。
 */

/** 額と通貨の 2 列を 1 つの金額に戻す。片方だけ入っている行は「未取得」とみなす。 */
function toMoney(minor: number | null, currency: string | null): Money | null {
  if (minor === null || currency === null) return null;
  return { amountMinor: minor, currency: currency as CurrencyCode };
}

/** 行 → 業務の形。ID の作り方を知っているのはこの層だけ。 */
function toConversion(row: AffiliateConversionRow): Conversion {
  return {
    id: taggedString<"ConversionId">(row.id) as ConversionId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    programId: taggedString<"AffiliateProgramId">(row.programId) as AffiliateProgramId,
    linkId:
      row.linkId === null ? null : (taggedString<"AffiliateLinkId">(row.linkId) as AffiliateLinkId),
    asp: row.asp,
    externalConversionId: row.externalConversionId,
    status: row.status,
    occurredAt: row.occurredAt,
    confirmedAt: row.confirmedAt,
    ingestedReward: toMoney(row.ingestedAmountMinor, row.ingestedCurrency),
    adjustedReward: toMoney(row.adjustedAmountMinor, row.adjustedCurrency),
    adjustmentReason: row.adjustmentReason,
    period: row.period,
    periodClosed: row.periodClosed,
  };
}

/** 業務の形 → 行。 */
function toRow(item: Conversion): AffiliateConversionRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    programId: String(item.programId),
    linkId: item.linkId === null ? null : String(item.linkId),
    asp: item.asp,
    externalConversionId: item.externalConversionId,
    status: item.status,
    occurredAt: item.occurredAt,
    confirmedAt: item.confirmedAt,
    // 未取得は 0 で埋めない。0 円の成果と区別が付かなくなる。
    ingestedAmountMinor: item.ingestedReward?.amountMinor ?? null,
    ingestedCurrency: item.ingestedReward?.currency ?? null,
    adjustedAmountMinor: item.adjustedReward?.amountMinor ?? null,
    adjustedCurrency: item.adjustedReward?.currency ?? null,
    adjustmentReason: item.adjustmentReason,
    period: item.period,
    periodClosed: item.periodClosed,
  };
}

export function createD1ConversionRepository(db: DrizzleD1): CommercialConversionRepositoryPort {
  async function inWorkspace(workspaceId: WorkspaceId): Promise<readonly Conversion[]> {
    const rows = await db
      .select()
      .from(affiliateConversions)
      .where(eq(affiliateConversions.workspaceId, String(workspaceId)));
    return mergeWithSamples(
      rows.map(toConversion),
      sampleConversions().filter((c) => c.workspaceId === workspaceId),
    );
  }

  return markCommercial({
    async findById(workspaceId: WorkspaceId, id: ConversionId): PortResult<Conversion | null> {
      try {
        return ok((await inWorkspace(workspaceId)).find((c) => c.id === id) ?? null);
      } catch (cause) {
        return storageFailure("成果の読み出し", cause);
      }
    },

    /**
     * ASP 側の ID で探す。**見本も含めて探す。**
     *
     * 保存先だけを見ると、見本と同じ成果をもう一度取り込めてしまい、
     * 同じ 1 件が二重に計上される。
     */
    async findByExternalId(
      workspaceId: WorkspaceId,
      asp: Conversion["asp"],
      normalizedExternalId: string,
    ): PortResult<Conversion | null> {
      try {
        return ok(
          (await inWorkspace(workspaceId)).find(
            (c) => c.asp === asp && c.externalConversionId === normalizedExternalId,
          ) ?? null,
        );
      } catch (cause) {
        return storageFailure("同じ成果があるかの確認", cause);
      }
    },

    async listByPeriod(
      workspaceId: WorkspaceId,
      period: string,
      page: PageRequest,
    ): PortResult<Paged<Conversion>> {
      try {
        // 見本と重ねたあとに切る。保存先で切ると、重ねた件数と合わなくなる。
        const items = (await inWorkspace(workspaceId))
          .filter((c) => c.period === period)
          .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
          .slice(0, page.limit);
        return ok({ items, nextCursor: null });
      } catch (cause) {
        return storageFailure("成果の一覧取得", cause);
      }
    },

    async save(conversion: Conversion): PortResult<Conversion> {
      try {
        const row = toRow(conversion);
        // 同じ id で入れ直したときは上書きする（金額を直すたびに呼ばれる）。
        // 見本の id を上書き保存すると、以後は保存されたほうが返る（`mergeWithSamples`）。
        await db.insert(affiliateConversions).values(row).onConflictDoUpdate({
          target: affiliateConversions.id,
          set: row,
        });
        return ok(conversion);
      } catch (cause) {
        return storageFailure("成果の保存", cause);
      }
    },
  });
}
