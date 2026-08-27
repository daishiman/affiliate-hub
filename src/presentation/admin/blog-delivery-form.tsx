"use client";

import { useActionState, useState } from "react";
import { type DeliveryPart, DELIVERY_PART_LABEL } from "@/domain/blogops";
import { Button, Field, FormResult, FormValue, TextArea, ToolForm } from "@/presentation/ui";
import { manageBlogDeliveryAction } from "./blog-layout-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/**
 * 配信部品 1 つぶんの出し入れ。
 *
 * 切るときに `note` を書かせるのは、**切った事実が画面に残らない**ためである。
 * feed を切っても画面は何も変わらない。半年後に「なぜ配信が無いのか」を
 * 調べる人が読むのは、この 1 行だけになる。
 */
export function BlogDeliveryForm({
  siteSlug,
  part,
  enabled,
  note,
  position,
}: {
  readonly siteSlug: string;
  readonly part: DeliveryPart;
  readonly enabled: boolean;
  readonly note: string;
  readonly position: number;
}) {
  const [state, action, pending] = useActionState(
    manageBlogDeliveryAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [noteValue, setNoteValue] = useState(note);
  const [positionValue, setPositionValue] = useState(String(position));

  return (
    <ToolForm
      action={action}
      toolName={`save_delivery_part_${part.replace(/-/g, "_")}`}
      toolDescription={`配信経路「${DELIVERY_PART_LABEL[part]}」を出すかどうかと、その理由を決める`}
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <FormValue name="part" value={part} />
      <FormValue name="enabledPresent" value="1" />

      <label>
        <input type="checkbox" name="enabled" defaultChecked={enabled} />
        この経路を出す
      </label>
      <TextArea
        label="覚え書き"
        name="note"
        value={noteValue}
        onValueChange={setNoteValue}
        rows={2}
        optional
        hint="切るときは理由を書いてください。切った跡は画面に残りません。"
        toolParamDescription="この経路を出す / 切る理由の覚え書き"
      />
      <Field
        label="並び順"
        name="position"
        type="number"
        value={positionValue}
        onValueChange={setPositionValue}
        toolParamDescription="配信部品一覧での並び順"
      />

      <Button type="submit" disabled={pending}>
        保存
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
