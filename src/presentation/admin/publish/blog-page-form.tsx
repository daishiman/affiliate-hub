"use client";

import { useActionState, useState } from "react";
import {
  type FixedPageKind,
  FIXED_PAGE_LABEL,
  type FixedPageStatus,
  FIXED_PAGE_STATUSES,
  FIXED_PAGE_STATUS_LABEL,
} from "@/domain/blogops";
import { Button, Field, FormResult, FormValue, Select, TextArea, ToolForm } from "@/presentation/ui";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { DeleteConfirm } from "../delete-confirm";
import { manageBlogPageAction } from "./blog-page-action";

/**
 * 固定ページ 1 枚ぶん。
 *
 * 種類 (`kind`) は選ばせない。**運営が示すべきページの一覧は決まっている**ので、
 * 画面側は「不足している枠を埋める」形にしてある。
 * 種類を自由入力にすると、運営者情報が 2 枚できたり、
 * 名前だけ違う同じページが並んだりする。
 */
export function BlogPageForm({
  siteSlug,
  kind,
  title,
  body,
  status,
  exists,
}: {
  readonly siteSlug: string;
  readonly kind: FixedPageKind;
  readonly title: string;
  readonly body: string;
  readonly status: FixedPageStatus;
  /** すでにあるか。無いときは「消す」を出さない。 */
  readonly exists: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageBlogPageAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [titleValue, setTitleValue] = useState(title);
  const [bodyValue, setBodyValue] = useState(body);
  const [statusValue, setStatusValue] = useState<FixedPageStatus>(status);

  const label = FIXED_PAGE_LABEL[kind];

  return (
    <>
      <ToolForm
        action={action}
        toolName={`save_fixed_page_${kind.replace(/-/g, "_")}`}
        toolDescription={`固定ページ「${label}」の見出しと本文を書く`}
      >
        <FormValue name="intent" value="save" />
        <FormValue name="siteSlug" value={siteSlug} />
        <FormValue name="kind" value={kind} />

        <Field
          label="見出し"
          name="title"
          value={titleValue}
          onValueChange={setTitleValue}
          error={state.field === "title" ? state.message : null}
          toolParamDescription={`${label}の見出し`}
        />
        <TextArea
          label="本文"
          name="body"
          value={bodyValue}
          onValueChange={setBodyValue}
          rows={10}
          error={state.field === "body" ? state.message : null}
          toolParamDescription={`${label}の本文`}
        />
        <Select
          label="公開状態"
          name="status"
          value={statusValue}
          onValueChange={(value) => setStatusValue(value as FixedPageStatus)}
          options={FIXED_PAGE_STATUSES.map((value) => ({
            value,
            label: FIXED_PAGE_STATUS_LABEL[value],
          }))}
          error={state.field === "status" ? state.message : null}
          hint="下書きは保存されますが、読者のページとフッターには出ません。"
          toolParamDescription="固定ページの公開状態"
        />

        <Button type="submit" disabled={pending}>
          {exists ? "この固定ページを直す" : "この固定ページを作る"}
        </Button>
        <FormResult state={state} />
      </ToolForm>

      {exists ? (
        <DeleteConfirm
          action={manageBlogPageAction}
          toolName={`delete_fixed_page_${kind.replace(/-/g, "_")}`}
          toolDescription={`固定ページ「${label}」を消す（理由が要ります）`}
          idName="kind"
          idValue={kind}
          hiddenValues={[
            { name: "intent", value: "delete" },
            { name: "siteSlug", value: siteSlug },
          ]}
          label={`固定ページ「${label}」`}
          verb="消す"
          consequence="消すと、この枠は一覧で「不足」に戻ります。"
        />
      ) : null}
    </>
  );
}

/** 削除済みの本文を新規保存で上書きせず、同じ行を明示的に戻す。 */
export function BlogPageRestoreForm({
  pageId,
  siteSlug,
  kind,
}: {
  readonly pageId: string;
  readonly siteSlug: string;
  readonly kind: FixedPageKind;
}) {
  const [state, action, pending] = useActionState(
    manageBlogPageAction,
    INITIAL_BLOG_OPS_STATE,
  );
  return (
    <ToolForm
      action={action}
      toolName={`restore_fixed_page_${kind.replace(/-/g, "_")}`}
      toolDescription={`削除済みの固定ページ「${FIXED_PAGE_LABEL[kind]}」を元の内容で戻す`}
    >
      <FormValue name="intent" value="restore" />
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="kind" value={kind} />
      <FormValue name="pageId" value={pageId} />
      <Button type="submit" disabled={pending}>元の内容で戻す</Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
