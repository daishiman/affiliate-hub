import { emptyProseNode, type ProseNode, type ProseNodeKind } from "@/domain/blogops";

export const TEXT_BLOCK_KINDS = ["paragraph", "heading", "quote", "bullet-list", "ordered-list"] as const;
export function canConvertText(node: ProseNode): boolean {
  return TEXT_BLOCK_KINDS.some((kind) => kind === node.kind);
}

/** 情報を失わず変換できる種類だけを提示する。画像等を文字に潰さない。 */
export function convertTextBlock(node: ProseNode, kind: ProseNodeKind): ProseNode {
  if (!canConvertText(node) || !TEXT_BLOCK_KINDS.some((value) => value === kind)) return node;
  const text = "text" in node ? node.text : "items" in node ? (node.items as readonly string[]).join("\n") : "";
  if (kind === "bullet-list" || kind === "ordered-list") return { kind, items: text.split("\n") };
  if (kind === "heading") return text.includes("\n") ? node : { kind, text, level: node.kind === "heading" ? node.level : 3 };
  if (kind === "paragraph" || kind === "quote") return { kind, text };
  return emptyProseNode(kind);
}
