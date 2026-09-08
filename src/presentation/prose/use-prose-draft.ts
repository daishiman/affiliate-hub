"use client";

import { useEffect, useRef, useState } from "react";
import { emptyProseNode, isEmptyProseNode, parseProse, serializeProse, type ProseNode } from "@/domain/blogops";

export type ProseRow = { readonly id: string; readonly node: ProseNode };
type Snapshot = { readonly rows: readonly ProseRow[]; readonly source: string };
type Draft = Snapshot & { readonly past: readonly Snapshot[]; readonly future: readonly Snapshot[] };

function initialDraft(source: string): Draft {
  const parsed = parseProse(source);
  const nodes = parsed.length ? parsed : [emptyProseNode("paragraph")];
  return { source, rows: nodes.map((node, index) => ({ id: `initial-${index}`, node })), past: [], future: [] };
}

/** 編集専用の同一性・履歴。IDは保存形式へ持ち込まない。 */
export function useProseDraft(value: string, onChange: (value: string) => void) {
  const sequence = useRef(0);
  const createRow = (node: ProseNode): ProseRow => ({ id: `row-${++sequence.current}`, node });
  const read = (source: string): Draft => {
    const nodes = parseProse(source);
    return { source, rows: (nodes.length ? nodes : [emptyProseNode("paragraph")]).map(createRow), past: [], future: [] };
  };
  const [draft, setDraft] = useState<Draft>(() => initialDraft(value));
  const current = useRef(draft);
  const notify = useRef(onChange);
  useEffect(() => { notify.current = onChange; }, [onChange]);
  useEffect(() => {
    if (value === current.current.source) return;
    const next = read(value);
    current.current = next;
    setDraft(next);
    // External restore/reload is a new history boundary, not a user edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function install(next: Draft) {
    current.current = next;
    setDraft(next);
    notify.current(next.source);
  }
  function change(update: (rows: readonly ProseRow[]) => readonly ProseRow[]) {
    const before = current.current;
    const result = update(before.rows);
    if (result === before.rows) return;
    const rows = result.length ? result : [createRow(emptyProseNode("paragraph"))];
    // IME cancellation and unchanged inputs must not canonicalize untouched source bytes.
    if (rows.length === before.rows.length && rows.every((row, index) => row.id === before.rows[index]?.id && JSON.stringify(row.node) === JSON.stringify(before.rows[index]?.node))) return;
    const source = serializeProse(rows.map((row) => row.node).filter((node) => !isEmptyProseNode(node)));
    install({ rows, source, past: [...before.past.slice(-99), { rows: before.rows, source: before.source }], future: [] });
  }
  function travel(direction: "past" | "future") {
    const before = current.current;
    const stack = before[direction];
    const target = stack.at(-1);
    if (!target) return;
    const snapshot = { rows: before.rows, source: before.source };
    install(direction === "past"
      ? { ...target, past: stack.slice(0, -1), future: [...before.future, snapshot] }
      : { ...target, past: [...before.past, snapshot], future: stack.slice(0, -1) });
  }
  return { rows: draft.rows, createRow, change, undo: () => travel("past"), redo: () => travel("future"), canUndo: draft.past.length > 0, canRedo: draft.future.length > 0 };
}
