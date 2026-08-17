import {
  type AudiencePersonaId,
  type ClaimId,
  type ContentPackageId,
  type DomainError,
  type MasterBriefId,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * Content Authoring コンテキスト / MasterBrief (§21 E24)。
 *
 * **1 つの記事のまとまりに対して、原本はこれ 1 つだけ。**
 * ブログ本文・note・X・メールなど、出し先ごとの原稿 ([[ContentVariant]]) は
 * すべてこの原本から派生する。
 *
 * 原本を分けずに出し先ごとに書き起こすと、必ず内容が食い違う。
 * 食い違ったとき、どれが正しいのかを決める手立てが無くなる。
 * だから「出し先が増える」は原稿の増加であって、原本の増加ではない。
 *
 * もう 1 つの役割は **主張と根拠の入口をここに固定すること**。
 * 原本の段階で「何を言い切るか」を並べておくと、
 * 公開前の検査 ([[publish-gate]]) が、その一つひとつに根拠があるかを機械で確かめられる。
 * 原稿を書いてから主張を数え直すやり方だと、書き手ごとに漏れる。
 */
export type MasterBrief = {
  readonly id: MasterBriefId;
  readonly workspaceId: WorkspaceId;
  readonly packageId: ContentPackageId;
  /** 誰に向けて書くか。 */
  readonly audienceId: AudiencePersonaId;
  /** 読んだ人が何をできるようになるか。1 文で書く。 */
  readonly promise: string;
  /** 言い切る内容。ここに挙げたものは、公開前に根拠の有無を機械で確かめる。 */
  readonly claimIds: readonly ClaimId[];
  /** 触れる論点。見出しの元になる。 */
  readonly keyPoints: readonly string[];
  /**
   * 書かないこと。
   * 「効果がある」「必ず痩せる」のような言い切りを避けたい領域を先に決めておく。
   */
  readonly avoid: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** 1 つの主張も無い原本は作れない（根拠の確認対象がゼロになるため）。 */
export function createMasterBrief(input: {
  id: MasterBriefId;
  workspaceId: WorkspaceId;
  packageId: ContentPackageId;
  audienceId: AudiencePersonaId;
  promise: string;
  claimIds: readonly ClaimId[];
  keyPoints: readonly string[];
  avoid?: readonly string[];
  createdAt: Date;
}): Result<MasterBrief, DomainError> {
  const promise = input.promise.trim();
  if (promise === "") {
    return err(
      validationError(
        "読んだ人が何をできるようになるかを 1 文で書いてください。",
        "promise",
      ),
    );
  }
  if (input.claimIds.length === 0) {
    return err(
      validationError(
        "言い切る内容を 1 つ以上挙げてください。挙げないと、根拠の確認ができません。",
        "claimIds",
      ),
    );
  }
  if (new Set(input.claimIds).size !== input.claimIds.length) {
    return err(validationError("同じ主張が重複しています。", "claimIds"));
  }
  const keyPoints = input.keyPoints.map((k) => k.trim()).filter((k) => k !== "");
  if (keyPoints.length === 0) {
    return err(
      validationError("触れる論点を 1 つ以上書いてください。", "keyPoints"),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    packageId: input.packageId,
    audienceId: input.audienceId,
    promise,
    claimIds: input.claimIds,
    keyPoints,
    avoid: (input.avoid ?? []).map((a) => a.trim()).filter((a) => a !== ""),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

/**
 * 原稿が原本から外れていないか。
 *
 * 原稿に、原本に無い主張が混ざっていたら止める。
 * 出し先ごとに書き足された言い切りは、根拠の確認を通っていない。
 */
export function claimsWithinBrief(
  brief: MasterBrief,
  variantClaimIds: readonly ClaimId[],
): Result<true, DomainError> {
  const allowed = new Set<string>(brief.claimIds.map(String));
  const extra = variantClaimIds.filter((id) => !allowed.has(String(id)));
  if (extra.length > 0) {
    return err(
      validationError(
        `原本に無い主張が原稿に入っています（${extra.length} 件）。原本に追加して根拠を付けてください。`,
        "claimIds",
      ),
    );
  }
  return ok(true);
}
