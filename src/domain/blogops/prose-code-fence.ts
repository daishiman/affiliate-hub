/** 本文内の連続バッククォートより長い囲み。行内・ブロックの両方で使う。 */
export function proseCodeFence(text: string, minimum: number): string {
  let length = minimum;
  for (const match of text.matchAll(/`+/g)) length = Math.max(length, match[0].length + 1);
  return "`".repeat(length);
}
