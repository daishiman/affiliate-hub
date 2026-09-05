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

/**
 * 入口が読む TypeScript。`worker-entry.js` の import から機械で拾う。
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

/** 入口から手が届く `src/` の全ファイルを、実際にたどって集める。 */
function reachableFromEntry(): Map<string, number> {
  const seen = new Map<string, number>();
  const queue = entryImports();
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
 * ── 【2026-09-05】130 → 155 ファイル / 1050 → 1250 KiB へ上げた。
 * **上げた理由をここへ書く。**
 *
 * cron の仕事が実際に 2 つ増えた。読者行動の日次ロールアップ
 * (`runReaderMetricsRollup`) と、SEO/AEO の定期評価 (`runScheduledSeoAssessment`)
 * である。どちらも「口を 1 つ足す」ではなく、集計表と評価表という**新しい
 * 置き場を伴う口**なので、上の見積り (1 口あたり 5〜10 ファイル) より重い。
 * 実測は 107 → 133 ファイル（+26）、889 → 1089 KiB（+200）。
 * **両方の上限を超えた。**片方だけ上げて済ませると、次に量で気づく手がかりが
 * 1 本になるので、両方をこの回の実測から置き直す。
 *
 * 新しい上限を 155 / 1250 にしたのは、この検査が分けたい 2 つの出来事が
 * **133 / 1089 を基点にしても依然として量の桁で分かれる**からである。
 *
 *   ふつうの追加   … cron に口を 1 つ。5〜10 ファイル / 50〜80 KiB。
 *                    2 回ぶん足しても 153 ファイル / 1249 KiB で、どちらも届かない。
 *   総目録の復活   … `createDeps()` が戻ると +88 ファイル / +775 KiB。
 *                    133 + 88 = 221、1089 + 775 = 1864 で、どちらも必ず超える。
 *
 * **この引き上げは「赤くなったから上げた」ではない。**上げる前に、増えた 26 が
 * cron の 2 job から実際に引かれているものかを一件ずつ見た。見本実装や
 * 取りまとめの import が紛れ込んだのではないことは、下の「要件 2」
 * (`createDeps` を引いていない) が引き続き緑であることでも裏が取れている。
 * 次に赤くなったときも、まずこの 2 つを確かめること。
 */
const MAX_FILES = 155;
const MAX_KIB = 1250;

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
});
