import { type DomainError, domainError } from "./errors";
import { type Result, err, ok } from "./result";
import type { WorkspaceId } from "./ids";

/**
 * テナント境界 (プラットフォーム層 §26.4)。
 *
 * すべてのデータは workspace_id で分離する。
 * 「読み出し時に where を書き忘れる」が最も起きやすい漏洩経路なので、
 * ドメイン側に「所属テナントを名乗る」契約を置き、application 層の
 * ユースケース入口で必ず照合する。
 */
export type TenantScoped = {
  readonly workspaceId: WorkspaceId;
};

/**
 * 実行主体の文脈。ユースケースは必ずこれを第一引数で受け取る。
 * ここに含まれない権限で処理を進めてはならない。
 */
export type ActorContext = {
  readonly workspaceId: WorkspaceId;
  readonly userId: string;
  readonly roles: readonly Role[];
  /** AI サービスアカウントかどうか。原則として公開操作を許可しない (§25)。 */
  readonly isAiServiceAccount: boolean;
  /**
   * この身元を、**何かと照合して確かめてあるか**。
   *
   * 確かめてある: 本人のログイン（合言葉を保存先で照合した）、鍵で入った AI（鍵を照合した）。
   * 確かめていない: 読者（誰でもある）、見本（ログインを解決できなかったときの落ち先）。
   *
   * 「ログインしたか」ではないことに注意。鍵で入った AI は誰もログインしていないが、
   * **どの鍵か**は確かめてある。記録に「鍵: ○○」と残せるのはそのためである。
   * 名前を `signedIn` にすると、この 1 件が名前と合わなくなり、
   * 合わせるために嘘を書くか、分岐をもう 1 つ足すことになる。
   *
   * --- なぜ `userId` だけでは足りないのか ---
   * `userId` は `string` で、「まだログインしていない」を表す値を持たない。
   * そのため読者は `"anonymous"`、ログインを解決できないときの見本は `"u_sample"` という
   * **普通の文字列**を名乗る。文字列として見るかぎり、本物の `u_01H...` と区別が付かない。
   *
   * 区別が付かないと何が起きたか（2026-08-19 実測）。
   * 操作の記録は `createAuditLogEntry()` が「匿名の操作は記録できません」で断ることに
   * なっており、`wasApprovedByHuman()` は「人が承認したこと」を返すことになっていた。
   * どちらも `userId === null` で判定していたが、写す側（`auditActorOf`）は
   * `userId === ""` だけを「無い」と見なしていた。**空文字を作る場所は 1 つも無い。**
   * よって断りは一度も発火せず、未ログインの承認が
   * 「anonymous という人が承認した」として残り、人の承認として数えられていた。
   *
   * 直したあとの形（同日）。**記録を断るのはやめた。**
   * 断ると「誰も押していない」と「押したが記録を断った」が同じ「行が無い」に化ける。
   * 記録は残し、確かめていないことをこの項目の写しとして `AuditActor.identified` と
   * `audit_logs.actor_identified` に残す。人の承認として数えるかどうかは
   * `wasApprovedByHuman()` がその印を見て決める。
   *
   * --- この項目でできること・できないこと ---
   * **できること**: 身元を作る場所が型で漏れなく数え上げられる。項目を必須にしてあるので、
   * 新しい身元を足した人は必ずここを埋める。「ログインしていない身元が増えたのに
   * 変換側の一覧に足し忘れる」という形の抜けが起きない。
   *
   * **できないこと**: 読む側にこの項目を見ることを強制しない。`userId` だけ読んで
   * 素通りする道は残っている。記録へ入る道は `auditActorOf()` の 1 本に絞ってあり、
   * そこを通らずに `AuditActor` を直に組み立てれば、同じ嘘がまた入る。
   * その道は `tests/application/audit-actor-identity.test.ts` が見張っている。
   *
   * **区別できないもの**: 「まだ確かめていない」と「確かめようとしたが保存先が落ちていた」は
   * どちらも `false` になる。後者は `ActorResolution` の `unavailable` として
   * 1 つ下の層では区別が付いているが、`signedInActor()` が `null` へ潰すため
   * ここまで届かない。安全側に倒れる点はどちらも同じだが、**画面に出る文が同じになる**ので、
   * 保存先が落ちているときに利用者はログインし直し続けることになる。
   */
  readonly identified: boolean;
  /**
   * この身元が入ってきた**一回の要求**を指す名前。記録の糸として使う。
   *
   * **省略できる形にしてある。** 身元を組み立てる場所は入口だけではない
   * （定期実行・組み立て時の見本）。そこに嘘の値を埋めさせるより、
   * 「要求の外だから無い」と言えるほうがよい。
   *
   * ただし**断りの記録では糸が必須**である（`DENIAL_ACTIONS`）。
   * ここが無いまま断りを記録しようとした場合は、記録する側が
   * その場で 1 本作る（`src/application/access-denial.ts`）。
   * 作った糸はその 1 件しか結べないが、行が消えるよりはよい。
   */
  readonly requestId?: string | null;
};

/** 権限ロール (プラットフォーム層 §25)。公開権限と編集権限を分ける。 */
export type Role =
  | "owner"
  | "workspace_admin"
  | "brand_manager"
  | "researcher"
  | "writer"
  | "reviewer"
  | "publisher"
  | "analyst"
  | "contributor"
  /**
   * 使い勝手の担当。改善要望を見る・扱いを決める・取得用の鍵を配る、だけ。
   *
   * 記事に関する権限を 1 つも持たない。分けてあるのは、
   * 「利用者の困りごとを預かる人」と「記事を出す人」が同じとは限らないため。
   * ここを `workspace_admin` で代用すると、要望を読ませたいだけの相手に
   * **公開の権限まで渡る**。
   */
  | "feedback_admin"
  | "ai_service_account";

/** 取り出したデータが実行主体のテナントに属するか照合する。 */
export function assertSameTenant<T extends TenantScoped>(
  actor: ActorContext,
  entity: T,
  what: string,
): Result<T, DomainError> {
  if (entity.workspaceId !== actor.workspaceId) {
    // 他テナントの存在を推測させないため、「見つからない」と同じ語調にする。
    return err(
      domainError("TENANT_MISMATCH", `${what} が見つかりません。`, {
        suggestedAction: "ワークスペースを切り替えているか確認してください。",
      }),
    );
  }
  return ok(entity);
}

export function hasRole(actor: ActorContext, ...roles: readonly Role[]): boolean {
  return actor.roles.some((r) => roles.includes(r));
}

export function requireRole(
  actor: ActorContext,
  what: string,
  ...roles: readonly Role[]
): Result<true, DomainError> {
  if (hasRole(actor, "owner") || hasRole(actor, ...roles)) return ok(true);
  return err(
    domainError("FORBIDDEN", `${what} を行う権限がありません。`, {
      suggestedAction: `必要な権限: ${roles.join(" / ")}`,
    }),
  );
}
