"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CONTENT_ANGLES, CONTENT_LENGTHS, CTA_TYPES } from "@/domain/authoring";
import { CHANNEL_CAPABILITIES } from "@/domain/distribution";
import {
  Button,
  Callout,
  Field,
  FormResult,
  FormValue,
  Select,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { createContentVariantAction, updateContentVariantAction } from "./content-form-action";
import { INITIAL_CONTENT_FORM_STATE, type ContentFormState } from "./content-form-state";
import { adminOperation } from "./admin-operation-manifest";

/**
 * 切り口・長さ・CTA の呼び名。
 *
 * 内部のキーをそのまま出すと、選ぶ人は「conclusion_first」が何かを
 * 別の場所で調べることになる。**選択肢の意味は選ぶ場に置く。**
 */
const ANGLE_LABEL: Readonly<Record<string, string>> = {
  conclusion_first: "結論から書く",
  problem_first: "悩みから書く",
  experience_first: "使った体験から書く",
  data_first: "数字から書く",
  comparison_first: "他と比べて書く",
  beginner: "はじめての人向けに書く",
  expert: "詳しい人向けに書く",
  budget: "予算を軸に書く",
  drawback: "弱いところから書く",
  surprise: "意外な点から書く",
  story: "話の流れで書く",
  seasonal: "時季に合わせて書く",
  use_case: "使う場面から書く",
  faq: "よくある質問に答える",
  paradox: "通説の逆から書く",
  checklist: "確かめる項目を並べる",
};

const LENGTH_LABEL: Readonly<Record<string, string>> = {
  one_sentence: "一文",
  short: "短い文",
  standard: "ふつうの長さ",
  long: "長い文",
  thread: "連続投稿",
  article: "記事",
  script: "台本",
};

const CTA_LABEL: Readonly<Record<string, string>> = {
  read_detail: "詳しい記事を読んでもらう",
  view_comparison: "比較表を見てもらう",
  check_official: "公式ページを見てもらう",
  check_price_at_merchant: "販売店で値段を見てもらう",
  save: "保存してもらう",
  comment: "感想をもらう",
  follow: "次も読んでもらう",
  email_signup: "メールを登録してもらう",
  free_diagnosis: "無料の診断を受けてもらう",
  request_material: "資料を請求してもらう",
};

const ANGLE_OPTIONS = CONTENT_ANGLES.map((angle) => ({
  value: angle,
  label: ANGLE_LABEL[angle] ?? angle,
}));
const LENGTH_OPTIONS = CONTENT_LENGTHS.map((length) => ({
  value: length,
  label: LENGTH_LABEL[length] ?? length,
}));
const CTA_OPTIONS = CTA_TYPES.map((cta) => ({
  value: cta,
  label: CTA_LABEL[cta] ?? cta,
}));
const CHANNEL_OPTIONS = Object.values(CHANNEL_CAPABILITIES).map((channel) => ({
  value: channel.kind,
  label: channel.label,
}));

/** 書き手・読者像の選択肢。どちらも先に決めておくもので、この画面では作れない。 */
export type PersonaOption = { readonly value: string; readonly label: string };

export type CreateContentFormProps = {
  /**
   * どの企画から作るか。**選ばせる。**
   *
   * 以前はここが 1 つの文字列で、画面が見本の企画を決め打ちで渡していた。
   * 何本記事を作っても親の企画が同じになり、「この記事は何のために書いたのか」の
   * 答えが全記事で一致してしまう——しかも画面には出ないので誰も気づけなかった。
   */
  readonly packages: readonly PersonaOption[];
  readonly authors: readonly PersonaOption[];
  readonly audiences: readonly PersonaOption[];
};

/**
 * 記事の枠を 1 本作る欄。
 *
 * **広告表記の欄は無い。** 出すことが決まっている文言で、書く人が選ぶものではない。
 * 欄にすると消せてしまい、消えたことに気づけるのは公開の直前になる。
 *
 * 一度に作れるのは 1 本だけ。複数のブログへ書き分けるのは生成マトリクスの
 * 画面が持つ（同じ操作を 2 か所に置くと、既定の決め方が 2 通りになる）。
 */
export function CreateContentForm({ packages, authors, audiences }: CreateContentFormProps) {
  const operation = adminOperation("content.create");
  const [state, action, pending] = useActionState(createContentVariantAction, INITIAL_CONTENT_FORM_STATE);
  // 企画が 1 件しか無いときだけ最初から入れておく。2 件以上あるときに
  // 先頭を既定にすると、選ばなかった人の記事が全部 1 件目にぶら下がる。
  const [contentPackageId, setContentPackageId] = useState(
    packages.length === 1 ? packages[0].value : "",
  );
  const [channel, setChannel] = useState("own_site");
  const [format, setFormat] = useState("article");
  const [authorPersonaId, setAuthorPersonaId] = useState(authors[0]?.value ?? "");
  const [audiencePersonaId, setAudiencePersonaId] = useState(audiences[0]?.value ?? "");
  const [angle, setAngle] = useState("conclusion_first");
  const [cta, setCta] = useState("read_detail");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="記事の枠を 1 本作る。出し先・切り口・誰が誰に向けて書くかが要る"
    >
      <Select
        name="contentPackageId"
        label="どの企画の記事か"
        value={contentPackageId}
        onValueChange={setContentPackageId}
        options={packages}
        placeholder="選んでください"
        hint="企画が、この記事で誰に何を伝えるかの前提になります。無いときは先に企画を立てます。"
        error={state.field === "contentPackageId" ? state.message : null}
        toolParamDescription="この記事がぶら下がる企画の ID"
      />

      <Select
        name="channel"
        label="出し先"
        value={channel}
        onValueChange={setChannel}
        options={CHANNEL_OPTIONS}
        hint="出し先によって書ける長さもリンクの置き方も変わります。"
        error={state.field === "channel" ? state.message : null}
        toolParamDescription="出し先の媒体"
      />
      <Select
        name="format"
        label="長さ"
        value={format}
        onValueChange={setFormat}
        options={LENGTH_OPTIONS}
        error={state.field === "format" ? state.message : null}
        toolParamDescription="文章の長さ"
      />
      <Select
        name="authorPersonaId"
        label="誰の立場で書くか"
        value={authorPersonaId}
        onValueChange={setAuthorPersonaId}
        options={authors}
        hint="立場が決まると、書いてよい事実の範囲も決まります。"
        error={state.field === "authorPersonaId" ? state.message : null}
        toolParamDescription="書き手の識別子"
      />
      <Select
        name="audiencePersonaId"
        label="誰に向けて書くか"
        value={audiencePersonaId}
        onValueChange={setAudiencePersonaId}
        options={audiences}
        error={state.field === "audiencePersonaId" ? state.message : null}
        toolParamDescription="読者像の識別子"
      />
      <Select
        name="angle"
        label="切り口"
        value={angle}
        onValueChange={setAngle}
        options={ANGLE_OPTIONS}
        error={state.field === "angle" ? state.message : null}
        toolParamDescription="文章の切り口"
      />
      <Select
        name="cta"
        label="読んだ後にしてほしいこと"
        value={cta}
        onValueChange={setCta}
        options={CTA_OPTIONS}
        error={state.field === "cta" ? state.message : null}
        toolParamDescription="読者に促す行動"
      />
      <Field
        name="title"
        label="題"
        value={title}
        onValueChange={setTitle}
        optional
        hint="後から付けても構いません。空のままだと一覧では「名前のない記事」と出ます。"
        error={state.field === "title" ? state.message : null}
        toolParamDescription="記事の題"
      />
      <TextArea
        name="summary"
        label="要約"
        value={summary}
        onValueChange={setSummary}
        rows={3}
        hint="一覧と検索結果に出ます。"
        error={state.field === "summary" ? state.message : null}
        toolParamDescription="記事の要約"
      />
      <TextArea
        name="body"
        label="本文"
        value={body}
        onValueChange={setBody}
        error={state.field === "body" ? state.message : null}
        toolParamDescription="記事の本文"
      />

      <ContentFormResult state={state} doneLinkLabel="作った記事を見る" />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "作っています…" : "この記事を作る"}
      </Button>
    </ToolForm>
  );
}

export type ContentEditDefaults = {
  readonly variantId: string;
  readonly title: string;
  readonly summary: string;
  readonly body: string;
};

/**
 * 記事の文章を直す欄。
 *
 * 直せるのは題・要約・本文の 3 つだけにしてある。出し先や切り口まで直せると、
 * **同じ 1 本が別の企画のものに化ける**。出し先を変えたいときは新しく枠を作る。
 */
export function UpdateContentForm({ defaults }: { readonly defaults: ContentEditDefaults }) {
  const operation = adminOperation("content.update");
  const [state, action, pending] = useActionState(updateContentVariantAction, INITIAL_CONTENT_FORM_STATE);
  const [title, setTitle] = useState(defaults.title);
  const [summary, setSummary] = useState(defaults.summary);
  const [body, setBody] = useState(defaults.body);

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="記事の題・要約・本文を直す。承認済みなら承認は外れる"
    >
      <FormValue name="variantId" value={defaults.variantId} />

      <Field
        name="title"
        label="題"
        value={title}
        onValueChange={setTitle}
        optional
        hint="空のままにすると、いま入っている題をそのまま残します。"
        error={state.field === "title" ? state.message : null}
        toolParamDescription="記事の題"
      />
      <TextArea
        name="summary"
        label="要約"
        value={summary}
        onValueChange={setSummary}
        rows={3}
        optional
        hint="空のままにすると、いま入っている要約をそのまま残します。"
        error={state.field === "summary" ? state.message : null}
        toolParamDescription="記事の要約"
      />
      <TextArea
        name="body"
        label="本文"
        value={body}
        onValueChange={setBody}
        optional
        hint="空のままにすると、いま入っている本文をそのまま残します。"
        error={state.field === "body" ? state.message : null}
        toolParamDescription="記事の本文"
      />

      <ContentFormResult state={state} doneLinkLabel="直した記事を見る" />

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "直しています…" : "この記事を直す"}
      </Button>
    </ToolForm>
  );
}

/**
 * 押した後の知らせ（この画面のぶん）。
 *
 * 骨格（失敗は warn・成功は success・欄に紐づく断りは出さない）は共通の
 * `FormResult` が持つ。ここが足すのは**この画面にしか無い知らせ**だけ、
 * すなわち「承認が外れた」の 1 件。
 *
 * 2 つのフォーム（作る／直す）が同じ知らせを出すので、薄くてもここに 1 つ置く。
 * 置かないと同じ `children` を 2 か所へ書くことになり、また写しが生まれる。
 */
function ContentFormResult({
  state,
  doneLinkLabel,
}: {
  readonly state: ContentFormState;
  readonly doneLinkLabel: string;
}) {
  return (
    <FormResult
      state={state}
      doneAction={
        state.variantPath === undefined ? null : <Link href={state.variantPath}>{doneLinkLabel}</Link>
      }
    >
      {state.approvalCleared === true ? (
        <Callout
          tone="info"
          title="承認は外れました"
          reason="承認済みの文章を直したため、承認をやり直す必要があります。直した文章のまま公開されることはありません。"
        />
      ) : null}
    </FormResult>
  );
}
