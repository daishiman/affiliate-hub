import {
  type AffiliateAccountId,
  type AffiliateProgramId,
  type DomainError,
  type Money,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Affiliate & Monetization コンテキスト。
 *
 * ここに入るデータはすべて Commercial (商業) 区分である。
 * Ranking / Evidence / Content Authoring から、このモジュールを import してはならない。
 * 依存方向の機械検査 (tests/architecture) がこの禁止を強制する。
 *
 * 根拠:
 *   プラットフォーム層 §12.3 / §19.4、ブログ層 §4.7 / §17.4
 *   「アフィリエイト報酬・広告主依頼・販売実績を評価の入力にしてはならない」
 */

/** ASP (アフィリエイト・サービス・プロバイダ)。 */
export type AspKind =
  | "amazon_associates"
  | "rakuten_affiliate"
  | "yahoo_shopping"
  | "value_commerce"
  | "a8net"
  | "moshimo"
  | "accesstrade"
  | "direct"; // 広告主と直接契約

export const ASP_LABEL: Readonly<Record<AspKind, string>> = {
  amazon_associates: "Amazonアソシエイト",
  rakuten_affiliate: "楽天アフィリエイト",
  yahoo_shopping: "Yahoo!ショッピング",
  value_commerce: "バリューコマース",
  a8net: "A8.net",
  moshimo: "もしもアフィリエイト",
  accesstrade: "アクセストレード",
  direct: "直接契約",
};

/**
 * ASP アカウント。
 *
 * 認証情報 (API キー・トラッキングID の秘密部分) はここに持たない。
 * 保管先の参照キーだけを持ち、値は Workers Secrets 側にある。
 */
export type AffiliateAccount = {
  readonly id: AffiliateAccountId;
  readonly workspaceId: WorkspaceId;
  readonly asp: AspKind;
  /** 画面に出す識別名。どのアカウントか人が判別できるようにする。 */
  readonly label: string;
  /** 公開されるトラッキング ID (リンクに現れるため秘密ではない)。 */
  readonly publicTrackingId: string | null;
  /** 認証情報の保管先の参照キー。値そのものは入れない。 */
  readonly credentialRef: string | null;
  readonly connectedAt: Date;
  readonly disabledAt: Date | null;
};

export type RewardModel =
  | { readonly kind: "rate"; readonly percent: number } // 売上に対する率
  | { readonly kind: "fixed"; readonly amount: Money } // 成果 1 件あたり固定
  | { readonly kind: "tiered"; readonly note: string } // 段階制。詳細は ASP 側
  | { readonly kind: "unknown" }; // 未取得。0 と区別する

export type AffiliateProgram = {
  readonly id: AffiliateProgramId;
  readonly workspaceId: WorkspaceId;
  readonly accountId: AffiliateAccountId;
  readonly asp: AspKind;
  /** 広告主・プログラム名。 */
  readonly advertiserName: string;
  readonly rewardModel: RewardModel;
  /** 承認率。null は未取得。 */
  readonly approvalRate: number | null;
  /** 成果の確定までの日数。入金予測に使う。 */
  readonly confirmationDays: number | null;
  /** クッキー有効期間 (日)。 */
  readonly cookieDurationDays: number | null;
  /**
   * 掲載条件・禁止事項。
   * 「価格を記載してはいけない」「比較表への掲載は不可」など ASP ごとに違う。
   */
  readonly restrictions: readonly string[];
  readonly joinedAt: Date;
  readonly endedAt: Date | null;
};

export function createAffiliateAccount(input: {
  id: AffiliateAccountId;
  workspaceId: WorkspaceId;
  asp: AspKind;
  label: string;
  publicTrackingId?: string | null;
  credentialRef?: string | null;
  connectedAt: Date;
}): Result<AffiliateAccount, DomainError> {
  if (input.label.trim() === "") {
    return err(validationError("ASP アカウントの識別名が必要です。", "label"));
  }
  if (input.credentialRef && input.credentialRef.trim().length > 200) {
    return err(
      validationError(
        "認証情報の値そのものではなく、保管先の参照キーを渡してください。",
        "credentialRef",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    asp: input.asp,
    label: input.label.trim(),
    publicTrackingId: input.publicTrackingId ?? null,
    credentialRef: input.credentialRef ?? null,
    connectedAt: input.connectedAt,
    disabledAt: null,
  });
}

export function createAffiliateProgram(input: {
  id: AffiliateProgramId;
  workspaceId: WorkspaceId;
  accountId: AffiliateAccountId;
  asp: AspKind;
  advertiserName: string;
  rewardModel?: RewardModel;
  approvalRate?: number | null;
  confirmationDays?: number | null;
  cookieDurationDays?: number | null;
  restrictions?: readonly string[];
  joinedAt: Date;
}): Result<AffiliateProgram, DomainError> {
  if (input.advertiserName.trim() === "") {
    return err(validationError("広告主名が必要です。", "advertiserName"));
  }
  const rate = input.approvalRate;
  if (rate !== null && rate !== undefined && (rate < 0 || rate > 1)) {
    return err(validationError("承認率は 0〜1 で指定してください。", "approvalRate"));
  }
  const reward = input.rewardModel ?? { kind: "unknown" };
  if (reward.kind === "rate" && (reward.percent < 0 || reward.percent > 100)) {
    return err(validationError("報酬率は 0〜100 で指定してください。", "rewardModel"));
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    accountId: input.accountId,
    asp: input.asp,
    advertiserName: input.advertiserName.trim(),
    rewardModel: reward,
    approvalRate: rate ?? null,
    confirmationDays: input.confirmationDays ?? null,
    cookieDurationDays: input.cookieDurationDays ?? null,
    restrictions: input.restrictions ?? [],
    joinedAt: input.joinedAt,
    endedAt: null,
  });
}

export function isProgramActive(p: AffiliateProgram, at: Date): boolean {
  return p.endedAt === null || p.endedAt > at;
}

/**
 * 掲載条件に反していないか確認する。
 *
 * 条件は自由文なので機械判定できない。
 * ここでは「確認すべき条件の一覧」を返し、人が確認する導線に使う。
 * 自動で通過させないことが目的。
 */
export function restrictionsToConfirm(p: AffiliateProgram): readonly string[] {
  return p.restrictions;
}
