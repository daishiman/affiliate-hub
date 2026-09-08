"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
  type ArticleTemplate,
} from "@/domain/blogops";
import {
  Button,
  Callout,
  CheckboxGroup,
  Field,
  Foldable,
  FormResult,
  FormValue,
  Note,
  Select,
  TextArea,
  ToolForm,
  useDraft,
} from "@/presentation/ui";
import { articleBlockDraftKey, keyedArticleBlockDrafts, newArticleBlockDraft, type ArticleBlockDraft } from "./article-block-draft";
import { ArticleEditorSection } from "./article-editor-section";
import { ProseOutline } from "@/presentation/prose";
import styles from "./article-editor.module.css";
import { ArticleLayoutSuggestionPanel } from "./article-layout-suggestion-panel";
import { ArticleSaveStatus } from "./article-save-status";
import { manageBlogArticleAction } from "./blog-article-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { DeleteConfirm } from "../delete-confirm";

export type { ArticleBlockDraft } from "./article-block-draft";

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
  readonly siteOptions: readonly {
    readonly value: string;
    readonly label: string;
    readonly categories: readonly { readonly value: string; readonly label: string }[];
  }[];
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
  const [categorySlug, setCategorySlug] = useState(siteOptions[0]?.categories[0]?.value ?? "");

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
        onValueChange={(value) => {
          setSiteSlug(value);
          setCategorySlug(
            siteOptions.find((option) => option.value === value)?.categories[0]?.value ?? "",
          );
        }}
        options={siteOptions}
        toolParamDescription="記事を置くブログの識別名"
      />
      <Select
        label="公開カテゴリ"
        name="categorySlug"
        value={categorySlug}
        onValueChange={setCategorySlug}
        options={
          siteOptions.find((option) => option.value === siteSlug)?.categories ?? []
        }
        error={state.field === "categorySlug" ? state.message : null}
        hint="下書きの時点で選び、公開後も同じ分類を使います。"
        toolParamDescription="サイト設計図にある記事カテゴリ"
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

type BlogArticleDraftValues = {
  readonly revision: number;
  readonly title: string;
  readonly lead: string;
  readonly template: string;
  readonly status: string;
  readonly authorName: string;
  readonly categorySlug: string;
  readonly tagIds: readonly string[];
  readonly rows: readonly ArticleBlockDraft[];
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
  revision,
  title,
  lead,
  template,
  status,
  authorName,
  categorySlug,
  categoryOptions,
  blocks,
  tagOptions,
  selectedTagIds,
  canPublish = false,
}: {
  readonly articleId: string;
  readonly revision: number;
  readonly title: string;
  readonly lead: string;
  readonly template: ArticleTemplate;
  readonly status: string;
  readonly authorName: string;
  readonly categorySlug: string;
  readonly categoryOptions: readonly { readonly value: string; readonly label: string }[];
  readonly blocks: readonly ArticleBlockDraft[];
  readonly tagOptions: readonly { readonly value: string; readonly label: string }[];
  readonly selectedTagIds: readonly string[];
  readonly canPublish?: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageBlogArticleAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const initialDraft = useMemo<BlogArticleDraftValues>(
    () => ({
      revision,
      title,
      lead,
      template,
      status,
      authorName,
      categorySlug,
      tagIds: [...selectedTagIds],
      rows: blocks.map((block) => ({ ...block })),
    }),
    [authorName, blocks, categorySlug, lead, revision, selectedTagIds, status, template, title],
  );
  const draft = useDraft(initialDraft, { key: `blog-article-draft:${articleId}` });
  const submitted = useRef<BlogArticleDraftValues | undefined>(undefined);
  const forgetDraft = draft.forget;
  const {
    title: titleValue,
    lead: leadValue,
    template: templateValue,
    status: statusValue,
    authorName: authorValue,
    categorySlug: categoryValue,
    tagIds,
    rows,
  } = draft.values;

  useEffect(() => {
    if (state.status === "done" && state.revision !== undefined) {
      forgetDraft({ revision: state.revision }, submitted.current);
    }
  }, [forgetDraft, state.revision, state.status]);

  const setRow = (key: string, patch: Partial<ArticleBlockDraft>) => {
    draft.update((previous) => ({ rows: keyedArticleBlockDrafts(previous.rows).map((row, i) =>
      articleBlockDraftKey(row, i) === key ? { ...row, ...patch } : row) }));
  };

  /**
   * 部品を 1 つ上/下へ動かす。
   *
   * **並び順は配列の順そのもの。**保存時に `position` は配列の添字から振り直される
   * (`createUpdateBlogArticleUseCase`)。だから「動かす」は配列の入れ替えで足りる。
   */
  const moveRow = (key: string, step: -1 | 1) => {
    draft.update((previous) => {
      const next = keyedArticleBlockDrafts(previous.rows);
      const index = next.findIndex((row, i) => articleBlockDraftKey(row, i) === key);
      const to = index + step;
      if (index < 0 || to < 0 || to >= next.length) return {};
      [next[index], next[to]] = [next[to]!, next[index]!];
      return { rows: next };
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

  return (
    <>
      {draft.restored ? (
        <Callout
          tone="info"
          title="端末下書きを復元しました"
          reason="前回この端末で入力した内容です。保存前に差分を確認できます。"
          action={
            <Button type="button" tone="quiet" onClick={draft.clear}>
              端末下書きを破棄
            </Button>
          }
        />
      ) : null}

      <ToolForm
        action={action}
        onSubmit={() => { submitted.current = draft.values; }}
        onKeyDownCapture={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) event.stopPropagation();
        }}
        toolName="update_blog_article"
        toolDescription="記事の見出し・書き出し・部品・タグ・公開状態を直す"
      >
        <FormValue name="intent" value="update" />
        <FormValue name="articleId" value={articleId} />
        <FormValue
          name="expectedRevision"
          value={String(state.revision ?? draft.values.revision)}
        />

        <div inert={pending} className={styles.workspace}>
        <div className={styles.document}>
        <Field
          label="見出し"
          name="title"
          value={titleValue}
          onValueChange={(value) => draft.update({ title: value })}
          error={state.field === "title" ? state.message : null}
          toolParamDescription="記事の見出し"
        />
        <TextArea
          label="書き出し"
          name="lead"
          value={leadValue}
          onValueChange={(value) => draft.update({ lead: value })}
          rows={3}
          optional
          toolParamDescription="記事の書き出し"
        />
        {rows.map((row, index) => (
          <ArticleEditorSection key={articleBlockDraftKey(row, index)}
            row={row} index={index} total={rows.length} articleId={articleId}
            anchor={`block-edit-${articleBlockDraftKey(row, index)}`}
            onChange={(patch) => setRow(articleBlockDraftKey(row, index), patch)} onMove={(step) => moveRow(articleBlockDraftKey(row, index), step)} />
        ))}
        <Select
          label="章を 1 つ足す"
          name="__addBlockKind"
          value=""
          onValueChange={(kind) => {
            const selected = ARTICLE_BLOCK_KINDS.find((candidate) => candidate === kind);
            if (selected === undefined) return;
            const added = newArticleBlockDraft(selected as ArticleBlockKind);
            draft.update((previous) => ({ rows: [...keyedArticleBlockDrafts(previous.rows), added] }));
          }}
          options={ARTICLE_BLOCK_KINDS.map((value) => ({ value, label: ARTICLE_BLOCK_LABEL[value] }))}
          placeholder="（選ぶと下に章を追加します）" optional
          hint="章の中には、＋から文章・画像・比較表などを追加できます。"
          toolParamDescription="足したい章の種類"
        />
        </div>
        <aside aria-label="記事の構成と設定">
        <Foldable summary={`章立て（${rows.length}件）`}>
          <ProseOutline nodes={rows.map((row, index) => ({
            block: { ...row, id: `edit-${articleBlockDraftKey(row, index)}`, position: index,
              heading: row.heading.trim() || ARTICLE_BLOCK_LABEL[row.kind] },
            label: String(index + 1), children: [],
          }))} />
        </Foldable>
        <div className={styles.check}>
          <ArticleLayoutSuggestionPanel template={picked} rows={rows}
            onRowsChange={(nextRows) => draft.update({ rows: nextRows })} />
        </div>
        <Foldable summary="記事の設定（公開状態・カテゴリ・タグ）">
        <Select
          label="公開カテゴリ" name="categorySlug" value={categoryValue}
          onValueChange={(value) => draft.update({ categorySlug: value })}
          options={categoryOptions} error={state.field === "categorySlug" ? state.message : null}
          hint="このブログの設計図にある分類だけを選べます。"
          toolParamDescription="サイト設計図にある記事カテゴリ"
        />
        <Select
          label="版面"
          name="template"
          value={templateValue}
          onValueChange={(value) => draft.update({ template: value })}
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
          onValueChange={(value) => draft.update({ status: value })}
          options={BLOG_ARTICLE_STATUSES.filter((value) => canPublish || value !== "published" || status === "published").map((value) => ({
            value,
            label: BLOG_ARTICLE_STATUS_LABEL[value],
          }))}
          error={state.field === "blocks" ? state.message : null}
          hint={canPublish ? "部品が足りないまま「公開」にはできません。" : "公開・公開中の記事の変更には公開権限が必要です。"}
          toolParamDescription="記事の公開状態"
        />
        <Field
          label="書いた人"
          name="authorName"
          value={authorValue}
          onValueChange={(value) => draft.update({ authorName: value })}
          optional
          toolParamDescription="記事の書き手として表示する名前"
        />

        <CheckboxGroup
          label="タグ"
          name="tagIds"
          options={tagOptions}
          selected={tagIds}
          onSelectedChange={(value) => draft.update({ tagIds: value })}
          optional
          toolParamDescription="この記事に付けるタグ"
        />

        </Foldable>
        </aside>
        </div>
        <div className={styles.saveBar}>
          <span>{BLOG_ARTICLE_STATUS_LABEL[BLOG_ARTICLE_STATUSES.find((value) => value === statusValue) ?? "draft"]}</span>
          <ArticleSaveStatus state={state} pending={pending} dirty={draft.dirty} />
          <Button type="submit" tone="primary" disabled={pending || (!canPublish && status === "published")} busy={pending} busyLabel="保存しています…">
            記事を保存
          </Button>
        </div>
        {draft.draftStorageError ? <Note>{draft.draftStorageError}</Note> : null}
        <FormResult state={state} />
      </ToolForm>

      {canPublish || status !== "published" ? <DeleteConfirm
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
      /> : null}
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
