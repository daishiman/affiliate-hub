import type { IntegrationKeyPort } from "@/application/ports/feedback";
import type { IdGeneratorPort } from "@/application/ports/common";
import {
  type KeyScope,
  KEY_HANDLING_TEXT,
  KEY_SCOPE_LABELS,
  KEY_SHOWN_ONCE_TEXT,
  issueIntegrationKey,
  revokeIntegrationKey,
} from "@/domain/feedback";
import { requireCapability } from "@/domain/identity";
import {
  type ActorContext,
  type DomainError,
  type Result,
  asIntegrationKeyId,
  err,
  notFound,
  ok,
} from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 取りに来るときの鍵を管理する。
 *
 * 平文の値がこの層に現れるのは**発行の戻り値 1 か所だけ**。
 * 一覧にも履歴にも出さないので、「うっかりログに載る」経路が構造上できない。
 *
 * ハッシュの計算は infrastructure が行う。ここは `hashedValue` を受け取る形しか知らない。
 */
export type ManageIntegrationKeysDeps = {
  readonly keys: IntegrationKeyPort;
  readonly ids: IdGeneratorPort;
  /** 平文と、それを潰した値を作る。domain も application も作り方を知らない。 */
  readonly mintSecret: () => Promise<{ readonly plainValue: string; readonly hashedValue: string }>;
  readonly now: () => Date;
};

export type ManageIntegrationKeysInput =
  | { readonly action: "list" }
  | {
      readonly action: "issue";
      readonly label: string;
      readonly scopes: readonly KeyScope[];
      readonly rateLimitPerMinute?: number;
    }
  | { readonly action: "revoke"; readonly id: string };

export type IntegrationKeyRow = {
  readonly id: string;
  readonly label: string;
  readonly scopeLabels: readonly string[];
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
  /** 一度も使われていないときの表示。空欄にしない。 */
  readonly lastUsedText: string;
  readonly revoked: boolean;
  readonly rateLimitPerMinute: number;
};

export type ManageIntegrationKeysOutput = {
  readonly rows: readonly IntegrationKeyRow[];
  /** 発行したときだけ入る。**この 1 回しか返らない。** */
  readonly issuedValue: string | null;
  readonly shownOnceText: string;
  readonly handlingText: string;
  readonly emptyReason: string | null;
};

export function createManageIntegrationKeysUseCase(
  deps: ManageIntegrationKeysDeps,
): UseCase<ManageIntegrationKeysInput, ManageIntegrationKeysOutput> {
  return {
    async execute(
      actor: ActorContext,
      input: ManageIntegrationKeysInput,
    ): Promise<Result<ManageIntegrationKeysOutput, DomainError>> {
      const allowed = requireCapability(actor, "integration_key.manage", "取得用の鍵の管理");
      if (!allowed.ok) return allowed;

      const at = deps.now();
      let issuedValue: string | null = null;

      if (input.action === "issue") {
        const secret = await deps.mintSecret();
        const key = issueIntegrationKey({
          id: asIntegrationKeyId(deps.ids.newId()),
          workspaceId: actor.workspaceId,
          label: input.label,
          hashedValue: secret.hashedValue,
          scopes: input.scopes,
          createdBy: actor.userId,
          at,
          rateLimitPerMinute: input.rateLimitPerMinute,
        });
        if (!key.ok) return key;
        const stored = await deps.keys.issue(actor.workspaceId, key.value);
        if (!stored.ok) return stored;
        // 保存が済んでから平文を返す。先に返すと、保存に失敗したのに
        // 利用者が「使える鍵をもらった」と思って控えることになる。
        issuedValue = secret.plainValue;
      }

      if (input.action === "revoke") {
        const listed = await deps.keys.list(actor.workspaceId);
        if (!listed.ok) return listed;
        const target = listed.value.find((k) => String(k.id) === input.id);
        if (target === undefined) return err(notFound("取得用の鍵", input.id));
        const revoked = revokeIntegrationKey(target, at);
        if (!revoked.ok) return revoked;
        const applied = await deps.keys.revoke(actor.workspaceId, target.id, at);
        if (!applied.ok) return applied;
      }

      const listed = await deps.keys.list(actor.workspaceId);
      if (!listed.ok) return listed;

      const rows: readonly IntegrationKeyRow[] = listed.value.map((k) => ({
        id: String(k.id),
        label: k.label,
        scopeLabels: k.scopes.map((s) => KEY_SCOPE_LABELS[s]),
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
        lastUsedText: k.lastUsedAt === null ? "まだ使われていません。" : "",
        revoked: k.revokedAt !== null,
        rateLimitPerMinute: k.rateLimitPerMinute,
      }));

      return ok({
        rows,
        issuedValue,
        shownOnceText: KEY_SHOWN_ONCE_TEXT,
        handlingText: KEY_HANDLING_TEXT,
        emptyReason:
          rows.length > 0
            ? null
            : "まだ鍵はありません。Claude Code に取りに来てもらう場合だけ発行してください。",
      });
    },
  };
}
