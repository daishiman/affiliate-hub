import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialConversionRepositoryPort,
} from "@/application/ports/monetization";
import type { IdGeneratorPort } from "@/application/ports/common";
import type { AuditLogPort } from "@/application/ports/compliance";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import {
  ASP_LABEL,
  type AffiliateAccount,
  type AffiliateProgram,
  type AspKind,
  type Conversion,
  type ConversionStatus,
  type RewardModel,
  DEFAULT_REWARD_CURRENCY,
  adjustReward,
  createAffiliateAccount,
  createAffiliateProgram,
  effectiveReward,
  isProgramActive,
  restrictionsToConfirm,
} from "@/domain/monetization";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type AffiliateAccountId,
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
  missingMark,
  money,
  ok,
  taggedString,
  validationError,
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
  readonly ids: IdGeneratorPort;
  readonly auditLog: AuditLogPort;
  readonly now: () => Date;
};

/**
 * 実行時に「商業の印」を求めるポート。
 *
 * `ids` や `now` のような、データを持たない依存は対象にしない。
 * 順位づけ側（`rank-products.ts`）も同じ向き（印が無ければ落とす）で見ている。
 */
const AFFILIATE_DATA_PORTS = ["links", "conversions"] as const;

function guardCommercial(deps: ManageAffiliateDeps): void {
  const unmarked = missingMark(
    deps as unknown as Record<string, unknown>,
    "commercial",
    AFFILIATE_DATA_PORTS,
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

      // 組み立ては 1 か所（`toAccountView`）に置く。一覧と保存で別々に書くと、
      // 「保存直後だけ案内の文が違う」というたちの悪いずれが生まれる。
      const items = listed.value.items.map(toAccountView);

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
  /**
   * 確定した成果の合計。未確定は足さない。
   * 通貨が混ざった期間は通貨ごとに分けて並べる（`¥12,000 / $34.00`）。
   */
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
    currency: effective?.currency ?? c.ingestedReward?.currency ?? DEFAULT_REWARD_CURRENCY,
    periodClosed: c.periodClosed,
  };
}

/**
 * 確定した成果の合計を作る。
 *
 * **通貨ごとに分けて足す。**`amountMinor` の 1 は通貨ごとに意味が違い
 * （JPY は 1 円、USD は 1 セント）、混ぜて足した数はどの通貨でも金額にならない。
 * 混ざった期間は `¥12,000 / $34.00` のように並べて出す。
 * 合計を出さずに文へ差し替える案も採れるが、**通貨が混ざるのは並べれば読める話**で、
 * いままで数字が出ていた場所を文にすると、混ざっていない大多数の期間まで読みにくくなる。
 *
 * 並べる順は通貨コードの昇順に固定する。取り込みの順に任せると、
 * 同じ期間の同じ成果が再取り込みのたびに違う並びで出る。
 *
 * 確定が 1 件も無い期間は `DEFAULT_REWARD_CURRENCY` の 0 を出す。
 * これは `toConversionView` が通貨未確定の成果に使う既定と同じもので、
 * 同じ画面の item と合計が別々の通貨を出すことは有り得ないので 1 つを共有する。
 */
function approvedTotal(raw: readonly Conversion[]): string {
  const byCurrency = new Map<CurrencyCode, number>();
  for (const c of raw) {
    if (c.status !== "approved") continue;
    const amount = effectiveReward(c);
    if (amount === null) continue;
    byCurrency.set(amount.currency, (byCurrency.get(amount.currency) ?? 0) + amount.amountMinor);
  }
  if (byCurrency.size === 0) byCurrency.set(DEFAULT_REWARD_CURRENCY, 0);

  const labels: string[] = [];
  for (const [currency, amountMinor] of [...byCurrency].sort(([a], [b]) => a.localeCompare(b))) {
    const total = money(amountMinor, currency);
    if (!total.ok) return "計算できません";
    labels.push(formatMoney(total.value));
  }
  return labels.join(" / ");
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
      const approvedTotalLabel = approvedTotal(raw);

      return ok({
        period: input.period,
        items,
        total: items.length,
        approvedTotalLabel,
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

      const before = effectiveReward(loaded.value);

      const saved = await deps.conversions.save(adjusted.value);
      if (!saved.ok) return saved;

      /*
       * 手で直したことを記録に残す。**記録は保存の後**に書く。
       *
       * 金額をここに書くのは、後から「取り込んだ値といくら違うか」を
       * 数えられるようにするためである。**この記録が順位づけへ流れることはない。**
       * 順位づけ側は Editorial 印のポートしか受け取れず、
       * `AuditLogPort` はその型に当てはまらないので、経路が型として存在しない。
       *
       * 理由は `createAuditLogEntry` 側で必須になっている（`REASON_REQUIRED`）。
       * 理由の無い金額の修正は、後から見て正当だったか判断できない。
       */
      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "conversion.adjusted",
        targetType: "conversion",
        targetId: String(loaded.value.id),
        before:
          before === null
            ? null
            : { amountMinor: before.amountMinor, currency: before.currency },
        after: { amountMinor: amount.value.amountMinor, currency: amount.value.currency },
        reason: input.reason,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(
          auditWriteFailure(
            `金額は ${formatMoney(amount.value)} に直っています`,
            appended.error.details,
          ),
        );
      }

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

// --- 提携先の登録・変更 -------------------------------------------------------

/** 選べる ASP。画面の選択肢も、入力の検査も、ここ 1 つから作る。 */
export function aspOptions(): readonly { readonly key: AspKind; readonly label: string }[] {
  return (Object.keys(ASP_LABEL) as AspKind[]).map((key) => ({ key, label: ASP_LABEL[key] }));
}

function readAsp(value: string): Result<AspKind, DomainError> {
  return value in ASP_LABEL
    ? ok(value as AspKind)
    : err(validationError("提携先の種類が選ばれていません。", "asp"));
}

export type SaveAffiliateAccountInput = {
  /** `null` なら新しく作る。文字列なら、その提携先を直す。 */
  readonly accountId: string | null;
  readonly asp: string;
  readonly label: string;
  /** 空文字は「未設定」。空文字のまま保存しない（未設定と空欄を混ぜない）。 */
  readonly publicTrackingId: string;
  /** 接続情報の**保管先の名前**。鍵そのものを渡してはいけない。 */
  readonly credentialRef: string;
  /** 止めるかどうか。止めても行は消さない（過去の成果の出どころが消えるため）。 */
  readonly disabled: boolean;
};

export type SaveAffiliateAccountOutput = {
  readonly accountId: string;
  readonly view: AffiliateAccountView;
};

function toAccountView(a: AffiliateAccount): AffiliateAccountView {
  return {
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
  };
}

/**
 * 提携先（ASP アカウント）を 1 つ登録する・直す。
 *
 * **秘密の値をここへ渡さない。** 受け取るのは保管先の名前（`credentialRef`）だけで、
 * 鍵そのものは各サービスの画面でご自身が登録する。ドメイン側が長さで弾くのは
 * 「鍵を丸ごと貼り付けた」形をせき止めるためで、正しさの保証ではない。
 * 保証しているのは、**この経路にも保存先にも鍵を置く場所が無い**ことのほうである。
 *
 * 直すときに `connectedAt` を引き継ぐ。引き継がないと、名前を直しただけの保存で
 * 「いつからの提携か」が今日へ動き、過去の成果がどの提携のものか読めなくなる。
 */
export function createSaveAffiliateAccountUseCase(
  deps: ManageAffiliateDeps,
): UseCase<SaveAffiliateAccountInput, SaveAffiliateAccountOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveAffiliateAccountInput,
    ): Promise<Result<SaveAffiliateAccountOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "提携先の登録");
      if (!allowed.ok) return allowed;

      const asp = readAsp(input.asp);
      if (!asp.ok) return asp;

      const existing =
        input.accountId === null
          ? null
          : await deps.accounts.findById(
              actor.workspaceId,
              taggedString<"AffiliateAccountId">(input.accountId) as AffiliateAccountId,
            );
      if (existing !== null && !existing.ok) return existing;
      if (input.accountId !== null && existing?.ok && existing.value === null) {
        return err(
          domainError("NOT_FOUND", "その提携先が見つかりません。", {
            suggestedAction: "一覧へ戻り、選び直してください。",
          }),
        );
      }
      const before = existing?.ok ? existing.value : null;

      const now = deps.now();
      const built = createAffiliateAccount({
        id:
          before?.id ??
          (taggedString<"AffiliateAccountId">(deps.ids.newId()) as AffiliateAccountId),
        workspaceId: actor.workspaceId,
        asp: asp.value,
        label: input.label,
        // 空欄は空文字ではなく未設定にする。空文字だと「登録済みだが空」に見え、
        // 接続情報が要るという案内が画面から消える。
        publicTrackingId: input.publicTrackingId.trim() === "" ? null : input.publicTrackingId.trim(),
        credentialRef: input.credentialRef.trim() === "" ? null : input.credentialRef.trim(),
        connectedAt: before?.connectedAt ?? now,
      });
      if (!built.ok) return built;

      // ドメインの構築子は必ず「止まっていない」状態で返す。止める指示は
      // ここで載せ直す。構築子に引数を足すと、作るときにも止められる形になる。
      const account: AffiliateAccount = {
        ...built.value,
        disabledAt: input.disabled ? (before?.disabledAt ?? now) : null,
      };

      const saved = await deps.accounts.save(account);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_account.changed",
        targetType: "affiliate_account",
        targetId: String(account.id),
        // **鍵は詰めない。** 登録されているかどうか（真偽）だけを残す。
        before:
          before === null
            ? null
            : {
                asp: before.asp,
                label: before.label,
                credentialRegistered: before.credentialRef !== null,
                disabled: before.disabledAt !== null,
              },
        after: {
          asp: account.asp,
          label: account.label,
          credentialRegistered: account.credentialRef !== null,
          disabled: account.disabledAt !== null,
        },
        reason: null,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("提携先は保存されています", appended.error.details));
      }

      return ok({ accountId: String(account.id), view: toAccountView(saved.value) });
    },
  };
}

// --- 提携条件の登録・変更 -----------------------------------------------------

export type SaveAffiliateProgramInput = {
  readonly programId: string | null;
  /** どの提携先の下の提携か。ASP はこの提携先から引く（別々に選ばせない）。 */
  readonly accountId: string;
  readonly advertiserName: string;
  readonly rewardKind: string;
  /** `rate` のときの率（%）。 */
  readonly rewardPercent: number | null;
  /** `fixed` のときの額。通貨は `rewardCurrency`。 */
  readonly rewardAmountMinor: number | null;
  readonly rewardCurrency: CurrencyCode;
  readonly rewardNote: string;
  /** 承認率を**％で**受け取る。0〜1 の小数を人に入力させない。 */
  readonly approvalRatePercent: number | null;
  readonly confirmationDays: number | null;
  readonly cookieDurationDays: number | null;
  readonly restrictions: readonly string[];
  /** 提携を終了にするか。終了でも行は消さない。 */
  readonly ended: boolean;
};

export type SaveAffiliateProgramOutput = {
  readonly programId: string;
  readonly view: AffiliateProgramView;
};

/** 画面の 4 通りの入力を、排他の 1 つの値へ畳む。 */
function readRewardModel(input: SaveAffiliateProgramInput): Result<RewardModel, DomainError> {
  switch (input.rewardKind) {
    case "rate":
      return input.rewardPercent === null
        ? err(validationError("報酬率（％）を入れてください。", "rewardPercent"))
        : ok({ kind: "rate", percent: input.rewardPercent });
    case "fixed": {
      if (input.rewardAmountMinor === null) {
        return err(validationError("1 件あたりの報酬額を入れてください。", "rewardAmountMinor"));
      }
      const amount = money(input.rewardAmountMinor, input.rewardCurrency);
      if (!amount.ok) return amount;
      return ok({ kind: "fixed", amount: amount.value });
    }
    case "tiered":
      return input.rewardNote.trim() === ""
        ? err(validationError("段階制の中身を一言で書いてください。", "rewardNote"))
        : ok({ kind: "tiered", note: input.rewardNote.trim() });
    case "unknown":
      // **「未取得」を選べるようにしておく。** 選べないと、分からない人が
      // とりあえず 0% を入れ、報酬の出ない提携として画面に並ぶ。
      return ok({ kind: "unknown" });
    default:
      return err(validationError("報酬の決め方が選ばれていません。", "rewardKind"));
  }
}

/**
 * 提携条件（広告主ごとのプログラム）を 1 つ登録する・直す。
 *
 * **ASP は提携先から引く。** 画面で別々に選ばせると、A8 のアカウントの下に
 * 楽天の提携条件がぶら下がる行が作れてしまい、成果の突合が合わなくなる。
 */
export function createSaveAffiliateProgramUseCase(
  deps: ManageAffiliateDeps,
): UseCase<SaveAffiliateProgramInput, SaveAffiliateProgramOutput> {
  guardCommercial(deps);
  return {
    async execute(
      actor: ActorContext,
      input: SaveAffiliateProgramInput,
    ): Promise<Result<SaveAffiliateProgramOutput, DomainError>> {
      const allowed = requireCapability(actor, "affiliate.manage", "提携条件の登録");
      if (!allowed.ok) return allowed;

      if (input.accountId.trim() === "") {
        return err(validationError("どの提携先の条件かを選んでください。", "accountId"));
      }
      const account = await deps.accounts.findById(
        actor.workspaceId,
        taggedString<"AffiliateAccountId">(input.accountId) as AffiliateAccountId,
      );
      if (!account.ok) return account;
      if (account.value === null) {
        return err(
          domainError("NOT_FOUND", "選ばれた提携先が見つかりません。", {
            suggestedAction: "先に提携先を登録してください。",
          }),
        );
      }

      const existing =
        input.programId === null
          ? null
          : await deps.programs.findById(actor.workspaceId, toProgramId(input.programId));
      if (existing !== null && !existing.ok) return existing;
      if (input.programId !== null && existing?.ok && existing.value === null) {
        return err(
          domainError("NOT_FOUND", "その提携条件が見つかりません。", {
            suggestedAction: "一覧へ戻り、選び直してください。",
          }),
        );
      }
      const before = existing?.ok ? existing.value : null;

      const reward = readRewardModel(input);
      if (!reward.ok) return reward;

      const now = deps.now();
      const built = createAffiliateProgram({
        id: before?.id ?? toProgramId(deps.ids.newId()),
        workspaceId: actor.workspaceId,
        accountId: account.value.id,
        // 提携先から引く。画面には出すが、選ばせない。
        asp: account.value.asp,
        advertiserName: input.advertiserName,
        rewardModel: reward.value,
        // ％で受け取り、ここで 0〜1 へ直す。人に小数を入力させない。
        approvalRate:
          input.approvalRatePercent === null ? null : input.approvalRatePercent / 100,
        confirmationDays: input.confirmationDays,
        cookieDurationDays: input.cookieDurationDays,
        restrictions: input.restrictions,
        joinedAt: before?.joinedAt ?? now,
      });
      if (!built.ok) return built;

      const program: AffiliateProgram = {
        ...built.value,
        endedAt: input.ended ? (before?.endedAt ?? now) : null,
      };

      const saved = await deps.programs.save(program);
      if (!saved.ok) return saved;

      const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
        action: "affiliate_program.changed",
        targetType: "affiliate_program",
        targetId: String(program.id),
        before:
          before === null
            ? null
            : {
                advertiserName: before.advertiserName,
                rewardKind: before.rewardModel.kind,
                restrictionCount: before.restrictions.length,
                ended: before.endedAt !== null,
              },
        after: {
          advertiserName: program.advertiserName,
          rewardKind: program.rewardModel.kind,
          restrictionCount: program.restrictions.length,
          ended: program.endedAt !== null,
        },
        reason: null,
      });
      if (!entry.ok) return entry;
      const appended = await deps.auditLog.append(entry.value);
      if (!appended.ok) {
        return err(auditWriteFailure("提携条件は保存されています", appended.error.details));
      }

      return ok({ programId: String(program.id), view: toProgramView(saved.value, now) });
    },
  };
}
