"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { PublishedArticle } from "@/application/read-models/published-article";
import { Button, Callout, Field, TextArea, ToolForm } from "@/presentation/ui";
import { useDraft } from "@/presentation/ui/patterns/use-draft";
import {
  archivePublishedArticleAction,
  updatePublishedArticleAction,
} from "./published-article-action";
import {
  INITIAL_PUBLISHED_ARTICLE_STATE,
} from "./published-article-state";
import styles from "./published-article-form.module.css";

type EditorDraft = {
  readonly title: string;
  readonly summary: string;
  readonly authorName: string;
  readonly authorBio: string;
  readonly authorCredentials: string;
  readonly reason: string;
  readonly sections: readonly { readonly id: string; readonly heading: string; readonly body: string }[];
};

export function PublishedArticleForm({
  article,
  archivedAt,
}: {
  readonly article: PublishedArticle;
  readonly archivedAt: string | null;
}) {
  const initial = useMemo<EditorDraft>(
    () => ({
      title: article.title,
      summary: article.summary,
      authorName: article.author.name,
      authorBio: article.author.bio,
      authorCredentials: article.author.credentials.join("\n"),
      reason: "",
      sections: article.sections.map((section) => ({
        id: section.id,
        heading: section.heading,
        body: section.paragraphs.join("\n\n"),
      })),
    }),
    [article],
  );
  const draft = useDraft(initial, {
    key: `affiliate-hub:published-article:${article.siteSlug}:${article.slug}:${article.updatedAt}:v1`,
  });
  const [updateState, updateAction, updating] = useActionState(
    updatePublishedArticleAction,
    INITIAL_PUBLISHED_ARTICLE_STATE,
  );
  const [archiveState, archiveAction, archiving] = useActionState(
    archivePublishedArticleAction,
    INITIAL_PUBLISHED_ARTICLE_STATE,
  );
  const [archiveReason, setArchiveReason] = useState("");
  const clearedSuccess = useRef(false);
  const clearDraft = draft.clear;

  useEffect(() => {
    if (updateState.status !== "done") {
      clearedSuccess.current = false;
      return;
    }
    if (!clearedSuccess.current) {
      clearedSuccess.current = true;
      clearDraft();
    }
  }, [clearDraft, updateState.status]);

  const errorFor = (field: string) =>
    updateState.status === "failed" && updateState.field === field ? updateState.message : null;
  const patchSection = (index: number, patch: Partial<EditorDraft["sections"][number]>) => {
    draft.update({
      sections: draft.values.sections.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, ...patch } : section,
      ),
    });
  };

  return (
    <div className={styles.editorForms}>
      {archivedAt !== null && (
        <Callout
          tone="info"
          title="この記事は非表示です"
          reason="ここで訂正しても非表示のままです。再公開は、承認と公開ゲートを通る既存の配信フローから行います。"
        />
      )}
      {draft.restored && (
        <Callout
          tone="info"
          title="入力途中の下書きを復元しました"
          reason="ブラウザに保存していた訂正内容です。"
          action={<Button type="button" tone="quiet" onClick={clearDraft}>復元内容を破棄</Button>}
        />
      )}
      <ToolForm
        action={updateAction}
        toolName="update_published_article"
        toolDescription="公開済み記事を理由付きで訂正する"
        className={styles.editorForm}
      >
        <input type="hidden" name="siteSlug" value={article.siteSlug} />
        <input type="hidden" name="slug" value={article.slug} />
        <Field name="title" label="タイトル" value={draft.values.title} onValueChange={(title) => draft.update({ title })} error={errorFor("title")} />
        <TextArea name="summary" label="一覧に出す結論" rows={3} value={draft.values.summary} onValueChange={(summary) => draft.update({ summary })} error={errorFor("summary")} />
        <Field name="authorName" label="書き手の名前" value={draft.values.authorName} onValueChange={(authorName) => draft.update({ authorName })} error={errorFor("authorName")} />
        <TextArea name="authorBio" label="書き手の紹介" rows={3} value={draft.values.authorBio} onValueChange={(authorBio) => draft.update({ authorBio })} />
        <TextArea name="authorCredentials" label="書き手の裏づけ" rows={3} value={draft.values.authorCredentials} onValueChange={(authorCredentials) => draft.update({ authorCredentials })} optional hint="1 行に 1 つ書きます。" />
        {draft.values.sections.map((section, index) => (
          <section key={section.id} className={styles.editorSection}>
            <input type="hidden" name="sectionId" value={section.id} />
            <Field name="sectionHeading" label={`節 ${index + 1} の見出し`} value={section.heading} onValueChange={(heading) => patchSection(index, { heading })} error={errorFor(`sections.${section.id}.heading`)} />
            <TextArea name="sectionBody" label={`節 ${index + 1} の本文`} rows={8} value={section.body} onValueChange={(body) => patchSection(index, { body })} hint="空行で段落を分けます。" error={errorFor(`sections.${section.id}.body`)} />
          </section>
        ))}
        <TextArea name="reason" label="訂正理由" rows={3} value={draft.values.reason} onValueChange={(reason) => draft.update({ reason })} hint="読者に出ている内容を変える理由として操作記録に残ります。" error={errorFor("reason")} />
        {draft.savedAt !== null && <p role="status">下書きを自動保存しました（{draft.savedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}）</p>}
        {updateState.status !== "idle" && <p role="status">{updateState.message}</p>}
        <Button type="submit" tone="primary" busy={updating} busyLabel="訂正を保存しています">訂正を保存</Button>
      </ToolForm>

      {archivedAt === null && (
        <ToolForm action={archiveAction} toolName="archive_published_article" toolDescription="公開済み記事を削除せず非表示にする" className={styles.archiveForm}>
          <input type="hidden" name="siteSlug" value={article.siteSlug} />
          <input type="hidden" name="slug" value={article.slug} />
          <TextArea name="archiveReason" label="非表示にする理由" rows={3} value={archiveReason} onValueChange={setArchiveReason} hint="記事は削除されず、非表示状態で一覧に残ります。" error={archiveState.status === "failed" && archiveState.field === "reason" ? archiveState.message : null} />
          {archiveState.status !== "idle" && <p role="status">{archiveState.message}</p>}
          <Button type="submit" tone="danger" busy={archiving} busyLabel="非表示にしています">記事を非表示にする</Button>
        </ToolForm>
      )}
    </div>
  );
}
