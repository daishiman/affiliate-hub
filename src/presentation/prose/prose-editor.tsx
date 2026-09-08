"use client";

import { useEffect, useId, useRef, useState } from "react";
import { PROSE_MENU_ORDER, PROSE_NODE_METADATA, type ProseNode, type ProseNodeKind, emptyProseNode } from "@/domain/blogops";
import { Icon } from "@/presentation/ui";
import { ProseBody, type ProductCardRenderer } from "./prose-body";
import { useProseDraft, type ProseRow } from "./use-prose-draft";
import { canConvertText, convertTextBlock, TEXT_BLOCK_KINDS } from "./prose-conversion";
import { PROSE_NODE_ICON } from "./prose-node-icons";
import { ProseMenu } from "./prose-menu";
import { NodeEditor } from "./prose-node-editor";
import { IconButton } from "./prose-fields";
import type { ProductPick } from "./prose-asset-fields";
import styles from "./prose.module.css";

export { PROSE_NODE_ICON } from "./prose-node-icons";
export type { ProductPick } from "./prose-asset-fields";

/**
 * 本文を、出来上がりの形のまま書く欄。
 *
 * ## なぜ素の入力欄ではないのか
 *
 * 本文は保存のときだけ文字列になる。書いている間は**断片の並び**で扱う。
 * 記法を覚えている人しか書けない欄は、記法を覚えていない人が
 * 「書けない」のではなく「**気づかずに崩す**」。行頭の `-` を 1 つ消しただけで
 * 箇条書きが段落に変わり、公開されるまで誰も気づかない。
 *
 * ここでは断片ごとに欄が分かれているので、崩しようがない。
 * 行の中の装飾も同じ理由で `RichText` が受け持ち、`**` のような記法の文字は
 * **編集面に一切出さない** (受け入れ A1)。
 *
 * ## 2 層の見出し
 *
 * 節の見出しは記事の骨格が決める見出し 2 で、この欄は触らない。
 * ここで選べるのは断片の見出し 3 と 4 だけである (FRONT-REQ-008)。
 * 挿入・移動・削除・貼り付けのどれでも段の深さは動かない——
 * 深さは断片が自分で持っていて、並びの位置から導かれないからである。
 *
 * ## `/` で足す
 *
 * 空の段落で `/` を打つと候補が出る。続けて打った文字で絞る。
 * **`/` だけに頼らない**のは、その作法を知らない人と、
 * 読み上げで操作する人が取り残されるためである。同じことができる
 * 「部品を足す」ボタンを必ず並べて置く。
 *
 * ## 保存の形
 *
 * 送るのは今までどおり 1 本の文字列 (`serializeProse`)。
 * 保存の形を変えていないので、この欄を使わずに書いた本文も、
 * ローカルの CLI が書いた本文も、そのまま読み込める (受け入れ A7)。
 */

export type ProseEditorProps = {
  readonly label: string;
  /** 保存される文字列を送る名前。中身は `serializeProse` の結果。 */
  readonly name: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /**
   * 商品を探す。**渡さないと商品カードは挿せない。**
   *
   * id の手入力欄は置かない (受け入れ A4)。打てるようにすると、
   * 存在しない id や他の作業場の id が本文へ入り、
   * 公開されるまで誰も気づかない。
   */
  readonly onSearchProducts?: (query: string) => Promise<readonly ProductPick[]>;
  /**
   * 画像を送る。**渡さないと画像は挿せない。**
   *
   * URL の手入力欄は置かない (受け入れ A5)。よそのサイトの画像を指すと、
   * 相手が消した日に記事から絵が消える。返すのは置いた先の URL。
   */
  readonly onUploadImage?: (file: File) => Promise<string>;
  readonly productOptions?: readonly ProductPick[];
  readonly renderProductCard?: ProductCardRenderer;
  /** この欄が AI から見て何の値かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
};

export function ProseEditor({
  label,
  name,
  value,
  onValueChange,
  onSearchProducts,
  onUploadImage,
  productOptions,
  renderProductCard,
  toolParamDescription,
}: ProseEditorProps) {
  const groupId = useId();

  const draft = useProseDraft(value, onValueChange);
  const root = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [focusRow, setFocusRow] = useState<string | null>(null);
  /** どの断片でメニューが開いているか。開いていなければ `null`。 */
  const [menuAt, setMenuAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const rows = draft.rows;
  useEffect(() => {
    if (focusRow === null) return;
    root.current?.querySelector<HTMLElement>(`[data-prose-row="${focusRow}"] [contenteditable], [data-prose-row="${focusRow}"] input, [data-prose-row="${focusRow}"] textarea`)?.focus();
  }, [focusRow]);

  function replaceAt(id: string, update: ProseNode | ((current: ProseNode) => ProseNode)) {
    draft.change((current) => {
      if (!current.some((row) => row.id === id)) return current;
      return current.map((row) => row.id === id ? { ...row, node: typeof update === "function" ? update(row.node) : update } : row);
    });
  }

  function removeAt(id: string) {
    draft.change((current) => current.filter((row) => row.id !== id));
    setMenuAt(null);
  }

  function moveAt(id: string, step: -1 | 1) {
    draft.change((current) => {
      const index = current.findIndex((row) => row.id === id);
      const to = index + step;
      if (index < 0 || to < 0 || to >= current.length) return current;
      const next = [...current];
      [next[index], next[to]] = [next[to]!, next[index]!];
      return next;
    });
  }

  /** 掴んで動かしている断片。掴んでいなければ `null`。 */
  const [dragging, setDragging] = useState<string | null>(null);
  /** いま離すとどこへ入るか。線を出す位置でもある。 */
  const [dropTo, setDropTo] = useState<{ id: string; side: DropSide } | null>(null);

  function endDrag() {
    setDragging(null);
    setDropTo(null);
  }

  function dropOn(targetId: string, side: DropSide) {
    const draggedId = dragging;
    endDrag();
    if (draggedId === null) return;
    draft.change((current) => reorder(current, draggedId, targetId, side));
  }

  function insertAfter(id: string, kind: ProseNodeKind, copy?: ProseNode) {
    const added = draft.createRow(copy ?? emptyProseNode(kind));
    draft.change((current) => {
      const next = [...current];
      next.splice(current.findIndex((row) => row.id === id) + 1, 0, added);
      return next;
    });
    setFocusRow(added.id);
    setMenuAt(null);
    setQuery("");
  }

  /** `/` を打った段落そのものを、選ばれた種類に置き換える。 */
  function convertAt(id: string, kind: ProseNodeKind) {
    replaceAt(id, emptyProseNode(kind));
    setFocusRow(id);
    setMenuAt(null);
    setQuery("");
  }

  return (
    <div className={styles.field} ref={root} onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") { setMenuAt(null); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        const target = event.target as HTMLElement;
        // Native controls keep their own input history; contenteditable shares the block history.
        if (target.matches("input, textarea")) return;
        event.preventDefault();
        if (event.shiftKey) draft.redo(); else draft.undo();
      }
    }}>
      <span className={styles.label} id={`${groupId}-label`}>
        {label}
      </span>

      {/*
        保存はこの 1 本だけが担う。断片ごとの欄には `name` を付けない。
        付けると、断片の数だけ増える名前をサーバ側が知ることになる。
      */}
      <input
        type="hidden"
        name={name}
        value={value}
        readOnly
        toolparamdescription={toolParamDescription}
      />

      <div className={styles.proseEditorToolbar}>
        <button type="button" className={styles.proseEditorMenuItem} disabled={!draft.canUndo} onClick={draft.undo}>元に戻す</button>
        <button type="button" className={styles.proseEditorMenuItem} disabled={!draft.canRedo} onClick={draft.redo}>やり直す</button>
        <button type="button" className={styles.proseEditorMenuItem} aria-pressed={preview} onClick={() => { setPreview(!preview); setMenuAt(null); }}>{preview ? "編集に戻る" : "本文プレビュー"}</button>
      </div>
      {preview && <div className={styles.prosePreview} aria-label="本文プレビュー"><ProseBody body={value} keyPrefix={groupId} renderProductCard={renderProductCard ?? ((id) => <p>{productOptions?.find((product) => product.id === id)?.name ?? "選択した商品（公開時に商品情報を表示）"}</p>)} /></div>}
      <div hidden={preview} aria-labelledby={`${groupId}-label`} className={styles.proseEditor} role="group">
        {rows.map(({ node, id }, index) => (
          <div
            className={[
              styles.proseEditorRow,
              dragging === id ? styles.proseEditorRowDragging : "",
              dropTo?.id === id ? (dropTo.side === "before" ? styles.proseEditorRowDropBefore : styles.proseEditorRowDropAfter) : "",
            ].filter(Boolean).join(" ")}
            data-prose-row={id}
            data-drop-side={dropTo?.id === id ? dropTo.side : undefined}
            key={id}
            onDragOver={(event) => {
              if (dragging === null) return;
              /* 既定の動作を止めないと、ブラウザは「ここには落とせない」と見なす。 */
              event.preventDefault();
              setDropTo({ id, side: sideOfPointer(event.currentTarget.getBoundingClientRect(), event.clientY) });
            }}
            onDragLeave={(event) => {
              /* 子要素へ移っただけの離脱では線を消さない。 */
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              setDropTo((current) => (current?.id === id ? null : current));
            }}
            onDrop={(event) => {
              if (dragging === null) return;
              event.preventDefault();
              dropOn(id, sideOfPointer(event.currentTarget.getBoundingClientRect(), event.clientY));
            }}
          >
            <div className={styles.proseEditorBar} onMouseDown={(event) => {
              // 押下途中に本文がblurすると装飾帯が消え、SPのscroll anchoringで
              // ボタンがmouseup位置から逃げる。選択を保ち、click後に操作先へ移す。
              if (event.button === 0 && (event.target as Element).closest("button")) event.preventDefault();
            }}>
              <span className={styles.proseEditorKind}>
                <button
                  aria-label={`${PROSE_NODE_METADATA[node.kind].label}を掴んで動かす`}
                  className={`${styles.proseEditorIconButton} ${styles.proseEditorGrip}`}
                  draggable
                  onDragEnd={endDrag}
                  onDragStart={(event) => {
                    setDragging(id);
                    /* 何も入れないと Firefox がドラッグを始めない。 */
                    event.dataTransfer.setData("text/plain", id);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  title="掴んで動かす"
                  type="button"
                >
                  <Icon name="grip" size="sm" />
                </button>
                <Icon name={PROSE_NODE_ICON[node.kind]} size="sm" />
                {canConvertText(node) ? <select aria-label={`${PROSE_NODE_METADATA[node.kind].label}の種類を変更`} className={styles.proseEditorSelect} value={node.kind} onChange={(event) => replaceAt(id, convertTextBlock(node, event.target.value as ProseNodeKind))}>
                  {TEXT_BLOCK_KINDS.map((kind) => <option key={kind} value={kind} disabled={kind === "heading" && (("text" in node && node.text.includes("\n")) || ("items" in node && node.items.length > 1))}>{PROSE_NODE_METADATA[kind].label}</option>)}
                </select> : PROSE_NODE_METADATA[node.kind].label}
              </span>
              <span className={styles.proseEditorActions}>
                <IconButton
                  disabled={index === 0}
                  icon="moveUp"
                  label={`${PROSE_NODE_METADATA[node.kind].label}を 1 つ上へ`}
                  onClick={() => moveAt(id, -1)}
                />
                <IconButton
                  disabled={index === rows.length - 1}
                  icon="moveDown"
                  label={`${PROSE_NODE_METADATA[node.kind].label}を 1 つ下へ`}
                  onClick={() => moveAt(id, 1)}
                />
                <IconButton
                  icon="removeItem"
                  label={`${PROSE_NODE_METADATA[node.kind].label}を消す`}
                  onClick={() => removeAt(id)}
                />
                <IconButton
                  icon="addItem"
                  label={`${PROSE_NODE_METADATA[node.kind].label}の下に部品を足す`}
                  onClick={() => {
                    setFocusRow(null);
                    setMenuAt(menuAt === id ? null : id);
                    setQuery("");
                  }}
                />
                <button type="button" className={styles.proseEditorMenuItem} aria-label={`${PROSE_NODE_METADATA[node.kind].label}を複製`} onClick={() => insertAfter(id, node.kind, structuredClone(node))}>複製</button>
              </span>
            </div>

            <NodeEditor
              node={node}
              onChange={(next) => replaceAt(id, next)}
              productOptions={productOptions}
              onSplit={(before, after) => {
                const added = draft.createRow({ kind: "paragraph", text: after });
                draft.change((current) => current.flatMap((row) => row.id === id ? [{ ...row, node: { kind: "paragraph" as const, text: before } }, added] : [row]));
                setFocusRow(added.id);
              }}
              onSearchProducts={onSearchProducts}
              onSlash={(rest) => {
                setMenuAt(id);
                setQuery(rest);
              }}
              onSlashClosed={() => {
                if (menuAt === id) setMenuAt(null);
              }}
              onUploadImage={onUploadImage}
            />

            {menuAt === id && (
              <ProseMenu
                onPick={(kind) => {
                  /*
                    `/` だけの段落は**置き換える**。ボタンから開いたときは**下に足す**。
                    置き換えないと、選んだ瞬間に空の段落が 1 つ残り、
                    運営者は自分が何もしていない行を消して回ることになる。
                  */
                  if (node.kind === "paragraph" && node.text.startsWith("/")) {
                    convertAt(id, kind);
                  } else {
                    insertAfter(id, kind);
                  }
                }}
                query={query}
                onQueryChange={setQuery}
                onClose={() => { setMenuAt(null); setFocusRow(id); }}
              />
            )}
          </div>
        ))}

        <div className={styles.proseEditorAdd}>
          <IconButton
            icon="addItem"
            label="いちばん下に段落を足す"
            onClick={() => insertAfter(rows.at(-1)!.id, "paragraph")}
          />
          <span className={styles.hint}>
            空の段落で <code>/</code> と打つと、部品の一覧が出ます。
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   掴んで動かす
   --------------------------------------------------------------------------- */

type DropSide = "before" | "after";

/**
 * 指した縦位置が、その断片の上半分か下半分か。
 *
 * 断片の**真ん中**で切る。上端・下端の細い帯だけを落とし口にすると、
 * 狙いを定める操作になり、掴んで放るという動作にならない。
 */
function sideOfPointer(box: { top: number; height: number }, y: number): DropSide {
  return y < box.top + box.height / 2 ? "before" : "after";
}

/**
 * 掴んだ断片 `draggedId` を、`targetId` の `side` 側へ移した並びを返す。
 *
 * `draft.change` に渡す純関数なので、ここが返した配列がそのまま
 * undo/redo の 1 手になる。**動かす必要が無いときは `current` を
 * そのまま返すこと。**新しい配列を返すと、見た目が変わらないのに
 * 「元に戻す」を 1 回押しても何も起きない手が履歴へ積まれる。
 */
function reorder(
  current: readonly ProseRow[],
  draggedId: string,
  targetId: string,
  side: DropSide,
): readonly ProseRow[] {
  const from = current.findIndex((row) => row.id === draggedId);
  const target = current.findIndex((row) => row.id === targetId);
  /* 自分自身へ落としたときと、消えた行へ落としたときは動かさない。 */
  if (from < 0 || target < 0 || from === target) return current;

  const to = side === "before" ? target : target + 1;
  /*
    **抜いてから挿すので、添字が 1 つずれる。**掴んだ断片より後ろへ入れる場合、
    抜いた時点で目標の添字が 1 つ手前へ寄る。ここを直さないと、
    下へ 1 つだけ動かしたときに元の位置へ戻り、掴んでも動かないように見える。
  */
  const insert = from < to ? to - 1 : to;
  /* すでにそこに居るなら、空の「元に戻す」を履歴へ積まない。 */
  if (insert === from) return current;

  const next = [...current];
  const [moved] = next.splice(from, 1);
  next.splice(insert, 0, moved as ProseRow);
  return next;
}

/** メニューの並びは 19 種すべてを覆う。`PROSE_MENU_ORDER` が正本。 */
export const PROSE_EDITOR_MENU_ORDER = PROSE_MENU_ORDER;
