"use client";

import { useActionState, useState } from "react";
import {
  ActionNote,
  Button,
  Field,
  FormResult,
  Select,
  type SelectOption,
  ToolForm,
} from "@/presentation/ui";
import { updateWorkspaceAction } from "./settings-form-action";
import { INITIAL_WORKSPACE_FORM_STATE } from "./settings-form-state";

/**
 * 作業場所の設定を直す欄。
 *
 * 契約の区分はブランド数・ブログ数・生成回数の上限そのもの。
 * **下げても、既にあるものは消えない。** 消す作りにすると、
 * 料金の欄を触っただけで記事の載っているブログが消える。
 * 超えた分はそのまま残り、新しく作れなくなるだけである。
 * それを保存の後に文章で返す（`overLimits`）。
 *
 * 時間帯と通貨に既定の穴埋めを持たせていないのは、application 側が
 * 空欄のとき今の値を残すため。画面で `?? 現在値` を書くと、
 * 空欄が「変えない」なのか「空にする」なのかが 2 か所で決まる。
 */
export type UpdateWorkspaceFormProps = {
  readonly planOptions: readonly SelectOption[];
  readonly initial: {
    readonly name: string;
    readonly plan: string;
    readonly timezone: string;
    readonly currency: string;
  };
};

export function UpdateWorkspaceForm({ planOptions, initial }: UpdateWorkspaceFormProps) {
  const [state, action, pending] = useActionState(
    updateWorkspaceAction,
    INITIAL_WORKSPACE_FORM_STATE,
  );
  const [name, setName] = useState(initial.name);
  const [plan, setPlan] = useState(initial.plan);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [currency, setCurrency] = useState(initial.currency);

  return (
    <ToolForm
      action={action}
      toolName="update_workspace"
      toolDescription="作業場所の名前・契約の区分・時間帯・通貨を直す"
    >
      <Field
        name="name"
        label="作業場所の名前"
        value={name}
        onValueChange={setName}
        hint="社内で見分けるための名前です。読者には出ません。"
        error={state.field === "name" ? state.message : null}
        toolParamDescription="作業場所の名前"
      />
      <Select
        name="plan"
        label="契約の区分"
        value={plan}
        onValueChange={setPlan}
        options={planOptions}
        hint="ブランド数・ブログ数・ひと月の生成回数の上限がこれで決まります。"
        error={state.field === "plan" ? state.message : null}
        toolParamDescription="契約の区分"
      />
      <Field
        name="timezone"
        label="時間帯"
        value={timezone}
        onValueChange={setTimezone}
        hint="Asia/Tokyo のように書きます。公開予約と締めの基準になります。空なら今の設定のままです。"
        error={state.field === "timezone" ? state.message : null}
        toolParamDescription="時間帯（例: Asia/Tokyo）"
      />
      <Field
        name="currency"
        label="通貨"
        value={currency}
        onValueChange={setCurrency}
        hint="JPY のように書きます。価格と成果の金額の単位です。空なら今の設定のままです。"
        error={state.field === "currency" ? state.message : null}
        toolParamDescription="通貨コード（例: JPY）"
      />

      <FormResult state={state} />
      {state.status === "done" && (state.overLimits?.length ?? 0) > 0 && (
        <ActionNote tone="danger">
          上限を超えているもの: {(state.overLimits ?? []).join("、")}
          。既にあるものは消えていません。これ以上は増やせないので、区分を戻すか、要らないものを片づけてください。
        </ActionNote>
      )}

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "保存しています…" : "この内容で直す"}
      </Button>
    </ToolForm>
  );
}
