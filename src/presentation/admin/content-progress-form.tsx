"use client";

import { useActionState, useState } from "react";
import { type ContentState, isUnpublishing } from "@/domain/authoring";
import { Button, Callout, Select, TextArea, ToolForm } from "@/presentation/ui";
import { advanceContentStateAction, approveContentAction } from "./content-progress-action";
import { INITIAL_CONTENT_PROGRESS_STATE } from "./content-progress-state";

export type ContentNextState = {
  readonly state: string;
  readonly label: string;
  readonly humanOnly: boolean;
};

/**
 * 記事を次の段階へ進める欄。
 *
 * **進める先の一覧は受け取ったものをそのまま出す。** ここで並べ直したり
 * 足したりすると、押せるのに通らないボタンができる（判断は domain の遷移表だけ）。
 *
 * 承認・公開予約・公開は、この選択肢に**出さない**。
 * 段階だけを動かすと、かんばんは「承認済み」なのに記事の中身は未承認、という
 * 同じ 1 本について 2 つの答えが見える状態になる。承認は下の専用のボタン、
 * 公開予約は配信の欄から行う（どちらも中身と段階の両方を動かす）。
 */
export function AdvanceContentStateForm({
  variantId,
  from,
  nextStates,
}: {
  readonly variantId: string;
  readonly from: string;
  readonly nextStates: readonly ContentNextState[];
}) {
  const [state, action, pending] = useActionState(
    advanceContentStateAction,
    INITIAL_CONTENT_PROGRESS_STATE,
  );
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const choices = nextStates.filter((n) => !n.humanOnly);
  /*
   * いま選んでいるのが「取り下げ」か。
   *
   * 判断はドメインの `isUnpublishing` に聞く。**画面側で条件を書き直さない。**
   * ここに `to === "ARCHIVED" && from === "PUBLISHED"` と書くと、
   * 公開中の段階（MONITORING / REFRESH_DUE）が増えた日に、
   * **画面は理由欄を出さないのにユースケースは理由を要求する**状態になる。
   * 押しても断られ続けて、理由の書きようが無い画面ができる。
   */
  const unpublishing = isUnpublishing(from as ContentState, to as ContentState);

  return (
    <ToolForm
      action={action}
      toolName="advance_content_state"
      toolDescription="記事の段階を次へ進める"
    >
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="from" value={from} />

      {choices.length === 0 ? (
        // 空の選択肢を置かない。押せない理由が書いていないと、故障に見える。
        <Callout
          tone="info"
          reason="この段階から進める先はありません。承認・公開予約・公開は、下の承認と配信の欄から行います。"
        />
      ) : (
        <>
          <Select
            name="to"
            label="次の段階"
            value={to}
            onValueChange={setTo}
            options={choices.map((n) => ({ value: n.state, label: n.label }))}
            placeholder="選んでください"
            toolParamDescription="進める先の段階（COMPLIANCE_REVIEW / ARCHIVED など）"
          />

          {/*
            取り下げのときだけ理由を聞く。
            **常に出さない**のは、没にする操作（まだ誰の目にも触れていない記事を
            片付ける）にまで理由を書かせると、書く手が止まって
            「片付けない」ほうが楽になるからである。
            空欄でも送れるようにしてあるのは承認の欄と同じ理由で、
            断る文面をユースケース側の 1 か所に置くため。
          */}
          {unpublishing ? (
            <TextArea
              name="reason"
              label="取り下げの理由"
              value={reason}
              onValueChange={setReason}
              rows={3}
              hint="読者が見ていた記事を引っ込めます。なぜ引っ込めるのかを書いてください。この文は操作の記録に残ります。"
              toolParamDescription="なぜ読者へ出した記事を取り下げるか。操作の記録に残ります。"
            />
          ) : null}

          <Button type="submit" tone="primary" disabled={pending || to === ""}>
            {pending ? "進めています…" : unpublishing ? "この記事を取り下げる" : "この段階へ進める"}
          </Button>
        </>
      )}

      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
    </ToolForm>
  );
}

/**
 * 承認するボタン。
 *
 * 進める操作と分けてあるのは、承認が**人にしかできない**唯一の操作だから。
 * 段階の選び直しと同じ見た目にすると、選択肢の 1 つとして押される。
 */
export function ApproveContentForm({ variantId }: { readonly variantId: string }) {
  const [state, action, pending] = useActionState(
    approveContentAction,
    INITIAL_CONTENT_PROGRESS_STATE,
  );
  const [reason, setReason] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="approve_content"
      toolDescription="内容を確認した人が、この記事を承認する"
    >
      <input type="hidden" name="variantId" value={variantId} />

      {/*
        理由を必須にしているのは、承認の記録に残すため。
        空欄でも送れるようにしてあるのは、断る文面をユースケース側の
        1 か所に置くため（画面でも断ると、AI から呼んだときと言うことが変わる）。
      */}
      <TextArea
        name="reason"
        label="承認の理由"
        value={reason}
        onValueChange={setReason}
        rows={3}
        hint="何を確認したのかを書いてください。この文は操作の記録に残り、後から「人が確認した」ことの説明になります。"
        toolParamDescription="なぜ承認してよいと判断したか。操作の記録に残ります。"
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "承認しています…" : "内容を確認したので承認する"}
      </Button>

      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
    </ToolForm>
  );
}
