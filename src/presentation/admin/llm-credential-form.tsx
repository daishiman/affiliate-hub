"use client";

import { useActionState, useState } from "react";
import { Button, Callout, Field, Select } from "@/presentation/ui";
import { manageLlmCredentialAction } from "./llm-credential-action";
import { INITIAL_LLM_CREDENTIAL_STATE } from "./llm-credential-state";

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
  const [state, action, pending] = useActionState(
    manageLlmCredentialAction,
    INITIAL_LLM_CREDENTIAL_STATE,
  );
  const [apiKey, setApiKey] = useState("");

  return (
    <form
      action={(formData: FormData) => {
        action(formData);
        setApiKey("");
      }}
    >
      <input type="hidden" name="intent" value="register" />
      <input type="hidden" name="providerId" value={providerId} />

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

      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}
    </form>
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
  readonly models: readonly { readonly modelId: string; readonly label: string }[];
}) {
  const [state, action, pending] = useActionState(
    manageLlmCredentialAction,
    INITIAL_LLM_CREDENTIAL_STATE,
  );
  const [modelId, setModelId] = useState(models[0]?.modelId ?? "");

  return (
    <form action={action}>
      <input type="hidden" name="intent" value="verify" />
      <input type="hidden" name="providerId" value={providerId} />

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
    </form>
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
  const [state, action, pending] = useActionState(
    manageLlmCredentialAction,
    INITIAL_LLM_CREDENTIAL_STATE,
  );

  return (
    <form action={action}>
      <input type="hidden" name="intent" value="revoke" />
      <input type="hidden" name="providerId" value={providerId} />
      <Button type="submit" tone="secondary" busy={pending} busyLabel="失効させています">
        「{label}」の鍵を失効させる
      </Button>
      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}
    </form>
  );
}
