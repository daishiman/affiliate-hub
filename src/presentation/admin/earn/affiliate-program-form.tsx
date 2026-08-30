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
  TextArea,
  TextLink,
  ToolForm,
} from "@/presentation/ui";
import { saveAffiliateProgramAction } from "./affiliate-form-action";
import { INITIAL_AFFILIATE_PROGRAM_FORM_STATE } from "./affiliate-form-state";

/**
 * 提携条件（どの広告主を、いくらで紹介できるか）を 1 つ登録する・直す欄。
 *
 * --- ASP を選ばせない ---
 * どのサービスかは、選んだ提携先から引く。ここでも選ばせると、
 * A8 のアカウントの下に楽天の提携条件がぶら下がる行が作れてしまう。
 *
 * --- 報酬の決め方を先に選ばせる ---
 * 率・固定額・段階制・未取得は排他。先に種類を選ばせて、その種類の欄だけ出す。
 * 全部の欄を並べると「率も固定額も入っている行」が作れて、
 * どちらで計算されるのか読む側に分からなくなる。
 *
 * 「未取得」は 0 と違う。取れていないだけの提携を 0% と書くと、
 * 報酬の出ない提携に見えて、確かめ直す人がいなくなる。
 */
const REWARD_KIND_OPTIONS: readonly SelectOption[] = [
  { value: "rate", label: "売上に対する率（％）" },
  { value: "fixed", label: "成果 1 件あたりの固定額" },
  { value: "tiered", label: "段階制（文章で書く）" },
  { value: "unknown", label: "まだ分からない（未取得）" },
];

export type SaveAffiliateProgramFormProps = {
  /** 登録済みの提携先。1 件も無いと、この欄は使えない。 */
  readonly accountOptions: readonly SelectOption[];
  /** 一覧から「この提携先の下に足す」で来たときの初期選択。 */
  readonly defaultAccountId?: string;
  /** 直すときだけ渡す。渡さないと新しく作る。 */
  readonly initial?: {
    readonly programId: string;
    readonly accountId: string;
    readonly advertiserName: string;
    readonly rewardKind: string;
    readonly rewardPercent: string;
    readonly rewardAmountMinor: string;
    readonly rewardCurrency: string;
    readonly rewardNote: string;
    readonly approvalRatePercent: string;
    readonly confirmationDays: string;
    readonly cookieDurationDays: string;
    readonly restrictions: readonly string[];
    readonly ended: boolean;
  };
};

export function SaveAffiliateProgramForm({
  accountOptions,
  defaultAccountId,
  initial,
}: SaveAffiliateProgramFormProps) {
  const [state, action, pending] = useActionState(
    saveAffiliateProgramAction,
    INITIAL_AFFILIATE_PROGRAM_FORM_STATE,
  );
  const [accountId, setAccountId] = useState(
    initial?.accountId ?? defaultAccountId ?? (accountOptions[0]?.value ?? ""),
  );
  const [advertiserName, setAdvertiserName] = useState(initial?.advertiserName ?? "");
  const [rewardKind, setRewardKind] = useState(initial?.rewardKind ?? "rate");
  const [rewardPercent, setRewardPercent] = useState(initial?.rewardPercent ?? "");
  const [rewardAmountMinor, setRewardAmountMinor] = useState(initial?.rewardAmountMinor ?? "");
  const [rewardCurrency, setRewardCurrency] = useState(initial?.rewardCurrency ?? "JPY");
  const [rewardNote, setRewardNote] = useState(initial?.rewardNote ?? "");
  const [approvalRatePercent, setApprovalRatePercent] = useState(
    initial?.approvalRatePercent ?? "",
  );
  const [confirmationDays, setConfirmationDays] = useState(initial?.confirmationDays ?? "");
  const [cookieDurationDays, setCookieDurationDays] = useState(initial?.cookieDurationDays ?? "");
  const [restrictions, setRestrictions] = useState((initial?.restrictions ?? []).join("\n"));

  return (
    <ToolForm
      action={action}
      toolName="save_affiliate_program"
      toolDescription="提携条件（広告主・報酬の決め方・承認率・掲載条件）を 1 つ登録する、または直す"
    >
      {initial !== undefined && <FormValue name="programId" value={initial.programId} />}

      <Select
        name="accountId"
        label="どの提携先の下か"
        value={accountId}
        onValueChange={setAccountId}
        options={accountOptions}
        hint="サービスの種類は、選んだ提携先から自動で決まります。"
        error={state.field === "accountId" ? state.message : null}
        toolParamDescription="この提携条件がぶら下がる提携先 ASP アカウントの ID"
      />
      <Field
        name="advertiserName"
        label="広告主の名前"
        value={advertiserName}
        onValueChange={setAdvertiserName}
        hint="読者に見える会社名・サービス名をそのまま書きます。"
        error={state.field === "advertiserName" ? state.message : null}
        toolParamDescription="広告主（提携先の先にいる会社）の名前"
      />

      <Select
        name="rewardKind"
        label="報酬の決め方"
        value={rewardKind}
        onValueChange={setRewardKind}
        options={REWARD_KIND_OPTIONS}
        error={state.field === "rewardKind" ? state.message : null}
        toolParamDescription="報酬の決め方。rate / fixed / tiered / unknown のいずれか"
      />
      {rewardKind === "rate" && (
        <Field
          name="rewardPercent"
          type="number"
          label="報酬率"
          unit="%"
          value={rewardPercent}
          onValueChange={setRewardPercent}
          hint="売上に対する割合です。1.5 のように小数でもかまいません。"
          error={state.field === "rewardPercent" ? state.message : null}
          toolParamDescription="売上に対する報酬率（％）"
        />
      )}
      {rewardKind === "fixed" && (
        <>
          <Field
            name="rewardAmountMinor"
            type="number"
            label="1 件あたりの報酬額"
            value={rewardAmountMinor}
            onValueChange={setRewardAmountMinor}
            hint="円なら「円」の単位で書きます（1000 なら 1000 円）。"
            error={state.field === "rewardAmountMinor" ? state.message : null}
            toolParamDescription="成果 1 件あたりの報酬額（最小単位）"
          />
          <Field
            name="rewardCurrency"
            label="通貨"
            value={rewardCurrency}
            onValueChange={setRewardCurrency}
            hint="JPY のように書きます。額だけ入って通貨が空だと、何円なのか決まりません。"
            error={state.field === "rewardCurrency" ? state.message : null}
            toolParamDescription="報酬額の通貨コード（例: JPY）"
          />
        </>
      )}
      {rewardKind === "tiered" && (
        <TextArea
          name="rewardNote"
          label="段階の決まり方"
          value={rewardNote}
          onValueChange={setRewardNote}
          rows={3}
          hint="「月 10 件までは 3%、それ以降は 5%」のように、そのまま書き写します。"
          error={state.field === "rewardNote" ? state.message : null}
          toolParamDescription="段階制の報酬の決まり方（文章）"
        />
      )}
      {rewardKind === "unknown" && (
        <Note>
          「未取得」で保存します。0 円として扱われることはありません。
          分かった時点でここへ戻って入れ直してください。
        </Note>
      )}

      <Field
        name="approvalRatePercent"
        type="number"
        label="承認率"
        unit="%"
        value={approvalRatePercent}
        onValueChange={setApprovalRatePercent}
        optional
        hint="発生したうち確定する割合です。空欄は「まだ分からない」で、0% とは違います。"
        error={state.field === "approvalRatePercent" ? state.message : null}
        toolParamDescription="成果が確定する割合（％）"
      />
      <Field
        name="confirmationDays"
        type="number"
        label="確定までの日数"
        unit="日"
        value={confirmationDays}
        onValueChange={setConfirmationDays}
        optional
        hint="発生から確定までにかかる日数。入金の見込みを立てるのに使います。"
        error={state.field === "confirmationDays" ? state.message : null}
        toolParamDescription="成果が確定するまでの日数"
      />
      <Field
        name="cookieDurationDays"
        type="number"
        label="成果が残る期間"
        unit="日"
        value={cookieDurationDays}
        onValueChange={setCookieDurationDays}
        optional
        hint="読者がリンクを踏んでから、成果として数えられる期間です。"
        error={state.field === "cookieDurationDays" ? state.message : null}
        toolParamDescription="クリックから成果として計上される期間（日）"
      />

      <TextArea
        name="restrictions"
        label="掲載してよい書き方の条件"
        value={restrictions}
        onValueChange={setRestrictions}
        rows={4}
        optional
        hint="1 行に 1 つ。「最安と書かない」など、文章で来た条件をそのまま書き写します。"
        error={state.field === "restrictions" ? state.message : null}
        toolParamDescription="掲載条件（改行区切り）"
      />
      <Note>
        ここに書いた条件は、機械では守れているか判定できません。
        公開の前に、ご自身で 1 つずつ確かめるための控えです。
      </Note>

      <Checkbox
        name="ended"
        label="この提携は終了した"
        defaultChecked={initial?.ended ?? false}
        toolParamDescription="終了しているなら true。終了しても行は消えない"
      />

      <FormResult state={state} />
      {state.status === "done" && state.affiliatePath !== undefined && (
        <SeeAlso>
          <TextLink href={state.affiliatePath}>提携と成果の一覧で確かめる</TextLink>
        </SeeAlso>
      )}

      <Button type="submit" tone="primary" disabled={pending}>
        {pending
          ? "保存しています…"
          : initial === undefined
            ? "この提携条件を登録する"
            : "この内容で直す"}
      </Button>
    </ToolForm>
  );
}
