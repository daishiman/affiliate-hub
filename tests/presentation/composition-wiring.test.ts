/** @tier 1 */
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
 * 保存先を新しくつないだときも、この検査は自動で対象を増やす
 * （組み立てが受け取る接続の名前と、それで分岐する依存を読み取るため）。
 *
 * 2026-08-17 追記: 最初は `db` だけを見ていた。画面の写しの置き場は R2 なので、
 * その形のままでは**新しい接続がまるごと検査の外**にいた。
 * 接続の一覧も組み立て側の型から読むようにして、増やした日から対象に入るようにした。
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

/**
 * 組み立てが受け取る接続の名前（`db` / `bucket` …）。
 *
 * **一覧を手で書かない。** 接続を 1 つ増やした日から検査対象に入るようにする。
 * 手で書くと、増やした人が書き足すのを忘れたことに誰も気づけない
 * （実際、画面の写しの置き場 (R2) は `db` しか見ない検査の外側にいた）。
 */
function connectionNames(): readonly string[] {
  const head = INFRA.slice(INFRA.indexOf("export function createDeps("));
  const signature = head.slice(0, head.indexOf("): AppDeps"));
  return [...signature.matchAll(/readonly (\w+)\?:/g)].map((m) => m[1]);
}

/** 接続 1 つにつき、それがあれば本物へ切り替わる依存の名前。 */
function capableSlots(connection: string): readonly string[] {
  const body = INFRA.slice(INFRA.indexOf("export function createDeps("));
  const slots: string[] = [];
  // 4 桁字下げの `名前:` を 1 つの枠とみなし、次の枠までを値として読む。
  const entries = [...body.matchAll(/^ {4}(\w+):/gm)];
  for (const [index, entry] of entries.entries()) {
    const start = entry.index ?? 0;
    const end = index + 1 < entries.length ? (entries[index + 1].index ?? body.length) : body.length;
    if (body.slice(start, end).includes(`${connection} === null`)) slots.push(entry[1]);
  }
  return slots;
}

/**
 * `createDeps(...)` に渡している引数の並びを取り出す。
 *
 * **括弧の対応を数える。** 単純に「次の `)` まで」で切ると、
 * `createDeps({ db: await tryGetDb(), bucket: await tryGetBucket() })` の
 * 途中で切れて、渡しているものを渡していないと読む。
 * 実際に一度そうなった（接続を 2 つ渡した日に、この検査だけが赤くなった）。
 */
function createDepsArguments(body: string): readonly string[] {
  const found: string[] = [];
  const head = "createDeps(";
  let at = body.indexOf(head);
  while (at !== -1) {
    let depth = 0;
    let end = at + head.length;
    for (; end < body.length; end += 1) {
      const ch = body[end];
      if (ch === "(") depth += 1;
      else if (ch === ")") {
        if (depth === 0) break;
        depth -= 1;
      }
    }
    found.push(body.slice(at + head.length, end));
    at = body.indexOf(head, end);
  }
  return found;
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
  const connections = connectionNames();

  it("組み立てが受け取る接続を読み取れる", () => {
    // ここが 0 件になったら検査が空回りする。空振りを緑で通さない。
    expect(connections.length).toBeGreaterThan(0);
    expect(connections).toContain("db");
    expect(connections).toContain("bucket");
  });

  const allSuspects: { entry: Entry; connection: string }[] = [];

  for (const connection of connections) {
    const slots = capableSlots(connection);

    it(`${connection} があれば本物に切り替わる依存が読み取れる`, () => {
      expect(slots.length, `${connection} で分岐する依存が 1 つも無い`).toBeGreaterThan(0);
    });

    const suspects = entryPoints().filter(
      (entry) =>
        entry.body.includes("createDeps(") && slots.some((slot) => entry.body.includes(`.${slot}`)),
    );
    for (const entry of suspects) allSuspects.push({ entry, connection });

    for (const entry of suspects) {
      it(`${entry.name} は createDeps に ${connection} を渡している`, () => {
        const calls = createDepsArguments(entry.body);
        expect(calls.length).toBeGreaterThan(0);
        for (const args of calls) {
          expect(
            args.includes(connection),
            `${entry.name} が createDeps(${args}) を呼んでいる。` +
              `${connection} を渡さないと、保存先をつないでも画面と道具には届かない。`,
          ).toBe(true);
        }
      });
    }
  }

  it("既知の依存が対象から抜け落ちていない", () => {
    const slots = connections.flatMap((connection) => capableSlots(connection));
    expect(slots).toContain("feedback");
    expect(slots).toContain("integrationKeys");
    expect(slots).toContain("linkInbox");
    expect(slots).toContain("feedbackCaptures");
  });

  it("対象の入口が 1 つ以上見つかる", () => {
    expect(allSuspects.length).toBeGreaterThan(0);
  });

  it("接続を取りに行く入口は、非同期になっている", () => {
    for (const { entry } of allSuspects) {
      expect(entry.body.startsWith("export async function"), `${entry.name}`).toBe(true);
    }
  });
});
