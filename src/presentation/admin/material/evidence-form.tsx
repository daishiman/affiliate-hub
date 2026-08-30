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
import { createEvidenceAction } from "./evidence-form-action";
import { INITIAL_EVIDENCE_FORM_STATE } from "./evidence-form-state";

/**
 * 根拠を 1 つ登録する欄。
 *
 * 根拠とは「なぜそう言えるか」の出所そのもの——公式の仕様表、測った結果、
 * 撮った写真など。ここに登録したものだけが、言えることの裏付けに使える。
 *
 * **利用条件を必須にしている。** 転載してよいか分からない素材を根拠に
 * すると、記事に載せた後で下ろすことになる。下ろすと、その根拠に
 * 支えられていた主張がまとめて根拠なしへ落ちる。
 *
 * 抜粋に上限があるのは他サイトの本文を丸ごと持ってこないため。
 * 上限の数はここに書かない（`domain/evidence/evidence.ts` が持つ）。
 * 写すと、上限を変えた日に画面の案内だけが古くなる。
 */
export type CreateEvidenceFormProps = {
  readonly types: readonly SelectOption[];
};

export function CreateEvidenceForm({ types }: CreateEvidenceFormProps) {
  const [state, action, pending] = useActionState(
    createEvidenceAction,
    INITIAL_EVIDENCE_FORM_STATE,
  );
  const [type, setType] = useState("");
  const [title, setTitle] = useState("");
  const [sourceOwner, setSourceOwner] = useState("");
  const [urlOrAssetId, setUrlOrAssetId] = useState("");
  const [excerptOrSummary, setExcerptOrSummary] = useState("");
  const [licenseOrPermission, setLicenseOrPermission] = useState("");
  const [capturedAt, setCapturedAt] = useState("");

  return (
    <ToolForm
      action={action}
      toolName="save_evidence"
      toolDescription="根拠となる資料を 1 つ登録する。題名・出所・利用条件・抜粋を残す"
    >
      <Select
        name="type"
        label="根拠の種類"
        value={type}
        onValueChange={setType}
        options={types}
        placeholder="選んでください"
        error={state.field === "type" ? state.message : null}
        toolParamDescription="根拠の種類"
      />
      <Field
        name="title"
        label="題名"
        value={title}
        onValueChange={setTitle}
        hint="後から探すときの手がかりになります。「メーカー仕様表 2026年版」のように書きます。"
        error={state.field === "title" ? state.message : null}
        toolParamDescription="根拠の題名"
      />
      <Field
        name="sourceOwner"
        label="誰の情報か"
        value={sourceOwner}
        onValueChange={setSourceOwner}
        hint="メーカー名・調査機関名・自社の部署名など。ここが空の資料は出所を示せません。"
        error={state.field === "sourceOwner" ? state.message : null}
        toolParamDescription="根拠の出所（誰の情報か）"
      />
      <Field
        name="urlOrAssetId"
        label="場所"
        value={urlOrAssetId}
        onValueChange={setUrlOrAssetId}
        optional
        hint="ページの URL、または保存した画像・PDF の番号です。"
        error={state.field === "urlOrAssetId" ? state.message : null}
        toolParamDescription="根拠のある URL、または保存した素材の識別子"
      />
      <TextArea
        name="excerptOrSummary"
        label="抜粋・要約"
        value={excerptOrSummary}
        onValueChange={setExcerptOrSummary}
        rows={5}
        optional
        // 上限の数を書かない理由はファイル冒頭に書いた。
        hint="必要な部分だけを短く写すか、自分の言葉で要約します。他サイトの本文を丸ごと保存することはできません。"
        error={state.field === "excerptOrSummary" ? state.message : null}
        toolParamDescription="根拠の抜粋または要約（短く）"
      />
      <Field
        name="licenseOrPermission"
        label="利用条件"
        value={licenseOrPermission}
        onValueChange={setLicenseOrPermission}
        hint="「出典を書けば引用可」「自社撮影」など。空のままにはできません。"
        error={state.field === "licenseOrPermission" ? state.message : null}
        toolParamDescription="この資料を使ってよい条件"
      />
      <Field
        name="capturedAt"
        type="date"
        label="いつ取った資料か"
        value={capturedAt}
        onValueChange={setCapturedAt}
        optional
        hint="読者に出ます。空のままなら今日として保存します。"
        error={state.field === "capturedAt" ? state.message : null}
        toolParamDescription="資料を取得した日（YYYY-MM-DD）"
      />

      <FormResult
        state={state}
        doneAction={
          state.claimEntryPath === undefined ? undefined : (
            <TextLink href={state.claimEntryPath}>この根拠で言えることを書く</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この根拠を登録する"}
      </Button>
    </ToolForm>
  );
}
