import {
  type ActorContext,
  type DomainError,
  type Result,
  type Role,
  domainError,
  ok,
  err,
} from "../shared";

/**
 * 権限表 (プラットフォーム層 §25)。
 *
 * ロールではなく「できること (capability)」で判定する理由:
 *   - 画面や API に `if (role === "writer")` を書くと、ロールを 1 つ足すたびに全部を直す
 *   - 「公開できるのは誰か」を 1 箇所で読めるようにする
 *
 * AI サービスアカウントは、この表とは別に
 * 「人の承認が要る操作は不可」という上書きを受ける。
 */
export type Capability =
  | "workspace.manage"
  | "brand.manage"
  | "site.manage"
  /**
   * ブログの器を作る（ウィザード）。
   *
   * `site.manage`（運用中のブログの設定を変える）と分けている。
   * 器を作った時点では記事が 1 本も無く、読者に見える内容は生まれない。
   * 記事が世に出るかどうかは `content.publish` と公開ゲートが決める。
   * 同じ権限にまとめると、企画担当が新しいブログを試すたびに
   * 公開の権限まで渡すことになる。
   */
  | "site.draft"
  | "member.manage"
  | "product.read"
  | "product.write"
  | "evidence.write"
  | "ranking_model.manage"
  | "content.read"
  | "content.write"
  | "content.generate"
  | "content.fact_check"
  | "content.compliance_review"
  | "content.approve"
  | "content.publish"
  | "affiliate.manage"
  | "affiliate.read_revenue"
  | "analytics.read"
  | "audit.read"
  | "export.perform"
  /**
   * 改善要望まわり（使い勝手を直すループ）。
   *
   * 4 つに分けている理由は、**取りに来る側（Claude Code）に渡してよい範囲**が
   * 人の管理者より狭いため。1 つにまとめると、鍵を配った瞬間に
   * 「要望を廃棄する」「鍵を発行する」まで渡ることになる。
   */
  | "feedback.submit"
  | "feedback.read"
  | "feedback.status_update"
  /** 扱い（対応しない・重複・廃棄）を決める・取り消す。人が決める。 */
  | "feedback.manage"
  /** 鍵の発行・失効。認証情報そのものを扱うため人に限る。 */
  | "integration_key.manage";

/** 人の承認が前提の操作。AI サービスアカウントには常に許可しない。 */
export const HUMAN_ONLY_CAPABILITIES: ReadonlySet<Capability> = new Set<Capability>([
  "content.approve",
  "content.publish",
  "member.manage",
  "workspace.manage",
  "affiliate.manage",
  "export.perform",
  "feedback.manage",
  "integration_key.manage",
]);

const ROLE_CAPABILITIES: Readonly<Record<Role, readonly Capability[]>> = {
  owner: [
    "workspace.manage",
    "brand.manage",
    "site.manage",
    "site.draft",
    "member.manage",
    "product.read",
    "product.write",
    "evidence.write",
    "ranking_model.manage",
    "content.read",
    "content.write",
    "content.generate",
    "content.fact_check",
    "content.compliance_review",
    "content.approve",
    "content.publish",
    "affiliate.manage",
    "affiliate.read_revenue",
    "analytics.read",
    "audit.read",
    "export.perform",
    "feedback.submit",
    "feedback.read",
    "feedback.status_update",
    "feedback.manage",
    "integration_key.manage",
  ],
  workspace_admin: [
    "brand.manage",
    "site.manage",
    "site.draft",
    "member.manage",
    "product.read",
    "product.write",
    "evidence.write",
    "ranking_model.manage",
    "content.read",
    "content.write",
    "content.generate",
    "content.fact_check",
    "content.compliance_review",
    "content.approve",
    "content.publish",
    "affiliate.manage",
    "affiliate.read_revenue",
    "analytics.read",
    "audit.read",
    "export.perform",
    "feedback.submit",
    "feedback.read",
    "feedback.status_update",
    "feedback.manage",
    "integration_key.manage",
  ],
  brand_manager: [
    "site.manage",
    "site.draft",
    "product.read",
    "product.write",
    "evidence.write",
    "ranking_model.manage",
    "content.read",
    "content.write",
    "content.generate",
    "content.fact_check",
    "content.approve",
    "content.publish",
    "analytics.read",
    // ブランド管理者は要望を送って一覧を見られるが、扱いを決めるのと鍵の発行はできない。
    "feedback.submit",
    "feedback.read",
  ],
  researcher: ["product.read", "product.write", "evidence.write", "content.read"],
  writer: ["product.read", "content.read", "content.write", "content.generate", "site.draft"],
  reviewer: [
    "product.read",
    "content.read",
    "content.fact_check",
    "content.compliance_review",
    "content.write",
  ],
  publisher: ["content.read", "content.publish", "analytics.read"],
  analyst: ["content.read", "analytics.read", "affiliate.read_revenue"],
  contributor: ["content.read", "content.write"],
  /**
   * AI サービスアカウント。
   * 下書き・調査・生成まで。承認と公開は持たせない (§25)。
   */
  ai_service_account: [
    "product.read",
    "product.write",
    "evidence.write",
    "content.read",
    "content.write",
    "content.generate",
    // 取りに来る側（Claude Code）。読むことと状態を進めることまで。
    // 扱いの決定・廃棄・鍵の発行は持たない。
    "feedback.read",
    "feedback.status_update",
  ],
};

export function capabilitiesOf(roles: readonly Role[]): ReadonlySet<Capability> {
  const set = new Set<Capability>();
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role]) set.add(cap);
  }
  return set;
}

export function can(actor: ActorContext, capability: Capability): boolean {
  if (actor.isAiServiceAccount && HUMAN_ONLY_CAPABILITIES.has(capability)) return false;
  return capabilitiesOf(actor.roles).has(capability);
}

/**
 * 権限を要求する。ユースケースの入口で必ず呼ぶ。
 *
 * 失敗メッセージに必要な権限名を含める。
 * 「権限がありません」だけでは、利用者が誰に頼めばよいか分からない。
 */
export function requireCapability(
  actor: ActorContext,
  capability: Capability,
  what: string,
): Result<true, DomainError> {
  if (can(actor, capability)) return ok(true);
  if (actor.isAiServiceAccount && HUMAN_ONLY_CAPABILITIES.has(capability)) {
    return err(
      domainError("FORBIDDEN", `${what} は人が行う必要があります。`, {
        suggestedAction: "担当者が内容を確認してから操作してください。",
      }),
    );
  }
  return err(
    domainError("FORBIDDEN", `${what} を行う権限がありません。`, {
      suggestedAction: `必要な権限: ${capability}。ワークスペース管理者に依頼してください。`,
    }),
  );
}
