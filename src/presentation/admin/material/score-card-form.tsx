"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Field,
  FormResult,
  FormValue,
  Select,
  type SelectOption,
  TextArea,
  TextLink,
  ToolForm,
} from "@/presentation/ui";
import { saveScoreCardAction } from "./ranking-form-action";
import { INITIAL_SCORE_CARD_FORM_STATE } from "./ranking-form-state";

/**
 * 商品 1 つに点を入れる欄。
 *
 * **基準は画面が決め、この欄では変えられない。** 変えられる形にすると、
 * 点を入れている途中で基準を切り替えたときに、前の基準の指標で打った点が
 * 別の基準の点として保存される。どの測り方で付けた点かが後から辿れなくなる。
 *
 * 出す指標は**その基準が使うものだけ**。許可されている 7 つ全部を出すと、
 * 基準が使わない項目にまで点を打たせることになり、保存時に黙って捨てられる。
 */
export type SaveScoreCardFormProps = {
  readonly modelId: string;
  readonly modelLabel: string;
  readonly criteria: readonly { readonly key: string; readonly label: string }[];
  readonly products: readonly SelectOption[];
};

export function SaveScoreCardForm({
  modelId,
  modelLabel,
  criteria,
  products,
}: SaveScoreCardFormProps) {
  const [state, action, pending] = useActionState(
    saveScoreCardAction,
    INITIAL_SCORE_CARD_FORM_STATE,
  );
  const [productId, setProductId] = useState("");
  const [scores, setScores] = useState<Readonly<Record<string, string>>>({});
  const [evidenceRefs, setEvidenceRefs] = useState("");
  const [testedAt, setTestedAt] = useState("");

  const setScore = (key: string, value: string) => setScores({ ...scores, [key]: value });

  return (
    <ToolForm
      action={action}
      toolName="save_score_card"
      toolDescription="商品 1 つに、決めた基準の指標ごとの点と、その根拠を登録する"
    >
      {/* 基準は画面が決めた 1 つ。人にも AI にも選ばせない。 */}
      <FormValue name="modelId" value={modelId} />

      <Select
        name="productId"
        label="どの商品の点か"
        value={productId}
        onValueChange={setProductId}
        options={products}
        placeholder="選んでください"
        hint={`基準「${modelLabel}」で測った点として保存します。`}
        error={state.field === "productId" ? state.message : null}
        toolParamDescription="点を付ける商品の ID"
      />

      {criteria.map((c) => (
        <Field
          key={c.key}
          name={`score_${c.key}`}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          unit="点"
          label={c.label}
          value={scores[c.key] ?? ""}
          onValueChange={(v) => setScore(c.key, v)}
          optional
          // 空欄と 0 点は違う。空欄は「まだ測っていない」、0 点は「測って 0 だった」。
          // 同じ扱いにすると、未測定の商品が最下位として順位に並ぶ。
          hint="まだ測っていない項目は空欄のままにします。0 と書くと「測って 0 点だった」になります。"
          error={state.field === c.key ? state.message : null}
          toolParamDescription={`${c.label}の点（0〜100）`}
        />
      ))}

      <TextArea
        name="evidenceRefs"
        label="この点の根拠"
        value={evidenceRefs}
        onValueChange={setEvidenceRefs}
        hint="検証記録の番号などを、1 行に 1 つ書きます。根拠を示せない点は順位に使えません。"
        error={state.field === "evidenceRefs" ? state.message : null}
        toolParamDescription="この点の根拠となる検証記録の識別子（改行区切り）"
      />
      <Field
        name="testedAt"
        type="date"
        label="最後に測った日"
        value={testedAt}
        onValueChange={setTestedAt}
        optional
        hint="読者に出ます。古い測定のまま上位にある商品を、読者が自分で見分けられるようにするためです。"
        error={state.field === "testedAt" ? state.message : null}
        toolParamDescription="最後に測定した日（YYYY-MM-DD）"
      />

      <FormResult
        state={state}
        doneAction={
          state.rankingPath === undefined ? undefined : (
            <TextLink href={state.rankingPath}>並び直した順位を見る</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この点を登録する"}
      </Button>
    </ToolForm>
  );
}
