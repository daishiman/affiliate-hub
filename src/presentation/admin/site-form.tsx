"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, CheckboxGroup, Field, FormResult, FormValue, TextArea, ToolForm } from "@/presentation/ui";
import { updateManagedSiteAction } from "./site-form-action";
import { INITIAL_SITE_FORM_STATE } from "./site-form-state";
import { adminOperation } from "./admin-operation-manifest";

/** 差別化の 1 軸。呼び名は設計図を読んだ側（画面）が持ってくる。 */
export type SiteAxisDefault = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

export type SiteEditDefaults = {
  readonly siteSlug: string;
  readonly name: string;
  readonly purpose: string;
  readonly genre: string;
  readonly emitLlmsTxt: boolean;
  readonly axes: readonly SiteAxisDefault[];
};

/**
 * ブログの設計図を直す欄。
 *
 * **10 軸を全部出す。** ここは切り口を決める場で、決めた切り口は
 * 記事を書き分けるたびに読まれる。3 軸に絞るのは選ぶ場（生成マトリクス）の話で、
 * 決める場で隠すと、隠れた軸が空のまま何本もの記事に効く。
 *
 * URL 名とパターンの欄は無い。どちらも変えると公開済みの住所が消えるので、
 * 「直す」ではなく「作り直す」にあたる。
 */
export function UpdateSiteForm({ defaults }: { readonly defaults: SiteEditDefaults }) {
  const operation = adminOperation("site.update");
  const [state, action, pending] = useActionState(updateManagedSiteAction, INITIAL_SITE_FORM_STATE);
  const [name, setName] = useState(defaults.name);
  const [purpose, setPurpose] = useState(defaults.purpose);
  const [genre, setGenre] = useState(defaults.genre);
  const [emitLlmsTxt, setEmitLlmsTxt] = useState<readonly string[]>(
    defaults.emitLlmsTxt ? ["emitLlmsTxt"] : [],
  );
  const [axes, setAxes] = useState<Readonly<Record<string, string>>>(
    Object.fromEntries(defaults.axes.map((axis) => [axis.key, axis.value])),
  );

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="ブログの設計図を直す。URL 名とパターンは変えられない"
    >
      <FormValue name="siteSlug" value={defaults.siteSlug} />

      <Field
        name="name"
        label="ブログ名"
        value={name}
        onValueChange={setName}
        optional
        hint="空のままにすると、いまの名前をそのまま残します。"
        error={state.field === "name" ? state.message : null}
        toolParamDescription="ブログの表示名"
      />
      <Field
        name="genre"
        label="扱う分野"
        value={genre}
        onValueChange={setGenre}
        optional
        error={state.field === "genre" ? state.message : null}
        toolParamDescription="ブログが扱う分野"
      />
      <TextArea
        name="purpose"
        label="このブログの目的"
        value={purpose}
        onValueChange={setPurpose}
        rows={3}
        optional
        hint="何のために作ったブログかを 1〜2 文で。記事を書き分けるときの土台になります。"
        error={state.field === "purpose" ? state.message : null}
        toolParamDescription="ブログの目的"
      />
      <CheckboxGroup
        name="emitLlmsTxt"
        label="AI 向けの案内ファイルを置く"
        options={[{ value: "emitLlmsTxt", label: "llms.txt を出す" }]}
        selected={emitLlmsTxt}
        onSelectedChange={setEmitLlmsTxt}
        optional
        hint="AI がこのブログを読むときの案内です。外すと置かれなくなります。"
        toolParamDescription="llms.txt を出すかどうか"
      />

      {defaults.axes.map((axis) => (
        <Field
          key={axis.key}
          name={`axis.${axis.key}`}
          label={axis.label}
          value={axes[axis.key] ?? ""}
          onValueChange={(next) => setAxes((prev) => ({ ...prev, [axis.key]: next }))}
          optional
          error={state.field === axis.key ? state.message : null}
          toolParamDescription={`差別化の軸: ${axis.label}`}
        />
      ))}

      <FormResult
        state={state}
        // 直したつもりで何も変わらなかったことは、成功だが success ではない。
        // 文言（「いま入っている値と同じでした」）と色の両方で同じことを伝える。
        doneTone={state.changedLabels?.length === 0 ? "info" : "success"}
        doneAction={
          state.sitePath === undefined ? null : <Link href={state.sitePath}>このブログを見る</Link>
        }
      />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "直しています…" : "この設計図を直す"}
      </Button>
    </ToolForm>
  );
}
