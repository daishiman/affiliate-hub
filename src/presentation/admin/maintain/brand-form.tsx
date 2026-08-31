"use client";

import { useActionState, useState } from "react";
import {
  Button,
  Field,
  FormResult,
  FormValue,
  Note,
  Select,
  type SelectOption,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { saveBrandAction } from "./settings-form-action";
import { INITIAL_BRAND_FORM_STATE } from "./settings-form-state";

/**
 * ブランドを 1 つ作る・直す欄。
 *
 * ブランドとは、読者から見た「誰が言っているか」。運営者の表示名と
 * 問い合わせ先がここに無いと、**記事を 1 本も公開できない**。
 * 訂正を求める先を示せないまま広告を出すことになるためである。
 *
 * --- 作る画面と直す画面で同じ部品を使う ---
 *
 * 送る先も、確かめることも同じ。分けると、片方にだけ欄を足した状態が作れる。
 * 差は `initial` があるかどうかだけで、直すときは番号を隠して一緒に送る。
 */
export type SaveBrandFormProps = {
  readonly politenessOptions: readonly SelectOption[];
  readonly vocabularyOptions: readonly SelectOption[];
  /** 直すときだけ渡す。渡さないと新しく作る。 */
  readonly initial?: {
    readonly brandId: string;
    readonly displayName: string;
    readonly legalName: string;
    readonly contactEmail: string;
    readonly positioning: string;
    readonly politeness: string;
    readonly firstPerson: string;
    readonly vocabulary: string;
    readonly avoidPhrases: readonly string[];
    readonly disclaimer: string;
    readonly locale: string;
    readonly timeZone: string;
    readonly defaultCta: string;
  };
};

export function SaveBrandForm({
  politenessOptions,
  vocabularyOptions,
  initial,
}: SaveBrandFormProps) {
  const [state, action, pending] = useActionState(saveBrandAction, INITIAL_BRAND_FORM_STATE);
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [legalName, setLegalName] = useState(initial?.legalName ?? "");
  const [contactEmail, setContactEmail] = useState(initial?.contactEmail ?? "");
  const [positioning, setPositioning] = useState(initial?.positioning ?? "");
  const [politeness, setPoliteness] = useState(initial?.politeness ?? "polite");
  const [firstPerson, setFirstPerson] = useState(initial?.firstPerson ?? "");
  const [vocabulary, setVocabulary] = useState(initial?.vocabulary ?? "mixed");
  const [avoidPhrases, setAvoidPhrases] = useState((initial?.avoidPhrases ?? []).join("\n"));
  const [disclaimer, setDisclaimer] = useState(initial?.disclaimer ?? "");
  // 言語と時間帯は既定を入れておく。空で保存されると、記事の予定日時が
  // どの時間帯で読まれるか決まらない。
  const [locale, setLocale] = useState(initial?.locale ?? "ja-JP");
  const [timeZone, setTimeZone] = useState(initial?.timeZone ?? "Asia/Tokyo");
  const [defaultCta, setDefaultCta] = useState(initial?.defaultCta ?? "");

  return (
    <ToolForm
      action={action}
      toolName="save_brand"
      toolDescription="ブランドを 1 つ作る、または直す。運営者の表示名・問い合わせ先・文体・断り書きを保存する"
    >
      {initial !== undefined && <FormValue name="brandId" value={initial.brandId} />}

      <Field
        name="displayName"
        label="読者に見える名前"
        value={displayName}
        onValueChange={setDisplayName}
        hint="記事の書き手として出る名前です。サイト名と同じでもかまいません。"
        error={state.field === "displayName" ? state.message : null}
        toolParamDescription="ブランドの表示名"
      />
      <Field
        name="legalName"
        label="運営者の表示名"
        value={legalName}
        onValueChange={setLegalName}
        optional
        hint="特定商取引法の表示に使う、事業者としての名前。空のままだと記事を公開できません。"
        error={state.field === "legalName" ? state.message : null}
        toolParamDescription="運営者の法的な表示名"
      />
      <Field
        name="contactEmail"
        type="email"
        label="問い合わせ先"
        value={contactEmail}
        onValueChange={setContactEmail}
        optional
        hint="読者が訂正を求めるときの連絡先。空のままだと記事を公開できません。"
        error={state.field === "contactEmail" ? state.message : null}
        toolParamDescription="読者からの問い合わせを受けるメールアドレス"
      />
      <TextArea
        name="positioning"
        label="このブランドは何を扱うか"
        value={positioning}
        onValueChange={setPositioning}
        rows={3}
        hint="「一人暮らし向けの調理家電」のように、読者が自分向けかどうか判断できる範囲を書きます。"
        error={state.field === "positioning" ? state.message : null}
        toolParamDescription="ブランドが扱う範囲・立ち位置"
      />

      <Select
        name="politeness"
        label="文体"
        value={politeness}
        onValueChange={setPoliteness}
        options={politenessOptions}
        error={state.field === "politeness" ? state.message : null}
        toolParamDescription="敬体（です・ます）か常体（だ・である）か"
      />
      <Field
        name="firstPerson"
        label="一人称"
        value={firstPerson}
        onValueChange={setFirstPerson}
        optional
        hint="「私たち」「編集部」など。空なら既定の言い方を使います。"
        error={state.field === "firstPerson" ? state.message : null}
        toolParamDescription="記事中の一人称"
      />
      <Select
        name="vocabulary"
        label="言葉づかい"
        value={vocabulary}
        onValueChange={setVocabulary}
        options={vocabularyOptions}
        error={state.field === "vocabulary" ? state.message : null}
        toolParamDescription="専門語をどこまで使うか"
      />
      <TextArea
        name="avoidPhrases"
        label="使わない言い回し"
        value={avoidPhrases}
        onValueChange={setAvoidPhrases}
        rows={4}
        optional
        // 欄を決めうちにしない理由は `settings-form-state.ts` に書いた。
        hint="1 行に 1 つ。「絶対に」「最安」など、言い切りすぎて訂正が必要になる言葉を書きます。"
        error={state.field === "avoidPhrases" ? state.message : null}
        toolParamDescription="使わない言い回し（改行区切り）"
      />

      <TextArea
        name="disclaimer"
        label="記事末尾の断り書き"
        value={disclaimer}
        onValueChange={setDisclaimer}
        rows={3}
        optional
        hint="「価格は掲載時点のものです」など、全記事の末尾に同じ文が出ます。"
        error={state.field === "disclaimer" ? state.message : null}
        toolParamDescription="全記事の末尾に出す断り書き"
      />
      <Field
        name="locale"
        label="言語"
        value={locale}
        onValueChange={setLocale}
        hint="ja-JP のように書きます。日付と数字の書き方がこれで決まります。"
        error={state.field === "locale" ? state.message : null}
        toolParamDescription="言語タグ（例: ja-JP）"
      />
      <Field
        name="timeZone"
        label="時間帯"
        value={timeZone}
        onValueChange={setTimeZone}
        hint="Asia/Tokyo のように書きます。投稿の予定日時はこの時間帯で読み書きします。"
        error={state.field === "timeZone" ? state.message : null}
        toolParamDescription="時間帯（例: Asia/Tokyo）"
      />
      <Field
        name="defaultCta"
        label="標準の行動文言"
        value={defaultCta}
        onValueChange={setDefaultCta}
        hint="「価格を見る」など。記事ごとに書き換えられますが、書かなければこれが出ます。"
        error={state.field === "defaultCta" ? state.message : null}
        toolParamDescription="標準の行動喚起の文言"
      />

      <FormResult state={state} />
      {state.status === "done" && (state.missing?.length ?? 0) > 0 && (
        <Note>公開の前に必要: {(state.missing ?? []).join("・")}</Note>
      )}

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "保存しています…" : initial === undefined ? "このブランドを作る" : "この内容で直す"}
      </Button>
    </ToolForm>
  );
}
