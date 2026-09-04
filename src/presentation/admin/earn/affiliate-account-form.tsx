"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Checkbox,
  Field,
  FormResult,
  FormValue,
  Note,
  SeeAlso,
  Select,
  type SelectOption,
  TextLink,
  ToolForm,
} from "@/presentation/ui";
import { saveAffiliateAccountAction } from "./affiliate-form-action";
import { INITIAL_AFFILIATE_ACCOUNT_FORM_STATE } from "./affiliate-form-state";

/**
 * 提携先（ASP のアカウント）を 1 つ登録する・直す欄。
 *
 * **この欄に鍵やパスワードを入れさせない。** 入れる場所を作れば、
 * いずれ入る。あるのは「保管先の名前」だけで、値そのものを持つ列は
 * 保存先にも無い。鍵の登録は、各 ASP の画面でご自身で行うもの。
 *
 * --- 作る画面と直す画面で同じ部品を使う ---
 * `brand-form.tsx` と同じ。差は `initial` があるかどうかだけで、
 * 直すときは番号を隠して一緒に送る。分けると、片方にだけ欄を足した状態が作れる。
 */
export type SaveAffiliateAccountFormProps = {
  readonly aspOptions: readonly SelectOption[];
  /** 直すときだけ渡す。渡さないと新しく作る。 */
  readonly initial?: {
    readonly accountId: string;
    readonly asp: string;
    readonly label: string;
    readonly publicTrackingId: string;
    readonly credentialRef: string;
    readonly disabled: boolean;
  };
};

export function SaveAffiliateAccountForm({
  aspOptions,
  initial,
}: SaveAffiliateAccountFormProps) {
  const [state, action, pending] = useActionState(
    saveAffiliateAccountAction,
    INITIAL_AFFILIATE_ACCOUNT_FORM_STATE,
  );
  const [asp, setAsp] = useState(initial?.asp ?? (aspOptions[0]?.value ?? ""));
  const [label, setLabel] = useState(initial?.label ?? "");
  const [publicTrackingId, setPublicTrackingId] = useState(initial?.publicTrackingId ?? "");
  const [credentialRef, setCredentialRef] = useState(initial?.credentialRef ?? "");

  return (
    <ToolForm
      action={action}
      toolName="save_affiliate_account"
      toolDescription="提携先（ASP アカウント）を 1 つ登録する、または直す。鍵やパスワードは扱わない"
    >
      {initial !== undefined && <FormValue name="accountId" value={initial.accountId} />}

      <Select
        name="asp"
        label="どのサービスか"
        value={asp}
        onValueChange={setAsp}
        options={aspOptions}
        error={state.field === "asp" ? state.message : null}
        toolParamDescription="提携先の ASP の種類"
      />
      <Field
        name="label"
        label="この ASP アカウントの呼び名"
        value={label}
        onValueChange={setLabel}
        hint="「本体用」「サブ媒体用」など、同じサービスで 2 つ持っていても見分けられる名前を書きます。"
        error={state.field === "label" ? state.message : null}
        toolParamDescription="提携先 ASP アカウントの表示名"
      />
      <Field
        name="publicTrackingId"
        label="公開されるID"
        value={publicTrackingId}
        onValueChange={setPublicTrackingId}
        optional
        hint="リンクの中に出る、隠す必要のない ID です。分からなければ空のままでかまいません。"
        error={state.field === "publicTrackingId" ? state.message : null}
        toolParamDescription="リンクに現れる公開用のトラッキング ID"
      />
      <Field
        name="credentialRef"
        label="接続情報の保管先の名前"
        value={credentialRef}
        onValueChange={setCredentialRef}
        optional
        hint="鍵そのものではなく、鍵を置いた場所の名前だけを書きます（例: A8_API_KEY）。"
        error={state.field === "credentialRef" ? state.message : null}
        toolParamDescription="接続情報を保管している場所の名前。鍵の値そのものではない"
      />
      <Note>
        パスワードや API キーそのものは、この画面にも保存先にも入れられません。
        入れる欄を作らないことが、漏れないことの唯一の担保になるためです。
        鍵の登録は、ご自身のブラウザで各サービスの画面から行ってください。
      </Note>

      <Checkbox
        name="disabled"
        label="この提携先をいまは止める"
        defaultChecked={initial?.disabled ?? false}
        toolParamDescription="止めるなら true。止めても過去の成果は消えない"
      />
      <Note>
        止めても行は消えません。消すと、この提携先で発生した過去の成果の出どころが
        たどれなくなるためです。
      </Note>

      <FormResult state={state} />
      {state.status === "done" && state.programEntryPath !== undefined && (
        <SeeAlso>
          <TextLink href={state.programEntryPath}>
            この提携先の下に提携条件を足す
          </TextLink>
        </SeeAlso>
      )}

      <Button type="submit" tone="primary" disabled={pending}>
        {pending
          ? "保存しています…"
          : initial === undefined
            ? "この提携先を登録する"
            : "この内容で直す"}
      </Button>
    </ToolForm>
  );
}
