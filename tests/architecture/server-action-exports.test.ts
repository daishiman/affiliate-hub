import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `"use server"` を付けたファイルからは**非同期の関数だけを外へ出す**、を機械で見る。
 *
 * きっかけ:
 *   2026-08-17、`site-wizard-action.ts` が定数を外へ出していたために `pnpm build` が
 *   `A "use server" file can only export async functions, found object.` で落ち、
 *   preview まで進めなかった。型検査も静的検査も単体テストも、これを見つけられない。
 *
 * 分かっていること／分かっていないこと:
 *   同じ形をした別の 2 ファイルは、**同じビルドを通過していた**。
 *   つまり「定数を出すと必ず落ちる」わけではなく、落ちる条件は特定できていない。
 *   条件が分からない以上、落ちるかどうかを 1 件ずつ見分けるのは当てにならない。
 *   そこで「定数と型は隣の `*-state.ts` に置く」を全ファイル共通の決まりにし、
 *   ここで揃っていることだけを見る。**この検査が守っているのは形の統一であり、
 *   1 件ごとにビルドが落ちることを証明したものではない。**
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

const serverActionFiles = walk(join(ROOT, "src")).filter((f) =>
  /^\s*["']use server["']/.test(readFileSync(f, "utf8")),
);

describe("サーバー側の操作ファイル", () => {
  it("検査対象を実際に読めている", () => {
    expect(serverActionFiles.length, '"use server" のファイルが 1 つも見つかりません').toBeGreaterThan(
      0,
    );
  });

  it("非同期の関数以外を外へ出していない", () => {
    const offenders: string[] = [];
    for (const file of serverActionFiles) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/^export\s+(?!async function )(\w+)([^\n]*)/gm)) {
        const keyword = match[1];
        // 型は実体を持たないので出しても構わない（`export type` / `export interface`）。
        if (keyword === "type" || keyword === "interface") continue;
        offenders.push(
          `${relative(ROOT, file)}: export ${keyword}${match[2]} — ` +
            "非同期の関数だけにしてください（型と定数は別ファイルへ）",
        );
      }
    }
    expect(
      offenders,
      '"use server" のファイルからは async function だけを出してください。' +
        "定数と型は隣の `*-state.ts` へ移してください。",
    ).toEqual([]);
  });
});
