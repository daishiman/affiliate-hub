import {
  type AuditLogId,
  type DomainError,
  type Result,
  type UserId,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 監査ログ (プラットフォーム層 §26)。
 *
 * 「誰が・いつ・何を・なぜ」を残す。特に次の 3 つは必ず記録する:
 *   1. 人の承認 (AI が承認していないことを後から証明できるようにする)
 *   2. 公開・取り下げ (読者へ出した内容の履歴)
 *   3. 広告表記・ランキング基準の変更 (規制対応で提出を求められうる)
 *
 * ドメインに置く理由: 「記録する」がアプリケーションの都合ではなく、
 * 業務上の要件そのものだから。実際の保存先は infrastructure の port が担う。
 */
export type AuditAction =
  | "content.created"
  | "content.state_changed"
  | "content.approved"
  | "content.published"
  | "content.unpublished"
  | "content.corrected"
  | "ranking_model.changed"
  | "disclosure.changed"
  | "policy_rule.changed"
  | "affiliate_link.created"
  | "affiliate_link.changed"
  /**
   * 受け取った成果リンクを対象外にした。
   *
   * 受け取り（`created`）と、広告主・商品を決めること（`changed`）は
   * 1 語にまとめてある（差は `after` の状態に出るので、語を分けても情報が増えない）。
   * **対象外だけを分けているのは、理由を必須にするため**（下の `REASON_REQUIRED`）。
   * 捨てた判断は後から必ず問われるうえ、「なぜ捨てたか」は
   * `before` と `after` の差からは読めない。理由の欄にしか残らない。
   */
  | "affiliate_link.rejected"
  | "connector.connected"
  | "connector.disconnected"
  | "member.role_changed"
  | "export.performed"
  /**
   * 配信予定が変わった（入れた・動かした・取り消した）。
   *
   * **3 つを 1 語にしている。** 予約・変更・取り消しは、後から読むときに
   * 知りたいことが同じ（「いつ外へ出る予定になっていたか」）で、
   * 差は `before` / `after` の日時に出る。1 操作 1 語で増やすと、
   * 一覧を読む人が「同じことの別名」を区別できなくなる。
   * 取り消しは `after` が null になるので、語を分けなくても読める。
   */
  | "publication.schedule_changed"
  /**
   * 外部連携の鍵の発行・失効。
   *
   * こちらは 2 語に分ける。生成 AI の鍵（`llm_credential.*`）と同じ理由で、
   * 漏れが疑われたときに「**いつ止めたか**」が言えないと事故対応が始まらない。
   * 発行と失効を 1 語にすると、止めた時刻を差分から読むことになる。
   */
  | "integration_key.issued"
  | "integration_key.revoked"
  /** ブログを作った。消す口が無いので、作られたことだけは必ず残す。 */
  | "site.created"
  /**
   * ブログを作り始めた／作成の段階を 1 つ保存した。
   *
   * **答えの中身は記録に入れない。** 下書きに書かれるのは、そのブログの狙いや
   * 説明文といった、後から画面で読めば済むものである。記録に写しても増える情報が無く、
   * 段階を進めるたびに同じ文章が記録側へ積み上がるだけになる。
   * 残すのは「どの下書きの・どの段階を・誰がいつ保存したか」まで。
   *
   * 段階の保存を**記録から外さなかった**理由。作り始めだけを残すと、
   * 下書きが途中で書き換わったことが誰にも見えない。ブログの設定は
   * 公開後の記事全部に効くので、「いつ誰が変えたか」を言えない状態にしない。
   */
  | "site_draft.started"
  | "site_draft.step_saved"
  /**
   * 成果の実績を人が手で直した。
   *
   * ASP から取り込んだ数字を上書きする操作なので、**理由を必須**にしている
   * （下の `REASON_REQUIRED`）。理由の無い金額の修正は、後から見て
   * 誤りの訂正なのか意図的な操作なのかを区別できない。
   */
  | "conversion.adjusted"
  /**
   * 生成 AI の鍵の登録・失効。
   *
   * **鍵の値は before/after に入らない**（下の `redactSensitive` が落とすが、
   * そもそも詰めない）。残すのは「誰が・どの提供元の鍵を・いつ」までである。
   * 失効を記録するのは、漏れが疑われたときに
   * 「いつ止めたか」が言えないと事故対応が始められないため。
   */
  | "llm_credential.registered"
  | "llm_credential.revoked"
  /**
   * 改善要望が届いた。
   *
   * **本文は記録に入れない。** 要望の本文には、送った人が画面で見ていたものが
   * そのまま書かれる（取引先の名前・金額・個人名）。記録は後から広く読まれる場所で、
   * ここに本文を写すと、要望の側で伏せた情報が記録の側から出てくる。
   * 残すのは「誰が・いつ・どの画面から・どんな種類の要望を出したか」までにする。
   */
  | "feedback.submitted"
  /**
   * 改善要望の対応状況・扱いが変わった。
   *
   * **1 語にまとめている。** 状態を進めることと扱い（対応しない・重複・廃棄）を
   * 決めることは同じ 1 つの口で行うので（`update-feedback-status.ts`）、
   * 語を分けると 1 回の操作が 2 行になり、履歴の行数と操作の回数が合わなくなる。
   * 差は `before` / `after` の状態と扱いに出る。
   */
  | "feedback.status_changed"
  /**
   * 改善要望を指示文として払い出した。
   *
   * **これは中身が外へ出る操作**である。払い出した文面は AI の手元へ渡り、
   * こちらからは追えなくなる。後から「どの要望が・いつ・どの経路で外へ出たか」を
   * 言えるようにしておく必要がある。文面そのものではなく指紋
   * （`promptFingerprint`）を残すのは、同じ文面かどうかだけが判定できればよく、
   * 中身を記録側へ複製する理由が無いため。
   */
  | "feedback.handed_off"
  /**
   * 見せ方の試作を登録した／承認した。
   *
   * **2 語に分ける。** 承認は仕様 §14.5 が人にだけ許している操作で、
   * 後から問われるのは「誰が比較に出してよいと言ったか」である。
   * 登録と 1 語にすると、その問いに差分から答えることになる。
   *
   * 承認に理由を必須にしていないのは、記事の承認（`content.approved`）と違って
   * **この時点では何も外へ出ない**ため。外へ出るのは比較を始めたときで、
   * そこは `loop_run.started` が残す。
   */
  | "variant_spec.drafted"
  | "variant_spec.approved"
  /**
   * 見せ方の比較を、始めた／観測した／判定した／打ち切った。
   *
   * **4 語に分ける。** 配信予定（`publication.schedule_changed`）を 1 語に
   * まとめたのは、後から知りたいことが同じ（いつ外へ出るか）だったからである。
   * こちらは 4 つとも問いが違う。始めた＝いつから読者に 2 通りが出たか、
   * 観測＝どの数字を根拠にしたか、判定＝何を採ったか、打ち切り＝なぜやめたか。
   *
   * 打ち切りだけ理由を必須にしている（下の `REASON_REQUIRED`）。
   * やめた判断は後から必ず問われるうえ、`before` と `after` の差からは読めない。
   */
  | "loop_run.started"
  | "loop_run.observed"
  | "loop_run.concluded"
  | "loop_run.stopped";

/** 操作した主体。AI かどうかを型で残す。後から「人が承認した」を検証するため。 */
export type AuditActor = {
  readonly userId: UserId | null;
  readonly isAiServiceAccount: boolean;
  /** AI の場合のモデル識別子。人の操作なら null。 */
  readonly modelId: string | null;
};

export type AuditLogEntry = {
  readonly id: AuditLogId;
  readonly workspaceId: WorkspaceId;
  readonly action: AuditAction;
  readonly actor: AuditActor;
  /** 対象の種類と ID。文字列で持つ (対象がコンテキストをまたぐため)。 */
  readonly targetType: string;
  readonly targetId: string;
  /** 変更前後。差分が意味を持つ操作だけ入れる。秘密情報は入れない。 */
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  /** なぜその操作をしたか。承認・取り下げ・訂正では必須。 */
  readonly reason: string | null;
  readonly occurredAt: Date;
};

/** 理由の記録が必須の操作。理由なしの承認・取り下げは後から説明できない。 */
const REASON_REQUIRED: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "content.approved",
  "content.unpublished",
  "content.corrected",
  "ranking_model.changed",
  "disclosure.changed",
  "member.role_changed",
  "conversion.adjusted",
  "affiliate_link.rejected",
  "loop_run.stopped",
]);

/**
 * 秘密情報を差分に入れないための遮断。
 *
 * before/after は開発者が自由に詰められるため、ここで機械的に落とす。
 * 「入れないように気をつける」は必ず破られる。
 */
const REDACTED_KEY_PATTERN = /secret|token|password|api_?key|credential|authorization|cookie/i;
export const REDACTED_PLACEHOLDER = "[記録しません]";

export function redactSensitive(
  record: Readonly<Record<string, unknown>> | null,
): Readonly<Record<string, unknown>> | null {
  if (record === null) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = REDACTED_KEY_PATTERN.test(key) ? REDACTED_PLACEHOLDER : value;
  }
  return out;
}

export function createAuditLogEntry(input: {
  id: AuditLogId;
  workspaceId: WorkspaceId;
  action: AuditAction;
  actor: AuditActor;
  targetType: string;
  targetId: string;
  before?: Readonly<Record<string, unknown>> | null;
  after?: Readonly<Record<string, unknown>> | null;
  reason?: string | null;
  occurredAt: Date;
}): Result<AuditLogEntry, DomainError> {
  if (input.targetType.trim() === "" || input.targetId.trim() === "") {
    return err(validationError("監査ログには対象の種類と ID が必要です。", "targetId"));
  }
  if (input.actor.userId === null && !input.actor.isAiServiceAccount) {
    return err(
      validationError("操作した主体が特定できません。匿名の操作は記録できません。", "actor"),
    );
  }
  const reason = input.reason?.trim() ?? "";
  if (REASON_REQUIRED.has(input.action) && reason === "") {
    return err(
      validationError(`${input.action} には理由の記録が必要です。`, "reason"),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    action: input.action,
    actor: input.actor,
    targetType: input.targetType,
    targetId: input.targetId,
    before: redactSensitive(input.before ?? null),
    after: redactSensitive(input.after ?? null),
    reason: reason === "" ? null : reason,
    occurredAt: input.occurredAt,
  });
}

/**
 * 承認が人によって行われたことを、記録から確認する。
 *
 * 公開前の最終確認と、規制対応の説明の両方で使う。
 */
export function wasApprovedByHuman(entries: readonly AuditLogEntry[], targetId: string): boolean {
  return entries.some(
    (e) =>
      e.targetId === targetId &&
      e.action === "content.approved" &&
      !e.actor.isAiServiceAccount &&
      e.actor.userId !== null,
  );
}
