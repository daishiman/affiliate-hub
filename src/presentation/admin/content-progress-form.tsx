"use client";

import { useActionState, useState } from "react";
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

  const choices = nextStates.filter((n) => !n.humanOnly);

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
          <Button type="submit" tone="primary" disabled={pending || to === ""}>
            {pending ? "進めています…" : "この段階へ進める"}
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
