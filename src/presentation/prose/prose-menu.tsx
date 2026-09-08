"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PROSE_MENU_GROUPS, PROSE_NODE_METADATA, type ProseNodeKind } from "@/domain/blogops";
import { Icon } from "@/presentation/ui";
import { PROSE_NODE_ICON, PROSE_NODE_DESCRIPTION } from "./prose-node-icons";
import { PickList } from "./pick-list";
import styles from "./prose.module.css";

/**
 * `/` の後ろに打った文字が、この種類に当たるか。
 *
 * 正本にある名前と読みの両方を見る。
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
  const metadata = PROSE_NODE_METADATA[kind];
  if (metadata.label.includes(needle)) return true;
  return metadata.keywords.some((word) => word.toLowerCase().includes(needle));
}

/**
 * `/` の候補。全 **19 個を 1 列に並べない**
 * (UIUX-REQ-007)。
 *
 * 群に分けるのは見た目のためではない。1 列にすると画面の下端で切れたものが
 * 「無い」ことになり、運営者は使える部品を知らないまま書き続ける。
 * 絞り込みの結果は群をまたぐので、空になった群は出さない。
 */
export function ProseMenu({
  query,
  onPick,
  onQueryChange,
  onClose,
}: {
  readonly query: string;
  readonly onPick: (kind: ProseNodeKind) => void;
  readonly onQueryChange: (query: string) => void;
  readonly onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { search.current?.focus(); }, []);
  const groups = useMemo(
    () =>
      PROSE_MENU_GROUPS.map((group) => ({
        ...group,
        hits: group.kinds.filter((kind) => matchesQuery(kind, query)),
      })).filter((group) => group.hits.length > 0),
    [query],
  );

  const hits = groups.flatMap((group) => group.hits);
  const selected = Math.min(active, Math.max(0, hits.length - 1));

  return (
    <div className={styles.proseEditorMenuPanel}>
      <input type="search" aria-label="本文ブロックを検索" className={styles.proseEditorText} ref={search} placeholder="見出し、画像、比較表…" value={query}
        onChange={(event) => { onQueryChange(event.target.value); setActive(0); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "Escape") { event.preventDefault(); onClose(); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setActive((selected + (event.key === "ArrowDown" ? 1 : -1) + hits.length) % Math.max(1, hits.length));
          }
          if (event.key === "Home") { event.preventDefault(); setActive(0); }
          if (event.key === "End") { event.preventDefault(); setActive(Math.max(0, hits.length - 1)); }
          if (event.key === "Enter") { event.preventDefault(); if (hits[selected]) onPick(hits[selected]); }
        }} />
      {groups.length === 0 && <p className={styles.proseEditorMenuEmpty}>「{query}」に当たる部品はありません。</p>}
      <div className={styles.proseEditorMenuGroups}>
      {groups.map((group) => (
        <div key={group.id}>
          <p className={styles.proseEditorMenuHead}>{group.label}</p>
          <PickList
            onPick={onPick}
            activeKey={hits[selected]}
            options={group.hits.map((kind) => ({
              key: kind,
              label: PROSE_NODE_METADATA[kind].label,
              description: PROSE_NODE_DESCRIPTION[kind],
              leading: <Icon name={PROSE_NODE_ICON[kind]} size="sm" />,
            }))}
          />
        </div>
      ))}
      </div>
      <p className={styles.hint}>↑↓ で選択・Enter で挿入・Esc で閉じる</p>
    </div>
  );
}
