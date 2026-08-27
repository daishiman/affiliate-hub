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
  /**
   * ブランドを作った／直した。
   *
   * **1 語にしている。** 差は `before` が `null` かどうかに出るので、
   * 語を分けても読める情報が増えない（成果リンクの `created` / `changed` と同じ扱い）。
   *
   * 記録する理由は、ここが**公開を止める場所**だからである。
   * 運営者の表示名か問い合わせ先が消えると、そのブランドの記事は
   * 全部公開できなくなる（`missingPublishReadiness`）。
   * 「昨日まで出せていたのに今日は出せない」の答えが、この行にしか無い。
   */
  | "brand.changed"
  /**
   * 作業場所の設定（名前・契約の区分・時間帯・通貨）を直した。
   *
   * 契約の区分はブランド数・ブログ数・生成回数の上限そのもので、
   * 下げると**作れていたものが作れなくなる**。
   * 時間帯を動かすと、予約済みの投稿が出る時刻がまとめてずれる。
   * どちらも画面の見た目は変わらないので、行が無いと原因に辿り着けない。
   */
  | "workspace.changed"
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
  /** 予約workerが外部送信の成功・失敗・再試行状態を変えた。 */
  | "publication.delivery_changed"
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
   * 提携先（ASP アカウント）を登録した／直した／止めた。
   *
   * **1 語にしている。** 差は `before` が `null` か、`after.disabled` かに出る。
   *
   * 記録する理由は、ここが**収益の出どころの名寄せ**だからである。
   * 提携先を止めると、その下の提携条件を使うリンクが成果を計上しなくなる。
   * 「先月まで入っていた成果が今月ゼロ」の答えが、この行にしか無い。
   *
   * **接続情報の値は入らない。** 差分に詰めるのは保管先の名前が
   * 登録済みかどうか（真偽）までで、`credential` を含む鍵は
   * `redactSensitive` が落とす前に、そもそも詰めない。
   */
  | "affiliate_account.changed"
  /**
   * 提携条件（広告主ごとのプログラム）を登録した／直した／終了にした。
   *
   * 掲載してよい書き方の条件（`restrictions`）がここに入る。文章なので
   * 機械では判定できず、**守れているかを確かめられるのは人だけ**である。
   * 条件が黙って書き換わると、規約違反の記事が出たときに
   * 「いつからその条件だったか」を誰も言えなくなる。
   */
  | "affiliate_program.changed"
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
   * 改善要望の技術診断を、保持期限の満了で消した。
   *
   * **人が押した操作ではない。** 定期実行（cron）が消す。それでも記録するのは、
   * 「なぜ 90 日前の要望に診断が付いていないのか」を後から説明できる場所が
   * ここしか無いためである。行が無ければ、**消したのか、最初から付いていな
   * かったのか、消し損ねたのか**が区別できない。
   *
   * 残すのは作業場所ごとの件数と期限の日数までにする。どの要望のどの診断を
   * 消したかを写すと、消したはずの中身が記録の側へ残る。
   */
  | "feedback.diagnostics_purged"
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
   * 権限が足りずに断った。
   *
   * **語が無かったこと自体が穴だった。** 断りは「何も起きなかった」ように見えるが、
   * 実際には誰かが取り返しのつかない操作（公開・削除）を叩いている。
   * 行が無いと、**試されていないこと**と**試されて止めたこと**が区別できない。
   * 後者は次に起こることが違う（役の付け間違いか、あるいは侵入の途中である）。
   *
   * `access.cross_workspace_blocked` と分けてあるのは、後から問われることが違うため。
   * こちらは「誰に何の権限を渡すべきだったか」で、あちらは「越境を試した者がいたか」である。
   * 1 語にまとめると、日常の付け忘れと侵入の兆候が同じ一覧に溶ける。
   *
   * 規範: 確定済み auth 章 AWS-ACC-04（actor / workspace / action / result を残す）
   */
  | "access.denied"
  /**
   * 別の作業場所のものへ触ろうとして断った。
   *
   * **外へ返す本文は「対象が見つかりません。」に潰す**（`maskExistence`）。
   * 潰した詳細——どの作業場所の何を指したのか——が残る場所はここしか無い。
   * 潰しっぱなしにすると、攻撃側だけが自分の試行を知っていて、
   * 守る側は 1 件も知らない状態になる。
   *
   * 規範: 確定済み auth 章 AWS-ACC-02（拒否は request ID 付きで監査に残る）
   */
  | "access.cross_workspace_blocked";

/**
 * 断りを表す語。
 *
 * **この集合に入る語は、`requestId` 無しでは記録できない**（下の `createAuditLogEntry`）。
 * 拒否は 1 件ずつでは意味を持たない。「同じ要求の中で何度断られたか」「同じ相手が
 * どの入口を順に叩いたか」を並べて初めて、付け忘れと総当たりが見分けられる。
 * 並べるための糸が request ID で、糸の無い行は後から結び直せない。
 */
export const DENIAL_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  "access.denied",
  "access.cross_workspace_blocked",
]);

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
  /**
   * この操作が入ってきた**一回の要求**を指す名前。
   *
   * **省略できる項目にしなかった。** 省略できる形にすると、埋める場所を
   * 足し忘れても型検査が黙る。断りの記録は糸が無いと役に立たないので、
   * 「入れない」を選ぶときも `null` と書いて選ばせる。
   *
   * 値が `null` になるのは、要求の外で起きた操作（定期実行など）だけである。
   * 断りの語（`DENIAL_ACTIONS`）では `null` を許さない。
   */
  readonly requestId: string | null;
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
  // 消す操作。取り消せないうえ、`after` が無いので差分から動機が読めない。
  "site.deleted",
  "product.deleted",
  "content.deleted",
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
  requestId?: string | null;
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
  const requestId = input.requestId?.trim() ?? "";
  if (DENIAL_ACTIONS.has(input.action) && requestId === "") {
    /*
     * 断りだけは request ID を必須にする。
     *
     * 通した操作は、対象そのもの（記事・商品）を糸にして後から辿れる。
     * 断った操作には対象が無い回がある（そもそも取れなかった、権限が無かった）。
     * 糸を要求しないと、**辿れない行だけが積み上がる**。
     */
    return err(
      validationError(`${input.action} の記録には request ID が必要です。`, "requestId"),
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
    requestId: requestId === "" ? null : requestId,
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
