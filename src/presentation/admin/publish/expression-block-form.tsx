"use client";

import { useActionState, useState } from "react";
import {
  EXPRESSION_BLOCK_LABEL,
  type ExpressionBlockKind,
} from "@/domain/authoring/blog-template";
import { Button, Field, FormResult, FormValue, Select, TextArea, ToolForm } from "@/presentation/ui";
import { manageBlogArticleAction } from "./blog-article-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";
import { INSERTABLE_EXPRESSION_BLOCK_KINDS } from "./expression-block-input";

const CONTENT_INPUT: Readonly<Record<ExpressionBlockKind, {
  readonly label: string;
  readonly hint: string;
  readonly rows: number;
}>> = {
  answer: { label: "先に示す結論", hint: "読者の質問へ最初に返す短い答え", rows: 3 },
  key_points: { label: "要点（1行1件）", hint: "例: 軽い", rows: 5 },
  faq: { label: "FAQ（1行に 質問 | 回答）", hint: "例: 保証は？ | 1年です。", rows: 5 },
  sources: {
    label: "出典（1行に 名称 | 確認日 | URL）",
    hint: "例: 公式仕様 | 2026-08-31 | https://example.com/spec（URLは省略可）",
    rows: 5,
  },
  freshness: { label: "情報の確認日", hint: "YYYY-MM-DD", rows: 2 },
  figure: { label: "図解の説明", hint: "図の下に表示する説明", rows: 3 },
  comparison: { label: "比較の説明", hint: "何をどう比べるか", rows: 3 },
  cta: { label: "リンクの表示文", hint: "例: 公式サイトを見る", rows: 3 },
  summary: { label: "まとめ", hint: "読者が次に判断できる結論", rows: 3 },
  spec_table: { label: "スペック（1行に 項目: 値）", hint: "例: 重さ: 900g", rows: 5 },
};

const DETAIL_INPUT: Readonly<Partial<Record<ExpressionBlockKind, {
  readonly label: string;
  readonly hint: string;
}>>> = {
  freshness: { label: "確認メモ（任意）", hint: "例: 公式仕様を再確認済み" },
  figure: { label: "代替テキスト", hint: "画像を見られない人にも内容が伝わる説明" },
  cta: { label: "移動先", hint: "例: /go/offer-1 または https://example.com" },
};

export function ExpressionBlockAppendForm({ articleId }: { readonly articleId: string }) {
  const [state, action, pending] = useActionState(manageBlogArticleAction, INITIAL_BLOG_OPS_STATE);
  const [kind, setKind] = useState<(typeof INSERTABLE_EXPRESSION_BLOCK_KINDS)[number]>("figure");
  const [content, setContent] = useState("");
  const [detail, setDetail] = useState("");
  const contentInput = CONTENT_INPUT[kind];
  const detailInput = DETAIL_INPUT[kind];

  return (
    <ToolForm
      action={action}
      toolName="append_expression_block"
      toolDescription="結論・要点・FAQ・出典・鮮度を含む10種の表現を構造化したまま記事へ追加する。"
    >
      <FormValue name="intent" value="append_expression" />
      <FormValue name="articleId" value={articleId} />
      <Select
        name="kind"
        label="足す表現"
        value={kind}
        onValueChange={(value) => {
          const selected = INSERTABLE_EXPRESSION_BLOCK_KINDS.find((candidate) => candidate === value);
          if (selected !== undefined) setKind(selected);
        }}
        options={INSERTABLE_EXPRESSION_BLOCK_KINDS.map((value) => ({
          value,
          label: EXPRESSION_BLOCK_LABEL[value],
        }))}
        error={state.field === "kind" ? state.message : null}
      />
      <TextArea
        name="content"
        label={contentInput.label}
        value={content}
        onValueChange={setContent}
        rows={contentInput.rows}
        hint={contentInput.hint}
        error={state.field === "content" ? state.message : null}
      />
      {detailInput !== undefined ? (
        <Field
          name="detail"
          label={detailInput.label}
          value={detail}
          onValueChange={setDetail}
          hint={detailInput.hint}
          error={state.field === "detail" ? state.message : null}
        />
      ) : (
        <FormValue name="detail" value="" />
      )}
      <Button type="submit" tone="primary" busy={pending} busyLabel="追加しています">
        記事へ追加する
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}
