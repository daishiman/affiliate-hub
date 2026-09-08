/** @tier 1 */
/**
 * Worker の入口が引き込む TypeScript の量に、上限を張る。
 *
 * --- なぜ要るのか（2026-08-30 に起きたこと） ---
 *
 * Cloudflare Workers の上限は **1 Worker あたり 3 MiB（gzip 後）**。
 * この日の公開はそこを超えて落ちた（gzip 3065 KiB / 上限 3072 KiB＝残り 6.5 KiB）。
 *
 * 中を割ると、`worker-entry.js` → `distribution-scheduler.ts` → `createDeps()` の
 * 経路が **226 ファイル・1018 KiB** を引いていた。画面と API のコードは
 * OpenNext が別に束ねた `handler.mjs` の中にあるので、**この経路が引いたものは
 * Worker の中にもう 1 部増える**。cron が実際に使う口は 5 つだけだった。
 *
 * --- なぜ「気をつける」では足りないか ---
 *
 * `createDeps()` へ戻しても、型は通り、テストは緑で、cron も正しく動く。
 * 太ったことは**どこにも現れない**。現れるのは、数か月後にたまたま上限へ
 * 当たった日の公開で、しかもそのとき出るのは「Worker が大きすぎます」であって
 * 「入口が総目録を引いています」ではない。原因と症状が遠すぎる。
 *
 * ここで見るのは gzip 後の実寸ではない（それはビルドしないと分からない）。
 * **入口から手が届く範囲**を見る。実寸が動く前に、引き込みの形が変わった時点で鳴る。
 *
 * --- この検査が言わないこと ---
 *
 * 上限の中に収まっていることは言わない。`handler.mjs` 側（画面・API・ルート）が
 * 太った分はここに出ない。実寸は公開の直前に `wrangler` が見る。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md
 * @req REQ-CI16
 * @types boundary, infra-config, code-boundary
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

/** 定期実行の中身の入口。ここから手が届く範囲を数える。 */
const CRON_ROUTE = "src/app/internal-cron/route.ts";

/**
 * 入口（`worker-entry.js`）が直に読む TypeScript。**0 件が正しい。**
 *
 * 手で書き写さないのは、入口が読む先を増やしたときに**ここだけ古いまま**に
 * なるのを避けるため。増えた先も自動で数に入る。
 */
function entryImports(): string[] {
  const entry = readFileSync(join(ROOT, "worker-entry.js"), "utf8");
  return [...entry.matchAll(/from\s+"(\.\/src\/[^"]+)"/g)].map((m) =>
    resolve(ROOT, m[1] as string),
  );
}

/** `@/…` と相対指定を実ファイルへ解く。拡張子の省略と `index` も見る。 */
function resolveSpecifier(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join(ROOT, "src", spec.slice(2))
    : spec.startsWith(".")
      ? resolve(dirname(from), spec)
      : null;
  if (base === null) return null; // node_modules は数えない（束ねる側の話）
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      // ディレクトリそのものは実体ではないので弾く
      if (candidate === base && !/\.tsx?$/.test(candidate)) continue;
      return candidate;
    }
  }
  return null;
}

/** 定期実行の入口から手が届く `src/` の全ファイルを、実際にたどって集める。 */
function reachableFromEntry(): Map<string, number> {
  const seen = new Map<string, number>();
  const queue = [join(ROOT, CRON_ROUTE)];
  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    const text = readFileSync(file, "utf8");
    seen.set(file, Buffer.byteLength(text, "utf8"));
    // `import type` は束ねる時点で消えるので数に入れない。
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?!type\s)[^;]*?from\s+"([^"]+)"/g)) {
      const next = resolveSpecifier(file, m[1] as string);
      if (next !== null) queue.push(next);
    }
    for (const m of text.matchAll(/(?:^|\n)\s*import\s+"([^"]+)"/g)) {
      const next = resolveSpecifier(file, m[1] as string);
      if (next !== null) queue.push(next);
    }
  }
  return seen;
}

const REACHED = reachableFromEntry();
const TOTAL_KIB = [...REACHED.values()].reduce((a, b) => a + b, 0) / 1024;
const PATHS = [...REACHED.keys()].map((p) => relative(ROOT, p).replaceAll("\\", "/")).sort();

/**
 * 上限。**この数字の意味は「これ以上は一度立ち止まる」であって「安全な量」ではない。**
 *
 * この検査の尺度での実測（2026-08-31、注釈込みのソース実寸）:
 *
 *   いま          107 ファイル /  889 KiB （見本実装 3 件）
 *   総目録を引くと 195 ファイル / 1664 KiB （`createDeps()` のころ、見本 20 件）
 *
 * 上限を 130 / 1050 に置いたのは、この 2 つの数の**間**だからではない。
 * 分けたい 2 つの出来事が、たまたま量の桁で分かれるからである。
 *
 *   ふつうの追加   … cron に口を 1 つ足す。D1 の置き場 1 つとその型で 5〜10 ファイル。
 *                    2 回ぶん足しても届かない位置に上限を置いた（+23 ファイル / +161 KiB）。
 *   総目録の復活   … 誰かが `createDeps()` や取りまとめの import を書き戻す。
 *                    このとき +88 ファイル / +775 KiB 跳ねるので、必ず超える。
 *
 * つまり「10 ファイル足したら赤くなる」ことは無く、「総目録が戻ったら必ず赤くなる」。
 * 見張りが鳴るのが年に何度もあるようなら、それは上限ではなく**入口の設計**が
 * 変わった合図なので、数字を上げる前に `distribution-scheduler.ts` の注記を読むこと。
 *
 * 上げてよい場合はある（cron の仕事が本当に増えたとき）。そのときは
 * **上げた理由をここへ書く**。理由の無い引き上げが 1 度通ると、この検査は
 * 「赤くなったら上げるもの」になり、何も守らなくなる。
 *
 * ── 【2026-09-05】155 → 105 ファイル / 1250 → 1000 KiB へ**下げた**。
 *
 * 同じ日に 2 つのことが起きた。順に書く。
 *
 * 1 つめ。cron の仕事が 2 つ増え（読者行動の日次ロールアップと SEO/AEO の
 * 定期評価）、107 → 133 ファイル / 889 → 1089 KiB になって、一度 155 / 1250 へ
 * 上げた。増えた 26 が cron の 2 job から実際に引かれていることは一件ずつ見た。
 *
 * 2 つめ。それでも公開が gzip 3104 KiB / 上限 3072 KiB で落ちた。中を割ると、
 * 引き込みの形が 2 か所で緩んでいた。
 *
 *   - `src/db/schema.ts` が列の CHECK 制約のために領域のバレル
 *     (`@/domain/<領域>`) から定数を引いていた。バレルは束ねる側から見て
 *     「副作用があるかもしれない module の束」なので、定数 1 つでも領域一式が入る。
 *     定義元の module を直に指す形へ直して 133 → 118 ファイル。
 *   - 同じ緩みが `src/` 全体に 146 ファイルぶんあった。直して 118 → 82 ファイル。
 *
 * さらに、この検査が測る**起点そのもの**を変えた。`worker-entry.js` が `src/` を
 * 直に読むと、同じ TypeScript が画面側の束とは別にもう一度束ねられ、
 * **1 つの Worker に 2 部**入る（実測でこの 2 部目が 82 ファイル 791 KiB）。
 * そこで cron の中身を画面側の束（`src/app/internal-cron/route.ts`）へ移し、
 * 入口はそれを叩くだけにした。この検査の起点もそこへ移した。
 *
 * 新しい上限を 105 / 1000 にしたのは、実測 83 ファイル / 792 KiB を基点にしても、
 * この検査が分けたい 2 つの出来事が依然として量の桁で分かれるからである。
 *
 *   ふつうの追加   … cron に口を 1 つ。5〜10 ファイル / 50〜80 KiB。
 *                    2 回ぶん足しても 103 ファイル / 952 KiB で、どちらも届かない。
 *   総目録の復活   … `createDeps()` が戻ると +88 ファイル / +775 KiB。
 *                    83 + 88 = 171、792 + 775 = 1567 で、どちらも必ず超える。
 *
 * **上限を下げたのは、緩みを直した実測がそこにあるからである。**上げたままに
 * しておくと、同じ緩みが戻っても 155 に届くまで鳴らない。守りたいのは
 * 「量が上限内であること」ではなく「引き込みの形が変わったら鳴ること」なので、
 * 実測が下がったら上限も下げる。次に赤くなったときは、数字を動かす前に
 * バレル経由の import が戻っていないかを先に見ること。
 */
const MAX_FILES = 105;
const MAX_KIB = 1000;

describe("Worker の入口が引き込む量", () => {
  it("要件 1: 入口から手が届く範囲が上限を超えていない", () => {
    expect(
      PATHS.length,
      `入口から ${PATHS.length} ファイル（上限 ${MAX_FILES}）。\n` +
        "cron の経路が新しく何かを引き込んでいる。引いたものは Worker の中に\n" +
        "もう 1 部増える（画面と API は handler.mjs 側に別にある）。\n" +
        "本当に要るものなら上限を上げてよいが、上げた理由をここへ書くこと。",
    ).toBeLessThanOrEqual(MAX_FILES);
    expect(
      TOTAL_KIB,
      `入口から ${TOTAL_KIB.toFixed(0)} KiB（上限 ${MAX_KIB} KiB）。`,
    ).toBeLessThanOrEqual(MAX_KIB);
  });

  it("要件 2: 入口が組み立ての総目録（createDeps）を引いていない", () => {
    // 総目録は「どの実装を使うか」を全部並べた場所で、見本実装まで数珠つなぎに引く。
    // cron が使う口は 5 つだけなので、ここへ触れた時点で引きすぎである。
    expect(
      PATHS,
      "入口が src/infrastructure/composition.ts を引いています。\n" +
        "cron に要る口だけを直に組んでください（distribution-scheduler.ts の注記を参照）。",
    ).not.toContain("src/infrastructure/composition.ts");
    expect(
      PATHS,
      "SEO scheduler が画面用の composition を引いています。cron に要る依存だけを直に組んでください。",
    ).not.toContain("src/presentation/composition.ts");
  });

  it("要件 3: 数えられている（たどれずに 0 件で緑になっていない）", () => {
    // 解決に失敗して空になれば、上限は必ず満たされる。**測っていないのに緑**を塞ぐ。
    expect(PATHS.length, "入口からたどれたファイルが少なすぎます").toBeGreaterThan(50);
    expect(PATHS).toContain("src/infrastructure/platform/distribution-scheduler.ts");
    expect(PATHS).toContain("src/infrastructure/platform/seo-assessment-scheduler.ts");
    expect(PATHS).toContain("src/db/schema.ts");
  });

  it("要件 4: Worker の入口が src/ を直に読んでいない（二重取り込みが戻っていない）", () => {
    // 入口が読んだ src/ は、画面側の束とは別にもう一度束ねられ、
    // 同じ TypeScript が 1 つの Worker に 2 部入る。2026-09-05 の実測で
    // その 2 部目は 82 ファイル 791 KiB あり、gzip 上限 3072 KiB を割っていた。
    // 上の 3 つの要件は「引き込む量」を見るが、2 部になったことは**量に出ない**。
    expect(
      entryImports(),
      "worker-entry.js が src/ を直に読んでいます。\n" +
        "定期実行の中身は画面側の束（src/app/internal-cron/route.ts）へ置き、\n" +
        "入口はそれを叩くだけにしてください。ここで読むと Worker に 2 部入ります。",
    ).toEqual([]);
  });

  it("要件 5: 定期実行の内部の道筋が、外から届かないように塞がれている", () => {
    // route が生えている以上、外から叩けてしまうと掃除・配信・診断を
    // 誰でも起動できる。塞いでいるのは入口の fetch なので、そこを見る。
    const entry = readFileSync(join(ROOT, "worker-entry.js"), "utf8");
    expect(entry, "内部の道筋の名前が入口と route で食い違っています").toContain("/internal-cron");
    expect(
      entry,
      "入口が内部の道筋を 404 で塞いでいません。外から定期実行を起動できます。",
    ).toMatch(/pathname === INTERNAL_CRON_PATH[\s\S]{0,200}status: 404/);
    const route = readFileSync(join(ROOT, CRON_ROUTE), "utf8");
    expect(route, "route が入口の印を確かめていません").toContain("x-internal-cron");
  });
});
