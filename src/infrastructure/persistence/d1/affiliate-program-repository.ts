import { eq } from "drizzle-orm";
import type { PageRequest, Paged, PortResult } from "@/application/ports/common";
import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
} from "@/application/ports/monetization";
import type { AffiliateAccount, AffiliateProgram, RewardModel } from "@/domain/monetization";
import {
  type AffiliateAccountId,
  type AffiliateProgramId,
  type CurrencyCode,
  type WorkspaceId,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  affiliateAccounts,
  affiliatePrograms,
  type AffiliateAccountRow,
  type AffiliateProgramRow,
} from "@/db/schema";
import {
  sampleAffiliateAccounts,
  sampleAffiliatePrograms,
} from "../sample/affiliate-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 提携先（ASP アカウント）と提携条件（プログラム）の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約を満たす、実際に保存する実装。
 *
 * ここを本物にしたのは、**登録の入口が画面にできたから**。入口があるのに
 * 保存先が無いと、登録できたように見えて次に開くと消えている。提携先は
 * 数が少なく、入れ直す手間より「入れたはずなのに無い」の原因探しのほうが長い。
 *
 * 見本は消さずに重ねる。消すと、まだ 1 件も登録していない人の画面から
 * 提携先が丸ごと消え、成果の画面も提携条件の画面も何も確かめられなくなる。
 * **同じ id なら保存されたほうが勝つ**（`mergeWithSamples`）。
 *
 * **秘密の値をここへ渡さない。** 列は `credential_ref`（保管先の名前）だけで、
 * 鍵そのものを入れる場所を持たない。持たせない、が唯一の担保になる。
 */

/** 4 列に散った報酬の決め方を、1 つの値へ戻す。 */
function toRewardModel(row: AffiliateProgramRow): RewardModel {
  switch (row.rewardKind) {
    case "rate":
      // 率のはずなのに値が無い行は、0% ではなく「未取得」として読む。
      // 0% にすると、取れていないだけの提携が「報酬の出ない提携」に見える。
      return row.rewardPercent === null
        ? { kind: "unknown" }
        : { kind: "rate", percent: row.rewardPercent };
    case "fixed":
      return row.rewardAmountMinor === null || row.rewardCurrency === null
        ? { kind: "unknown" }
        : {
            kind: "fixed",
            amount: {
              amountMinor: row.rewardAmountMinor,
              currency: row.rewardCurrency as CurrencyCode,
            },
          };
    case "tiered":
      return { kind: "tiered", note: row.rewardNote ?? "" };
    default:
      return { kind: "unknown" };
  }
}

/** 1 つの値を 4 列へ割る。使わない列は 0 で埋めず null にする。 */
function fromRewardModel(
  model: RewardModel,
): Pick<
  AffiliateProgramRow,
  "rewardKind" | "rewardPercent" | "rewardAmountMinor" | "rewardCurrency" | "rewardNote"
> {
  const empty = {
    rewardPercent: null,
    rewardAmountMinor: null,
    rewardCurrency: null,
    rewardNote: null,
  };
  switch (model.kind) {
    case "rate":
      return { ...empty, rewardKind: "rate", rewardPercent: model.percent };
    case "fixed":
      return {
        ...empty,
        rewardKind: "fixed",
        rewardAmountMinor: model.amount.amountMinor,
        rewardCurrency: model.amount.currency,
      };
    case "tiered":
      return { ...empty, rewardKind: "tiered", rewardNote: model.note };
    default:
      return { ...empty, rewardKind: "unknown" };
  }
}

function toAccount(row: AffiliateAccountRow): AffiliateAccount {
  return {
    id: taggedString<"AffiliateAccountId">(row.id) as AffiliateAccountId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    asp: row.asp,
    label: row.label,
    publicTrackingId: row.publicTrackingId,
    credentialRef: row.credentialRef,
    connectedAt: row.connectedAt,
    disabledAt: row.disabledAt,
  };
}

function accountRow(item: AffiliateAccount): AffiliateAccountRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    asp: item.asp,
    label: item.label,
    publicTrackingId: item.publicTrackingId,
    credentialRef: item.credentialRef,
    connectedAt: item.connectedAt,
    disabledAt: item.disabledAt,
  };
}

function toProgram(row: AffiliateProgramRow): AffiliateProgram {
  return {
    id: taggedString<"AffiliateProgramId">(row.id) as AffiliateProgramId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    accountId: taggedString<"AffiliateAccountId">(row.accountId) as AffiliateAccountId,
    asp: row.asp,
    advertiserName: row.advertiserName,
    rewardModel: toRewardModel(row),
    approvalRate: row.approvalRate,
    confirmationDays: row.confirmationDays,
    cookieDurationDays: row.cookieDurationDays,
    restrictions: row.restrictions,
    joinedAt: row.joinedAt,
    endedAt: row.endedAt,
  };
}

function programRow(item: AffiliateProgram): AffiliateProgramRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    accountId: String(item.accountId),
    asp: item.asp,
    advertiserName: item.advertiserName,
    ...fromRewardModel(item.rewardModel),
    approvalRate: item.approvalRate,
    confirmationDays: item.confirmationDays,
    cookieDurationDays: item.cookieDurationDays,
    restrictions: [...item.restrictions],
    joinedAt: item.joinedAt,
    endedAt: item.endedAt,
  };
}

export function createD1AffiliateAccountRepository(
  db: DrizzleD1,
): AffiliateAccountRepositoryPort {
  async function inWorkspace(workspaceId: WorkspaceId): Promise<readonly AffiliateAccount[]> {
    const rows = await db
      .select()
      .from(affiliateAccounts)
      .where(eq(affiliateAccounts.workspaceId, String(workspaceId)));
    return mergeWithSamples(
      rows.map(toAccount),
      sampleAffiliateAccounts().filter((a) => a.workspaceId === workspaceId),
    );
  }

  return {
    async findById(
      workspaceId: WorkspaceId,
      id: AffiliateAccountId,
    ): PortResult<AffiliateAccount | null> {
      try {
        return ok((await inWorkspace(workspaceId)).find((a) => a.id === id) ?? null);
      } catch (cause) {
        return storageFailure("提携先の読み出し", cause);
      }
    },

    async list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<AffiliateAccount>> {
      try {
        // 重ねたあとに切る。保存先の側で切ると、重ねた件数と合わなくなる。
        const items = (await inWorkspace(workspaceId))
          .slice()
          .sort((a, b) => b.connectedAt.getTime() - a.connectedAt.getTime())
          .slice(0, page.limit);
        return ok({ items, nextCursor: null });
      } catch (cause) {
        return storageFailure("提携先の一覧取得", cause);
      }
    },

    async save(account: AffiliateAccount): PortResult<AffiliateAccount> {
      try {
        const row = accountRow(account);
        await db
          .insert(affiliateAccounts)
          .values(row)
          .onConflictDoUpdate({
            target: affiliateAccounts.id,
            // つないだ日と作業場所は上書きしない。名前を直しただけの保存で
            // 「いつからの提携か」が今日へ動くと、成果の期間の読み方が狂う。
            set: {
              asp: row.asp,
              label: row.label,
              publicTrackingId: row.publicTrackingId,
              credentialRef: row.credentialRef,
              disabledAt: row.disabledAt,
            },
          });
        return ok(account);
      } catch (cause) {
        return storageFailure("提携先の保存", cause);
      }
    },
  };
}

export function createD1AffiliateProgramRepository(
  db: DrizzleD1,
): AffiliateProgramRepositoryPort {
  async function inWorkspace(workspaceId: WorkspaceId): Promise<readonly AffiliateProgram[]> {
    const rows = await db
      .select()
      .from(affiliatePrograms)
      .where(eq(affiliatePrograms.workspaceId, String(workspaceId)));
    return mergeWithSamples(
      rows.map(toProgram),
      sampleAffiliatePrograms().filter((p) => p.workspaceId === workspaceId),
    );
  }

  return {
    async findById(
      workspaceId: WorkspaceId,
      id: AffiliateProgramId,
    ): PortResult<AffiliateProgram | null> {
      try {
        return ok((await inWorkspace(workspaceId)).find((p) => p.id === id) ?? null);
      } catch (cause) {
        return storageFailure("提携条件の読み出し", cause);
      }
    },

    async list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<AffiliateProgram>> {
      try {
        const items = (await inWorkspace(workspaceId))
          .slice()
          .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime())
          .slice(0, page.limit);
        return ok({ items, nextCursor: null });
      } catch (cause) {
        return storageFailure("提携条件の一覧取得", cause);
      }
    },

    async save(program: AffiliateProgram): PortResult<AffiliateProgram> {
      try {
        const row = programRow(program);
        await db
          .insert(affiliatePrograms)
          .values(row)
          .onConflictDoUpdate({
            target: affiliatePrograms.id,
            set: {
              accountId: row.accountId,
              asp: row.asp,
              advertiserName: row.advertiserName,
              rewardKind: row.rewardKind,
              rewardPercent: row.rewardPercent,
              rewardAmountMinor: row.rewardAmountMinor,
              rewardCurrency: row.rewardCurrency,
              rewardNote: row.rewardNote,
              approvalRate: row.approvalRate,
              confirmationDays: row.confirmationDays,
              cookieDurationDays: row.cookieDurationDays,
              restrictions: row.restrictions,
              endedAt: row.endedAt,
            },
          });
        return ok(program);
      } catch (cause) {
        return storageFailure("提携条件の保存", cause);
      }
    },
  };
}
