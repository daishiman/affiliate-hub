"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormResult, FormValue, Select, ToolForm } from "@/presentation/ui";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { manageBlogPlacementAction } from "./blog-placement-action";

/**
 * 記事のどこに成果リンクを出しているかを台帳へ記録する欄（受入 A7）。
 *
 * 台帳は逆引き index、読者側の正本は記事の `cta` ブロック。
 * 保存は D1 の同じ batch で両方へ反映し、中間状態を作らない。
 *
 * --- 追跡コードは任意 ---
 * 空欄は「コードの無い掲載」を指す。空文字のまま送ると `''` の行と
 * `NULL` の行が別物として並ぶので、ユースケース側で寄せている。
 */

const SLOT_OPTIONS = [
  { value: "intro", label: "導入" },
  { value: "comparison", label: "比較" },
  { value: "conclusion", label: "まとめ" },
] as const;

export function BlogPlacementForm({
  siteSlug,
  articleSlugs,
}: {
  readonly siteSlug: string;
  /** このブログの記事の道しるべ。台帳は外部キーを持たないので、選ばせて打ち間違いを防ぐ。 */
  readonly articleSlugs: readonly string[];
}) {
  const [state, action, pending] = useActionState(
    manageBlogPlacementAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [articleSlug, setArticleSlug] = useState(articleSlugs[0] ?? "");
  const [placement, setPlacement] = useState<string>(SLOT_OPTIONS[0].value);
  const [trackingCode, setTrackingCode] = useState("");
  const [position, setPosition] = useState("0");

  return (
    <ToolForm
      action={action}
      toolName="record_blog_placement"
      toolDescription="成果リンクの掲載を記録し、同じ操作で読者の記事へ CTA を反映する。"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      <Select
        name="articleSlug"
        label="対象の記事"
        value={articleSlug}
        onValueChange={setArticleSlug}
        options={articleSlugs.map((slug) => ({ value: slug, label: slug }))}
        error={state.field === "articleSlug" ? state.message : null}
      />
      <Select
        name="placement"
        label="掲載位置"
        value={placement}
        onValueChange={setPlacement}
        options={[...SLOT_OPTIONS]}
        error={state.field === "placement" ? state.message : null}
      />
      <Field
        name="trackingCode"
        label="追跡コード"
        value={trackingCode}
        onValueChange={setTrackingCode}
        optional
        hint="空のままにすると「コードの無い掲載」として記録します。"
        error={state.field === "trackingCode" ? state.message : null}
      />
      <Field
        name="position"
        label="同じ位置の中での並び"
        value={position}
        onValueChange={setPosition}
        inputMode="numeric"
        hint="同じ位置に複数出すときの目安です。分からなければ 0 のままで構いません。"
        error={state.field === "position" ? state.message : null}
      />
      {/*
        `intent` は押した押しボタン自身が名乗る。隠し欄に置くと、
        `FormData.get("intent")` が先に現れる隠し欄を拾い、
        外す押しボタンを押しても記録が走る。
      */}
      <Button
        type="submit"
        name="intent"
        value="save"
        tone="primary"
        busy={pending}
        busyLabel="記録しています"
      >
        記録して記事へ反映する
      </Button>
      <Button type="submit" name="intent" value="remove" busy={pending}>
        この掲載を台帳から外す
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
