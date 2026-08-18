/** @tier 1 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 生成 AI を実際に動かす入口が、実行環境（`env`）を渡し忘れていないことを固定する。
 *
 * --- なぜ検査が要るか ---
 * 鍵は実行環境（Cloudflare の secret）から取る。組み立て（`createDeps`）へ
 * `env` を渡し忘れると、`createLlmPorts({})` になり、**鍵は 1 件も見えない**。
 * このとき起きるのは例外ではなく「使えません」という穏やかな返答で、
 * 画面は普通に描ける。**壊れて見えないので、気づく機会が無い。**
 * 実際この案件では、口はあるのに呼ばれていない形の穴が 4 回続き、
 * 4 回とも別の作業のついでに偶然見つかっている。
 *
 * --- 渡さなくてよい場所がある ---
 * 道具の**名前と入力の形だけ**を読む場所（WebMCP の宣言）は、中身を一度も
 * 動かさない。ここまで `env` を取りに行かせると、画面の描画が実行環境の
 * 読み込みを待つ。だから「動かす入口」だけを対象にし、
 * 対象外はここに名前で書き出す（黙って外れない）。
 *
 * --- この検査が見ていないこと ---
 * `env` の中身が正しいかは見ていない（それは実行時の話）。
 * ここが緑でも「鍵が読める」ことにはならない。渡し忘れが無いことだけを言う。
 *
 * 規範: docs/product/credential-registration.md
 * @req REQ-SEC01
 * @types secrets, infra-config
 */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

/**
 * 注釈を落としてから読む。
 *
 * 落とさないと、`createDeps()` のままにすると…と**書いてある注意書き**自体を
 * 違反として拾う。実際に一度そうなった。検査が言うべきなのは
 * 「何が書いてあるか」ではなく「何が動くか」である。
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

const PRESENTATION = stripComments(read("src/presentation/composition.ts"));
const INFRASTRUCTURE = read("src/infrastructure/composition.ts");

/**
 * 生成 AI を実際に動かす入口。ここは必ず `appContext()` から組み立てる。
 *
 * 増やすときは、増やした側がこの一覧に足す。足さずに済ませられないよう、
 * 「`deps.llm` を読む場所が増えていないか」も下で見る。
 */
const MUST_PASS_ENV = ["createToolCatalog", "generationUseCases", "llmCredentialEntry"];

/**
 * `env` を渡さない場所と、その理由。
 *
 * `descriptorsForPage` … 道具の名前と入力の形しか読まず、中身を動かさない。
 *                        実行環境の読み込みを画面の描画に待たせないため。
 * `rankingTool`        … 順位付けは生成 AI を使わない（報酬額もモデルも入らない）。
 */
const MAY_SKIP_ENV = ["descriptorsForPage", "rankingTool"];

/** 関数 1 つ分の本文を取り出す。次の関数宣言の手前までを本文とみなす。 */
function bodyOf(source: string, name: string): string {
  const head = new RegExp(`\\n(?:export )?(?:async )?function ${name}\\b`);
  const start = source.search(head);
  if (start === -1) return "";
  const rest = source.slice(start + 1);
  const next = rest.slice(1).search(/\n(?:export )?(?:async )?function /);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe("生成 AI を動かす入口が実行環境を渡している", () => {
  it("要件 1: 動かす入口は appContext() から組み立てている", () => {
    for (const name of MUST_PASS_ENV) {
      const body = bodyOf(PRESENTATION, name);
      expect(body, `${name} が composition.ts に見つかりません`).not.toBe("");
      expect(
        /appContext\(\)/.test(body),
        `${name} が appContext() を使っていません。` +
          "createDeps() のままだと、鍵を登録しても提供元アダプタからは 1 件も見えません。",
      ).toBe(true);
    }
  });

  it("要件 2: 動かす入口の createDeps は、どの呼び方でも env を渡している", () => {
    for (const name of MUST_PASS_ENV) {
      const body = bodyOf(PRESENTATION, name);
      const calls = [...body.matchAll(/createDeps\(([^\n]*)\)/g)].map((m) => m[1] as string);
      expect(calls.length, `${name} が createDeps を呼んでいません`).toBeGreaterThan(0);
      for (const args of calls) {
        expect(
          args.includes("env"),
          `${name} が createDeps(${args}) を呼んでいる。` +
            "env を渡さないと、鍵を登録しても提供元アダプタからは 1 件も見えない。",
        ).toBe(true);
      }
    }
  });

  it("要件 3: 道具一覧を組み立てる場所は、動かすなら環境つきで作っている", () => {
    // 道具一覧（`buildToolCatalog`）には生成 AI を呼ぶ道具が入る。
    // ここへ渡す deps に env が無いと、AI からの呼び出しだけが
    // 「鍵がありません」になり、**画面とは答えが違う**状態になる。
    const names = [...PRESENTATION.matchAll(/\n(?:export )?(?:async )?function (\w+)/g)].map(
      (m) => m[1] as string,
    );
    const building = names.filter((n) => /buildToolCatalog\(/.test(bodyOf(PRESENTATION, n)));
    expect(building.length, "buildToolCatalog を呼ぶ場所が 1 つも見つかりません").toBeGreaterThan(0);

    for (const name of building) {
      if (MAY_SKIP_ENV.includes(name)) continue;
      expect(
        /appContext\(\)/.test(bodyOf(PRESENTATION, name)),
        `${name} が環境なしで道具一覧を組み立てています。` +
          "道具を動かさない（名前と形だけ読む）なら MAY_SKIP_ENV へ理由つきで足してください。",
      ).toBe(true);
    }
  });

  it("要件 4: 組み立て側が env を既定の空へ落としていない（呼び出し元の値を使う）", () => {
    /**
     * 以前はここで `createLlmPorts(options.env ?? {})` という**呼び方そのもの**を
     * 期待していた。鍵の預かり所を経由する形へ変えた日にこれが落ちたが、
     * 落ちた理由は「env が届かなくなった」ではなく「途中に 1 段はさまった」だった。
     * 呼び方を固定すると、**中身が正しくても組み替えるたびに赤くなる**。
     * 見るべきなのは呼び方ではなく、`env` が受け取った値のまま渡っていることである。
     */
    expect(INFRASTRUCTURE, "組み立てが呼び出し元の env を読んでいない").toMatch(
      /options\.env\s*\?\?\s*\{\}/,
    );

    // 受け取った env を捨てて空で組み立て直していないこと。
    // `createLlmCredentialManagement({ db, env: {} })` のように書くと、
    // 型は通り、画面も描け、鍵だけが 1 件も見えない状態になる。
    expect(stripComments(INFRASTRUCTURE), "env を空で組み立て直している").not.toMatch(
      /env:\s*\{\s*\}/,
    );

    /**
     * ここには「引数なしの `createLlmPorts()` が無いこと」も見ていたが、消した。
     * 引数が省略できた（既定 `{}`）ころに要る検査で、いまは引数が必須なので
     * **書いた時点で型検査が止める**。型で止まるものを検査でもう一度見ると、
     * 直す場所が 2 つになり、型を直した人が検査を落として当惑する。
     */
  });

  it("要件 5: 生成 AI の口（deps.llm / deps.llmCosts）を読む場所が増えていない", () => {
    const src = readAllSources(join(ROOT, "src"));
    const readers = src
      .filter((f) => /deps\.llm\b|deps\.llmCosts\b/.test(stripComments(f.text)))
      .map((f) => f.path.slice(ROOT.length + 1).replaceAll("\\", "/"))
      .sort();
    // 読む場所が増えたら、その場所も env つきで組み立てられているかを
    // 確かめてから、この一覧へ足す。
    expect(readers).toEqual([
      "src/application/usecases/generation/draft-content-variant.ts",
      "src/presentation/composition.ts",
      "src/presentation/tools/generation-tools.ts",
    ]);
  });
});

function readAllSources(dir: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readAllSources(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))
      out.push({ path: full, text: readFileSync(full, "utf8") });
  }
  return out;
}
