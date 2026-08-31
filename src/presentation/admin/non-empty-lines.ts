/** 1 行 1 件の入力を読む。前後の空白と空行は保存しない。 */
export function parseNonEmptyLines(value: string): readonly string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
}
