import type { IntegrationKeyPort } from "@/application/ports/feedback";
import type { AuditLogPort } from "@/application/ports/compliance";
import type { IdGeneratorPort } from "@/application/ports/common";
import { auditWriteFailure, buildAuditEntry } from "@/application/audit";
import { KEY_HANDLING_TEXT, KEY_SCOPE_LABELS, KEY_SHOWN_ONCE_TEXT, issueIntegrationKey, revokeIntegrationKey, type KeyScope } from "@/domain/feedback/integration-access";
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
  readonly auditLog: AuditLogPort;
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

      /**
       * 鍵の出し入れを記録する。
       *
       * **平文も、それを潰した値も渡さない。** 記録に残すのは
       * 「どの鍵を・いつ・誰が」だけ。鍵そのものを記録へ入れると、
       * 一度しか見せない作りにした意味が消える。
       *
       * 発行と失効は別の言葉にしてある。事故のときに知りたいのは
       * 「いつ止めたか」で、これを「変えた」の 1 語に混ぜると読み出せない。
       */
      const record = async (
        action: "integration_key.issued" | "integration_key.revoked",
        input: { readonly keyId: string; readonly label: string; readonly scopes: readonly string[] },
        doneAlready: string,
      ): Promise<Result<void, DomainError>> => {
        const entry = buildAuditEntry({ ids: deps.ids, now: deps.now }, actor, {
          action,
          targetType: "integration_key",
          targetId: input.keyId,
          after: { label: input.label, scopes: input.scopes.join(",") },
        });
        if (!entry.ok) return entry;
        const appended = await deps.auditLog.append(entry.value);
        if (!appended.ok) return err(auditWriteFailure(doneAlready, appended.error.details));
        return ok(undefined);
      };

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
        // 記録は保存の後。先に書くと、発行できていない鍵の記録だけが残る。
        const recorded = await record(
          "integration_key.issued",
          { keyId: String(key.value.id), label: input.label, scopes: input.scopes },
          // 鍵は保存されたが、値は一度しか出せないのでここで失うことになる。
          // 「一覧に並ぶが使えない鍵」が残るので、それを隠さず書く
          "鍵は作られて一覧に並びます。ただし値は表示できていないので、この鍵は使えません",
        );
        if (!recorded.ok) return recorded;
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
        const recorded = await record(
          "integration_key.revoked",
          { keyId: String(target.id), label: target.label, scopes: target.scopes },
          "鍵は止まっています",
        );
        if (!recorded.ok) return recorded;
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
