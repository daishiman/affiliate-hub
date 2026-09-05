/** @tier 1 @req REQ-FB04 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Worker の入口と定期実行の配線を、設定ファイルの形として確かめる。
 *
 * --- なぜ要るのか ---
 * 定期実行（cron）は**呼ばれなくても誰も困らない**。画面は動き続け、
 * テストも通り、エラーも出ない。ただ期限切れの写しが消えなくなるだけで、
 * それは置き場を覗かないと分からない。つまり**壊れても気づけない種類**の配線である。
 *
 * 壊れ方は 3 通りある。
 *
 *   1. `main` を OpenNext の生成物へ戻す（生成物に `scheduled` は無い）
 *   2. 環境を 1 つ増やしたときに、そこだけ `triggers` を書き忘れる
 *   3. 入口が掃除を呼ばなくなる（包むだけになる）
 *
 * 3 つとも、公開しても成功する。だからここで見る。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2-7（契約検査）
 */

const ROOT = process.cwd();

/**
 * jsonc（注釈つき JSON）から注釈を落とす。
 *
 * 文字列の中の `//` を消さないよう、文字列の内側にいるかを見ながら進む。
 * ここで専用の読み取り部品を足さないのは、それが**間接の依存**になり、
 * 「設定を読むために別の何かが要る」状態を増やすため。
 */
function stripJsonComments(source: string): string {
  let out = "";
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < source.length; i += 1) {
    const c = source[i];
    const next = source[i + 1];
    if (inLine) {
      if (c === "\n") {
        inLine = false;
        out += c;
      }
      continue;
    }
    if (inBlock) {
      if (c === "*" && next === "/") {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 1;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === "/" && next === "/") {
      inLine = true;
      i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      inBlock = true;
      i += 1;
      continue;
    }
    out += c;
  }
  return out;
}

type WranglerSection = {
  readonly triggers?: { readonly crons?: readonly string[] };
  readonly r2_buckets?: readonly { readonly binding: string }[];
  readonly d1_databases?: readonly { readonly binding: string }[];
};
type WranglerConfig = WranglerSection & {
  readonly main?: string;
  readonly env?: Record<string, WranglerSection>;
};

const config = JSON.parse(
  stripJsonComments(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")),
) as WranglerConfig;

/**
 * 見る対象の一覧を、設定そのものから作る。
 * 環境を足した人が、この検査に足しに来なくてよいようにする。
 */
function sections(): readonly (readonly [string, WranglerSection])[] {
  return [
    ["（既定）", config] as const,
    ...Object.entries(config.env ?? {}).map(([name, section]) => [name, section] as const),
  ];
}

/**
 * 定期メンテナンスの配線の正本。
 *
 * 入口（worker-entry.js）は OpenNext の生成物を包むだけに保ち、
 * 「どの仕事を、どんな順で、どう守って呼ぶか」はこちら側に置く。
 * だから SEO の配線検査もこのファイルを見る。
 */
const MAINTENANCE_MODULE = join(ROOT, "src", "infrastructure", "platform", "scheduled-maintenance.ts");

/** モジュールを関数単位に切り分ける。1 つの仕事の中だけを見るため。 */
function jobSections(source: string): readonly string[] {
  const starts = [...source.matchAll(/\n(?:export )?(?:async )?function /g)].map(
    (match) => match.index,
  );
  return starts.map((start, index) => source.slice(start, starts[index + 1] ?? source.length));
}

const SEO_SCHEDULER_IMPORT =
  'import { runScheduledSeoAssessment } from "./seo-assessment-scheduler";';

const OTHER_CRON_JOBS = [
  "sweepExpiredCaptures",
  "runPublicationDeliveryAuditFlush",
  "runScheduledDistribution",
  "runReaderMetricsRollup",
  "runFeedbackDiagnosticsPurge",
] as const;

function assertSeoWiring(entry: string): void {
  const imports = entry
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("seo-assessment-scheduler"));
  expect(imports, "SEO scheduler は正確な named import 1 本で読み込んでください").toEqual([
    SEO_SCHEDULER_IMPORT,
  ]);

  const seoJobs = jobSections(entry).filter((section) =>
    section.includes("runScheduledSeoAssessment("),
  );
  expect(seoJobs, "SEO 再診断が独立した仕事になっていません").toHaveLength(1);
  const seoJob = seoJobs[0] as string;
  const call = "runScheduledSeoAssessment(env.DB, now)";
  const guardAt = seoJob.indexOf("if (env.DB === undefined)");
  const returnAt = seoJob.indexOf("return;", guardAt);
  const guardEndAt = seoJob.indexOf("}", guardAt);
  const callAt = seoJob.indexOf(call);
  expect(
    guardAt >= 0 && guardAt < returnAt && returnAt < guardEndAt && guardEndAt < callAt,
    "SEO scheduler は DB guard → return → call の順で配線してください",
  ).toBe(true);
  expect(seoJob.match(new RegExp(call.replace(/[().]/g, "\\$&"), "g")) ?? []).toHaveLength(1);

  for (const field of ["scanned", "completed", "failed", "truncated"]) {
    expect(seoJob, `SEO 定期処理の ${field} を構造化ログに出していません`).toContain(
      `${field}: result.${field}`,
    );
  }
  for (const [, args = ""] of seoJob.matchAll(/console\.(?:log|warn|error)\(([\s\S]*?)\);/g)) {
    expect(args, "SEO 定期処理のログに例外または失敗対象を渡しています").not.toMatch(
      /\berror\b|result\.failures/,
    );
  }
  const errorCalls = [...seoJob.matchAll(/console\.error\(([\s\S]*?)\);/g)].map(
    (match) => `console.error(${match[1]});`,
  );
  expect(errorCalls, "SEO 定期処理の例外は安全な固定文言だけを出してください").toEqual([
    'console.error("[seo-assessment] 月次再診断に失敗しました");',
  ]);

  for (const otherJob of OTHER_CRON_JOBS) {
    expect(seoJob, `SEO waitUntil に別の cron 処理 ${otherJob} が混ざっています`).not.toContain(
      otherJob,
    );
  }
}

describe("Worker の入口と定期実行の配線", () => {
  it("入口は、リポジトリに入っているファイルを指している", () => {
    const main = config.main;
    expect(main, "main が指定されていません").toBeTypeOf("string");
    // 生成物（.open-next/）はリポジトリに入っていないので、
    // 取得した直後の状態では存在しない。そこを直に指すと
    // 「手元では動くが、取得しただけの環境では入口が無い」になる。
    expect(main, "生成物を直に指しています").not.toContain(".open-next");
    expect(existsSync(join(ROOT, main as string)), `${main} がありません`).toBe(true);
  });

  it("画面の写しの置き場がある環境には、掃除の定期実行がある", () => {
    for (const [name, section] of sections()) {
      const hasBucket = (section.r2_buckets ?? []).some((b) => b.binding === "BUCKET");
      if (!hasBucket) continue;
      // 置き場があるのに掃除が無いと、「180 日で消えます」だけが嘘になる。
      const crons = section.triggers?.crons ?? [];
      expect(crons.length, `${name}: 置き場はあるのに定期実行がありません`).toBeGreaterThan(0);
    }
  });

  it("見ている環境が 1 つも無い、ということが起きていない", () => {
    // 上の検査は「置き場のある環境」だけを見る。binding の名前を変えると
    // 対象が 0 件になり、何も確かめずに緑になる。それを潰す。
    const covered = sections().filter(([, s]) =>
      (s.r2_buckets ?? []).some((b) => b.binding === "BUCKET"),
    );
    expect(covered.length, "置き場のある環境が 1 つも見つかりませんでした").toBeGreaterThan(0);
  });

  it("技術診断の保存先がある環境にも、削除の定期実行がある", () => {
    const covered = sections().filter(([, section]) =>
      (section.d1_databases ?? []).some((database) => database.binding === "DB"),
    );
    expect(covered.length, "DB のある環境が 1 つも見つかりませんでした").toBeGreaterThan(0);
    for (const [name, section] of covered) {
      expect(
        section.triggers?.crons?.length ?? 0,
        `${name}: DB はあるのに技術診断を消す定期実行がありません`,
      ).toBeGreaterThan(0);
    }
  });

  it("入口は、定期メンテナンスへ実行環境と cron の起動時刻を渡している", () => {
    const entry = readFileSync(join(ROOT, config.main as string), "utf8");
    expect(entry, "定期実行の受け口がありません").toContain("scheduled");
    // 入口はOpenNextの生成物を包むだけに保ち、型で守る配線は src 側へ置く。
    expect(entry, "定期メンテナンスの配線を読み込んでいません").toContain(
      "scheduleMaintenanceJobs",
    );
    expect(
      entry,
      "定期メンテナンスへ実行環境・実行文脈・cron の起動時刻を渡していません",
    ).toMatch(/scheduleMaintenanceJobs\s*\(\s*env\s*,\s*ctx\s*,\s*now\s*\)/);
  });

  it("定期メンテナンスは、仕事ごとに独立した待ち行列へ載せている", () => {
    const source = readFileSync(MAINTENANCE_MODULE, "utf8");
    // 包むだけになっていないこと。処理そのものは各 scheduler にあり、そちらにテストがある。
    for (const [job, label] of [
      ["sweepExpiredCaptures", "掃除"],
      ["runFeedbackDiagnosticsPurge", "技術診断の削除"],
      ["runScheduledDistribution", "予約された外部配信"],
      ["runPublicationDeliveryAuditFlush", "配信監査outboxの再送"],
      ["runReaderMetricsRollup", "読者の日次集計"],
      ["runScheduledSeoAssessment", "SEO の月次再診断"],
    ] as const) {
      expect(source, `${label}を呼んでいません`).toContain(job);
    }
    expect(source, "D1 binding の欠落を安全側で扱っていません").toContain("env.DB === undefined");
    expect(
      (source.match(/ctx\.waitUntil\(/g) ?? []).length,
      "SEO・配信・R2・D1を同じ待ち行列へ戻すと、1 つの失敗で他の定期処理まで止まります",
    ).toBeGreaterThanOrEqual(6);
    assertSeoWiring(source);
  });

  it("危険な SEO 配線の変異を拒否する", () => {
    const entry = readFileSync(MAINTENANCE_MODULE, "utf8");
    const mutations: readonly (readonly [string, (source: string) => string])[] = [
      [
        "side-effect import",
        (source) =>
          source.replace(
          'import { runScheduledSeoAssessment } from "./seo-assessment-scheduler";',
          'import "./seo-assessment-scheduler";',
        ),
      ],
      [
        "guard より前の call",
        (source) =>
          source.replace(
          'if (env.DB === undefined) {\n    console.warn("[seo-assessment]',
          'if (env.DB === undefined) {\n    runScheduledSeoAssessment(env.DB, now);\n    console.warn("[seo-assessment]',
        ),
      ],
      [
        "error ログ",
        (source) =>
          source.replace(
          'console.error("[seo-assessment] 月次再診断に失敗しました");',
          'console.error("[seo-assessment] 月次再診断に失敗しました", error);',
        ),
      ],
      [
        "failures ログ",
        (source) =>
          source.replace(
          "truncated: result.truncated,",
          "truncated: result.truncated,\n            failures: result.failures,",
        ),
      ],
      [
        "他 cron の混入",
        (source) =>
          source.replace(
          "const result = await runScheduledSeoAssessment(env.DB, now);",
          "await runPublicationDeliveryAuditFlush(env.DB);\n          const result = await runScheduledSeoAssessment(env.DB, now);",
        ),
      ],
    ];
    for (const [name, mutate] of mutations) {
      expect(() => assertSeoWiring(mutate(entry)), name).toThrow();
    }
  });

  it("入口は、生成物が出している入れ物をすべて通している", () => {
    const built = join(ROOT, ".open-next", "worker.js");
    if (!existsSync(built)) {
      // 生成物が無い状態（取得した直後）では確かめようがない。
      // 見落としても公開時に「宣言された入れ物が無い」で必ず失敗するため、
      // ここで無理に判定せず、確かめられるときだけ確かめる。
      expect(config.main, "生成物が無いので、通し忘れは公開時に判明する").toBeTypeOf("string");
      return;
    }
    const exported = [...readFileSync(built, "utf8").matchAll(/export\s*\{\s*(\w+)\s*\}/g)].map(
      (m) => m[1],
    );
    expect(exported.length, "生成物から入れ物を読み取れませんでした").toBeGreaterThan(0);
    const entry = readFileSync(join(ROOT, config.main as string), "utf8");
    for (const name of exported) {
      expect(entry, `${name} を通していません`).toContain(name);
    }
  });
});
