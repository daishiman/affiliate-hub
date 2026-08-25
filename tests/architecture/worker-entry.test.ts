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

  it("入口は、掃除を呼んでいる", () => {
    const entry = readFileSync(join(ROOT, config.main as string), "utf8");
    expect(entry, "定期実行の受け口がありません").toContain("scheduled");
    // 包むだけになっていないこと。処理そのものは src 側にあり、そちらにテストがある。
    expect(entry, "掃除を呼んでいません").toContain("sweepExpiredCaptures");
    expect(entry, "技術診断の削除を呼んでいません").toContain(
      "runFeedbackDiagnosticsPurge",
    );
    expect(entry, "D1 binding の欠落を安全側で扱っていません").toContain(
      "env.DB === undefined",
    );
    expect(
      (entry.match(/ctx\.waitUntil\(/g) ?? []).length,
      "R2 と D1 を同じ待ち行列へ戻すと、片方の欠落で両方止まります",
    ).toBeGreaterThanOrEqual(2);
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
