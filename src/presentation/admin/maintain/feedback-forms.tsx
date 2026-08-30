"use client";

import { type ReactNode, useActionState, useState } from "react";
import {
  FEEDBACK_DISPOSITIONS,
  FEEDBACK_DISPOSITION_LABELS,
  FEEDBACK_STATUSES,
  FEEDBACK_STATUS_LABELS,
} from "@/domain/feedback";
import {
  Button,
  Callout,
  Field,
  FormResult,
  FormValue,
  HumanOnlyForm,
  Select,
  SubSection,
  TextArea,
  ToolForm,
  UI_COPY,
} from "@/presentation/ui";
import { CopyButton } from "../copy-button";
import { changeFeedbackStatusAction, handOffFeedbackAction } from "../feedback-action";
import { INITIAL_FEEDBACK_HANDOFF_STATE, INITIAL_FEEDBACK_STATUS_STATE } from "../feedback-state";

/**
 * 改善要望を扱うための操作一式。
 *
 * --- なぜ「コピー」で終わらせないのか ---
 *
 * 指示文をコピーしただけでは、誰かが持って行ったことが記録に残らない。
 * 記録が無いと、同じ要望が二重に着手されても誰も気づけない。
 * そのため下読み（コピーだけ）と払い出し（記録が残る）を**別のボタン**にし、
 * どちらを押したかが画面の文にも出るようにしてある。
 *
 * --- 文字列を必ず画面に出す理由 ---
 *
 * 書き込み用のクリップボードは、ブラウザや設定によっては使えない。
 * 押しても何も起きないボタンを作らないため、文面そのものも常に画面へ出し、
 * 手で選んでコピーできる状態を保つ。
 * ボタンそのものは `copy-button.tsx` にある（他の画面でも同じ振る舞いにするため）。
 */

/**
 * まとめて渡す。
 *
 * 選ぶための行そのものは画面側（サーバー側）が描く。ここは囲いと結果だけを持つ。
 * 表を丸ごとこちらへ持ってくると、一覧の描画が全部ブラウザ側の仕事になり、
 * 件数が増えたときに最初の 1 画面が出るまでの時間が伸びる。
 *
 * 1 件だけを渡す画面（詳細）は `ids` を渡す。画面側が隠し欄を書くと、
 * 送る欄の名前 (`ids`) を画面の数だけ書き写すことになり、
 * 名前を変えた日に片方だけが黙って送られなくなる。
 */
export function FeedbackHandoffForm({
  ids,
  children,
}: {
  /** 選ばせずに決め打ちで渡す相手。詳細画面から 1 件だけ渡すときに使う。 */
  readonly ids?: readonly string[];
  readonly children?: ReactNode;
}) {
  const [state, action, pending] = useActionState(handOffFeedbackAction, INITIAL_FEEDBACK_HANDOFF_STATE);

  return (
    <HumanOnlyForm
      action={action}
      reason={
        "下読み（preview）と払い出し（handoff）が 1 つの選択を共有していて、intent で分かれる。" +
        "`ToolForm` は道具を 1 つしか名乗れないので、片方を名乗ると、名乗らなかった側が" +
        "「AI からは見えないのに同じ欄から押せる」形で残る。渡す側の道具は目録の " +
        "hand_off_feedback が REST / MCP から担っており、画面が二重に名乗る必要はない。"
      }
    >
      {ids?.map((id) => (
        <FormValue key={id} name="ids" value={id} />
      ))}
      {children}

      <div>
        <Button type="submit" name="intent" value="preview" tone="secondary" busy={pending}>
          選んだものの指示文を見る
        </Button>
        <Button type="submit" name="intent" value="handoff" tone="primary" busy={pending}>
          {UI_COPY.feedback.handoffMarkDone}
        </Button>
      </div>

      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}

      {state.status === "done" ? (
        <>
          <Callout
            tone={state.previewOnly ? "info" : "success"}
            title={state.message}
            reason={state.idempotencyText}
          />
          {state.skipped.map((s) => (
            <Callout
              key={s.reportId}
              tone="warn"
              title={`${s.reportId} は渡せませんでした`}
              reason={s.reason}
            />
          ))}
          {state.prompts.map((p) => (
            // 見出し＋添え書きは `SubSection` が持つ。素の h3 を書くと、
            // 見出しの段（h2 の 1 つ下）を画面ごとに選び直せてしまう。
            <SubSection
              key={p.reportId}
              title={p.reportId}
              lead={`ひな型の版: ${p.templateVersion}`}
            >
              <CopyButton label={UI_COPY.feedback.handoffCopyPrompt} text={p.text} />
              <textarea readOnly value={p.text} rows={12} aria-label={`${p.reportId} の指示文`} />
            </SubSection>
          ))}
        </>
      ) : null}
    </HumanOnlyForm>
  );
}

/** 1 件分の対応状況を変える。見送りには理由が要る（判定は domain 側）。 */
export function FeedbackStatusForm({
  id,
  currentStatus,
}: {
  readonly id: string;
  readonly currentStatus: string;
}) {
  const [state, action, pending] = useActionState(changeFeedbackStatusAction, INITIAL_FEEDBACK_STATUS_STATE);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="update_feedback_status"
      toolDescription="改善要望 1 件の対応状況を変える"
    >
      <FormValue name="id" value={id} />
      <FormValue name="intent" value="status" />
      <p>いまは「{currentStatus}」です。</p>

      <Select
        name="status"
        label="変更後の状態"
        value={status}
        onValueChange={setStatus}
        options={FEEDBACK_STATUSES.map((s) => ({
          value: s,
          label: FEEDBACK_STATUS_LABELS[s],
        }))}
        placeholder="選んでください"
        error={state.field === "status" ? state.message : null}
        hint="間違えて進めたときは、ここから戻せます。"
      />
      <Field
        name="note"
        label="メモ"
        optional
        value={note}
        onValueChange={setNote}
        error={state.field === "note" ? state.message : null}
        hint="「見送り」にするときは理由が要ります。理由が無いと、後から読んだ人には検討した結果なのか放置なのか分かりません。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="変えています">
        この状態にする
      </Button>

      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * 扱いを決める・取り消す。
 *
 * 取り消しを同じ場所に置いてある。**決めた側と戻す側が離れていると、
 * 「戻せる」と書いてあっても戻し方が見つからない。**
 */
export function FeedbackDispositionForm({
  id,
  dispositionLabel,
}: {
  readonly id: string;
  readonly dispositionLabel: string | null;
}) {
  const [state, action, pending] = useActionState(changeFeedbackStatusAction, INITIAL_FEEDBACK_STATUS_STATE);
  const [kind, setKind] = useState("");
  const [reason, setReason] = useState("");
  const [duplicateOf, setDuplicateOf] = useState("");

  if (dispositionLabel !== null) {
    return (
      <ToolForm
        action={action}
        toolName="update_feedback_status"
        toolDescription="改善要望に決めた扱いを取り消して、決める前の状態に戻す"
      >
        <FormValue name="id" value={id} />
        <FormValue name="intent" value="undo" />
        <p>
          いまの扱いは「{dispositionLabel}
          」です。取り消すと、扱いを決める前の状態に戻ります。 決めた記録は履歴に残ります。
        </p>
        <Button type="submit" tone="secondary" busy={pending} busyLabel="戻しています">
          扱いを取り消して元に戻す
        </Button>
        {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
        {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
      </ToolForm>
    );
  }

  return (
    <ToolForm
      action={action}
      toolName="update_feedback_status"
      toolDescription="改善要望の扱い（採用・見送り・重複など）を理由付きで決める"
    >
      <FormValue name="id" value={id} />
      <FormValue name="intent" value="dispose" />

      <Select
        name="disposition"
        label="扱い"
        value={kind}
        onValueChange={setKind}
        options={FEEDBACK_DISPOSITIONS.map((d) => ({
          value: d,
          label: FEEDBACK_DISPOSITION_LABELS[d],
        }))}
        placeholder="選んでください"
        error={state.field === "disposition" ? state.message : null}
        hint="どれを選んでも、あとから取り消せます。要望そのものは消えません。"
      />
      <TextArea
        name="reason"
        label="そう扱う理由"
        value={reason}
        onValueChange={setReason}
        error={state.field === "reason" ? state.message : null}
        hint="半年後に読み返す人が、判断をやり直せるだけのことを書いてください。"
      />
      {kind === "duplicate" ? (
        <Field
          name="duplicateOf"
          label="どの要望と同じか"
          value={duplicateOf}
          onValueChange={setDuplicateOf}
          error={state.field === "duplicateOf" ? state.message : null}
          hint="一覧に出ている番号を入れてください。"
        />
      ) : null}

      <Button type="submit" tone="secondary" busy={pending} busyLabel="決めています">
        この扱いにする
      </Button>

      <FormResult state={state} />
    </ToolForm>
  );
}

/**
 * 取りに来てもらうための案内。
 *
 * **鍵の値そのものはここに出さない。** 出すと、この画面を開ける人全員が
 * その鍵を使えることになる。コマンドは環境変数を指す形にしてあり、
 * 値は利用者が自分の手元で入れる。
 */
export function FeedbackPullCommand() {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const command = `curl -H "Authorization: Bearer $AFFILIATE_HUB_FEEDBACK_KEY" ${origin}/api/feedback/pending`;

  return (
    <>
      <CopyButton label={UI_COPY.feedback.handoffCopyCommand} text={command} />
      <pre>{command}</pre>
      <p>
        鍵はご自身の手元（ターミナル）で環境変数に入れてください。ここへ貼り付けたり、
        ファイルに書いたりしないでください。
      </p>
    </>
  );
}
