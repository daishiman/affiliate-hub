"use client";

import { useActionState, useState } from "react";
import type { PublishArticleFormOptions } from "@/application/usecases/site/publish-article";
import { Button, Field, Select, TextArea, ToolForm } from "@/presentation/ui";
import { publishArticleAction } from "./publish-article-action";
import { PublishArticleResult } from "./publish-article-result";
import { INITIAL_PUBLISH_ARTICLE_STATE } from "./publish-article-state";

/** 根拠 1 件ぶんの入力。画面の中だけで使う形。 */
type ClaimDraft = {
  readonly statement: string;
  readonly sourceLabel: string;
  readonly sourceUrl: string;
  readonly checkedOn: string;
};

const EMPTY_CLAIM: ClaimDraft = {
  statement: "",
  sourceLabel: "",
  sourceUrl: "",
  checkedOn: "",
};

/**
 * 「いまサイトに出す」欄。
 *
 * **欄の並びは画面に書かない。** 記事の種類ごとの節も、出し先のブログも、
 * 広告との関係の文言も、全て `preparePublishArticle` が渡した一覧から作る。
 * ここへ手で並べると、記事の構成を 1 つ直した日に、直った種類と
 * 直っていない種類が同じ画面に混ざる。
 *
 * 種類を選び直しても読み直しをしないのは、**書きかけの原稿を消さないため**。
 * 全種類ぶんの欄が最初から手元にあるので、差し替えるだけで済む。
 */
export function PublishArticleForm({
  publicationId,
  options,
}: {
  readonly publicationId: string;
  readonly options: PublishArticleFormOptions;
}) {
  const [state, action, pending] = useActionState(
    publishArticleAction,
    INITIAL_PUBLISH_ARTICLE_STATE,
  );

  const firstType = options.articleTypes[0];
  const [articleType, setArticleType] = useState<string>(firstType?.value ?? "");
  const [siteSlug, setSiteSlug] = useState(options.siteOptions[0]?.slug ?? "");
  const [categorySlug, setCategorySlug] = useState(
    options.siteOptions[0]?.categories[0]?.slug ?? "",
  );
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState(options.prefill.title);
  const [conclusion, setConclusion] = useState(options.prefill.conclusion);
  const [authorName, setAuthorName] = useState("");
  const [authorBio, setAuthorBio] = useState("");
  const [authorCredentials, setAuthorCredentials] = useState("");
  const [relationshipType, setRelationshipType] = useState("");
  const [disclosureMessage, setDisclosureMessage] = useState(options.prefill.disclosureMessage);
  const [nextReviewOn, setNextReviewOn] = useState("");
  const [claims, setClaims] = useState<readonly ClaimDraft[]>([EMPTY_CLAIM]);
  const [sectionBodies, setSectionBodies] = useState<Readonly<Record<string, string>>>({});

  const selectedType = options.articleTypes.find((t) => t.value === articleType);
  const sections = selectedType?.sections ?? [];
  const selectedSite = options.siteOptions.find((s) => s.slug === siteSlug);

  // ブログを選び直したら、カテゴリーもそのブログのものへ入れ替える。
  // 入れ替えないと、前のブログのカテゴリーが残ったまま送られて弾かれる。
  function chooseSite(next: string) {
    setSiteSlug(next);
    const site = options.siteOptions.find((s) => s.slug === next);
    setCategorySlug(site?.categories[0]?.slug ?? "");
  }

  function updateClaim(index: number, patch: Partial<ClaimDraft>) {
    setClaims((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  const errorFor = (field: string) => (state.field === field ? state.message : null);

  return (
    <ToolForm
      action={action}
      toolName="publish_article_to_own_site"
      toolDescription="承認済みの記事を、自分のブログの読者ページへ出す"
    >
      <input type="hidden" name="publicationId" value={publicationId} />

      <Select
        name="articleType"
        label="記事の種類"
        value={articleType}
        onValueChange={setArticleType}
        options={options.articleTypes.map((t) => ({ value: t.value, label: t.label }))}
        hint="選んだ種類に合わせて、下の原稿の欄が入れ替わります。書いた内容は消えません。"
        error={errorFor("articleType")}
        toolParamDescription="記事の種類（ranking / review / comparison / guide / tool）"
      />

      <Select
        name="siteSlug"
        label="出し先のブログ"
        value={siteSlug}
        onValueChange={chooseSite}
        options={options.siteOptions.map((s) => ({ value: s.slug, label: s.name }))}
        error={errorFor("siteSlug")}
        toolParamDescription="出し先のブログの識別子"
      />

      <Select
        name="categorySlug"
        label="カテゴリー"
        value={categorySlug}
        onValueChange={setCategorySlug}
        options={(selectedSite?.categories ?? []).map((c) => ({ value: c.slug, label: c.name }))}
        error={errorFor("categorySlug")}
        toolParamDescription="出し先のカテゴリーの識別子"
      />

      <Field
        name="slug"
        label="URL の名前"
        value={slug}
        onValueChange={setSlug}
        hint="半角の小文字・数字・ハイフンだけが使えます（例: quiet-laptop）。あとから変えると、読者のブックマークが切れます。"
        error={errorFor("slug")}
        toolParamDescription="読者ページの URL に使う名前"
      />

      <Field
        name="title"
        label="タイトル"
        value={title}
        onValueChange={setTitle}
        error={errorFor("title")}
        toolParamDescription="記事のタイトル"
      />

      <Field
        name="conclusion"
        label="一文の結論"
        value={conclusion}
        onValueChange={setConclusion}
        hint="一覧と検索結果にそのまま出ます。読んだ人が、記事を開かなくても判断できる一文にします。"
        error={errorFor("conclusion")}
        toolParamDescription="記事の結論を 1 文で"
      />

      {/* --- 書き手 --------------------------------------------------- */}
      <Field
        name="authorName"
        label="書き手の名前"
        value={authorName}
        onValueChange={setAuthorName}
        hint="誰が書いたか分からない記事は出せません。"
        error={errorFor("authorName")}
        toolParamDescription="書き手の名前"
      />

      <TextArea
        name="authorBio"
        label="書き手の紹介"
        value={authorBio}
        onValueChange={setAuthorBio}
        rows={3}
        error={errorFor("authorBio")}
        toolParamDescription="書き手の紹介文"
      />

      <TextArea
        name="authorCredentials"
        label="書き手の裏づけ"
        value={authorCredentials}
        onValueChange={setAuthorCredentials}
        rows={3}
        optional
        hint="1 行に 1 つ書きます（例: 家電量販店で 8 年勤務）。"
        error={errorFor("authorCredentials")}
        toolParamDescription="書き手の裏づけ（改行区切り）"
      />

      {/* --- 広告表記 ------------------------------------------------- */}
      <Select
        name="relationshipType"
        label="広告との関係"
        value={relationshipType}
        onValueChange={setRelationshipType}
        options={options.relationshipOptions}
        placeholder="選んでください"
        hint="ここで選んだ文が、そのまま記事の冒頭に出ます。"
        error={errorFor("relationshipType")}
        toolParamDescription="広告との関係の種類"
      />

      <TextArea
        name="disclosureMessage"
        label="読者に見せる広告表記"
        value={disclosureMessage}
        onValueChange={setDisclosureMessage}
        rows={2}
        error={errorFor("disclosureMessage")}
        toolParamDescription="読者に見せる広告表記の文"
      />

      <Field
        name="nextReviewOn"
        type="date"
        label="次に見直す日"
        value={nextReviewOn}
        onValueChange={setNextReviewOn}
        hint="古い情報を出したままにしないための日付です。設定しないと公開できません。"
        error={errorFor("nextReviewOn")}
        toolParamDescription="次回確認日（YYYY-MM-DD）"
      />

      {/* --- 原稿 ------------------------------------------------------ */}
      {sections.map((section) => (
        <TextArea
          key={section.id}
          name={`section:${section.id}`}
          label={section.label}
          value={sectionBodies[section.id] ?? ""}
          onValueChange={(next) =>
            setSectionBodies((prev) => ({ ...prev, [section.id]: next }))
          }
          optional
          rows={6}
          hint={section.purpose}
          toolParamDescription={`${section.label}: ${section.purpose}`}
        />
      ))}

      {/* --- 根拠 ------------------------------------------------------ */}
      {claims.map((claim, index) => (
        // 並べ替えも削除もしないので、位置で数える。
        // biome-ignore lint/suspicious/noArrayIndexKey: 行は末尾に足すだけで、並べ替えない
        <div key={index}>
          <Field
            name="claimStatement"
            label={`言い切り ${index + 1}`}
            value={claim.statement}
            onValueChange={(next) => updateClaim(index, { statement: next })}
            optional
            hint="根拠を示せることだけを書きます。空のままなら、この行は送られません。"
            toolParamDescription="記事に載せる言い切り"
          />
          <Field
            name="claimSourceLabel"
            label="出典の名前"
            value={claim.sourceLabel}
            onValueChange={(next) => updateClaim(index, { sourceLabel: next })}
            optional
            toolParamDescription="出典の名前"
          />
          <Field
            name="claimSourceUrl"
            type="url"
            label="出典の URL"
            value={claim.sourceUrl}
            onValueChange={(next) => updateClaim(index, { sourceUrl: next })}
            optional
            toolParamDescription="出典の URL"
          />
          <Field
            name="claimCheckedOn"
            type="date"
            label="確認した日"
            value={claim.checkedOn}
            onValueChange={(next) => updateClaim(index, { checkedOn: next })}
            optional
            toolParamDescription="出典を確認した日（YYYY-MM-DD）"
          />
        </div>
      ))}

      <Button
        type="button"
        tone="quiet"
        onClick={() => setClaims((prev) => [...prev, EMPTY_CLAIM])}
      >
        根拠の欄を増やす
      </Button>

      <PublishArticleResult state={state} />

      <Button type="submit" tone="primary" disabled={pending || siteSlug === ""}>
        {pending ? "出しています…" : "いまサイトに出す"}
      </Button>
    </ToolForm>
  );
}
