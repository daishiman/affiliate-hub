"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Field,
  FormResult,
  Select,
  type SelectOption,
  TextArea,
  TextLink,
  ToolForm,
} from "@/presentation/ui";
import { createClaimAction } from "./evidence-form-action";
import { INITIAL_CLAIM_FORM_STATE } from "./evidence-form-state";

/**
 * 商品について言えることを 1 つ登録する欄。
 *
 * 「言えること」は記事に書く 1 文そのもの。**種類によって根拠が要る。**
 * 公式・測定・体験・外部評価は事実を名乗るので根拠が 1 つ以上必要で、
 * 空のまま送ると断られる（判定は `domain/evidence/claim.ts`）。
 *
 * **登録した直後は「確かめ待ち」で、記事には使えない。**
 * 書いた人がそのまま使える形にすると、確かめる工程が省ける道ができる。
 */
export type CreateClaimFormProps = {
  readonly types: readonly SelectOption[];
  readonly products: readonly SelectOption[];
  /** 直前に根拠を登録してきた場合の番号。欄に先に入れておく。 */
  readonly initialEvidenceId: string;
};

export function CreateClaimForm({ types, products, initialEvidenceId }: CreateClaimFormProps) {
  const [state, action, pending] = useActionState(createClaimAction, INITIAL_CLAIM_FORM_STATE);
  const [productId, setProductId] = useState("");
  const [statement, setStatement] = useState("");
  const [type, setType] = useState("");
  // 根拠を登録した流れで来た人の欄を空にしない。空にすると、
  // さっき見た番号を覚えて打ち直すことになる。
  const [evidenceIds, setEvidenceIds] = useState(initialEvidenceId);
  const [confidencePercent, setConfidencePercent] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="save_claim"
      toolDescription="商品について言えることを 1 つ登録する。根拠の番号と、いつまで言えるかを添える"
    >
      <Select
        name="productId"
        label="どの商品について言うのか"
        value={productId}
        onValueChange={setProductId}
        options={products}
        placeholder="選んでください"
        error={state.field === "productId" ? state.message : null}
        toolParamDescription="この主張が対象とする商品の ID"
      />
      <TextArea
        name="statement"
        label="言えること"
        value={statement}
        onValueChange={setStatement}
        rows={3}
        hint="記事にそのまま書ける 1 文にします。「実測で 12 時間もった」のように、確かめられる形で書きます。"
        error={state.field === "statement" ? state.message : null}
        toolParamDescription="主張の文（1 文）"
      />
      <Select
        name="type"
        label="どういう種類の話か"
        value={type}
        onValueChange={setType}
        options={types}
        placeholder="選んでください"
        hint="公式・測定・体験・外部の評価は「事実」として扱うので、根拠を 1 つ以上求めます。"
        error={state.field === "type" ? state.message : null}
        toolParamDescription="主張の種類"
      />
      <TextArea
        name="evidenceIds"
        label="根拠の番号"
        value={evidenceIds}
        onValueChange={setEvidenceIds}
        rows={3}
        optional
        hint="1 行に 1 つ書きます。登録されていない番号を書くと断られます。"
        error={state.field === "evidenceIds" ? state.message : null}
        toolParamDescription="この主張を支える根拠の識別子（改行区切り）"
      />
      <Field
        name="confidencePercent"
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        unit="%"
        label="どれだけ確かか"
        value={confidencePercent}
        onValueChange={setConfidencePercent}
        optional
        hint="決めていなければ空のままで構いません。50% として保存します。"
        error={state.field === "confidencePercent" ? state.message : null}
        toolParamDescription="この主張の確かさ（0〜100）"
      />
      <Field
        name="validFrom"
        type="date"
        label="いつから言えるか"
        value={validFrom}
        onValueChange={setValidFrom}
        optional
        hint="空のままなら今日からとして保存します。"
        error={state.field === "validFrom" ? state.message : null}
        toolParamDescription="この主張が有効になる日（YYYY-MM-DD）"
      />
      <Field
        name="validUntil"
        type="date"
        label="いつまで言えるか"
        value={validUntil}
        onValueChange={setValidUntil}
        optional
        // 期限を書くと、その日を過ぎた主張が自動で使えなくなる。
        // 空のままは「期限を決めていない」で、値段のように変わるものほど危ない。
        hint="値段や在庫のように変わるものには必ず入れます。過ぎた主張は記事に使えなくなります。"
        error={state.field === "validUntil" ? state.message : null}
        toolParamDescription="この主張の有効期限（YYYY-MM-DD）"
      />

      <FormResult
        state={state}
        doneAction={
          state.productPath === undefined ? undefined : (
            <TextLink href={state.productPath}>この商品のページを見る</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "これを登録する"}
      </Button>
    </ToolForm>
  );
}
