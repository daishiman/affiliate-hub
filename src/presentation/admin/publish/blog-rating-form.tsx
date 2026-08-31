"use client";

import { useActionState, useState } from "react";
import { Button, FormResult, FormValue, TextArea, ToolForm } from "@/presentation/ui";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { manageBlogRatingAction } from "./blog-rating-action";

/**
 * 票 1 件を伏せる／戻す欄。
 *
 * **理由の欄を必ず出す。**「伏せる」だけの押し釦にすると、押した理由が
 * どこにも残らない。読者が書いたものを見えなくする操作なので、
 * あとから「なぜそう判断したか」を辿れる形にしておく（記録側でも必須）。
 *
 * 票ごとに 1 つの欄を置いている。まとめて選ぶ形にすると、
 * 理由が 1 つで複数件に付き、**どの票にどの理由が当たるのかが分からなくなる。**
 */
export function BlogRatingHideForm({
  articleId,
  ratingId,
  hidden,
}: {
  readonly articleId: string;
  readonly ratingId: string;
  /** いま伏せてあるか。伏せてあれば「戻す」側の欄になる。 */
  readonly hidden: boolean;
}) {
  const [state, action, pending] = useActionState(
    manageBlogRatingAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [reason, setReason] = useState("");

  return (
    <ToolForm
      action={action}
      toolName={hidden ? "show_blog_rating" : "hide_blog_rating"}
      toolDescription={
        hidden
          ? "伏せてある評価を読者に見える状態へ戻す（理由が要ります）"
          : "評価を読者から見えなくする（行は消えません。理由が要ります）"
      }
    >
      <FormValue name="intent" value={hidden ? "show" : "hide"} />
      <FormValue name="articleId" value={articleId} />
      <FormValue name="ratingId" value={ratingId} />
      <TextArea
        label={hidden ? "戻す理由" : "伏せる理由"}
        name="reason"
        value={reason}
        onValueChange={setReason}
        rows={2}
        error={state.field === "reason" ? state.message : null}
        hint={
          hidden
            ? "戻すと、この票が平均と件数に入り直します。"
            : "伏せても票は消えません。平均と件数から外れるだけです。"
        }
        toolParamDescription="伏せる／戻す理由 (記録に残ります)"
      />
      <Button type="submit" tone={hidden ? "secondary" : "danger"} disabled={pending}>
        {hidden ? "読者に見えるよう戻す" : "この評価を伏せる"}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
