"use client";

import { useActionState, useState } from "react";
import { KEY_SCOPES, KEY_SCOPE_LABELS } from "@/domain/feedback";
import { Button, Callout, CheckboxGroup, Field, FormValue, HumanOnlyForm } from "@/presentation/ui";
import { manageIntegrationAccessAction } from "../feedback-action";
import { INITIAL_INTEGRATION_ACCESS_STATE } from "../feedback-state";

/**
 * 鍵の発行と失効を AI から呼べなくしている理由。`HumanOnlyForm` が要求する。
 *
 * ここを `ToolForm` にすると、**AI が自分の使う鍵を自分で発行できる**ことになる。
 * 発行された値は 1 度だけ画面に返るので、AI が呼べば AI がその値を読む。
 * 権限の範囲を自分で決められる主体は、権限の外へ出る手段を持つのと変わらない。
 */
const HUMAN_ONLY_REASON =
  "鍵の発行は権限そのものを作る操作で、発行された値は 1 度だけ呼び出し元へ返る。" +
  "AI から呼べると、AI が自分の権限を自分で発行し、その値を読めることになる。" +
  "失効も同じ経路にあるため、片方だけを人に限っても意味を成さない。";

/**
 * 取りに来るときの鍵を発行する・失効させる。
 *
 * --- 発行した値をこの部品が持ち続けない ---
 *
 * 値は結果として 1 度だけ返り、画面の状態にだけ載る。控えて画面を離れれば消える。
 * 「あとでもう一度見られる」形にすると、その置き場所が新しい漏れ口になる。
 *
 * --- 失効を「消す」にしない ---
 *
 * 失効した鍵も一覧に残す。消すと、履歴の「どの鍵で取ったか」が
 * 名前の無い識別子だけになり、後から誰の取得だったかをたどれなくなる。
 */
export function IssueIntegrationAccessForm() {
  const [state, action, pending] = useActionState(
    manageIntegrationAccessAction,
    INITIAL_INTEGRATION_ACCESS_STATE,
  );
  const [label, setLabel] = useState("");
  const [scopes, setScopes] = useState<readonly string[]>(["read"]);

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="intent" value="issue" />

      <Field
        name="label"
        label="この鍵の名前"
        value={label}
        onValueChange={setLabel}
        error={state.field === "label" ? state.message : null}
        hint="何に使う鍵かを書いてください（例: 自分の手元の Claude Code）。分からない名前の鍵は、後から失効させてよいか判断できません。"
      />
      <CheckboxGroup
        name="scopes"
        label="この鍵でできること"
        options={KEY_SCOPES.map((s) => ({
          value: s,
          label: KEY_SCOPE_LABELS[s],
        }))}
        selected={scopes}
        onSelectedChange={setScopes}
        error={state.field === "scopes" ? state.message : null}
        hint="増やすほど、漏れたときにできることが増えます。読むだけで足りるなら読むだけにしてください。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="発行しています">
        鍵を発行する
      </Button>

      {state.issuedValue === null ? null : (
        <>
          <Callout tone="warn" title="いま控えてください" reason={state.message} />
          {/* 選んでコピーできる形で出す。読み上げのために何の値かを名前で伝える。 */}
          <output aria-label="発行した鍵の値">{state.issuedValue}</output>
          <p>
            鍵はご自身の手元（ターミナル）で環境変数に入れてください。
            ここへ貼り付け直したり、ファイルに書いたりしないでください。
          </p>
        </>
      )}
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}
    </HumanOnlyForm>
  );
}

/** 1 本を失効させる。押した先で何が起きるかを、押す前に書いておく。 */
export function RevokeIntegrationAccessForm({ id, label }: { readonly id: string; readonly label: string }) {
  const [state, action, pending] = useActionState(
    manageIntegrationAccessAction,
    INITIAL_INTEGRATION_ACCESS_STATE,
  );

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="intent" value="revoke" />
      <FormValue name="id" value={id} />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="失効させています">
        「{label}」を失効させる
      </Button>
      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
    </HumanOnlyForm>
  );
}
