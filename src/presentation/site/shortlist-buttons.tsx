"use client";

import { useActionState } from "react";
import { Button, FormResult, FormValue, ToolForm } from "@/presentation/ui";
import { removeFromShortlistAction, saveToShortlistAction } from "./shortlist-action";
import { INITIAL_SHORTLIST_FORM_STATE } from "./shortlist-form-state";

/**
 * 「気になる」の押しどころ 2 つ。
 *
 * --- なぜ欄の無いフォームなのか ---
 * 読者に入力させることが何も無いので、送る値はすべて隠して持たせる。
 * それでも `<form>` にしてサーバ動作へ渡す。押しただけで画面の状態が変わる
 * 作りにすると、通信が失敗したことを読者へ伝える場所が無くなる。
 *
 * --- 押したあと必ず何か言う ---
 * 保存中・保存した・失敗したの 3 つを出す。押しても何も変わらない状態は、
 * 読者から見て「壊れている」と「押せていない」の区別が付かない。
 */

export function ShortlistSaveButton({
  siteSlug,
  productId,
  productName,
  fromArticleHref,
  oneLine,
}: {
  readonly siteSlug: string;
  readonly productId: string;
  readonly productName: string;
  /** どの記事から保存したか。あとで「なぜ保存したか」を思い出す手がかり。 */
  readonly fromArticleHref?: string;
  readonly oneLine?: string;
}) {
  const [state, action, pending] = useActionState(
    saveToShortlistAction,
    INITIAL_SHORTLIST_FORM_STATE,
  );

  return (
    <ToolForm
      action={action}
      toolName="save_to_shortlist_here"
      toolDescription="この商品を、読者の「気になる商品」へ保存する"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="productId" value={productId} />
      <FormValue name="productName" value={productName} />
      {fromArticleHref !== undefined && (
        <FormValue name="fromArticleHref" value={fromArticleHref} />
      )}
      {oneLine !== undefined && <FormValue name="oneLine" value={oneLine} />}

      <Button type="submit" disabled={pending}>
        {pending ? "保存しています…" : "気になる"}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

export function ShortlistRemoveButton({
  siteSlug,
  productId,
  productName,
}: {
  readonly siteSlug: string;
  readonly productId: string;
  readonly productName: string;
}) {
  const [state, action, pending] = useActionState(
    removeFromShortlistAction,
    INITIAL_SHORTLIST_FORM_STATE,
  );

  return (
    <ToolForm
      action={action}
      toolName="remove_from_shortlist_here"
      toolDescription="この商品を、読者の「気になる商品」から外す"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="productId" value={productId} />

      <Button type="submit" tone="quiet" disabled={pending}>
        {pending ? "外しています…" : `${productName} を外す`}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
