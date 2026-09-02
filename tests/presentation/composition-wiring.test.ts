/** @tier 1 @req REQ-API01, REQ-TS09 */
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

/** 組み立て（`createDeps`）1 つ分の本文。次の `export` の手前まで。 */
function createDepsBody(): string {
  const from = INFRA.slice(INFRA.indexOf("export function createDeps("));
  const next = from.indexOf("\nexport ");
  return next === -1 ? from : from.slice(0, next);
}

/**
 * `const 名前 = …;` を、**改行をまたいで**取り出す。
 *
 * 1 行に収まる書き方だけを見ていると、引数が増えて折り返した日に
 * 「そんな値は無い」と読む。括弧の対応を数えて終わりを決める
 * （`createDepsArguments` と同じ理由）。
 */
function constBindings(body: string): readonly { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  for (const head of body.matchAll(/const (\w+) = /g)) {
    const start = (head.index ?? 0) + head[0].length;
    let depth = 0;
    let end = start;
    for (; end < body.length; end += 1) {
      const ch = body[end];
      if (ch === "(" || ch === "{" || ch === "[") depth += 1;
      else if (ch === ")" || ch === "}" || ch === "]") depth -= 1;
      else if (ch === ";" && depth === 0) break;
    }
    out.push({ name: head[1], value: body.slice(start, end) });
  }
  return out;
}

/**
 * 接続 1 つにつき、それがあれば本物へ切り替わる依存の名前。
 *
 * 見つけ方は 2 通りある。
 *
 *   1. 枠の中で直に分岐している（`db === null ? 見本 : 本物`）
 *   2. 接続から**別の値を作って**、その値から枠を埋めている
 *      （`const llmPorts = createLlmPorts(options.env ?? {})` → `llm: llmPorts.llm`）
 *
 * 2026-08-18 に 2 を足した。生成 AI の鍵を渡すための `env` を組み立てへ足した日、
 * この検査は「`env` で分岐する依存が 1 つも無い」と言って落ちた。**言い分は正しい**。
 * 1 しか見ていなかったので、接続を増やしても対象が 0 件のまま緑になる形が
 * 残っていた（空振りを緑で通すのは、検査が無いのと同じである）。
 * 分岐の書き方に検査を合わせるのではなく、**届き方をもう 1 通り数える**ように直した。
 *
 * 同じ日にもう一度落ちた。**1 段しか辿っていなかった**ためで、
 * `env → 鍵の預かり所 → 生成 AI の口` のように途中が 2 つになると見失う。
 * 中継を何段はさんでも「接続から作られたもの」であることは変わらないので、
 * **辿れなくなるまで辿る**ようにした。段数を決め打ちすると、
 * 1 段増やした日にまた同じ落ち方をする。
 */
function capableSlots(connection: string): readonly string[] {
  const body = createDepsBody();

  /**
   * 接続から作られた中間の値。直接（`options.接続`）だけでなく、
   * **すでに接続から作られたものを使って作られたもの**も同じ扱いにする。
   */
  const bindings = constBindings(body);
  const derived: string[] = [];
  for (const binding of bindings) {
    if (new RegExp(`options\\.${connection}\\b`).test(binding.value)) derived.push(binding.name);
  }
  for (let changed = true; changed; ) {
    changed = false;
    for (const binding of bindings) {
      if (derived.includes(binding.name)) continue;
      if (derived.some((name) => new RegExp(`\\b${name}\\b`).test(binding.value))) {
        derived.push(binding.name);
        changed = true;
      }
    }
  }

  const slots: string[] = [];
  // 4 桁字下げの `名前:` を 1 つの枠とみなし、次の枠までを値として読む。
  const entries = [...body.matchAll(/^ {4}(\w+):/gm)];
  for (const [index, entry] of entries.entries()) {
    const start = entry.index ?? 0;
    const end = index + 1 < entries.length ? (entries[index + 1].index ?? body.length) : body.length;
    const value = body.slice(start, end);
    const branches = value.includes(`${connection} === null`);
    const fromDerived = derived.some((name) => new RegExp(`\\b${name}\\.`).test(value));
    if (branches || fromDerived) slots.push(entry[1]);
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
    found.push(resolveAppContext(body.slice(at + head.length, end)));
    at = body.indexOf(head, end);
  }
  return found;
}

/**
 * `createDeps(await appContext())` を、`appContext()` が実際に返す名前へ開く。
 *
 * **束ねた関数を「渡していない」と読ませない。** `appContext()` は
 * 保存先と環境を 1 度にそろえるためにある（片方だけ渡す書き方を残さないため）。
 * その名前ごしに渡している入口を赤にすると、直し方は
 * 「束ねるのをやめて 2 つ別々に取る」になってしまい、
 * この検査が防ぎたかった食い違いを検査自身が呼び戻す。
 *
 * 開く先は手で書かない。`app-context.ts` の `return { … }` から読む。
 * 束の中身が痩せた日には、ここが自動で赤くなる。
 */
function resolveAppContext(args: string): string {
  if (!/^\s*await\s+appContext\(\s*\)\s*$/.test(args)) return args;
  const source = readFileSync(`${ROOT}src/infrastructure/app-context.ts`, "utf-8");
  const at = source.lastIndexOf("return {");
  const body = source.slice(at, source.indexOf("}", at));
  const keys = [...body.matchAll(/(\w+):/g)].map((m) => m[1]);
  if (keys.length === 0) throw new Error("appContext() が何を返しているか読めない");
  return keys.join(", ");
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
