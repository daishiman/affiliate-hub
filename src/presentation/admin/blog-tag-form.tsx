"use client";

import { useActionState, useState } from "react";
import { BLOG_TAG_KIND_LABEL, BLOG_TAG_KINDS } from "@/domain/blogops";
import { Button, Field, FormResult, FormValue, Select, TextArea, ToolForm } from "@/presentation/ui";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { DeleteConfirm } from "./delete-confirm";
import { manageBlogTagAction } from "./blog-tag-action";

/**
 * タグ 1 つぶん。足すのも直すのも同じ形。
 *
 * `tagId` が空なら新しく足し、入っていれば直す。
 * 「足す画面」と「直す画面」を分けないのは、**タグは項目が 3 つしかない**ため。
 * 画面を分けると、行き来のほうが入力より手間になる。
 */
export function BlogTagForm({
  siteSlug,
  tagId,
  slug,
  name,
  description,
  kind,
}: {
  readonly siteSlug: string;
  /** 空文字なら新規。 */
  readonly tagId: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  /**
   * ブランドか話題か。**新規では空文字を渡す。**
   *
   * 既定を勝手に選ばせない。この欄は「サイドバーのブランド一覧に出るか」を
   * 決めていて、選び直すのは足したあとでは気づきにくい。
   */
  readonly kind: string;
}) {
  const [state, action, pending] = useActionState(
    manageBlogTagAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [slugValue, setSlugValue] = useState(slug);
  const [nameValue, setNameValue] = useState(name);
  const [descriptionValue, setDescriptionValue] = useState(description);
  const [kindValue, setKindValue] = useState(kind);

  const editing = tagId !== "";

  return (
    <>
      <ToolForm
        action={action}
        toolName={editing ? "update_blog_tag" : "create_blog_tag"}
        toolDescription={
          editing ? "タグの名前・住所・説明を直す" : "タグを 1 つ足す（住所・名前・説明）"
        }
      >
        <FormValue name="intent" value="save" />
        <FormValue name="siteSlug" value={siteSlug} />
        <FormValue name="tagId" value={tagId} />

        <Field
          label="タグの住所"
          name="slug"
          value={slugValue}
          onValueChange={setSlugValue}
          error={state.field === "slug" ? state.message : null}
          hint="小文字の英数字とハイフン。タグ一覧の URL になります。"
          toolParamDescription="タグの URL に使う識別名 (slug)"
        />
        <Field
          label="表に出す名前"
          name="name"
          value={nameValue}
          onValueChange={setNameValue}
          error={state.field === "name" ? state.message : null}
          toolParamDescription="読者に見せるタグ名"
        />
        <Select
          label="タグの種類"
          name="kind"
          value={kindValue}
          onValueChange={setKindValue}
          options={BLOG_TAG_KINDS.map((k) => ({ value: k, label: BLOG_TAG_KIND_LABEL[k] }))}
          placeholder="選んでください"
          error={state.field === "kind" ? state.message : null}
          hint="サイドバーのブランド一覧に出るのは「ブランド」だけです。話題はそこには出ません。"
          toolParamDescription="タグの種類 (brand=商品の作り手 / topic=記事のまとめ方)"
        />
        <TextArea
          label="説明"
          name="description"
          value={descriptionValue}
          onValueChange={setDescriptionValue}
          rows={2}
          optional
          hint="タグ一覧の先頭に、この文がそのまま出ます。"
          toolParamDescription="タグの説明文"
        />

        <Button type="submit" disabled={pending}>
          {editing ? "直す" : "タグを足す"}
        </Button>
        <FormResult state={state} />
      </ToolForm>

      {editing ? (
        <DeleteConfirm
          action={manageBlogTagAction}
          toolName="delete_blog_tag"
          toolDescription="タグを消す（理由が要ります）"
          idName="tagId"
          idValue={tagId}
          hiddenValues={[
            { name: "intent", value: "delete" },
            { name: "siteSlug", value: siteSlug },
          ]}
          label={`タグ「${name}」`}
          verb="消す"
          consequence="タグを消しても記事は消えませんが、このまとまりは無くなります。"
        />
      ) : null}
    </>
  );
}
