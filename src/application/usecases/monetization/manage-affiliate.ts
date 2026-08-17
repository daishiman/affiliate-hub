import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialConversionRepositoryPort,
} from "@/application/ports/monetization";
import {
  ASP_LABEL,
  type AffiliateProgram,
  type AspKind,
  type Conversion,
  type ConversionStatus,
  type RewardModel,
  adjustReward,
  effectiveReward,
  isProgramActive,
  restrictionsToConfirm,
} from "@/domain/monetization";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type AffiliateProgramId,
  type ConversionId,
  type CurrencyCode,
  type DomainError,
  type ProductId,
  type Result,
  assertSameTenant,
  domainError,
  err,
  formatMoney,
  money,
  ok,
  readDataClass,
  taggedString,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 提携（アフィリエイト）と成果のユースケース。
 *
 * **ここは Commercial 区分。順位づけからは完全に切り離す。**
 * この層で扱う報酬額が順位の入力に混ざらないことは、
 * ランキング側が Editorial 印のポートしか受け取らないことで型として担保される。
 * ここでは逆向きの確認をする: 渡されたポートに商業の印が付いているか。
 * 付いていなければ、印を付け忘れた実装が混ざっているということで、
 * その状態を放置すると将来ランキングへ渡せてしまう。
 */
export type ManageAffiliateDeps = {
  readonly accounts: AffiliateAccountRepositoryPort;
  readonly programs: AffiliateProgramRepositoryPort;
  readonly links: CommercialAffiliateLinkRepositoryPort;
  readonly conversions: CommercialConversionRepositoryPort;
};

function guardCommercial(deps: ManageAffiliateDeps): void {
  const unmarked = (["links", "conversions"] as const).filter(
    (key) => readDataClass(deps[key]) !== "commercial",
  );
  if (unmarked.length > 0) {
    throw new Error(
      `商業データの印が付いていないポートが渡されています: ${unmarked.join(", ")}。` +
        "印が無いと、順位づけ側へ渡せてしまいます。",
    );
  }
}

/** 報酬の決め方を、読んで分かる言葉にする。 */
export function rewardModelLabel(model: RewardModel): string {
  switch (model.kind) {
    case "rate":
      return `売上の ${model.percent}%`;
    case "fixed":
      return `成果 1 件につき ${formatMoney(model.amount)}`;
    case "tiered":
      return `段階制（${model.note}）`;
    default:
      // 「不明」と「0 円」を混ぜない。混ぜると、取得できていないことに気づけない。
      return "未取得";
  }
}

/** 成果の状態の表示名。 */
export const CONVERSION_STATUS_LABEL: Readonly<Record<ConversionStatus, string>> = {
  pending: "発生（未確定）",
  approved: "確定",
  rejected: "却下",
  cancelled: "取消",
};

// --- 提携先の一覧 -----------------------------------------------------------

export type AffiliateAccountView = {
  readonly accountId: string;
  readonly asp: AspKind;
  readonly aspLabel: string;
  readonly label: string;
  readonly publicTrackingId: string | null;
  /** 認証情報が登録済みか。**値そのものは決して返さない。** */
  readonly credentialRegistered: boolean;
  readonly disabled: boolean;
  readonly blockedReason: string | null;
};

export type ListAffiliateAccountsOutput = {
  readonly items: readonly AffiliateAccountView[];
  readonly total: number;
  readonly emptyReason: string | null;
};

export function createListAffiliateAccountsUseCase(
  deps: ManageAffiliateDeps,
): UseCase<Record<string, never>, ListAffiliateAccountsOutput> {
  guardCommercial(deps);
  return {
    async execute(actor: ActorContext): Promise<Result<ListAffiliateAccountsOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.read_revenue", "提携先の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.accounts.list(actor.workspaceId, { limit: 100, cursor: null });
      if (!listed.ok) return listed;

      const items = listed.value.items.map((a) => ({
        accountId: String(a.id),
        asp: a.asp,
        aspLabel: ASP_LABEL[a.asp],
        label: a.label,
        publicTrackingId: a.publicTrackingId,
        credentialRegistered: a.credentialRef !== null,
        disabled: a.disabledAt !== null,
        blockedReason:
          a.credentialRef === null
            ? "この提携先の接続情報がまだ登録されていません。成果の取り込みは、ご自身で接続情報を登録してから行えます。"
            : a.disabledAt !== null
              ? "この提携先はいま止めています。"
              : null,
      }));

      return ok({
        items,
        total: items.length,
        emptyReason: items.length === 0 ? "提携先がまだ登録されていません。" : null,
      });
    },
  };
}

// --- 提携プログラムの一覧 ---------------------------------------------------

export type AffiliateProgramView = {
  readonly programId: string;
  readonly aspLabel: string;
  readonly advertiserName: string;
  readonly rewardLabel: string;
  readonly approvalRateLabel: string;
  readonly confirmationDaysLabel: string;
  readonly cookieDurationLabel: string;
  /** 人が確認する必要のある掲載条件。機械では判定できない。 */
  readonly restrictions: readonly string[];
  readonly active: boolean;
};

export type ListAffiliateProgramsOutput = {
  readonly items: readonly AffiliateProgramView[];
  readonly total: number;
  readonly restrictionCount: number;
  readonly emptyReason: string | null;
};

function toProgramView(p: AffiliateProgram, at: Date): AffiliateProgramView {
  return {
    programId: String(p.id),
    aspLabel: ASP_LABEL[p.asp],
    advertiserName: p.advertiserName,
    rewardLabel: rewardModelLabel(p.rewardModel),
    // 未取得を 0% と書かない。書くと「承認されない提携」に見えてしまう。
    approvalRateLabel:
      p.approvalRate === null ? "未取得" : `${Math.round(p.approvalRate * 100)}%`,
    confirmationDaysLabel: p.confirmationDays === null ? "未取得" : `${p.confirmationDays}日`,
    cookieDurationLabel: p.cookieDurationDays === null ? "未取得" : `${p.cookieDurationDays}日`,
    restrictions: restrictionsToConfirm(p),
    active: isProgramActive(p, at),
  };
}

export function createListAffiliateProgramsUseCase(
  deps: ManageAffiliateDeps,
): UseCase<Record<string, never>, ListAffiliateProgramsOutput> {
  guardCommercial(deps);
  return {
    async execute(actor: ActorContext): Promise<Result<ListAffiliateProgramsOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.read_revenue", "提携条件の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.programs.list(actor.workspaceId, { limit: 100, cursor: null });
      if (!listed.ok) return listed;

      const now = new Date();
      const items = listed.value.items.map((p) => toProgramView(p, now));
      return ok({
        items,
        total: items.length,
        restrictionCount: items.reduce((sum, i) => sum + i.restrictions.length, 0),
        emptyReason: items.length === 0 ? "提携しているプログラムがまだありません。" : null,
      });
    },
  };
}

// --- 成果の一覧 -------------------------------------------------------------

export type ConversionView = {
  readonly conversionId: string;
  readonly aspLabel: string;
  readonly statusLabel: string;
  readonly occurredAt: Date;
  /** 取り込んだままの金額。手で直しても、この値は残す。 */
  readonly ingestedLabel: string;
  /** 手で直した金額。直していなければ null。 */
  readonly adjustedLabel: string | null;
  readonly adjustmentReason: string | null;
  readonly effectiveLabel: string;
  /**
   * この成果の通貨。
   *
   * 表示だけなら `effectiveLabel` で足りるが、**金額を直す欄は
   * 入力された数がどの通貨かを知らないと保存できない**。
   * 画面側で「たぶん円」と決め打つと、ドル建ての成果に 1500 と入れた人の
   * 意図が黙って 1500 円になり、直したことに誰も気づけない。
   */
  readonly currency: CurrencyCode;
  readonly periodClosed: boolean;
};

export type ListConversionsInput = { readonly period: string };
export type ListConversionsOutput = {
  readonly period: string;
  readonly items: readonly ConversionView[];
  readonly total: number;
  /** 確定した成果の合計。未確定は足さない。 */
  readonly approvedTotalLabel: string;
  readonly pendingCount: number;
  readonly closed: boolean;
  readonly emptyReason: string | null;
};

function toConversionView(c: Conversion): ConversionView {
  const effective = effectiveReward(c);
  return {
    conversionId: String(c.id),
    aspLabel: ASP_LABEL[c.asp],
    statusLabel: CONVERSION_STATUS_LABEL[c.status],
    occurredAt: c.occurredAt,
    ingestedLabel: c.ingestedReward === null ? "未取得" : formatMoney(c.ingestedReward),
    adjustedLabel: c.adjustedReward === null ? null : formatMoney(c.adjustedReward),
    adjustmentReason: c.adjustmentReason,
    effectiveLabel: effective === null ? "未取得" : formatMoney(effective),
    // まだ 1 円も取り込めていない成果は通貨も決まっていない。
    // 直す欄を出さないわけにはいかないので、既定を円とし、画面に単位を出す。
    currency: effective?.currency ?? c.ingestedReward?.currency ?? "JPY",
    periodClosed: c.periodClosed,
  };
}

export function createListConversionsUseCase(
  deps: ManageAffiliateDeps,
): UseCase<ListConversionsInput, ListConversionsOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ListConversionsInput,
    ): Promise<Result<ListConversionsOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.read_revenue", "成果の参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.conversions.listByPeriod(actor.workspaceId, input.period, {
        limit: 200,
        cursor: null,
      });
      if (!listed.ok) return listed;

      const raw = listed.value.items;
      const items = raw.map(toConversionView);

      // 確定分だけを合計する。未確定を足すと、入ってこない金額を見込みにしてしまう。
      let approvedMinor = 0;
      let currency: CurrencyCode = "JPY";
      for (const c of raw) {
        if (c.status !== "approved") continue;
        const amount = effectiveReward(c);
        if (amount === null) continue;
        approvedMinor += amount.amountMinor;
        currency = amount.currency;
      }
      const total = money(approvedMinor, currency);

      return ok({
        period: input.period,
        items,
        total: items.length,
        approvedTotalLabel: total.ok ? formatMoney(total.value) : "計算できません",
        pendingCount: raw.filter((c) => c.status === "pending").length,
        closed: raw.some((c) => c.periodClosed),
        emptyReason:
          items.length === 0
            ? `${input.period} の成果はまだ取り込まれていません。`
            : null,
      });
    },
  };
}

// --- 成果 1 件 ---------------------------------------------------------------

export type GetConversionInput = { readonly conversionId: string };
export type GetConversionOutput = {
  readonly view: ConversionView;
  readonly advertiserName: string;
  /** 金額を直せるか。直せないときは理由を出す。 */
  readonly adjustable: boolean;
  readonly notAdjustableReason: string | null;
};

async function loadConversion(
  deps: ManageAffiliateDeps,
  actor: ActorContext,
  conversionId: string,
): Promise<Result<Conversion, DomainError>> {
  const found = await deps.conversions.findById(
    actor.workspaceId,
    taggedString<"ConversionId">(conversionId) as ConversionId,
  );
  if (!found.ok) return found;
  if (found.value === null) {
    return err(
      domainError("NOT_FOUND", "この成果が見つかりません。", {
        suggestedAction: "期間を選び直してください。",
      }),
    );
  }
  const same = assertSameTenant(actor, found.value, "この成果");
  if (!same.ok) return same;
  return ok(found.value);
}

export function createGetConversionUseCase(
  deps: ManageAffiliateDeps,
): UseCase<GetConversionInput, GetConversionOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: GetConversionInput,
    ): Promise<Result<GetConversionOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.read_revenue", "成果の参照");
      if (!allowed.ok) return allowed;

      const loaded = await loadConversion(deps, actor, input.conversionId);
      if (!loaded.ok) return loaded;
      const conversion = loaded.value;

      const program = await deps.programs.findById(actor.workspaceId, conversion.programId);
      if (!program.ok) return program;

      // 直せない理由は、締め済みかどうかと権限の 2 つだけ。
      // どちらでもないのにボタンが出ない、という状態を作らない。
      const canManage = requireCapability(actor, "affiliate.manage", "成果の金額の修正");
      const notAdjustableReason = conversion.periodClosed
        ? "この期間はすでに締めているため、金額を直せません。訂正が必要な場合は、次の期間で調整として記録してください。"
        : !canManage.ok
          ? "金額を直せるのは、提携の管理を任されている担当者だけです。"
          : null;

      return ok({
        view: toConversionView(conversion),
        advertiserName: program.value?.advertiserName ?? "未取得",
        adjustable: notAdjustableReason === null,
        notAdjustableReason,
      });
    },
  };
}

// --- 成果の手修正 -----------------------------------------------------------

export type AdjustConversionInput = {
  readonly conversionId: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly reason: string;
};
export type AdjustConversionOutput = { readonly view: ConversionView };

/**
 * 成果の金額を手で直す。
 *
 * 取り込んだ値は残したまま、直した値を別の欄に置く。
 * 上書きしてしまうと、次の取り込みとの差分が出せず、誤りに気づけない。
 * 締め済みの期間は直せない（締めた報告と食い違うため）。
 */
export function createAdjustConversionUseCase(
  deps: ManageAffiliateDeps,
): UseCase<AdjustConversionInput, AdjustConversionOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: AdjustConversionInput,
    ): Promise<Result<AdjustConversionOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "成果の金額の修正");
      if (!allowed.ok) return allowed;

      const loaded = await loadConversion(deps, actor, input.conversionId);
      if (!loaded.ok) return loaded;

      if (loaded.value.periodClosed) {
        return err(
          domainError("CONFLICT", "この期間はすでに締めているため、金額を直せません。", {
            suggestedAction: "訂正が必要な場合は、次の期間で調整として記録してください。",
          }),
        );
      }

      const amount = money(input.amountMinor, input.currency);
      if (!amount.ok) return amount;

      const adjusted = adjustReward(loaded.value, amount.value, input.reason);
      if (!adjusted.ok) return adjusted;

      const saved = await deps.conversions.save(adjusted.value);
      if (!saved.ok) return saved;
      return ok({ view: toConversionView(saved.value) });
    },
  };
}

// --- リンクの確認 -----------------------------------------------------------

export type ListProductLinksInput = { readonly productId: string };
export type ProductLinkView = {
  readonly linkId: string;
  readonly url: string;
  readonly alterationProhibited: boolean;
  readonly usable: boolean;
  readonly blockedReason: string | null;
};
export type ListProductLinksOutput = {
  readonly items: readonly ProductLinkView[];
  readonly emptyReason: string | null;
};

/**
 * 商品につながる提携リンクの一覧。
 *
 * URL はここでも表示のときも一切変えない。
 * 計測用の印を URL に足すと、多くの提携先で規約違反になり、
 * 成果が付かなくなる。
 */
export function createListProductLinksUseCase(
  deps: ManageAffiliateDeps,
): UseCase<ListProductLinksInput, ListProductLinksOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: ListProductLinksInput,
    ): Promise<Result<ListProductLinksOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.read_revenue", "提携リンクの参照");
      if (!allowed.ok) return allowed;

      const listed = await deps.links.listByProduct(
        actor.workspaceId,
        taggedString<"ProductId">(input.productId) as ProductId,
      );
      if (!listed.ok) return listed;

      const now = new Date();
      const items = listed.value.map((l) => {
        const usable = l.disabledAt === null && (l.expiresAt === null || l.expiresAt > now);
        return {
          linkId: String(l.id),
          url: l.originalUrl,
          alterationProhibited: l.alterationProhibited,
          usable,
          blockedReason: usable
            ? null
            : l.disabledAt !== null
              ? "このリンクは止めています。"
              : "このリンクは有効期限が切れています。作り直してください。",
        };
      });

      return ok({
        items,
        emptyReason:
          items.length === 0 ? "この商品につながる提携リンクはまだありません。" : null,
      });
    },
  };
}

/** 提携プログラムの ID を作る補助。画面から渡された文字列を型に載せる。 */
export function toProgramId(value: string): AffiliateProgramId {
  return taggedString<"AffiliateProgramId">(value) as AffiliateProgramId;
}
