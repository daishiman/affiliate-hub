"use client";

import { useActionState, useState } from "react";
import {
  Button,
  CheckboxGroup,
  Field,
  FormResult,
  Select,
  type SelectOption,
  TextLink,
  ToolForm,
} from "@/presentation/ui";
import { createContentPackageAction } from "./content-package-form-action";
import { INITIAL_CONTENT_PACKAGE_FORM_STATE } from "./content-package-form-state";

/**
 * 企画を 1 つ立てる欄。
 *
 * **記事を作る欄（`content-form.tsx`）と分けている。** あちらは
 * 「決まった企画から 1 本書く」操作で、こちらは「何のために書くか」を決める操作。
 * 1 つのフォームに混ぜると、記事を書くたびに企画をやり直すことになり、
 * 同じ商品について方針の違う記事が並んでも誰も気づけない。
 *
 * 選択肢（書き手・読者像・商品・ブランド・分野・切り口）は
 * **画面が受け取る。この部品は取りに行かない。** 取りに行く形にすると、
 * 同じ一覧を出す場所が増えたときに取り方が枝分かれする。
 */
export type CreateContentPackageFormProps = {
  readonly authors: readonly SelectOption[];
  readonly audiences: readonly SelectOption[];
  readonly products: readonly SelectOption[];
  readonly brands: readonly SelectOption[];
  readonly domainScopes: readonly SelectOption[];
  readonly funnelStages: readonly SelectOption[];
  readonly angles: readonly SelectOption[];
};

export function CreateContentPackageForm({
  authors,
  audiences,
  products,
  brands,
  domainScopes,
  funnelStages,
  angles,
}: CreateContentPackageFormProps) {
  const [state, action, pending] = useActionState(
    createContentPackageAction,
    INITIAL_CONTENT_PACKAGE_FORM_STATE,
  );
  const [objective, setObjective] = useState("");
  const [brandId, setBrandId] = useState(brands.length === 1 ? brands[0].value : "");
  const [primarySubjectId, setPrimarySubjectId] = useState("");
  const [domainScope, setDomainScope] = useState("");
  const [authorPersonaId, setAuthorPersonaId] = useState("");
  const [audiencePersonaIds, setAudiencePersonaIds] = useState<readonly string[]>([]);
  const [funnelStage, setFunnelStage] = useState("");
  const [contentAngles, setContentAngles] = useState<readonly string[]>([]);

  return (
    <ToolForm
      action={action}
      toolName="save_content_package"
      toolDescription="企画を立てる。どの商品について、誰が、誰に向けて、何のために記事を書くかを決める"
    >
      <Field
        name="objective"
        label="この企画で達成したいこと"
        value={objective}
        onValueChange={setObjective}
        hint="「動画編集を始めた人が、書き出しの速さで機種を選べるようにする」のように、読者が何をできるようになるかを書きます。"
        error={state.field === "objective" ? state.message : null}
        toolParamDescription="この企画の目的（読者が何をできるようになるか）"
      />
      <Select
        name="primarySubjectId"
        label="主題になる商品"
        value={primarySubjectId}
        onValueChange={setPrimarySubjectId}
        options={products}
        placeholder="選んでください"
        hint="比べる相手はあとで足せます。ここは記事の中心になる 1 つです。"
        error={state.field === "primarySubjectId" ? state.message : null}
        toolParamDescription="この企画の中心になる商品の ID"
      />
      <Select
        name="brandId"
        label="どのブランドとして出すか"
        value={brandId}
        onValueChange={setBrandId}
        options={brands}
        placeholder="選んでください"
        error={state.field === "brandId" ? state.message : null}
        toolParamDescription="この企画を出すブランドの ID"
      />
      <Select
        name="domainScope"
        label="記事の分野"
        value={domainScope}
        onValueChange={setDomainScope}
        options={domainScopes}
        placeholder="選んでください"
        // 既定値を置いていない。置くと全部の企画が「とくに規制の無い分野」になり、
        // 薬機法や金融のルールが 1 件も当たらないまま「違反 0 件」で通り続ける。
        hint="分野で、書いてよい言い方が変わります。分からないまま「とくに規制の無い分野」を選ばないでください。"
        error={state.field === "domainScope" ? state.message : null}
        toolParamDescription="記事の分野（表現ルールの当て先）"
      />
      <Select
        name="authorPersonaId"
        label="誰が書くか"
        value={authorPersonaId}
        onValueChange={setAuthorPersonaId}
        options={authors}
        placeholder="選んでください"
        error={state.field === "authorPersonaId" ? state.message : null}
        toolParamDescription="書き手の ID"
      />
      <CheckboxGroup
        name="audiencePersonaIds"
        label="誰に向けて書くか"
        options={audiences}
        selected={audiencePersonaIds}
        onSelectedChange={setAudiencePersonaIds}
        hint="2 人以上選ぶと、同じ企画から読者ごとに書き分けた記事案を作れます。"
        error={state.field === "audiencePersonaIds" ? state.message : null}
        toolParamDescription="読者像の ID（複数可）"
      />
      <Select
        name="funnelStage"
        label="読者はどこまで決まっているか"
        value={funnelStage}
        onValueChange={setFunnelStage}
        options={funnelStages}
        placeholder="選んでください"
        error={state.field === "funnelStage" ? state.message : null}
        toolParamDescription="読者の購買段階"
      />
      <CheckboxGroup
        name="contentAngles"
        label="どの切り口で書くか"
        options={angles}
        selected={contentAngles}
        onSelectedChange={setContentAngles}
        hint="複数選ぶと、同じ内容を切り口ごとに書き分けた記事案を作れます。"
        error={state.field === "contentAngles" ? state.message : null}
        toolParamDescription="記事の切り口（複数可）"
      />

      <FormResult
        state={state}
        doneAction={
          state.packageListPath === undefined ? undefined : (
            <TextLink href={state.packageListPath}>企画の一覧へ</TextLink>
          )
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "登録しています…" : "この企画を立てる"}
      </Button>
    </ToolForm>
  );
}
