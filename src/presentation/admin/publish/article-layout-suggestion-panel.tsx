"use client";

import { useState } from "react";
import {
  ARTICLE_BLOCK_LABEL,
  type ArticleBlockKind,
  REQUIRED_BLOCKS,
  TEMPLATE_BLOCK_ORDER,
  blocksOutOfTemplateOrder,
  type ArticleTemplate,
} from "@/domain/blogops";
import { Button, Callout, Foldable, Note, SectionHeading } from "@/presentation/ui";
import type { ArticleBlockDraft } from "./article-block-draft";

/**
 * 既存の版面規則からだけ直し候補を作る。永続化した点数や別の評価器は持たない。
 * 1件ずつ差分を見て適用し、直後に同じ場所から元へ戻せる。
 *
 * **`/admin/improvement` の「改善の状況」とは別物である。**あちらはサイト単位の
 * A/B 実験ループで、統計的な判定と承認を伴い、結果が出るまで日単位で待つ。
 * こちらは記事 1 本の版面規則の照合で、即時に結果が出て、その場で取り消せる。
 * 同じ「改善」という語で呼ぶと運営者はどちらの手続きに居るか分からなくなるので、
 * 語彙も識別子も「版面チェック」側へ寄せてある。**2 つを統合しないこと。**
 */
export function ArticleLayoutSuggestionPanel({
  template,
  rows,
  onRowsChange,
}: {
  readonly template: ArticleTemplate;
  readonly rows: readonly ArticleBlockDraft[];
  readonly onRowsChange: (rows: readonly ArticleBlockDraft[]) => void;
}) {
  const [undo, setUndo] = useState<{
    readonly rows: readonly ArticleBlockDraft[];
    readonly message: string;
  } | null>(null);
  const present = new Set(rows.map((row) => row.kind));
  const missing = REQUIRED_BLOCKS[template].filter((kind) => !present.has(kind));
  const misordered = blocksOutOfTemplateOrder(template, rows);

  const applyMissing = (kind: ArticleBlockKind) => {
    setUndo({ rows, message: `${ARTICLE_BLOCK_LABEL[kind]}の追加を取り消せます。` });
    onRowsChange([...rows, { id: "", kind, heading: "", body: "" }]);
  };

  const applyOrder = () => {
    const order = TEMPLATE_BLOCK_ORDER[template];
    const reordered = rows
      .map((row, index) => ({ row, index }))
      .sort((left, right) => {
        const leftOrder = order.indexOf(left.row.kind);
        const rightOrder = order.indexOf(right.row.kind);
        const normalizedLeft = leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder;
        const normalizedRight = rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder;
        return normalizedLeft - normalizedRight || left.index - right.index;
      })
      .map(({ row }) => row);
    setUndo({ rows, message: "部品の並べ替えを取り消せます。" });
    onRowsChange(reordered);
  };

  return (
    <section aria-labelledby="article-layout-check-title">
      <SectionHeading level={3} id="article-layout-check-title">版面チェック</SectionHeading>
      {missing.length === 0 && misordered.length === 0 ? (
        <Note>版面ルールから見つかる直しどころはありません。</Note>
      ) : null}

      {missing.map((kind) => (
        <article key={`missing-${kind}`}>
          <strong>優先度 高</strong>
          <p>該当箇所: 本文の末尾 — {ARTICLE_BLOCK_LABEL[kind]}が足りません。</p>
          <Foldable summary="差分を確認">
            <p>追加: 空の「{ARTICLE_BLOCK_LABEL[kind]}」を本文の末尾へ1件追加します。</p>
          </Foldable>
          <Button type="button" tone="secondary" onClick={() => applyMissing(kind)}>
            この1件を適用
          </Button>
        </article>
      ))}

      {misordered.length > 0 ? (
        <article>
          <strong>優先度 中</strong>
          <p>該当箇所: 本文全体 — 版面の読む順と異なる部品があります。</p>
          <Foldable summary="並びの差分を確認">
            <p>
              変更後: {TEMPLATE_BLOCK_ORDER[template]
                .filter((kind) => present.has(kind))
                .map((kind) => ARTICLE_BLOCK_LABEL[kind])
                .join(" → ")}
            </p>
          </Foldable>
          <Button type="button" tone="secondary" onClick={applyOrder}>
            並び1件を適用
          </Button>
        </article>
      ) : null}

      {undo !== null ? (
        <Callout
          tone="success"
          title="版面の直しを反映しました"
          reason={undo.message}
          action={
            <Button
              type="button"
              tone="quiet"
              onClick={() => {
                onRowsChange(undo.rows);
                setUndo(null);
              }}
            >
              元に戻す
            </Button>
          }
        />
      ) : null}
    </section>
  );
}
