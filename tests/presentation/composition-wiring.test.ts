import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * **つないだつもりを検出する。**
 *
 * 2026-08-17、改善要望の保存先を D1 につないだあと、
 * `pnpm run preview`（Workers 上）で確認したら画面には見本データが出続けていた。
 * 原因は組み立て側ではなく**入口側**で、`src/presentation/composition.ts` の
 * `feedbackUseCases()` が接続を渡さずに `createDeps()` を呼んでいた。
 *
 * このとき既存の 2390 件のテストは全部通っていた。統合テストが
 * `createDeps({ db })` を直に組み立てており、**入口を通っていなかった**ため。
 * 同じ抜け方が `resolveIntegrationAccess` `createToolCatalog`
 * `dashboardUseCases` にもあり、鍵の照合・AI から使う道具・ホームの数字が
 * 揃って見本のままだった。
 *
 * だから「入口が接続を渡しているか」だけを、実装ではなくコードの形として見る。
 * 保存先を新しく D1 化したときも、この検査は自動で対象を増やす
 * （`db === null` で分岐する依存を組み立て側から読み取るため）。
 */

// パスに日本語が入るとURLエスケープされるので、そのまま連結しない。
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const INFRA = readFileSync(`${ROOT}src/infrastructure/composition.ts`, "utf-8");
// 説明文の中の `createDeps()` を実際の呼び出しと取り違えないよう、注釈を落として読む。
const PRESENTATION = withoutComments(
  readFileSync(`${ROOT}src/presentation/composition.ts`, "utf-8"),
);

/** 行数を保ったまま注釈を空白にする（切り出し位置がずれないようにするため）。 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (hit, head: string) => head + " ".repeat(hit.length - head.length));
}

/** 組み立て側で「接続があれば本物」に切り替わる依存の名前。 */
function d1CapableSlots(): readonly string[] {
  const body = INFRA.slice(INFRA.indexOf("export function createDeps("));
  const slots: string[] = [];
  // 4 桁字下げの `名前:` を 1 つの枠とみなし、次の枠までを値として読む。
  const entries = [...body.matchAll(/^ {4}(\w+):/gm)];
  for (const [index, entry] of entries.entries()) {
    const start = entry.index ?? 0;
    const end = index + 1 < entries.length ? (entries[index + 1].index ?? body.length) : body.length;
    if (body.slice(start, end).includes("db === null")) slots.push(entry[1]);
  }
  return slots;
}

/** 入口 1 つ分（`export function 名前(...)` から次の `export` まで）。 */
type Entry = { readonly name: string; readonly body: string };

function entryPoints(): readonly Entry[] {
  const heads = [...PRESENTATION.matchAll(/^export (?:async )?function (\w+)/gm)];
  return heads.map((head, index) => {
    const start = head.index ?? 0;
    const end =
      index + 1 < heads.length ? (heads[index + 1].index ?? PRESENTATION.length) : PRESENTATION.length;
    return { name: head[1], body: PRESENTATION.slice(start, end) };
  });
}

describe("画面・REST・MCP の入口が保存先の接続を渡していること", () => {
  const slots = d1CapableSlots();

  it("接続があれば本物に切り替わる依存が、組み立て側から読み取れる", () => {
    // ここが 0 件になったら検査が空回りする。空振りを緑で通さない。
    expect(slots.length).toBeGreaterThan(0);
    expect(slots).toContain("feedback");
    expect(slots).toContain("integrationKeys");
    expect(slots).toContain("linkInbox");
  });

  const suspects = entryPoints().filter(
    (entry) =>
      entry.body.includes("createDeps(") &&
      slots.some((slot) => entry.body.includes(`.${slot}`)),
  );

  it("対象の入口が 1 つ以上見つかる", () => {
    expect(suspects.length).toBeGreaterThan(0);
  });

  for (const entry of suspects) {
    it(`${entry.name} は createDeps に db を渡している`, () => {
      const calls = [...entry.body.matchAll(/createDeps\(([^)]*)\)/g)].map((m) => m[1]);
      expect(calls.length).toBeGreaterThan(0);
      for (const args of calls) {
        expect(
          args.includes("db"),
          `${entry.name} が createDeps(${args}) を呼んでいる。` +
            "接続を渡さないと、保存先をつないでも画面と道具には届かない。",
        ).toBe(true);
      }
    });
  }

  it("接続を取りに行く入口は、非同期になっている", () => {
    for (const entry of suspects) {
      expect(entry.body.startsWith("export async function"), `${entry.name}`).toBe(true);
    }
  });
});
