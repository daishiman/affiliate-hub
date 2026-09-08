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
import { createTestRunAction } from "./evidence-form-action";
import { INITIAL_TEST_RUN_FORM_STATE } from "./evidence-form-state";

/**
 * 実際に測った記録を 1 件登録する欄。
 *
 * **「実際に使ってみました」と書けるかどうかは、この記録の有無で決まる。**
 * 記録が無いのに体験として書くと、公開前の判定で止まる。
 *
 * --- 測り方の版を必ず書かせる理由 ---
 *
 * 方法を変えたのに版を据え置くと、違う方法で出た数字が同じ列に並ぶ。
 * 「去年より良くなった」が方法の違いなのか実際の差なのか、後から
 * 誰にも分けられなくなる。分けられない数字は、順位の根拠にできない。
 *
 * --- 条件と生の値を自由な行にしている理由 ---
 *
 * 測る項目は商品の種類ごとに違う。決めうちの欄にすると、測った人が
 * **欄に無い条件を書き残せない**。書き残せない条件は、次に測る人が
 * 同じ条件を再現できないということで、記録の意味が半分になる。
 */
export type CreateTestRunFormProps = {
  readonly products: readonly SelectOption[];
  readonly criteria: readonly { readonly key: string; readonly label: string }[];
};

export function CreateTestRunForm({ products, criteria }: CreateTestRunFormProps) {
  const [state, action, pending] = useActionState(
    createTestRunAction,
    INITIAL_TEST_RUN_FORM_STATE,
  );
  const [productId, setProductId] = useState("");
  const [methodVersion, setMethodVersion] = useState("");
  const [testerIds, setTesterIds] = useState("");
  const [equipment, setEquipment] = useState("");
  const [environment, setEnvironment] = useState("");
  const [rawResults, setRawResults] = useState("");
  const [scores, setScores] = useState<Readonly<Record<string, string>>>({});
  const [evidenceIds, setEvidenceIds] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [completedAt, setCompletedAt] = useState("");

  const setScore = (key: string, value: string) => setScores({ ...scores, [key]: value });

  return (
    <ToolForm
      action={action}
      toolName="save_test_run"
      toolDescription="実際に測った記録を 1 件登録する。方法の版・測った人・条件・生の値・点を残す"
    >
      <Select
        name="productId"
        label="どの商品を測ったか"
        value={productId}
        onValueChange={setProductId}
        options={products}
        placeholder="選んでください"
        error={state.field === "productId" ? state.message : null}
        toolParamDescription="測定対象の商品の ID"
      />
      <Field
        name="methodVersion"
        label="測り方の版"
        value={methodVersion}
        onValueChange={setMethodVersion}
        hint="「2026.09-1」のように書きます。測り方を変えたら必ず上げます。前の数字と混ぜないためです。"
        error={state.field === "methodVersion" ? state.message : null}
        toolParamDescription="測定方法のバージョン"
      />
      <TextArea
        name="testerIds"
        label="測った人"
        value={testerIds}
        onValueChange={setTesterIds}
        rows={2}
        hint="1 行に 1 人。誰が測ったか示せない記録は使えません。"
        error={state.field === "testerIds" ? state.message : null}
        toolParamDescription="測定した人の識別子（改行区切り）"
      />
      <TextArea
        name="equipment"
        label="使った道具"
        value={equipment}
        onValueChange={setEquipment}
        rows={2}
        optional
        hint="1 行に 1 つ。測定器の型番など、同じ測り方を再現するのに要るものを書きます。"
        toolParamDescription="測定に使った機材（改行区切り）"
      />
      <TextArea
        name="environment"
        label="測ったときの条件"
        value={environment}
        onValueChange={setEnvironment}
        rows={4}
        optional
        hint="「気温: 25度」のように、1 行に 1 つ「名前: 値」で書きます。"
        toolParamDescription="測定時の条件（1 行 1 件、名前: 値）"
      />
      <TextArea
        name="rawResults"
        label="測った生の値"
        value={rawResults}
        onValueChange={setRawResults}
        rows={4}
        optional
        // 生の値を残すのは、後から点の付け方を変えたときに測り直さずに済むため。
        hint="「連続再生: 12.4時間」のように、1 行に 1 つ「名前: 値」で書きます。単位もそのまま書いて構いません。"
        toolParamDescription="測定した生の値（1 行 1 件、名前: 値）"
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
          label={`${c.label}の点`}
          value={scores[c.key] ?? ""}
          onValueChange={(v) => setScore(c.key, v)}
          optional
          hint="測っていない観点は空欄のままにします。0 と書くと「測って 0 点だった」になります。"
          error={state.field === c.key ? state.message : null}
          toolParamDescription={`${c.label}の点（0〜100）`}
        />
      ))}

      <TextArea
        name="evidenceIds"
        label="残した資料の番号"
        value={evidenceIds}
        onValueChange={setEvidenceIds}
        rows={2}
        optional
        hint="撮った写真やログを根拠として登録してあれば、その番号を 1 行に 1 つ書きます。"
        toolParamDescription="この記録に付随する根拠の識別子（改行区切り）"
      />
      <Field
        name="startedAt"
        type="date"
        label="測り始めた日"
        value={startedAt}
        onValueChange={setStartedAt}
        optional
        hint="空のままなら今日として保存します。"
        error={state.field === "startedAt" ? state.message : null}
        toolParamDescription="測定を開始した日（YYYY-MM-DD）"
      />
      <Field
        name="completedAt"
        type="date"
        label="測り終えた日"
        value={completedAt}
        onValueChange={setCompletedAt}
        optional
        hint="まだ続いている測定は空のままにします。"
        error={state.field === "completedAt" ? state.message : null}
        toolParamDescription="測定を完了した日（YYYY-MM-DD）"
      />

      <FormResult
        state={state}
        doneAction={
          state.testRunId === undefined ? undefined : (
            <TextLink href="/admin/evidence/claims/new">この記録で言えることを書く</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この記録を登録する"}
      </Button>
    </ToolForm>
  );
}
