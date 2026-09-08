"use client";
import type { ProseNode } from "@/domain/blogops";
import { RichText } from "./rich-text";
import { IconButton, PlainField } from "./prose-fields";
import { ProseTableFrame } from "./prose-table-frame";
import { normalizeProseTable } from "./prose-presentation";
import styles from "./prose.module.css";

export function ItemsEditor({
  items,
  ordered,
  onItemsChange,
}: {
  readonly items: readonly string[];
  readonly ordered: boolean;
  readonly onItemsChange: (items: readonly string[]) => void;
}) {
  return (
    <div className={styles.proseEditorStack}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
        <div className={styles.proseEditorItemRow} key={i}>
          <span className={styles.proseEditorItemMark}>{ordered ? `${i + 1}.` : "・"}</span>
          <RichText
            ariaLabel={`${i + 1} 番目の項目`}
            onValueChange={(text) =>
              onItemsChange(items.map((current, j) => (j === i ? text : current)))
            }
            placeholder="項目"
            value={item}
          />
          <IconButton
            disabled={items.length === 1}
            icon="removeItem"
            label={`${i + 1} 番目の項目を消す`}
            onClick={() => onItemsChange(items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <IconButton
        icon="addItem"
        label="項目を足す"
        onClick={() => onItemsChange([...items, ""])}
      />
    </div>
  );
}

export function ChecklistEditor({
  items,
  onItemsChange,
}: {
  readonly items: readonly { readonly text: string; readonly checked: boolean }[];
  readonly onItemsChange: (
    items: readonly { readonly text: string; readonly checked: boolean }[],
  ) => void;
}) {
  return (
    <div className={styles.proseEditorStack}>
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 項目は順序が同一性
        <div className={styles.proseEditorItemRow} key={i}>
          {/*
            書く側の印は本物の `<input type="checkbox">` にする。
            読者の画面では押せない印になるが、**書いている人は押して切り替える**。
            ここを絵にすると、キーボードだけで印を付け外しできなくなる。
          */}
          <input
            aria-label={`${i + 1} 番目に印を付ける`}
            checked={item.checked}
            onChange={(e) =>
              onItemsChange(
                items.map((current, j) =>
                  j === i ? { ...current, checked: e.target.checked } : current,
                ),
              )
            }
            type="checkbox"
          />
          <RichText
            ariaLabel={`${i + 1} 番目の項目`}
            onValueChange={(text) =>
              onItemsChange(
                items.map((current, j) => (j === i ? { ...current, text } : current)),
              )
            }
            placeholder="やること"
            value={item.text}
          />
          <IconButton
            disabled={items.length === 1}
            icon="removeItem"
            label={`${i + 1} 番目の項目を消す`}
            onClick={() => onItemsChange(items.filter((_, j) => j !== i))}
          />
        </div>
      ))}
      <IconButton
        icon="addItem"
        label="やることを足す"
        onClick={() => onItemsChange([...items, { text: "", checked: false }])}
      />
    </div>
  );
}

/**
 * プログラムの欄。**ここだけは装飾を通さない。**
 *
 * プログラムの中の `**` は太字ではなく、そのままの記号である。
 * `RichText` を通すと、貼り付けたプログラムが書き換わる。
 */
export function CodeEditor({
  node,
  onChange,
}: {
  readonly node: Extract<ProseNode, { kind: "code" }>;
  readonly onChange: (next: ProseNode) => void;
}) {
  const rows = Math.max(3, node.text.split("\n").length);
  return (
    <div className={styles.proseEditorStack}>
      <PlainField
        ariaLabel="プログラムの言語（決めなくても構いません）"
        onValueChange={(language) => onChange({ ...node, language })}
        placeholder="ts / sql / bash など"
        value={node.language}
      />
      <textarea
        aria-label="プログラムの中身"
        className={styles.proseEditorCode}
        onChange={(e) => onChange({ ...node, text: e.target.value })}
        placeholder="そのまま貼り付けます"
        rows={rows}
        /*
          綴りの直しと大文字化を切る。プログラムを打つ欄で効かせると、
          変数名が勝手に直る。
        */
        spellCheck={false}
        value={node.text}
      />
    </div>
  );
}

export function TableEditor({
  node: inputNode,
  onChange,
}: {
  readonly node: Extract<ProseNode, { kind: "comparison-table" | "table" }>;
  readonly onChange: (next: ProseNode) => void;
}) {
  const node = normalizeProseTable(inputNode);
  const width = node.headers.length;

  function setHeader(at: number, text: string) {
    onChange({ ...node, headers: node.headers.map((h, i) => (i === at ? text : h)) });
  }

  function setCell(row: number, col: number, text: string) {
    onChange({
      ...node,
      rows: node.rows.map((cells, i) =>
        i === row ? cells.map((cell, j) => (j === col ? text : cell)) : cells,
      ),
    });
  }

  return (
    <div className={styles.proseEditorStack}>
      <ProseTableFrame
        columnCount={width}
        renderCell={(row, col) => (
          <RichText
            ariaLabel={`${row + 1} 行 ${col + 1} 列`}
            onValueChange={(text) => setCell(row, col, text)}
            placeholder="値"
            value={node.rows[row]?.[col] ?? ""}
          />
        )}
        renderHeaderCell={(col) => (
          <RichText
            ariaLabel={`${col + 1} 列目の見出し`}
            onValueChange={(text) => setHeader(col, text)}
            placeholder="見出し"
            value={node.headers[col] ?? ""}
          />
        )}
        rowCount={node.rows.length}
      />
      <div className={styles.proseEditorInline}>
        <IconButton disabled={width <= 1} icon="removeItem" label="いちばん右の列を消す" onClick={() => onChange({ ...node, headers: node.headers.slice(0, -1), rows: node.rows.map((cells) => cells.slice(0, -1)) })} />
        <IconButton
          icon="addItem"
          label="列を足す"
          onClick={() =>
            onChange({
              ...node,
              headers: [...node.headers, ""],
              rows: node.rows.map((cells) => [...cells, ""]),
            })
          }
        />
        <IconButton
          icon="addItem"
          label="行を足す"
          onClick={() =>
            onChange({ ...node, rows: [...node.rows, Array.from({ length: width }, () => "")] })
          }
        />
        <IconButton
          disabled={node.rows.length === 1}
          icon="removeItem"
          label="いちばん下の行を消す"
          onClick={() => onChange({ ...node, rows: node.rows.slice(0, -1) })}
        />
      </div>
    </div>
  );
}
