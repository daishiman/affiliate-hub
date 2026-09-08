import type { ExpressionBlock } from "@/domain/authoring/blog-template";
import { serializeInline } from "@/domain/blogops/prose-inline";
import { serializeProse } from "@/domain/blogops/prose-format";
import type { ProseNode } from "@/domain/blogops/prose-node";

const text = (value: string) => serializeInline([{ text: value, marks: [] }]);

/**
 * 構造化表現の表示可能な部分を公開本文へ写す境界。
 * 型や保存用carrierは統合しない。結論・要点・FAQは公開モデル側の専用欄で扱う。
 * 図解・比較のcaptionから存在しない画像や比較データを作らない。
 */
export function proseBodyOfExpression(block: ExpressionBlock): string | null {
  let nodes: readonly ProseNode[];
  switch (block.kind) {
    case "sources":
      nodes = [{ kind: "bullet-list", items: block.items.map((item) =>
        serializeInline([
          { text: item.label, marks: item.url ? [{ kind: "link", href: item.url }] : [] },
          { text: `（${item.checkedAt} 確認）`, marks: [] },
        ])) }];
      break;
    case "freshness":
      nodes = [{ kind: "paragraph", text: text(`${block.asOf}${block.note ? ` — ${block.note}` : ""}`) }];
      break;
    case "figure":
    case "comparison":
      nodes = [{ kind: "paragraph", text: text(block.caption) }];
      break;
    case "cta":
      nodes = [{ kind: "cta-button", href: block.href, label: block.label, tone: "action" }];
      break;
    case "spec_table":
      nodes = [{ kind: "table", headers: ["項目", "仕様"], rows: block.rows.map((row) => [text(row.label), text(row.value)]) }];
      break;
    default:
      return null;
  }
  return serializeProse(nodes);
}
