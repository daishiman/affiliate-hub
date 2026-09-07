"use client";

import { isExpressionArticleBody } from "@/application/adapters/expression-article-block";
import { ARTICLE_BLOCK_LABEL } from "@/domain/blogops";
import { ProseEditor } from "@/presentation/prose";
import { Button, Field, FormValue } from "@/presentation/ui";
import { searchArticleProducts, uploadArticleImage } from "./article-asset-client";
import type { ArticleBlockDraft } from "./article-block-draft";
import styles from "./article-editor.module.css";
import { ExpressionArticleEditor } from "./expression-article-editor";

/** 章の操作と本文編集を分離する。本文内ブロックの操作は ProseEditor だけが持つ。 */
export function ArticleEditorSection({ row, index, total, anchor, articleId, onChange, onMove }: {
  readonly row: ArticleBlockDraft;
  readonly index: number;
  readonly total: number;
  readonly anchor: string;
  readonly articleId: string;
  readonly onChange: (patch: Partial<ArticleBlockDraft>) => void;
  readonly onMove: (step: -1 | 1) => void;
}) {
  const label = ARTICLE_BLOCK_LABEL[row.kind];
  return (
    <fieldset className={styles.section} id={anchor}>
      <legend>{index + 1}. {label}</legend>
      <div className={styles.sectionActions}>
        <Button type="button" tone="quiet" disabled={index === 0}
          aria-label={`${label}を 1 つ上へ`} onClick={() => onMove(-1)}>1 つ上へ</Button>
        <Button type="button" tone="quiet" disabled={index === total - 1}
          aria-label={`${label}を 1 つ下へ`} onClick={() => onMove(1)}>1 つ下へ</Button>
      </div>
      <FormValue name={`blocks[${index}].kind`} value={row.kind} />
      {row.id === "" ? null : <FormValue name={`blocks[${index}].id`} value={row.id} />}
      <Field label="章の見出し" name={`blocks[${index}].heading`} value={row.heading}
        onValueChange={(heading) => onChange({ heading })} optional
        toolParamDescription={`${label}の見出し`} />
      {isExpressionArticleBody(row.body) ? (
        <ExpressionArticleEditor name={`blocks[${index}].body`} value={row.body}
          onValueChange={(body) => onChange({ body })} />
      ) : (
        <ProseEditor label="本文" name={`blocks[${index}].body`} value={row.body}
          onValueChange={(body) => onChange({ body })}
          toolParamDescription={`${label}の本文（拡張 Markdown）`}
          onSearchProducts={searchArticleProducts}
          onUploadImage={(file) => uploadArticleImage(articleId, file)} />
      )}
    </fieldset>
  );
}
