/** @tier 1 @req REQ-TS09 @types contract */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

async function doc(path: string): Promise<string> {
  return readFile(`${ROOT}/${path}`, "utf8");
}

describe("最初に読むアーキテクチャ文書は現行構造を指す", () => {
  it("索引とcontext mapのコンテキスト数が一致する", async () => {
    const [index, map] = await Promise.all([
      doc("docs/architecture/README.md"),
      doc("docs/architecture/context-map.md"),
    ]);
    const count = map.match(/^## (\d+) のコンテキスト$/m)?.[1];
    expect(count).toBeDefined();
    expect(index).toContain(`| 2 | [context-map.md](context-map.md) | ${count} の業務領域`);
  });

  it("入口の見出し数、表の行数、実在する読者presentationを一致させる", async () => {
    const layers = await doc("docs/architecture/layers.md");
    const declared = Number(layers.match(/^## 入口は (\d+) つ、手順は 1 つ$/m)?.[1]);
    const table = layers.match(/\| 入口 \| 置き場所 \| 呼ぶもの \|[\s\S]*?\n\n/)?.[0] ?? "";
    const rows = table.split("\n").filter((line) => /^\| [^|-]/.test(line)).length - 1;
    expect(declared).toBe(5);
    expect(rows).toBe(declared);
    expect(layers).toContain("`src/presentation/site/`");
    expect(layers).not.toContain("`src/presentation/reader/`");
  });
});
