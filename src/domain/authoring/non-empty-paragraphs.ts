/**
 * 1つの本文欄を、空行で区切られた保存用の段落へ正規化する。
 * 単一改行は段落内の改行として保ち、空の段落は保存しない。
 */
export function parseNonEmptyParagraphs(value: string): readonly string[] {
  return value
    .split(/\n\s*\n/u)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph !== "");
}
