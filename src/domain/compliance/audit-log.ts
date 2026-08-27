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
  /**
   * 記事の中身（題名・本文・要約）を直した。
   *
   * **`content.state_changed` とは別。** あちらは進行の位置が動いたことで、
   * 本文は変わっていない。こちらは本文が変わったことで、位置は動いていない
   * （承認済みを直したときだけ、承認が外れて位置も戻る）。
   * 1 語にまとめると、「承認された文章」と「今ある文章」が
   * 同じものかどうかを履歴から判定できなくなる。
   */
  | "content.changed"
  | "content.state_changed"
  | "content.approved"
  | "content.published"
  | "content.unpublished"
  | "content.corrected"
  | "ranking_model.changed"
  | "disclosure.changed"
  | "policy_rule.changed"
  /**
   * SEO/AI 指針の**出典**を登録した／確認日を更新した。
   *
   * `policy_rule.changed`（表記のきまりを変えた）とは別の語にしている。
   * あちらは「何を書いてよいか」の決まりそのものが動いたこと。
   * こちらは**決まりの根拠として何を見たか**が動いたことで、
   * 決まりは 1 文字も変わっていない。1 語にまとめると、
   * 「きまりが変わった」の一覧に出典の確認作業が混ざり、
   * 規制対応で提出を求められたときにきまりの変更履歴が読めなくなる。
   *
   * **確認日の更新を別の語にしている**のは、`registered` と
   * 意味が違うからではなく、`after` の差から読めないからである。
   * 再確認は中身が 1 つも変わらない（確認日だけが動く）ので、
   * 語を 1 つにすると「登録したのか、見に行っただけなのか」を
   * 履歴から区別できない。90 日ごとの確認が実際に行われたかは
   * この語の並びでしか言えない。
   */
  | "guideline_reference.registered"
  | "guideline_reference.rechecked"
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
   * 配信予定の**中身**が変わった（送る文面・送り先の媒体）。
   *
   * 上の 1 語（いつ外へ出るか）とは問いが違う。こちらは
   * 「外へ出たものは、どの媒体へ向けた、どの文面だったか」を問われる。
   * 送信済みのものは直せないので、この語が残るのは送信前だけである。
   */
  | "publication.changed"
  /**
   * 外部連携の鍵の発行・失効。
   *
   * こちらは 2 語に分ける。生成 AI の鍵（`llm_credential.*`）と同じ理由で、
   * 漏れが疑われたときに「**いつ止めたか**」が言えないと事故対応が始まらない。
   * 発行と失効を 1 語にすると、止めた時刻を差分から読むことになる。
   */
  | "integration_key.issued"
  | "integration_key.revoked"
  /** ブログを作った。 */
  | "site.created"
  /**
   * ブログの設計図を直した／ブログを取り下げた。
   *
   * **2 語に分ける。** 直しは「いつからその方針だったか」を問われ、
   * 取り下げは「なぜ消したか」を問われる。後者は `before` と `after` の差からは
   * 読めない（`after` が無い）ので、理由の欄にしか残らない。
   * だから取り下げだけ理由を必須にしている（下の `REASON_REQUIRED`）。
   */
  | "site.changed"
  | "site.deleted"
  /**
   * 商品を登録した／直した／消した。
   *
   * 記事（`content.*`）と揃えて 3 語にする。商品は順位表と比較表の入力なので、
   * 「いつ仕様が変わったか」が言えないと、過去の順位が正しかったかを検証できない。
   * 消したものだけ理由を必須にする理由はブログと同じ。
   */
  | "product.created"
  | "product.changed"
  | "product.deleted"
  /**
   * 記事を消した。
   *
   * 取り下げ（`content.unpublished`）とは別。取り下げは読者から見えなくすることで、
   * 記事そのものは残る。こちらは本文ごと無くなるので、後から中身を確かめられない。
   * 区別しないと、「消えている記事」がどちらの理由で消えたか判定できなくなる。
   */
  | "content.deleted"
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
  | "loop_run.stopped"
  /**
   * サイト網の節点を足した／直した／外した。
   *
   * ブログそのもの（`site.*`）とは別の語にしている。あちらは
   * 「そのブログの中身がどう変わったか」で、こちらは
   * 「ブログどうしの上下関係がどう変わったか」である。1 語にまとめると、
   * どの親子関係をいつ変えたかを履歴から追えない。
   *
   * 外したものだけ理由を必須にしている。有効な子がある親の削除は
   * 全体を拒否し、子を孤立させた成功と監査記録は作らない。
   */
  | "site_network.created"
  | "site_network.changed"
  | "site_network.deleted"
  | "site_network.restored"
  /**
   * ブログの見た目の枠・帯の設定が変わった。
   *
   * **1 語にまとめている。** ヘッダー・サイドバー・フッターの枠と
   * トップの帯は、後から読むときの問いが同じ（「そのとき読者に何がどの順で見えていたか」）で、
   * 差は `before` / `after` に出る。部位ごとに語を分けると、
   * 一度の並べ替えが 4 行になり、履歴の行数と操作の回数が合わなくなる。
   */
  | "blog_layout.changed"
  /**
   * 配信部品（RSS・sitemap・機械可読の要約など）の入切が変わった。
   *
   * 見た目の枠（`blog_layout.changed`）と分けているのは、**外へ出るものだから**である。
   * 枠は読者が来たときにだけ見えるが、こちらは検索や AI が取りに来る口で、
   * 切った瞬間から外側の索引が古くなる。「いつ止めたか」は差分からは読めても、
   * 枠の変更に埋もれると探せない。
   */
  | "blog_delivery.changed"
  | "blog_delivery.checked"
  /**
   * ブログ記事を作った／直した／消した。
   *
   * 生成の流れに乗る記事（`content.*`）とは別の語にしている。あちらは
   * 下書き→校正→承認→公開の位置を持ち、承認の履歴が問われる。
   * こちらは読者に見える面の記事で、問われるのは版面（T1–T4）と
   * 必要な部品が揃っていたかである。1 語にまとめると、
   * 承認を通っていない記事が承認済みの一覧に混ざる。
   */
  | "blog_article.created"
  | "blog_article.changed"
  | "blog_article.deleted"
  | "blog_article.restored"
  /**
   * 固定ページ（運営者情報・各種方針など 8 種）を保存／論理削除／復元した。
   *
   * 削除だけ理由を必須にする。行と本文は残り、`blog_page.restored` の
   * 明示操作で元の ID・URL・内容へ戻す。通常保存で暗黙に復活させない。
   */
  | "blog_page.changed"
  | "blog_page.deleted"
  | "blog_page.restored"
  /** ブランドタグを保存した／消した。 */
  | "blog_tag.changed"
  | "blog_tag.deleted"
  /**
   * 読者が付けた評価を伏せた／戻した。
   *
   * **消す語 (`*.deleted`) を作っていない。** 票は行として残し、印だけ付け替える。
   * 消す形にすると「伏せた」と「最初から無かった」が同じ姿になり、
   * 伏せた判断そのものを後から確かめられない。
   *
   * **伏せると戻すを 2 語に分ける。** どちらも `before`/`after` に印の差は出るが、
   * 一覧を「伏せた操作だけ」で読みたい場面（読者の書き込みを見えなくした回数を
   * 数える、まとめて見直す）が実際にあり、1 語だと差分を全部開くまで数えられない。
   */
  | "blog_rating.hidden"
  | "blog_rating.shown";

/** 操作した主体。AI かどうかを型で残す。後から「人が承認した」を検証するため。 */
export type AuditActor = {
  readonly userId: UserId | null;
  readonly isAiServiceAccount: boolean;
  /** AI の場合のモデル識別子。人の操作なら null。 */
  readonly modelId: string | null;
  /**
   * この身元を、**何かと照合して確かめてあるか**（`ActorContext.identified` の写し）。
   *
   * 確かめてある: 本人のログイン、鍵で入った AI。
   * 確かめていない: 読者（`anonymous` は誰でもある）、見本（ログインを解決できなかった落ち先）。
   *
   * **`userId` の有無から推測しない。列として持つ理由は `isAiServiceAccount` と同じ。**
   * 確かめていない身元にも名前は付いている（`anonymous` / `u_sample`）ので、
   * 名前があることは確かめたことを意味しない。推測にすると、
   * 読者が押した操作を後から「人が確認した」と読んでしまう。
   *
   * **この印が false でも記録は残す。** 残さないと、
   * 「誰も押していない」と「押したが記録を断った」が後から区別できなくなる。
   * 区別を付けるのは記録する / しないではなく、この印である。
   */
  readonly identified: boolean;
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
  // 消す操作。復元可能な対象も通常表示・公開から外す動機は差分だけで読めない。
  "site.deleted",
  "product.deleted",
  "content.deleted",
  "site_network.deleted",
  "blog_article.deleted",
  "blog_page.deleted",
  "blog_tag.deleted",
  /*
   * 読者が書いたものを見えなくする／戻す操作。行は消えないので `before`/`after` に
   * 印の差は残るが、**なぜそう判断したかは差からは読めない。** 理由の欄にしか残らない。
   * 戻す側も必須にしているのは、「伏せたのを誰がどんな理由で戻したか」が
   * 言えないと、伏せた判断が黙って覆せることになるため。
   */
  "blog_rating.hidden",
  "blog_rating.shown",
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
  /*
   * **確かめていない身元でも断らない（2026-08-19 に変えた）。**
   *
   * ここは以前「操作した主体が特定できません。匿名の操作は記録できません。」で
   * 断っていた。ただし断る条件は `userId === null` で、`auditActorOf` が
   * null を作るのは `actor.userId === ""` のときだけだった。空文字を入れる場所は
   * 1 つも無かったので、この断りは**一度も働いていなかった**。
   *
   * 印（`identified`）を入れて初めて働くようになったが、そこで断ると
   * 読者や見本の身元で通っていた操作が全部止まる。止めるのが正しい場面もあるが、
   * 記録を断ることは**操作を断ること**とは別で、ここは記録の側である。
   * 残さないほうが危ない——「誰も押していない」と「押したが記録を断った」が
   * 同じ「行が無い」に化ける。
   *
   * よって記録は残し、確かめていないことは `actor.identified` に残す。
   * 「人が承認した」を数えるのは `wasApprovedByHuman()` で、そちらが印を見る。
   */
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
 *
 * 3 つを同時に満たすものだけを数える:
 *   1. AI の代行ではない（`isAiServiceAccount`）
 *   2. 身元に名前が付いている（`userId !== null`）
 *   3. **その名前を照合して確かめてある**（`identified`）
 *
 * 3 が要るのは、確かめていない身元にも名前が付いているからである
 * （読者は `anonymous`、見本は `u_sample`）。2 だけで数えると、
 * 誰でもない人が押した承認が「人が承認した」に化ける。
 */
export function wasApprovedByHuman(entries: readonly AuditLogEntry[], targetId: string): boolean {
  return entries.some(
    (e) =>
      e.targetId === targetId &&
      e.action === "content.approved" &&
      !e.actor.isAiServiceAccount &&
      e.actor.userId !== null &&
      e.actor.identified,
  );
}
