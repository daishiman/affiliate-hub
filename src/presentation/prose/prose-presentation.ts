import type { ProseCalloutTone, ProseCtaTone, ProseNode } from "@/domain/blogops";
import type { IconName } from "@/presentation/ui";
import styles from "./prose.module.css";

export const CALLOUT_PRESENTATION: Readonly<Record<ProseCalloutTone, { icon: IconName; label: string; className: string }>> = {
  info: { icon: "calloutInfo", label: "補足", className: styles.proseCalloutInfo },
  tip: { icon: "calloutTip", label: "こつ", className: styles.proseCalloutTip },
  warn: { icon: "calloutWarn", label: "注意", className: styles.proseCalloutWarn },
  note: { icon: "calloutNote", label: "覚え書き", className: styles.proseCalloutNote },
};
export const CTA_PRESENTATION: Readonly<Record<ProseCtaTone, { label: string; className: string }>> = {
  action: { label: "主なボタン", className: styles.proseCtaAction },
  accent: { label: "そえるボタン", className: styles.proseCtaAccent },
};

/** 不揃いな既存表でも余剰セルを隠さず、編集/公開の列数を揃える。 */
export function normalizeProseTable<T extends Extract<ProseNode, { kind: "table" | "comparison-table" }>>(node: T): T {
  const width = Math.max(1, node.headers.length, ...node.rows.map((row) => row.length));
  const fill = (cells: readonly string[]) => Array.from({ length: width }, (_, i) => cells[i] ?? "");
  return { ...node, headers: fill(node.headers), rows: node.rows.map(fill) };
}
