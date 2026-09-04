"use client";

import { useId, useMemo, useState } from "react";
import {
  CALLOUT_TONES,
  type ProseCalloutTone,
  type ProseNode,
  type ProseNodeKind,
  PROSE_MENU_ORDER,
  PROSE_NODE_KEYWORDS,
  PROSE_NODE_LABEL,
  emptyProseNode,
  isEmptyProseNode,
  parseProse,
  serializeProse,
} from "@/domain/blogops";
import { Icon, type IconName } from "@/presentation/ui";
import { ProseTableFrame } from "./prose-table-frame";
import styles from "./prose.module.css";

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
 * ローカルの CLI が書いた本文も、そのまま読み込める。
 */

/** 断片の種類に対応するアイコン。絵文字は使わない。 */
export const PROSE_NODE_ICON: Readonly<Record<ProseNodeKind, IconName>> = {
  paragraph: "proseParagraph",
  heading: "proseHeading",
  "bullet-list": "proseBulletList",
  "ordered-list": "proseOrderedList",
  quote: "proseQuote",
  callout: "proseCallout",
  "product-card": "proseProductCard",
  "comparison-table": "proseTable",
  image: "proseImage",
  divider: "proseDivider",
};

const TONE_ICON: Readonly<Record<ProseCalloutTone, IconName>> = {
  info: "calloutInfo",
  tip: "calloutTip",
  warn: "calloutWarn",
  note: "calloutNote",
};

const TONE_LABEL: Readonly<Record<ProseCalloutTone, string>> = {
  info: "補足",
  tip: "こつ",
  warn: "注意",
  note: "覚え書き",
};

/**
 * `/` の後ろに打った文字が、この種類に当たるか。
 *
 * 名前 (`PROSE_NODE_LABEL`) と読み (`PROSE_NODE_KEYWORDS`) の両方を見る。
 */
function matchesQuery(kind: ProseNodeKind, query: string): boolean {
  /*
    **空のときは全部出す。**`/` を打った時点では、まだ何を挿したいか
    決まっていないことのほうが多い。ここで空を返すと、
    メニューは「打ち間違えた」ように見える。

    当てるのは**部分一致**。`list` で `bullet-list` を出したいので前方一致では足りない。
    英字だけ小文字に畳む (かなは畳まれないが、元から小文字の別がない)。
  */
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  if (PROSE_NODE_LABEL[kind].includes(needle)) return true;
  return PROSE_NODE_KEYWORDS[kind].some((word) => word.toLowerCase().includes(needle));
}

export type ProseEditorProps = {
  readonly label: string;
  /** 保存される文字列を送る名前。中身は `serializeProse` の結果。 */
  readonly name: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** 商品カードで選べる商品。渡さないと id を直に打つ欄になる。 */
  readonly productOptions?: readonly { readonly value: string; readonly label: string }[];
  /** この欄が AI から見て何の値かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
};

export function ProseEditor({
  label,
  name,
  value,
  onValueChange,
  productOptions,
  toolParamDescription,
}: ProseEditorProps) {
  const groupId = useId();

  /*
    **文字列ではなく断片を持つ。**`value` から毎回読み直すと、
    `/` で足した直後の空の断片が消える (空は文字列に残らない)。
    書いている途中の状態は、書いている側が持つしかない。
  */
  const [nodes, setNodes] = useState<readonly ProseNode[]>(() => parseProse(value));
  /** どの断片でメニューが開いているか。開いていなければ `null`。 */
  const [menuAt, setMenuAt] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  /*
    **画面に出ている並びが、編集の対象そのものである。**

    本文が空のとき、書き始める場所が無いと欄は使えないので 1 つ空の段落を出す。
    以前はこれを描画のためだけの派生値にしていたが、そうすると
    **その段落へ打った文字が `nodes`（＝空）へ書き戻され、消える。**
    新規記事で本文を打っても 1 段落目が保存されない、という形で表に出た
    （2026-08-27・`tests/ui/prose-editor.test.tsx`）。

    保存には乗らない（空の断片は `commit` が落とす）ので、
    穴埋めの段落を並びに含めても、公開面へ空の箱は出ない。
  */
  const rows = nodes.length === 0 ? [emptyProseNode("paragraph")] : nodes;

  function commit(next: readonly ProseNode[]) {
    setNodes(next);
    onValueChange(serializeProse(next.filter((node) => !isEmptyProseNode(node))));
  }

  function replaceAt(index: number, node: ProseNode) {
    commit(rows.map((current, i) => (i === index ? node : current)));
  }

  function removeAt(index: number) {
    commit(rows.filter((_, i) => i !== index));
    setMenuAt(null);
  }

  function moveAt(index: number, step: -1 | 1) {
    const to = index + step;
    if (to < 0 || to >= rows.length) return;
    const next = [...rows];
    const moved = next[index] as ProseNode;
    next[index] = next[to] as ProseNode;
    next[to] = moved;
    commit(next);
  }

  function insertAfter(index: number, kind: ProseNodeKind) {
    const next = [...rows];
    next.splice(index + 1, 0, emptyProseNode(kind));
    commit(next);
    setMenuAt(null);
    setQuery("");
  }

  /** `/` を打った段落そのものを、選ばれた種類に置き換える。 */
  function convertAt(index: number, kind: ProseNodeKind) {
    replaceAt(index, emptyProseNode(kind));
    setMenuAt(null);
    setQuery("");
  }

  return (
    <div className={styles.field}>
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

      <div aria-labelledby={`${groupId}-label`} className={styles.proseEditor} role="group">
        {rows.map((node, index) => (
          <div
            className={styles.proseEditorRow}
            // biome-ignore lint/suspicious/noArrayIndexKey: 断片は本文の順序そのものが同一性で、他に安定した鍵が無い
            key={`${groupId}-${index}`}
          >
            <div className={styles.proseEditorBar}>
              <span className={styles.proseEditorKind}>
                <Icon name={PROSE_NODE_ICON[node.kind]} size="sm" />
                {PROSE_NODE_LABEL[node.kind]}
              </span>
              <span className={styles.proseEditorActions}>
                <IconButton
                  disabled={index === 0}
                  icon="moveUp"
                  label={`${PROSE_NODE_LABEL[node.kind]}を 1 つ上へ`}
                  onClick={() => moveAt(index, -1)}
                />
                <IconButton
                  disabled={index === rows.length - 1}
                  icon="moveDown"
                  label={`${PROSE_NODE_LABEL[node.kind]}を 1 つ下へ`}
                  onClick={() => moveAt(index, 1)}
                />
                <IconButton
                  icon="removeItem"
                  label={`${PROSE_NODE_LABEL[node.kind]}を消す`}
                  onClick={() => removeAt(index)}
                />
                <IconButton
                  icon="addItem"
                  label={`${PROSE_NODE_LABEL[node.kind]}の下に部品を足す`}
                  onClick={() => {
                    setMenuAt(menuAt === index ? null : index);
                    setQuery("");
                  }}
                />
              </span>
            </div>

            <NodeEditor
              node={node}
              onChange={(next) => replaceAt(index, next)}
              onSlash={(rest) => {
                setMenuAt(index);
                setQuery(rest);
              }}
              onSlashClosed={() => {
                if (menuAt === index) setMenuAt(null);
              }}
              productOptions={productOptions}
            />

            {menuAt === index && (
              <ProseMenu
                onPick={(kind) => {
                  /*
                    `/` だけの段落は**置き換える**。ボタンから開いたときは**下に足す**。
                    置き換えないと、選んだ瞬間に空の段落が 1 つ残り、
                    運営者は自分が何もしていない行を消して回ることになる。
                  */
                  if (node.kind === "paragraph" && node.text.startsWith("/")) {
                    convertAt(index, kind);
                  } else {
                    insertAfter(index, kind);
                  }
                }}
                query={query}
              />
            )}
          </div>
        ))}

        <div className={styles.proseEditorAdd}>
          <IconButton
            icon="addItem"
            label="いちばん下に段落を足す"
            onClick={() => commit([...rows, emptyProseNode("paragraph")])}
          />
          <span className={styles.hint}>
            空の段落で <code>/</code> と打つと、部品の一覧が出ます。
          </span>
        </div>
      </div>
    </div>
  );
}

function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  /*
    同じ絵のボタンが断片の数だけ並ぶ。読み上げは順に読むので、
    どの断片のボタンかを名前に入れる (呼び出し側が入れている)。
    `type="button"` を明示するのは、form の中の button が既定で送信になるため。
  */
  return (
    <button
      aria-label={label}
      className={styles.proseEditorIconButton}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon name={icon} size="sm" />
    </button>
  );
}

function ProseMenu({
  query,
  onPick,
}: {
  readonly query: string;
  readonly onPick: (kind: ProseNodeKind) => void;
}) {
  const hits = useMemo(
    () => PROSE_MENU_ORDER.filter((kind) => matchesQuery(kind, query)),
    [query],
  );

  if (hits.length === 0) {
    return (
      <p className={styles.proseEditorMenuEmpty}>
        「{query}」に当たる部品はありません。
      </p>
    );
  }

  return (
    <ul className={styles.proseEditorMenu}>
      {hits.map((kind) => (
        <li key={kind}>
          <button
            className={styles.proseEditorMenuItem}
            onClick={() => onPick(kind)}
            type="button"
          >
            <Icon name={PROSE_NODE_ICON[kind]} size="sm" />
            {PROSE_NODE_LABEL[kind]}
          </button>
        </li>
      ))}
    </ul>
  );
}

function NodeEditor({
  node,
  onChange,
  onSlash,
  onSlashClosed,
  productOptions,
}: {
  readonly node: ProseNode;
  readonly onChange: (next: ProseNode) => void;
  readonly onSlash: (query: string) => void;
  readonly onSlashClosed: () => void;
  readonly productOptions?: readonly { readonly value: string; readonly label: string }[];
}) {
  switch (node.kind) {
    case "paragraph":
      return (
        <AutoTextArea
          ariaLabel="段落"
          className={styles.proseEditorText}
          onValueChange={(text) => {
            onChange({ kind: "paragraph", text });
            if (text.startsWith("/")) onSlash(text.slice(1));
            else onSlashClosed();
          }}
          placeholder="ここに本文を書きます（/ で部品を足せます）"
          value={node.text}
        />
      );

    case "heading":
      return (
        <div className={styles.proseEditorInline}>
          <select
            aria-label="小見出しの深さ"
            className={styles.proseEditorSelect}
            onChange={(e) =>
              onChange({ ...node, level: e.target.value === "4" ? 4 : 3 })
            }
            value={String(node.level)}
          >
            <option value="3">大きい小見出し</option>
            <option value="4">小さい小見出し</option>
          </select>
          <input
            aria-label="小見出しの文言"
            className={
              node.level === 3 ? styles.proseEditorHeading3 : styles.proseEditorHeading4
            }
            onChange={(e) => onChange({ ...node, text: e.target.value })}
            placeholder="小見出し"
            type="text"
            value={node.text}
          />
        </div>
      );

    case "bullet-list":
    case "ordered-list":
      return (
        <ItemsEditor
          items={node.items}
          onItemsChange={(items) => onChange({ ...node, items })}
          ordered={node.kind === "ordered-list"}
        />
      );

    case "quote":
      return (
        <AutoTextArea
          ariaLabel="引用"
          className={styles.proseEditorQuote}
          onValueChange={(text) => onChange({ kind: "quote", text })}
          placeholder="引用する文"
          value={node.text}
        />
      );

    case "callout":
      return (
        <div className={[styles.proseCallout, styles.proseEditorCallout].join(" ")}>
          <Icon name={TONE_ICON[node.tone]} size="md" />
          <div>
            <div className={styles.proseEditorInline}>
              <select
                aria-label="注意書きの調子"
                className={styles.proseEditorSelect}
                onChange={(e) =>
                  onChange({ ...node, tone: e.target.value as ProseCalloutTone })
                }
                value={node.tone}
              >
                {CALLOUT_TONES.map((tone) => (
                  <option key={tone} value={tone}>
                    {TONE_LABEL[tone]}
                  </option>
                ))}
              </select>
              <input
                aria-label="注意書きの題名"
                className={styles.proseEditorHeading4}
                onChange={(e) => onChange({ ...node, title: e.target.value })}
                placeholder="題名"
                type="text"
                value={node.title}
              />
            </div>
            <AutoTextArea
              ariaLabel="注意書きの本文"
              className={styles.proseEditorText}
              onValueChange={(text) => onChange({ ...node, text })}
              placeholder="伝えたいこと"
              value={node.text}
            />
          </div>
        </div>
      );

    case "product-card":
      return productOptions === undefined ? (
        <input
          aria-label="商品の id"
          className={styles.proseEditorText}
          onChange={(e) => onChange({ kind: "product-card", productId: e.target.value })}
          placeholder="pc_..."
          type="text"
          value={node.productId}
        />
      ) : (
        <select
          aria-label="差し込む商品"
          className={styles.proseEditorSelect}
          onChange={(e) => onChange({ kind: "product-card", productId: e.target.value })}
          value={node.productId}
        >
          <option value="">（商品を選びます）</option>
          {productOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );

    case "comparison-table":
      return <TableEditor node={node} onChange={onChange} />;

    case "image":
      return (
        <div className={styles.proseEditorStack}>
          <input
            aria-label="画像の場所"
            className={styles.proseEditorText}
            onChange={(e) => onChange({ ...node, src: e.target.value })}
            placeholder="/media/... または https://..."
            type="text"
            value={node.src}
          />
          <input
            aria-label="画像の説明（見えない人へ伝わる言葉）"
            className={styles.proseEditorText}
            onChange={(e) => onChange({ ...node, alt: e.target.value })}
            placeholder="この絵に何が写っているか"
            type="text"
            value={node.alt}
          />
          {node.src.trim() !== "" && (
            // 運営者入力の URL は寸法も許可ホストも事前確定できないため、最適化 API を経由しない。
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={node.alt} className={styles.proseImage} src={node.src} />
          )}
        </div>
      );

    case "divider":
      return <hr className={styles.proseDivider} />;
  }
}

function ItemsEditor({
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
          <input
            aria-label={`${i + 1} 番目の項目`}
            className={styles.proseEditorText}
            onChange={(e) =>
              onItemsChange(items.map((current, j) => (j === i ? e.target.value : current)))
            }
            placeholder="項目"
            type="text"
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

function TableEditor({
  node,
  onChange,
}: {
  readonly node: Extract<ProseNode, { kind: "comparison-table" }>;
  readonly onChange: (next: ProseNode) => void;
}) {
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
          <input
            aria-label={`${row + 1} 行 ${col + 1} 列`}
            className={styles.proseEditorText}
            onChange={(e) => setCell(row, col, e.target.value)}
            placeholder="値"
            type="text"
            value={node.rows[row]?.[col] ?? ""}
          />
        )}
        renderHeaderCell={(col) => (
          <input
            aria-label={`${col + 1} 列目の見出し`}
            className={styles.proseEditorText}
            onChange={(e) => setHeader(col, e.target.value)}
            placeholder="見出し"
            type="text"
            value={node.headers[col] ?? ""}
          />
        )}
        rowCount={node.rows.length}
      />
      <div className={styles.proseEditorInline}>
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

function AutoTextArea({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  className,
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly placeholder: string;
  readonly className: string;
}) {
  /*
    行数を中身から出す。固定の高さだと、短い段落に空白が広がり、
    長い段落は箱の中でしか読めない。**書いたものが全部見えている**ことが、
    見た目のまま書ける欄の最低条件である。
  */
  const rows = Math.max(2, value.split("\n").length);
  return (
    <textarea
      aria-label={ariaLabel}
      className={className}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      value={value}
    />
  );
}
