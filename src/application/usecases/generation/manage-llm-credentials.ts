import { auditActorOf } from "@/application/audit";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import type {
  LlmConnectivityPort,
  LlmCredentialVaultPort,
  LlmModelDescriptor,
  LlmProviderCatalogPort,
} from "@/application/ports/llm-credential";
import { createAuditLogEntry } from "@/domain/compliance";
import type { LlmCredentialSummary } from "@/domain/generation/llm-credential";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type AuditLogId,
  type DomainError,
  type Result,
  type UserId,
  err,
  ok,
  taggedString,
  validationError,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 生成 AI の API キーを、画面から登録・確認・失効させる。
 *
 * --- この層に鍵の値が現れるのは 1 か所だけ ---
 * `input.apiKey`（登録のときの入力）だけである。
 * それを `vault.store` へ渡したら、その先はもう戻ってこない
 * （`LlmCredentialVaultPort` に値を返す口が無い）。
 * 一覧にも監査記録にも戻り値にも、値の入る欄が型として存在しない。
 *
 * --- 権限 ---
 * `integration_key.manage` を使う。定義の但し書きが
 * 「認証情報そのものを扱うため人に限る」で、まさにこの用途である。
 * 新しく権限を足すと、役割の表を 1 つ増やしたぶん
 * 「どちらを見ればよいか」が分かれる。
 * この権限は `HUMAN_ONLY_CAPABILITIES` に入っているので、
 * **AI サービスアカウントからは鍵を登録も失効もできない。**
 */
export type ManageLlmCredentialsDeps = {
  readonly vault: LlmCredentialVaultPort;
  readonly catalog: LlmProviderCatalogPort;
  /** 疎通確認。登録した鍵が実際に使えるかを 1 回だけ確かめる。 */
  readonly connectivity: LlmConnectivityPort;
  readonly auditLog: AuditLogPort;
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

export type ManageLlmCredentialsInput =
  | { readonly action: "list" }
  | { readonly action: "register"; readonly providerId: string; readonly apiKey: string }
  | { readonly action: "revoke"; readonly providerId: string }
  | { readonly action: "verify"; readonly providerId: string; readonly modelId: string };

export type LlmProviderRow = {
  readonly providerId: string;
  readonly label: string;
  readonly keyIssueUrl: string;
  readonly required: boolean;
  /** 登録済みなら要約。未登録は `null`。 */
  readonly credential: LlmCredentialSummary | null;
  /** 選べるモデル。空なら設定が入っていない。 */
  readonly models: readonly LlmModelDescriptor[];
  /**
   * この提供元がいま使えない理由。使えるときは `null`。
   *
   * **黙って空にしない。** 「モデルが 1 つも出ない」と
   * 「鍵が入っていない」と「失効させた」は、画面では同じ空白に見えるのに
   * 利用者がやることが全部違う。
   */
  readonly unavailableReason: string | null;
};

export type ManageLlmCredentialsOutput = {
  readonly rows: readonly LlmProviderRow[];
  /**
   * 疎通確認が失敗したときの中身。成功・未実施は `null`。
   *
   * 例外にせず値で返すのは、**失敗しても一覧を出したい**ため。
   * 画面が真っ白になると、何が駄目だったのかを読む場所ごと消える。
   */
  readonly verifyFailure: DomainError | null;
  readonly emptyReason: string | null;
};

/** 登録後に値をもう一度見せないことを、画面の文言としても言い切る。 */
export const LLM_KEY_SHOWN_ONCE_TEXT =
  "登録した API キーは、この先どこにも表示されません（末尾 4 文字だけを控えとして出します）。控えが必要な場合は、登録前に提供元の画面で保管してください。";

export function createManageLlmCredentialsUseCase(
  deps: ManageLlmCredentialsDeps,
): UseCase<ManageLlmCredentialsInput, ManageLlmCredentialsOutput> {
  /**
   * 操作の記録を残す。**鍵の値は渡さない。**
   *
   * 引数に `apiKey` を取らない形にしてある。取れる形にすると、
   * いつか誰かが「どの鍵か分かるように」と入れる。
   */
  async function record(
    actor: ActorContext,
    action: "llm_credential.registered" | "llm_credential.revoked",
    providerId: string,
    last4: string,
  ): Promise<Result<void, DomainError>> {
    const entry = createAuditLogEntry({
      id: taggedString<"AuditLogId">(`al_${deps.ids.newId()}`) as AuditLogId,
      workspaceId: actor.workspaceId,
      action,
      // 身元を記録の形へ移すのは `auditActorOf()` の 1 本だけにする（2026-08-19）。
      actor: auditActorOf(actor),
      targetType: "llm_credential",
      targetId: providerId,
      after: { providerId, last4 },
      occurredAt: deps.now(),
    });
    if (!entry.ok) return entry;
    const appended = await deps.auditLog.append(entry.value);
    if (!appended.ok) return appended;
    return ok(undefined);
  }

  return {
    async execute(
      actor: ActorContext,
      input: ManageLlmCredentialsInput,
    ): Promise<Result<ManageLlmCredentialsOutput, DomainError>> {
      const allowed = requireCapability(
        actor,
        "integration_key.manage",
        "生成 AI の API キーの管理",
      );
      if (!allowed.ok) return allowed;

      const providers = await deps.catalog.listProviders();
      if (!providers.ok) return providers;

      if (input.action !== "list") {
        // 目録に無い提供元を受け付けない。受け付けると、綴り違いの行が
        // 保管庫に増え、画面のどこにも出ないまま鍵が残る。
        const known = providers.value.some((p) => p.providerId === input.providerId);
        if (!known) {
          return err(validationError("その提供元は選べません。", "providerId"));
        }
      }

      if (input.action === "register") {
        const stored = await deps.vault.store({
          workspaceId: actor.workspaceId,
          providerId: input.providerId,
          apiKey: input.apiKey,
          registeredBy: taggedString<"UserId">(actor.userId) as UserId,
        });
        if (!stored.ok) return stored;
        const recorded = await record(
          actor,
          "llm_credential.registered",
          input.providerId,
          stored.value.last4,
        );
        if (!recorded.ok) return recorded;
      }

      /**
       * 疎通確認。**結果を必ず書き留めてから返す。**
       *
       * 確かめた事実が残らないと、次に画面を開いたときに
       * 「確かめていない」のか「確かめて駄目だった」のかが区別できず、
       * 利用者は同じ確認を何度も繰り返すことになる。
       */
      let verifyFailure: DomainError | null = null;
      if (input.action === "verify") {
        const checked = await deps.connectivity.check({
          workspaceId: actor.workspaceId,
          providerId: input.providerId,
          modelId: input.modelId,
        });
        const noted = await deps.vault.recordVerification({
          workspaceId: actor.workspaceId,
          providerId: input.providerId,
          outcome: checked.ok ? "ok" : "failed",
        });
        if (!noted.ok) return noted;
        // 失敗しても一覧は返す。**画面を空にしない**
        // （何が起きたかを、いまの状態と並べて読めるようにする）。
        verifyFailure = checked.ok ? null : checked.error;
      }

      if (input.action === "revoke") {
        const revoked = await deps.vault.revoke({
          workspaceId: actor.workspaceId,
          providerId: input.providerId,
          revokedBy: taggedString<"UserId">(actor.userId) as UserId,
        });
        if (!revoked.ok) return revoked;
        const recorded = await record(
          actor,
          "llm_credential.revoked",
          input.providerId,
          revoked.value.last4,
        );
        if (!recorded.ok) return recorded;
      }

      const stored = await deps.vault.list(actor.workspaceId);
      if (!stored.ok) return stored;
      const byProvider = new Map(stored.value.map((c) => [c.providerId, c]));

      const rows: LlmProviderRow[] = [];
      for (const provider of providers.value) {
        const models = await deps.catalog.listModels(provider.providerId);
        if (!models.ok) return models;
        const credential = byProvider.get(provider.providerId) ?? null;
        rows.push({
          providerId: provider.providerId,
          label: provider.label,
          keyIssueUrl: provider.keyIssueUrl,
          required: provider.required,
          credential,
          models: models.value,
          unavailableReason: unavailableReason(credential, models.value.length),
        });
      }

      return ok({
        rows,
        verifyFailure,
        emptyReason:
          rows.length > 0
            ? null
            : "使える提供元の設定が入っていません。LLM_PROVIDER_CATALOG を設定してください。",
      });
    },
  };
}

/**
 * 使えない理由を 1 文で返す。
 *
 * 順番に意味がある。**鍵より先にモデルを見る**のは、
 * 鍵を入れたのに何も起きない、という順番で利用者を歩かせないため
 * （モデルが 0 件なら、鍵を入れても呼べる先が無い）。
 */
function unavailableReason(
  credential: LlmCredentialSummary | null,
  modelCount: number,
): string | null {
  if (modelCount === 0) {
    return "選べるモデルが設定されていません。管理者が LLM_PROVIDER_CATALOG を設定するまで使えません。";
  }
  if (credential === null) {
    return "API キーがまだ登録されていません。";
  }
  if (credential.status === "revoked") {
    return "API キーを失効させています。使うには登録し直してください。";
  }
  if (credential.lastVerification === "failed") {
    return "前回の疎通確認に失敗しています。キーが有効か確かめてください。";
  }
  return null;
}
