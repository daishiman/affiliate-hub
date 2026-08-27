"use client";

import { useActionState, useState } from "react";
import {
  ARTICLE_BLOCK_KINDS,
  ARTICLE_BLOCK_LABEL,
  type ArticleBlockKind,
  ARTICLE_TEMPLATE_LABEL,
  ARTICLE_TEMPLATE_TITLE_RULE,
  ARTICLE_TEMPLATES,
  BLOG_ARTICLE_STATUS_LABEL,
  BLOG_ARTICLE_STATUSES,
  REQUIRED_BLOCKS,
  TEMPLATE_BLOCK_ORDER,
  blocksOutOfTemplateOrder,
  type ArticleTemplate,
} from "@/domain/blogops";
import {
  Button,
  Callout,
  CheckboxGroup,
  Field,
  FormResult,
  FormValue,
  Note,
  Select,
  TextArea,
  ToolForm,
} from "@/presentation/ui";
import { ProseEditor } from "@/presentation/prose";
import { manageBlogArticleAction } from "./blog-article-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { DeleteConfirm } from "./delete-confirm";

/**
 * 記事を 1 本作る。
 *
 * **作るときは「入れ物」だけを決める。中身はあとで足す。**
 * 版面 (`template`) を選んだ時点で、その記事が要求する部品の種類が決まる。
 * ここで部品まで入力させると、書き始める前に 15 個の空欄と向き合うことになり、
 * 「まず下書きを置く」ができなくなる。
 */
export function BlogArticleCreateForm({
  siteOptions,
}: {
  readonly siteOptions: readonly { readonly value: string; readonly label: string }[];
}) {
  const [state, action, pending] = useActionState(
    manageBlogArticleAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [siteSlug, setSiteSlug] = useState(siteOptions[0]?.value ?? "");
  const [slug, setSlug] = useState("");
  const [template, setTemplate] = useState<string>("T1");
  const [title, setTitle] = useState("");
  const [lead, setLead] = useState("");
  const [authorName, setAuthorName] = useState("");

  const picked = (ARTICLE_TEMPLATES.find((c) => c === template) ?? "T1") as ArticleTemplate;

  return (
    <ToolForm
      action={action}
      toolName="create_blog_article"
      toolDescription="ブログ記事の下書きを 1 本作る（版面・住所・見出し・書き出し）"
    >
      <FormValue name="intent" value="create" />

      <Select
        label="どのブログに置くか"
        name="siteSlug"
        value={siteSlug}
        onValueChange={setSiteSlug}
        options={siteOptions}
        toolParamDescription="記事を置くブログの識別名"
      />
      <Field
        label="記事の住所"
        name="slug"
        value={slug}
        onValueChange={setSlug}
        error={state.field === "slug" ? state.message : null}
        hint="小文字の英数字とハイフン。公開後は変えられません。"
        toolParamDescription="記事の URL に使う識別名 (slug)"
      />
      <Select
        label="版面"
        name="template"
        value={template}
        onValueChange={setTemplate}
        options={ARTICLE_TEMPLATES.map((value) => ({
          value,
          label: `${value}: ${ARTICLE_TEMPLATE_LABEL[value]}`,
        }))}
        hint={ARTICLE_TEMPLATE_TITLE_RULE[picked]}
        toolParamDescription="記事の型 (T1..T4)。要求される部品の種類が決まる"
      />
      <Field
        label="見出し"
        name="title"
        value={title}
        onValueChange={setTitle}
        error={state.field === "title" ? state.message : null}
        toolParamDescription="記事の見出し"
      />
      <TextArea
        label="書き出し"
        name="lead"
        value={lead}
        onValueChange={setLead}
        rows={3}
        optional
        hint="一覧と検索結果にそのまま出ます。"
        toolParamDescription="記事の書き出し (一覧・検索結果に出る)"
      />
      <Field
        label="書いた人"
        name="authorName"
        value={authorName}
        onValueChange={setAuthorName}
        optional
        toolParamDescription="記事の書き手として表示する名前"
      />

      <Note>
        この版面は {REQUIRED_BLOCKS[picked].map((k) => ARTICLE_BLOCK_LABEL[k]).join("・")} を要求します。
      </Note>

      <Button type="submit" disabled={pending}>
        下書きを作る
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

export type ArticleBlockDraft = {
  readonly id: string;
  readonly kind: ArticleBlockKind;
  readonly heading: string;
  readonly body: string;
};

/**
 * 記事 1 本の中身を直し、公開まで進める。
 *
 * 部品は `blocks[n].xxx` という欄の名前で並べる。
 * 送信のたびに全部品を送り直し、サーバ側は「消してから入れ直す」。
 * 差分だけを送る作りにすると、消した部品が送られてこないので消えたと分からない。
 */
export function BlogArticleEditForm({
  articleId,
  title,
  lead,
  template,
  status,
  authorName,
  blocks,
  tagOptions,
  selectedTagIds,
  missing,
}: {
  readonly articleId: string;
  readonly title: string;
  readonly lead: string;
  readonly template: ArticleTemplate;
  readonly status: string;
  readonly authorName: string;
  readonly blocks: readonly ArticleBlockDraft[];
  readonly tagOptions: readonly { readonly value: string; readonly label: string }[];
  readonly selectedTagIds: readonly string[];
  /** まだ足りない部品。公開を止めている理由をそのまま出す。 */
  readonly missing: readonly ArticleBlockKind[];
}) {
  const [state, action, pending] = useActionState(
    manageBlogArticleAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [titleValue, setTitleValue] = useState(title);
  const [leadValue, setLeadValue] = useState(lead);
  const [templateValue, setTemplateValue] = useState<string>(template);
  const [statusValue, setStatusValue] = useState(status);
  const [authorValue, setAuthorValue] = useState(authorName);
  const [tagIds, setTagIds] = useState<readonly string[]>(selectedTagIds);
  const [rows, setRows] = useState<readonly ArticleBlockDraft[]>(blocks);

  const setRow = (index: number, patch: Partial<ArticleBlockDraft>) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  /**
   * 部品を 1 つ上/下へ動かす。
   *
   * **並び順は配列の順そのもの。**保存時に `position` は配列の添字から振り直される
   * (`createUpdateBlogArticleUseCase`)。だから「動かす」は配列の入れ替えで足りる。
   */
  const moveRow = (index: number, step: -1 | 1) => {
    setRows((prev) => {
      const to = index + step;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  /*
   * 並びのずれは**いま画面にある順**から数え直す。保存を待たない。
   *
   * 保存後にだけ出すと、運営者は「動かす → 保存 → まだ言われる → また動かす」を
   * 繰り返すことになり、1 手ずつしか進めない。読み出し側 (`getArticle` の
   * `outOfOrder`) も同じ `blocksOutOfTemplateOrder()` を呼ぶので、**規則は 1 か所**。
   */
  const picked = ARTICLE_TEMPLATES.find((t) => t === templateValue) ?? template;
  const misordered = blocksOutOfTemplateOrder(picked, rows);
  const present = new Set(rows.map((row) => row.kind));
  const orderGuide = TEMPLATE_BLOCK_ORDER[picked]
    .filter((kind) => present.has(kind))
    .map((kind) => ARTICLE_BLOCK_LABEL[kind])
    .join(" → ");

  return (
    <>
      {missing.length > 0 ? (
        <Callout
          tone="warn"
          title="公開に必要な部品が足りません"
          reason={`${missing.map((k) => ARTICLE_BLOCK_LABEL[k]).join("・")} がまだありません。`}
        />
      ) : null}

      {misordered.length > 0 ? (
        // **「足りない」とは別の枠で、別の言葉で出す。**直し方が違う
        // (足す / 動かす)。同じ枠にまとめると、運営者は在る部品を探しに行って空振りする。
        // 公開は止めない (`tone="info"`)。並びは読みやすさの問題で、欠落とは重さが違う。
        <Callout
          tone="info"
          title="部品の並びが版面と違います"
          reason={
            `${misordered.map((k) => ARTICLE_BLOCK_LABEL[k]).join("・")} を動かすと揃います。` +
            `この版面の並びは ${orderGuide} です。`
          }
        />
      ) : null}

      <ToolForm
        action={action}
        toolName="update_blog_article"
        toolDescription="記事の見出し・書き出し・部品・タグ・公開状態を直す"
      >
        <FormValue name="intent" value="update" />
        <FormValue name="articleId" value={articleId} />

        <Field
          label="見出し"
          name="title"
          value={titleValue}
          onValueChange={setTitleValue}
          error={state.field === "title" ? state.message : null}
          toolParamDescription="記事の見出し"
        />
        <TextArea
          label="書き出し"
          name="lead"
          value={leadValue}
          onValueChange={setLeadValue}
          rows={3}
          optional
          toolParamDescription="記事の書き出し"
        />
        <Select
          label="版面"
          name="template"
          value={templateValue}
          onValueChange={setTemplateValue}
          options={ARTICLE_TEMPLATES.map((value) => ({
            value,
            label: `${value}: ${ARTICLE_TEMPLATE_LABEL[value]}`,
          }))}
          hint="版面を変えると、要求される部品も変わります。"
          toolParamDescription="記事の型 (T1..T4)"
        />
        <Select
          label="公開状態"
          name="status"
          value={statusValue}
          onValueChange={setStatusValue}
          options={BLOG_ARTICLE_STATUSES.map((value) => ({
            value,
            label: BLOG_ARTICLE_STATUS_LABEL[value],
          }))}
          error={state.field === "blocks" ? state.message : null}
          hint="部品が足りないまま「公開」にはできません。"
          toolParamDescription="記事の公開状態"
        />
        <Field
          label="書いた人"
          name="authorName"
          value={authorValue}
          onValueChange={setAuthorValue}
          optional
          toolParamDescription="記事の書き手として表示する名前"
        />

        <CheckboxGroup
          label="タグ"
          name="tagIds"
          options={tagOptions}
          selected={tagIds}
          onSelectedChange={setTagIds}
          optional
          toolParamDescription="この記事に付けるタグ"
        />

        {rows.map((row, index) => (
          <fieldset key={row.id === "" ? `new-${index}` : row.id}>
            <legend>
              {index + 1}. {ARTICLE_BLOCK_LABEL[row.kind]}
            </legend>
            {/*
              動かす道が無いまま「並びが違う」とだけ言うと、運営者は部品を消して
              入れ直すしかなくなり、そのたびに本文を書き写すことになる。
              `type="button"` を明示する (form の中の button は既定で送信になる)。
            */}
            <Button
              type="button"
              tone="quiet"
              disabled={index === 0}
              // 同じ文言のボタンが部品の数だけ並ぶ。読み上げでは順に読まれるので、
              // どの部品のボタンかを名前に入れる。
              aria-label={`${ARTICLE_BLOCK_LABEL[row.kind]}を 1 つ上へ`}
              onClick={() => moveRow(index, -1)}
            >
              1 つ上へ
            </Button>
            <Button
              type="button"
              tone="quiet"
              disabled={index === rows.length - 1}
              aria-label={`${ARTICLE_BLOCK_LABEL[row.kind]}を 1 つ下へ`}
              onClick={() => moveRow(index, 1)}
            >
              1 つ下へ
            </Button>
            <FormValue name={`blocks[${index}].kind`} value={row.kind} />
            {row.id === "" ? null : (
              <FormValue name={`blocks[${index}].id`} value={row.id} />
            )}
            <Field
              label="小見出し"
              name={`blocks[${index}].heading`}
              value={row.heading}
              onValueChange={(value) => setRow(index, { heading: value })}
              optional
              toolParamDescription={`${ARTICLE_BLOCK_LABEL[row.kind]}の小見出し`}
            />
            {/*
              本文は素の入力欄ではなく `ProseEditor` で書く。
              記法を知らない人が行頭の記号を消して箇条書きを崩す事故が、
              断片ごとに欄が分かれていると起こらない。
              送る値は今までどおり 1 本の文字列なので、保存側は何も変わらない。
            */}
            <ProseEditor
              label="本文"
              name={`blocks[${index}].body`}
              value={row.body}
              onValueChange={(value) => setRow(index, { body: value })}
              toolParamDescription={`${ARTICLE_BLOCK_LABEL[row.kind]}の本文（拡張 Markdown）`}
            />
          </fieldset>
        ))}

        <Select
          label="部品を 1 つ足す"
          name="__addBlockKind"
          value=""
          onValueChange={(kind) => {
            const picked = ARTICLE_BLOCK_KINDS.find((candidate) => candidate === kind);
            if (picked === undefined) return;
            setRows((prev) => [
              ...prev,
              { id: "", kind: picked as ArticleBlockKind, heading: "", body: "" },
            ]);
          }}
          options={ARTICLE_BLOCK_KINDS.map((value) => ({
            value,
            label: ARTICLE_BLOCK_LABEL[value],
          }))}
          placeholder="（選ぶと下に追加されます）"
          optional
          toolParamDescription="足したい部品の種類"
        />

        <Button type="submit" disabled={pending}>
          記事を保存
        </Button>
        <FormResult state={state} />
      </ToolForm>

      <DeleteConfirm
        action={manageBlogArticleAction}
        toolName="delete_blog_article"
        toolDescription="記事を消す（理由が要ります）"
        idName="articleId"
        idValue={articleId}
        hiddenValues={[{ name: "intent", value: "delete" }]}
        label={`記事「${title}」`}
        verb="削除する"
        consequence="通常一覧と読者側から外れます。本文の部品・タグ・評価は残り、削除済み一覧から同じ URL へ戻せます。"
        acknowledgement="削除済み一覧から同じ URL へ戻せることを確かめました"
      />
    </>
  );
}

export function BlogArticleRestoreForm({
  articleId,
  title,
}: {
  readonly articleId: string;
  readonly title: string;
}) {
  const [state, action, pending] = useActionState(
    manageBlogArticleAction,
    INITIAL_BLOG_OPS_STATE,
  );
  return (
    <ToolForm
      action={action}
      toolName="restore_blog_article"
      toolDescription="削除済みの記事を本文・タグ・評価ごと同じ URL へ戻す"
    >
      <FormValue name="intent" value="restore" />
      <FormValue name="articleId" value={articleId} />
      <Button type="submit" disabled={pending}>
        {pending ? "戻しています…" : `記事「${title}」を同じ URL で戻す`}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
