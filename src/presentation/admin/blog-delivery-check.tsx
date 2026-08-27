"use client";

import { useActionState } from "react";
import { Button, FormResult, FormValue, ToolForm } from "@/presentation/ui";
import { checkBlogDeliveryAction } from "./blog-layout-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/**
 * 配信物を「いま」点検する口 (受入 A9)。
 *
 * **設定の保存フォームと別に置いてある。**保存のついでに点検すると、
 * 保存した人が緑を作れてしまい、点検が保存の言い換えになる。
 * 押した時刻とその時の結果が 1 件ずつ残ることに意味があるので、
 * 押す動作もそれ専用にする。
 */
export function BlogDeliveryCheck({ siteSlug }: { readonly siteSlug: string }) {
  const [state, action, pending] = useActionState(
    checkBlogDeliveryAction,
    INITIAL_BLOG_OPS_STATE,
  );

  return (
    <ToolForm
      action={action}
      toolName="check_blog_delivery"
      toolDescription="配信物 9 種を実際に組み立ててみて、欠けているものを一覧に記録する"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <Button type="submit" disabled={pending}>
        {pending ? "点検しています…" : "いま点検する"}
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
