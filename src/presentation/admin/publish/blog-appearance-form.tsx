"use client";

import { useActionState, useId, useState } from "react";
import { modeOptions, themeOptions } from "@/domain/authoring/appearance";
import { BLOG_TEMPLATES, type PageThemeOverride } from "@/domain/authoring/blog-template";
import { SITE_ROUTES } from "@/domain/authoring/site-routes";
import { Button, Field, FormResult, FormValue, Select, Stack, ToolForm } from "@/presentation/ui";
import { manageBlogAppearanceAction } from "./blog-appearance-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/**
 * ブログの見せ方（6 種）と配色（2 層）を選ぶ欄。
 *
 * --- 1 つの画面に 3 つのフォームを置く ---
 * 見せ方・全体の配色・ページ単位の例外は、それぞれ別の判断である。
 * 1 つのフォームにまとめると、配色だけ直したいときにも見せ方の値を
 * 送ることになり、「触っていないものが保存された」が起きる。
 *
 * --- AI から呼べる形にしてある ---
 * 固定ページ（`HumanOnlyForm`）と違い、ここは法的な表示を書かない。
 * 見た目の選び直しは何度でも取り消せるので、人だけに限る理由が無い。
 */

const MODE_OPTIONS = modeOptions();
const THEME_OPTIONS = themeOptions();
const PAGE_PATH_SUGGESTIONS = SITE_ROUTES.filter((route) => !route.path.includes("{")).map(
  (route) => ({ path: route.path, label: route.label }),
);

export function BlogAppearanceForm({
  siteSlug,
  templateId,
  brandTheme,
  colorMode,
}: {
  readonly siteSlug: string;
  /** まだ選んでいなければ空文字。既定で埋めない（明示の選択と区別する）。 */
  readonly templateId: string;
  readonly brandTheme: string;
  readonly colorMode: string;
}) {
  const [state, action, pending] = useActionState(
    manageBlogAppearanceAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [template, setTemplate] = useState(templateId);
  const [theme, setTheme] = useState(brandTheme);
  const [mode, setMode] = useState(colorMode);

  return (
    <>
      <ToolForm
        action={action}
        toolName="select_blog_appearance"
        toolDescription="ブログの見せ方を 6 種から選び直す。記事の中身は 1 つも消えない。"
      >
        <FormValue name="siteSlug" value={siteSlug} />
        <FormValue name="intent" value="select_template" />
        <Select
          name="templateId"
          label="ブログの見せ方"
          value={template}
          onValueChange={setTemplate}
          options={BLOG_TEMPLATES.map((t) => ({ value: t.id, label: t.label }))}
          hint="並び方だけが変わります。書いた記事の中身は 1 つも消えません。"
          error={state.field === "templateId" ? state.message : null}
        />
        <Button type="submit" tone="primary" busy={pending} busyLabel="切り替えています">
          この見せ方にする
        </Button>
      </ToolForm>

      <ToolForm
        action={action}
        toolName="save_blog_theme"
        toolDescription="ブログ全体の既定の配色（色づかいと明暗）を保存する。"
      >
        <FormValue name="siteSlug" value={siteSlug} />
        <FormValue name="intent" value="save_theme" />
        <Select
          name="brandTheme"
          label="ブログ全体の色づかい"
          value={theme}
          onValueChange={setTheme}
          options={THEME_OPTIONS}
          error={state.field === "brandTheme" ? state.message : null}
        />
        <Select
          name="colorMode"
          label="明暗"
          value={mode}
          onValueChange={setMode}
          options={[...MODE_OPTIONS]}
          hint="「自動」のままにしておくと、読者が自分の端末で選んだ設定がそのまま効きます。"
          error={state.field === "colorMode" ? state.message : null}
        />
        <Button type="submit" tone="primary" busy={pending} busyLabel="保存しています">
          全体の配色を保存する
        </Button>
      </ToolForm>
      <FormResult state={state} />
    </>
  );
}

/**
 * 1 ページだけ配色を変える欄。
 *
 * 空欄は「全体のまま」。両方を空にして保存すると上書きが消える。
 * 解除の押しボタンを別に置いてあるのは、**空にして保存する**が
 * 解除だと気づける人はほとんど居ないからである。
 */
export function PageThemeOverrideForm({
  siteSlug,
  pagePath: initialPagePath,
  brandTheme,
  colorMode,
  pagePathReadOnly = false,
}: {
  readonly siteSlug: string;
  readonly pagePath: string;
  readonly brandTheme: string;
  readonly colorMode: string;
  /** 保存済み行では対象を固定し、別ページへの意図しない複製を防ぐ。 */
  readonly pagePathReadOnly?: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageBlogAppearanceAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [pagePath, setPagePath] = useState(initialPagePath);
  const [theme, setTheme] = useState(brandTheme);
  const [mode, setMode] = useState(colorMode);
  const pagePathListId = useId();

  return (
    <ToolForm
      action={action}
      toolName="save_page_theme_override"
      toolDescription="1 ページだけ配色を変える。両方を空にすると、そのページは全体の配色へ戻る。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      {/*
        `intent` は押した押しボタン自身が名乗る。隠し欄に置くと、
        `FormData.get("intent")` が先に現れる隠し欄を拾い、
        解除の押しボタンを押しても保存が走る。
      */}
      <Field
        name="pagePath"
        label="対象のページ"
        value={pagePath}
        onValueChange={setPagePath}
        readOnly={pagePathReadOnly}
        list={pagePathReadOnly ? undefined : pagePathListId}
        placeholder="例: /operator または /blog/article-slug"
        hint={
          pagePathReadOnly
            ? "保存済みの対象です。別のページには新しい上書きを追加してください。"
            : "候補から選ぶか、記事などの公開パスを / から入力してください。"
        }
        error={state.field === "pagePath" ? state.message : null}
        toolParamDescription="配色を上書きする公開ページのパス。先頭の / を含める。"
      />
      {!pagePathReadOnly ? (
        <datalist id={pagePathListId}>
          {PAGE_PATH_SUGGESTIONS.map((route) => (
            <option key={route.path} value={route.path}>
              {route.label}
            </option>
          ))}
        </datalist>
      ) : null}
      <Select
        name="brandTheme"
        label="このページの色づかい"
        value={theme}
        onValueChange={setTheme}
        options={[{ value: "", label: "全体のまま" }, ...THEME_OPTIONS]}
        error={state.field === "brandTheme" ? state.message : null}
      />
      <Select
        name="colorMode"
        label="このページの明暗"
        value={mode}
        onValueChange={setMode}
        options={[{ value: "", label: "全体のまま" }, ...MODE_OPTIONS]}
        error={state.field === "colorMode" ? state.message : null}
      />
      <Button
        type="submit"
        name="intent"
        value="save_override"
        tone="primary"
        busy={pending}
        busyLabel="保存しています"
      >
        このページだけの配色を保存する
      </Button>
      {pagePathReadOnly ? (
        <Button type="submit" name="intent" value="clear_override" busy={pending}>
          このページの上書きを解除する
        </Button>
      ) : null}
      <FormResult state={state} />
    </ToolForm>
  );
}

/** 保存済みの上書きと、新しく追加する欄を同じ入力作法で描く。 */
export function PageThemeOverrideForms({
  siteSlug,
  overrides,
}: {
  readonly siteSlug: string;
  readonly overrides: readonly {
    readonly pagePath: string;
    readonly override: PageThemeOverride;
  }[];
}) {
  return (
    <Stack>
      {overrides.map(({ pagePath, override }) => (
        <PageThemeOverrideForm
          key={pagePath}
          siteSlug={siteSlug}
          pagePath={pagePath}
          brandTheme={override.brandTheme ?? ""}
          colorMode={override.colorMode ?? ""}
          pagePathReadOnly
        />
      ))}
      <PageThemeOverrideForm
        siteSlug={siteSlug}
        pagePath=""
        brandTheme=""
        colorMode=""
      />
    </Stack>
  );
}
