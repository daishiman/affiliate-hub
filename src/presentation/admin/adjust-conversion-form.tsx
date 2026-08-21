"use client";

import { useActionState, useState } from "react";
import type { CurrencyCode } from "@/domain/shared";
import { Button, Callout, Field, TextArea, ToolForm } from "@/presentation/ui";
import { adjustConversionAction } from "./adjust-conversion-action";
import { INITIAL_ADJUST_CONVERSION_STATE } from "./adjust-conversion-state";

/** 通貨ごとの単位。欄の中に置き、利用者に入力させない。 */
const UNIT: Readonly<Record<CurrencyCode, string>> = { JPY: "円", USD: "ドル" };

/**
 * 成果の金額を直す欄。
 *
 * **理由を必須にする。** 金額だけ直せると、あとから見た人に
 * 「なぜこの額なのか」が一切残らない。締めの根拠にならない。
 *
 * **取り込んだ額を初期値に入れない。** 入れると、確認せずにそのまま
 * 送ってしまい、直していないのに「直した額」の欄が埋まる。
 * 取り込んだ額は上の内訳に出ているので、見ながら入れてもらう。
 *
 * 通貨は画面で選ばせず、この成果の通貨をそのまま送る。
 * 選ばせると、ドル建ての成果に円を指定できてしまう。
 */
export function AdjustConversionForm({
  conversionId,
  currency,
}: {
  readonly conversionId: string;
  readonly currency: CurrencyCode;
}) {
  const [state, action, pending] = useActionState(
    adjustConversionAction,
    INITIAL_ADJUST_CONVERSION_STATE,
  );
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="adjust_conversion_reward"
      toolDescription="成果の報酬額を手で直す（取り込んだ額は残す）"
    >
      <input type="hidden" name="conversionId" value={conversionId} />
      <input type="hidden" name="currency" value={currency} />

      <Field
        name="amount"
        label="直したあとの金額"
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        unit={UNIT[currency]}
        value={amount}
        onValueChange={setAmount}
        hint="取り込んだ額は消えません。別の欄に残ります。"
        error={state.status === "failed" && state.field === "amount" ? state.message : null}
        toolParamDescription="直したあとの報酬額（最小単位の整数。日本円なら円）"
      />

      <TextArea
        name="reason"
        label="直した理由"
        rows={3}
        value={reason}
        onValueChange={setReason}
        hint="あとから金額の根拠をたどれるようにするため、必ず残します。"
        error={
          state.status === "failed" && state.field === "adjustmentReason" ? state.message : null
        }
        toolParamDescription="金額を直した理由（空にできない）"
      />

      <Button type="submit" tone="primary" disabled={pending || amount === "" || reason.trim() === ""}>
        {pending ? "直しています…" : "この金額に直す"}
      </Button>

      {/* 欄に紐づかない断り（締め済み・権限など）は、操作全体の断りとして出す。 */}
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}
      {state.status === "done" ? <Callout tone="success" reason={state.message} /> : null}
    </ToolForm>
  );
}
