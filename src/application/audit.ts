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
 * 確かめていない身元で来ることがある（ログインを解決できなかったとき、読者のとき）。
 * **名前はそのまま移し、確かめていないことは `identified` に移す。**
 * 名前を落とすと、読者が押したのか、ログインを解決できなかった落ち先だったのかが
 * 後から区別できない。前者は日常で、後者は保存先が落ちている徴候である。
 *
 * --- 空文字を見ていた頃のこと（2026-08-19 に直した） ---
 * ここは以前 `actor.userId === ""` を「身元が無い」の印にしていた。
 * ところが **`userId` に空文字を入れる場所は、コードにも検査にも 1 つも無かった**。
 * 実際に来るのは読者の `"anonymous"` と見本の `"u_sample"` で、どちらも空文字ではない。
 * つまりこの分岐は一度も真にならず、`createAuditLogEntry` の
 * 「匿名の操作は記録できません」も、`wasApprovedByHuman()` の人の判定も、
 * 未ログインに対しては働いていなかった。
 *
 * 印が働いていないことは、印の側を読んでも分からない。
 * 印を**立てる場所**を数えて初めて分かる。`identified` を必須の項目にしてあるのは、
 * 身元を作る場所が型で数え上げられ、立て忘れが型検査で止まるようにするためである。
 */
export function auditActorOf(actor: ActorContext): AuditActor {
  return {
    userId: taggedString<"UserId">(actor.userId) as UserId,
    isAiServiceAccount: actor.isAiServiceAccount,
    identified: actor.identified,
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
    /*
     * 糸は**身元と一緒に運ぶ**。入力として各ユースケースに書かせない。
     * 書かせると、書き忘れた入口だけが糸の無い行を積む。
     */
    requestId: actor.requestId ?? null,
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
