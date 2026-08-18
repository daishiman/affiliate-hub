import type { IdGeneratorPort } from "@/application/ports/common";
import { type AuditAction, type AuditActor, type AuditLogEntry, createAuditLogEntry } from "@/domain/compliance";
import {
  type ActorContext,
  type AuditLogId,
  type DomainError,
  type Result,
  type UserId,
  domainError,
  taggedString,
} from "@/domain/shared";

/**
 * 操作の記録を組み立てる共通部分。
 *
 * --- なぜ「組み立て」だけを共通にするのか ---
 * `deps.auditLog.append()` の**呼び出しは各ユースケースのファイルに残す**。
 * ここへ引き上げて 1 か所にすると読みやすくなるが、
 * `scripts/port-wiring.mjs` は入口から辿れる呼び出しを
 * **同じファイルの中だけ**で数える（別ファイルの補助関数は辿らない）。
 * 引き上げた瞬間、記録を書いている入口が全部「記録していない」に化けて、
 * この検査が守るものが消える。
 *
 * 検査の都合に合わせているのではない。「記録を書いている」ことが
 * **そのファイルを開けば目に入る**ほうが、後から読む人にとっても正しい。
 * よってここに置くのは、入れ物の組み立てと、失敗したときの断り文だけにする。
 */
export type AuditClock = {
  readonly ids: IdGeneratorPort;
  readonly now: () => Date;
};

/**
 * 操作した主体を、記録の形へ移す。
 *
 * 身元が空のまま来ることがある（解決できなかったとき）。
 * **その場合は null にして、`createAuditLogEntry` に断らせる。**
 * ここで適当な名前を埋めると、後から読んだときに嘘を読む。
 */
export function auditActorOf(actor: ActorContext): AuditActor {
  return {
    userId: actor.userId === "" ? null : (taggedString<"UserId">(actor.userId) as UserId),
    isAiServiceAccount: actor.isAiServiceAccount,
    /*
     * どのモデルが動かしたかは、いまの `ActorContext` に入っていない。
     * 分からないものを埋めない（残課題 53）。
     */
    modelId: null,
  };
}

export function buildAuditEntry(
  clock: AuditClock,
  actor: ActorContext,
  input: {
    readonly action: AuditAction;
    readonly targetType: string;
    readonly targetId: string;
    readonly before?: Readonly<Record<string, unknown>> | null;
    readonly after?: Readonly<Record<string, unknown>> | null;
    readonly reason?: string | null;
  },
): Result<AuditLogEntry, DomainError> {
  return createAuditLogEntry({
    id: taggedString<"AuditLogId">(`al_${clock.ids.newId()}`) as AuditLogId,
    workspaceId: actor.workspaceId,
    action: input.action,
    actor: auditActorOf(actor),
    targetType: input.targetType,
    targetId: input.targetId,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    occurredAt: clock.now(),
  });
}

/**
 * 記録を残せなかったときの断り。
 *
 * **「操作の記録に失敗しました」だけを返さない。** それだけだと、
 * 押した人には操作が効いたのかどうかが分からず、もう一度押してよいかも
 * 判断できない。済んだことと残っていることを両方その場で書く。
 *
 * @param doneAlready 「もう済んでいること」を表す一文（句点は付けない）
 */
export function auditWriteFailure(
  doneAlready: string,
  details?: Readonly<Record<string, string | number | boolean | null>>,
): DomainError {
  return domainError(
    "UPSTREAM_UNAVAILABLE",
    `${doneAlready}。ただし、この操作を誰が行ったかの記録を残せませんでした。` +
      "記録が無いままだと、後から「人が確認した」ことを示せません。",
    {
      retryable: true,
      suggestedAction:
        "画面を開き直して、記録が残っているか確認してください。残っていない場合は保存先の状態を確認してください。",
      details,
    },
  );
}
