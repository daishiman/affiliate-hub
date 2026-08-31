"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { SiteDraftView, WizardFieldSpec } from "@/application/usecases/site/build-site";
import {
  Button,
  Callout,
  CheckboxGroup,
  Field,
  FormValue,
  Select,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { createSiteFromDraftAction, saveSiteDraftStepAction } from "./site-wizard-action";
import { INITIAL_SITE_WIZARD_STATE } from "./site-wizard-state";
import { adminOperation } from "./admin-operation-manifest";
import { BLOG_TEMPLATES } from "@/domain/authoring/blog-template";

/**
 * ブログ作成ウィザードの 1 段階。
 *
 * **欄の並びは画面が決めない。** application 層が返す `fields` をそのまま描く。
 * ここで欄を書き起こすと、段階を 1 つ足したときに
 * 「保存はできるが画面に欄が無い」が起きる。
 *
 * 最後の段階だけ形が違う（入力ではなく実行）ので、分けて描いている。
 */
export function SiteWizardStepForm({ draft }: { readonly draft: SiteDraftView }) {
  if (draft.currentStep === "create") {
    return <CreateSiteForm draft={draft} />;
  }
  return <StepFieldsForm draft={draft} />;
}

function StepFieldsForm({ draft }: { readonly draft: SiteDraftView }) {
  const [state, action, pending] = useActionState(saveSiteDraftStepAction, INITIAL_SITE_WIZARD_STATE);

  return (
    <ToolForm action={action} toolName="save_site_draft_step" toolDescription="ブログ作成の 1 段階を保存する">
      <FormValue name="draftId" value={draft.draftId} />
      <FormValue name="step" value={draft.currentStep} />

      {draft.fields.map((field) => (
        <WizardField
          key={field.name}
          field={field}
          error={state.field === field.name ? state.message : null}
        />
      ))}

      {/* 欄が特定できない誤りは、まとめてここに出す。黙って消さない。 */}
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}

      <Button type="submit" tone="primary" busy={pending} busyLabel="保存しています">
        保存して次へ
      </Button>
    </ToolForm>
  );
}

/**
 * 欄 1 つ。**種類ごとの出し分けはここ 1 箇所だけ。**
 * 段階が増えても、この関数は変わらない。
 */
function WizardField({ field, error }: { readonly field: WizardFieldSpec; readonly error: string | null }) {
  const [value, setValue] = useState(field.value);
  const [selected, setSelected] = useState<readonly string[]>(field.selected);

  if (field.kind === "multi_choice") {
    return (
      <CheckboxGroup
        name={field.name}
        label={field.label}
        options={[...field.options]}
        selected={selected}
        onSelectedChange={setSelected}
        hint={field.hint}
        error={error}
        toolParamDescription={field.hint}
      />
    );
  }

  if (field.kind === "choice") {
    return (
      <Select
        name={field.name}
        label={field.label}
        value={value}
        onValueChange={setValue}
        options={[...field.options]}
        placeholder="選んでください"
        hint={field.hint}
        error={error}
        toolParamDescription={field.hint}
      />
    );
  }

  if (field.kind === "longtext") {
    return (
      <TextArea
        name={field.name}
        label={field.label}
        value={value}
        onValueChange={setValue}
        hint={field.hint}
        error={error}
        rows={6}
        toolParamDescription={field.hint}
      />
    );
  }

  return (
    <Field
      name={field.name}
      label={field.label}
      value={value}
      onValueChange={setValue}
      hint={field.hint}
      error={error}
      toolParamDescription={field.hint}
    />
  );
}

/**
 * 最後の段階（作る）。
 *
 * **埋まっていない段階があるときは、ボタンを押せないようにするだけにしない。**
 * どこが足りないかと、そこへ戻る導線を一緒に出す。
 * 押せない理由が分からないボタンは、故障と区別がつかない。
 */
export function CreateSiteForm({ draft }: { readonly draft: SiteDraftView }) {
  const operation = adminOperation("site.create");
  const [state, action, pending] = useActionState(createSiteFromDraftAction, INITIAL_SITE_WIZARD_STATE);
  const [templateId, setTemplateId] = useState("");

  const ready = draft.incomplete.length === 0;

  if (draft.createdSiteSlug !== null && state.status !== "done") {
    return (
      <Callout
        tone="success"
        reason={`「${draft.name}」は作成済みです。読者からは /s/${draft.createdSiteSlug} で見えます。`}
        action={<Link href={`/s/${draft.createdSiteSlug}`}>できたブログを見る</Link>}
      />
    );
  }

  return (
    <ToolForm action={action} toolName={operation.tool} toolDescription="下書きからブログを作る">
      <FormValue name="draftId" value={draft.draftId} />

      <Select
        name="templateId"
        label="ブログの見せ方"
        value={templateId}
        onValueChange={setTemplateId}
        options={BLOG_TEMPLATES.map((template) => ({
          value: template.id,
          label: template.label,
        }))}
        placeholder="6 種から選んでください"
        hint="記事の中身は変えず、トップと記事部品の推奨順を決めます。"
        error={state.field === "templateId" ? state.message : null}
      />

      {ready ? null : (
        <Callout
          tone="warn"
          reason={`まだ埋まっていない段階があります: ${draft.incompleteLabels.join(" / ")}`}
          action={
            <Link href={`/admin/sites/new?draftId=${draft.draftId}&step=${draft.incomplete[0]}`}>
              足りない段階へ戻る
            </Link>
          }
        />
      )}

      <Button
        type="submit"
        tone="primary"
        busy={pending}
        busyLabel="作っています"
        disabled={!ready || templateId === ""}
      >
        このブログを作る
      </Button>

      {state.status === "failed" ? <Callout tone="warn" reason={state.message} /> : null}

      {state.status === "done" && state.createdPath !== undefined ? (
        <Callout
          tone="success"
          reason={state.message}
          action={<Link href={state.createdPath}>できたブログを見る</Link>}
        />
      ) : null}
    </ToolForm>
  );
}
