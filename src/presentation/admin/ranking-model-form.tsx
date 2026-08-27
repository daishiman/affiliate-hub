"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Callout,
  Field,
  FormResult,
  TextLink,
  ToolForm,
} from "@/presentation/ui";
import { createRankingModelAction } from "./ranking-form-action";
import { INITIAL_RANKING_MODEL_FORM_STATE } from "./ranking-form-state";

/**
 * 順位づけの基準を 1 つ立てる欄。
 *
 * **重みは % で入れてもらう。** 0.4 と打たせると、合計 1.0 に合わせる暗算を
 * 人にさせることになり、0.05 のずれが「なぜか保存できない」として返る。
 * 合計は入力しながら画面に出す。送信して初めて合計違いを知らされるのは、
 * 7 項目を打ち直させるのと同じこと。
 *
 * 指標の一覧（`criteria`）は**画面が受け取る。この部品は取りに行かない。**
 * 許可された指標は domain が決めており、ここへ書き写すと写した側だけが古くなる。
 */
export type CreateRankingModelFormProps = {
  readonly criteria: readonly { readonly key: string; readonly label: string }[];
  /** すでに使われている商品の種類。入力の助けにするだけで、選択肢ではない。 */
  readonly knownCategories: readonly string[];
};

export function CreateRankingModelForm({
  criteria,
  knownCategories,
}: CreateRankingModelFormProps) {
  const [state, action, pending] = useActionState(
    createRankingModelAction,
    INITIAL_RANKING_MODEL_FORM_STATE,
  );
  // 使われている種類が 1 つしか無いときだけ最初から入れておく。
  // 2 つ以上あるときに片方を既定にすると、選ばなかった人の基準が全部そちらに付く。
  const [categoryId, setCategoryId] = useState(
    knownCategories.length === 1 ? knownCategories[0] : "",
  );
  const [version, setVersion] = useState("");
  const [audience, setAudience] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [reason, setReason] = useState("");
  const [weights, setWeights] = useState<Readonly<Record<string, string>>>({});
  const [measurements, setMeasurements] = useState<Readonly<Record<string, string>>>({});
  const [thresholds, setThresholds] = useState<Readonly<Record<string, string>>>({});

  const total = criteria.reduce((sum, c) => sum + (Number(weights[c.key] ?? "") || 0), 0);
  const totalIsRight = Math.round(total) === 100;

  // 指標の数だけ状態を作らず、1 つの表で持つ。指標が増えても欄の宣言は増えない
  // （`repairability` を足したときにコードの分岐が 1 つも増えなかったのと同じ理由）。
  const setWeight = (key: string, value: string) => setWeights({ ...weights, [key]: value });
  const setMeasurement = (key: string, value: string) =>
    setMeasurements({ ...measurements, [key]: value });
  const setThreshold = (key: string, value: string) =>
    setThresholds({ ...thresholds, [key]: value });

  return (
    <ToolForm
      action={action}
      toolName="save_ranking_model"
      toolDescription="順位づけの基準を決める。何をどれだけ重く見るか、どう測るか、どこから合格かを定める"
    >
      <Field
        name="version"
        label="この基準の版"
        value={version}
        onValueChange={setVersion}
        hint="「2026.09-1」のように、いつの・何番目の測り方かが分かる名前にします。同じ版名で測り直すと前の順位を再現できなくなります。"
        error={state.field === "version" ? state.message : null}
        toolParamDescription="評価基準の版名"
      />
      {/*
        種類は文字で入れてもらう。選ぶ形にできないのは、**種類そのものを
        登録する場所がまだ無い**ため。ここで一覧を作ると、商品側の種類と
        この画面の一覧という 2 つの正解ができ、綴りが割れても誰も気づけない。
        既に使われている種類を上に出しているのはそのつなぎ。
      */}
      <Field
        name="categoryId"
        label="どの種類の商品を並べるか"
        value={categoryId}
        onValueChange={setCategoryId}
        hint={
          knownCategories.length === 0
            ? "「cat_laptop」のように、商品に付けている種類の名前をそのまま書きます。ノートパソコンと洗濯機を同じ基準で並べることはできません。"
            : `すでに使われている種類：${knownCategories.join("・")}`
        }
        error={state.field === "categoryId" ? state.message : null}
        toolParamDescription="対象の商品カテゴリ ID"
      />
      <Field
        name="audience"
        label="誰にとっての順位か"
        value={audience}
        onValueChange={setAudience}
        hint="「動画編集をする人」のように書きます。読者が違えば、同じ商品でも上下は変わります。"
        error={state.field === "audience" ? state.message : null}
        toolParamDescription="この基準が想定する読者"
      />
      <Field
        name="effectiveFrom"
        type="date"
        label="いつからの基準か"
        value={effectiveFrom}
        onValueChange={setEffectiveFrom}
        hint="この日より前に出した順位は、前の版のままで残ります。"
        error={state.field === "effectiveFrom" ? state.message : null}
        toolParamDescription="基準の有効開始日（YYYY-MM-DD）"
      />

      <Callout
        tone={totalIsRight ? "info" : "warn"}
        title={`重みの合計は ${Math.round(total)}%`}
        reason={
          totalIsRight
            ? "合計 100% です。このまま登録できます。"
            : "合計が 100% になるまで登録できません。使わない指標は 0% のままにします。"
        }
      />

      {criteria.map((c) => (
        <div key={c.key}>
          <Field
            name={`weight_${c.key}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            unit="%"
            label={`${c.label}：どれだけ重く見るか`}
            value={weights[c.key] ?? ""}
            onValueChange={(v) => setWeight(c.key, v)}
            optional
            hint="使わない指標は空欄のままで構いません（0% として扱います）。"
            error={state.field === c.key ? state.message : null}
            toolParamDescription={`${c.label}の重み（%）`}
          />
          {/* 重みを付けた指標だけ、測り方と合格ラインを聞く。
              0% の指標にまで測り方を書かせると、順位に影響しない作業が毎回増える。 */}
          {(Number(weights[c.key] ?? "") || 0) <= 0 ? null : (
            <>
              <Field
                name={`measurement_${c.key}`}
                label={`${c.label}：どう測ったか`}
                value={measurements[c.key] ?? ""}
                onValueChange={(v) => setMeasurement(c.key, v)}
                hint="読者に見せる文です。「同じ素材を 3 回書き出して中央値」のように、他人が同じ手順を踏める書き方にします。"
                toolParamDescription={`${c.label}の測り方`}
              />
              <Field
                name={`threshold_${c.key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                unit="%"
                label={`${c.label}：ここを下回ったら選外`}
                value={thresholds[c.key] ?? ""}
                onValueChange={(v) => setThreshold(c.key, v)}
                optional
                hint="空欄なら足切りをしません。総合点が高くても、ここを下回った商品は順位から外れます。"
                toolParamDescription={`${c.label}の合格ライン（%）`}
              />
            </>
          )}
        </div>
      ))}

      <Field
        name="reason"
        label="この基準を登録する理由"
        value={reason}
        onValueChange={setReason}
        hint="順位が変わったときに、測り方を変えた根拠を後から確認できるよう操作の記録へ残します。"
        error={state.field === "reason" ? state.message : null}
        toolParamDescription="評価基準を登録・変更する理由"
      />

      <FormResult
        state={state}
        doneAction={
          state.scoreEntryPath === undefined ? undefined : (
            <TextLink href={state.scoreEntryPath}>この基準で点を入れる</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending || !totalIsRight || reason.trim() === ""}>
        {pending ? "登録しています…" : "この基準を登録する"}
      </Button>
    </ToolForm>
  );
}
