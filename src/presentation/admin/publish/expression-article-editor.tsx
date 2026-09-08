"use client";

import { useState, type ReactNode } from "react";
import { expressionBlockOfArticleBody, toExpressionArticleBlock } from "@/application/adapters/expression-article-block";
import { EXPRESSION_BLOCK_LABEL, type ExpressionBlock } from "@/domain/authoring/blog-template";
import { safeHref } from "@/domain/blogops";
import { Button, Field, FormValue, Note, TextArea } from "@/presentation/ui";

/** 既存の構造化表現を直接直す。本文記法や区切り文字へ変換しない。 */
export function ExpressionArticleEditor({ name, value, onValueChange }: {
  readonly name: string;
  readonly value: string;
  readonly onValueChange: (body: string) => void;
}) {
  const block = expressionBlockOfArticleBody(value);
  const [history, setHistory] = useState<readonly string[]>([]);
  // 外部復元の値は画面の正本として即時描画。古い履歴から上書きしない。
  const [historySource, setHistorySource] = useState(value);
  if (historySource !== value) {
    setHistorySource(value);
    setHistory([]);
  }
  const update = (next: ExpressionBlock) => {
    const body = toExpressionArticleBlock(next, "", 0).body;
    if (body === value) return;
    setHistory((past) => [...past.slice(-99), value]);
    setHistorySource(body);
    onValueChange(body);
  };
  return (
    <div onKeyDownCapture={(event) => {
      // 共通FieldのEnter移動より先にIME確定を保護する。
      if (event.nativeEvent.isComposing || event.keyCode === 229) event.stopPropagation();
    }}>
      <FormValue name={name} value={value} />
      {block === null ? <Note>構造化した内容を読み取れません。保存済みの値を保持しています。</Note> : <>
        <Note>{EXPRESSION_BLOCK_LABEL[block.kind]}の内容を編集します。</Note>
        <ExpressionFields block={block} onChange={update} />
        <Button type="button" tone="quiet" disabled={history.length === 0} onClick={() => {
          const previous = history.at(-1);
          if (previous === undefined) return;
          setHistorySource(previous);
          setHistory((past) => past.slice(0, -1));
          onValueChange(previous);
        }}>表現の変更を元に戻す</Button>
      </>}
    </div>
  );
}

function ExpressionFields({ block, onChange }: { readonly block: ExpressionBlock; readonly onChange: (block: ExpressionBlock) => void }) {
  switch (block.kind) {
    case "answer":
    case "summary":
      return <TextArea label={block.kind === "answer" ? "先に示す結論" : "まとめ"} value={block.text} onValueChange={(text) => onChange({ ...block, text })} rows={4} />;
    case "key_points":
      return <ExpressionItems label="要点" items={block.items} create={() => ""} onChange={(items) => onChange({ ...block, items })}
        renderItem={(text, index, update) => <Field label={`要点 ${index + 1}`} value={text} onValueChange={update} />} />;
    case "faq":
      return <ExpressionItems label="質問" items={block.items} create={() => ({ question: "", answer: "" })} onChange={(items) => onChange({ ...block, items })}
        renderItem={(item, index, update) => <>
          <Field label={`質問 ${index + 1}`} value={item.question} onValueChange={(question) => update({ ...item, question })} />
          <TextArea label={`回答 ${index + 1}`} value={item.answer} onValueChange={(answer) => update({ ...item, answer })} rows={3} />
        </>} />;
    case "sources":
      return <ExpressionItems<Extract<ExpressionBlock, { kind: "sources" }>["items"][number]> label="出典" items={block.items} create={() => ({ label: "", checkedAt: "" })} onChange={(items) => onChange({ ...block, items })}
        renderItem={(item, index, update) => <>
          <Field label={`出典名 ${index + 1}`} value={item.label} onValueChange={(label) => update({ ...item, label })} />
          <Field label={`確認日 ${index + 1}`} value={item.checkedAt} onValueChange={(checkedAt) => update({ ...item, checkedAt })} placeholder="2026-09-06" />
          <ExpressionLink label={`出典URL ${index + 1}`} value={item.url ?? ""} onChange={(url) => update({ ...item, url })} optional />
        </>} />;
    case "freshness":
      return <>
        <Field label="情報の確認日" value={block.asOf} onValueChange={(asOf) => onChange({ ...block, asOf })} placeholder="2026-09-06" />
        <TextArea label="確認メモ" value={block.note ?? ""} onValueChange={(note) => onChange({ ...block, note })} rows={2} optional />
      </>;
    case "figure":
      return <>
        <TextArea label="図解の説明" value={block.caption} onValueChange={(caption) => onChange({ ...block, caption })} rows={3} />
        <Field label="代替テキスト" value={block.alt} onValueChange={(alt) => onChange({ ...block, alt })} />
        <Note>画像ファイルは本文の画像ブロックで追加できます。</Note>
      </>;
    case "comparison":
      return <TextArea label="比較の説明" value={block.caption} onValueChange={(caption) => onChange({ ...block, caption })} rows={3} />;
    case "cta":
      return <>
        <Field label="リンクの表示文" value={block.label} onValueChange={(label) => onChange({ ...block, label })} />
        <ExpressionLink label="移動先" value={block.href} onChange={(href) => onChange({ ...block, href })} />
      </>;
    case "spec_table":
      return <ExpressionItems label="スペック" items={block.rows} create={() => ({ label: "", value: "" })} onChange={(rows) => onChange({ ...block, rows })}
        renderItem={(row, index, update) => <>
          <Field label={`項目名 ${index + 1}`} value={row.label} onValueChange={(label) => update({ ...row, label })} />
          <Field label={`値 ${index + 1}`} value={row.value} onValueChange={(value) => update({ ...row, value })} />
        </>} />;
    default: {
      const exhaustive: never = block;
      return exhaustive;
    }
  }
}

function ExpressionLink({ label, value, onChange, optional = false }: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly optional?: boolean;
}) {
  return <Field label={label} value={value} onValueChange={onChange} inputMode="url" optional={optional}
    hint="/s/... または https://..."
    error={value.trim() !== "" && safeHref(value) === null ? "この行き先は使えません。URLを確認してください。" : null} />;
}

function ExpressionItems<T>({ label, items, create, onChange, renderItem }: {
  readonly label: string;
  readonly items: readonly T[];
  readonly create: () => T;
  readonly onChange: (items: readonly T[]) => void;
  readonly renderItem: (item: T, index: number, update: (item: T) => void) => ReactNode;
}) {
  return <>
    {items.map((item, index) => <fieldset key={index}>
      <legend>{label} {index + 1}</legend>
      {renderItem(item, index, (next) => onChange(items.map((current, at) => at === index ? next : current)))}
      <Button type="button" tone="quiet" aria-label={`${label} ${index + 1} を削除`} onClick={() => onChange(items.filter((_, at) => at !== index))}>削除</Button>
    </fieldset>)}
    <Button type="button" tone="quiet" onClick={() => onChange([...items, create()])}>{label}を追加</Button>
  </>;
}
