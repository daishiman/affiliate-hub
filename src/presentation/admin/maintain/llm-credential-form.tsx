"use client";

import { useActionState, useState } from "react";
import { Button, Callout, Field, FormResult, FormValue, HumanOnlyForm, Select } from "@/presentation/ui";
import { manageLlmCredentialAction } from "./llm-credential-action";
import { INITIAL_LLM_CREDENTIAL_STATE } from "./llm-credential-state";

/**
 * 鍵の登録・確認・失効を AI から呼べなくしている理由。`HumanOnlyForm` が要求する。
 *
 * 登録を AI から呼べるようにするには、鍵の値を AI が持てる場所へ置く必要がある。
 * 置いた時点で、鍵は「人が貼った 1 回きり」ではなくなる。
 * 確認と失効を分けて許すこともしない。**同じ 1 本の鍵に対する 3 つの操作**で、
 * 失効だけ AI に許せば、AI は人の鍵を止められる。
 */
const HUMAN_ONLY_REASON =
  "API キーは人がその場で貼る 1 回きりの値で、AI から呼べる形にするには" +
  "AI が読める場所へ鍵を置く必要がある。置いた時点で 1 回きりではなくなる。" +
  "確認と失効も同じ 1 本に対する操作なので、片方だけ許すと AI が人の鍵を止められる。";

/**
 * API キーを登録する。
 *
 * --- 入力欄を送信後に空にする ---
 * 送ったあとも値が欄に残っていると、画面を開いたままの端末に鍵が出続ける。
 * 送信の成否にかかわらず消す。**失敗しても戻さない**のは、
 * 「もう一度押せば通るかもしれない」ために鍵を画面へ置いておくより、
 * 貼り直してもらうほうが安いためである。
 *
 * --- 値の行き先を、押す前に書く ---
 * 何が起きるか（包んで保存する・二度と表示しない）をボタンの手前に置く。
 * 押したあとに説明しても、そのときには送信が終わっている。
 */
export function RegisterLlmKeyForm({
  providerId,
  label,
  keyIssueUrl,
}: {
  readonly providerId: string;
  readonly label: string;
  readonly keyIssueUrl: string;
}) {
  const [state, action, pending] = useActionState(manageLlmCredentialAction, INITIAL_LLM_CREDENTIAL_STATE);
  const [apiKey, setApiKey] = useState("");

  return (
    <HumanOnlyForm
      reason={HUMAN_ONLY_REASON}
      action={(formData: FormData) => {
        action(formData);
        setApiKey("");
      }}
    >
      <FormValue name="intent" value="register" />
      <FormValue name="providerId" value={providerId} />

      <Field
        name="apiKey"
        type="password"
        label={`${label} の API キー`}
        value={apiKey}
        onValueChange={setApiKey}
        autoComplete="off"
        error={state.field === "apiKey" ? state.message : null}
        hint={
          <>
            包んで（暗号化して）保管します。登録後は末尾 4 文字しか表示されません。
            {keyIssueUrl === "" ? null : (
              <>
                {" "}
                鍵の発行は{" "}
                <a href={keyIssueUrl} rel="noreferrer noopener" target="_blank">
                  提供元の画面
                </a>{" "}
                から行ってください。
              </>
            )}
          </>
        }
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="登録しています">
        この鍵を登録する
      </Button>

      <FormResult state={state} />
    </HumanOnlyForm>
  );
}

/**
 * 登録した鍵で実際に呼べるかを 1 回だけ確かめる。
 *
 * **確認そのものにも料金が掛かる**ので、そのことをボタンの近くに書く。
 * 書かないと、切り分けのつもりで何度も押される。
 */
export function VerifyLlmKeyForm({
  providerId,
  label,
  models,
}: {
  readonly providerId: string;
  readonly label: string;
  readonly models: readonly {
    readonly modelId: string;
    readonly label: string;
  }[];
}) {
  const [state, action, pending] = useActionState(manageLlmCredentialAction, INITIAL_LLM_CREDENTIAL_STATE);
  const [modelId, setModelId] = useState(models[0]?.modelId ?? "");

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="intent" value="verify" />
      <FormValue name="providerId" value={providerId} />

      <Select
        name="modelId"
        label={`${label} で確かめるモデル`}
        value={modelId}
        onValueChange={setModelId}
        options={models.map((m) => ({ value: m.modelId, label: m.label }))}
        hint="短い依頼を 1 回だけ送ります。ごく少額ですが料金が掛かり、使った量にも記録されます。"
      />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="確かめています">
        つながるか確かめる
      </Button>

      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
    </HumanOnlyForm>
  );
}

/** 失効させる。行は消さず、失効した記録として残る。 */
export function RevokeLlmKeyForm({
  providerId,
  label,
}: {
  readonly providerId: string;
  readonly label: string;
}) {
  const [state, action, pending] = useActionState(manageLlmCredentialAction, INITIAL_LLM_CREDENTIAL_STATE);

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <FormValue name="intent" value="revoke" />
      <FormValue name="providerId" value={providerId} />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="失効させています">
        「{label}」の鍵を失効させる
      </Button>
      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
    </HumanOnlyForm>
  );
}
