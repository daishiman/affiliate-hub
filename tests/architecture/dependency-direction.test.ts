import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 依存方向の機械検査。
 *
 * 人のレビューでは守れないので、テストで落とす。
 * 「domain が Drizzle を import していないか」を目視で確認し続けることはできない。
 *
 * 依存は内側へ向かう:
 *   presentation → application → domain
 *   infrastructure → application → domain
 *   domain → (何にも依存しない)
 */
const SRC = join(process.cwd(), "src");

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (/\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const IMPORT_PATTERN = /(?:from|import)\s+["']([^"']+)["']/g;

function importsOf(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const found: string[] = [];
  for (const m of source.matchAll(IMPORT_PATTERN)) {
    found.push(m[1]);
  }
  return found;
}

function filesUnder(...segments: string[]): string[] {
  const dir = join(SRC, ...segments);
  try {
    return listTsFiles(dir);
  } catch {
    return [];
  }
}

function violations(
  files: string[],
  isForbidden: (spec: string) => boolean,
): { file: string; spec: string }[] {
  const out: { file: string; spec: string }[] = [];
  for (const file of files) {
    for (const spec of importsOf(file)) {
      if (isForbidden(spec)) out.push({ file: relative(process.cwd(), file), spec });
    }
  }
  return out;
}

describe("依存方向", () => {
  const domainFiles = filesUnder("domain");

  it("domain は外側の層に依存しない", () => {
    const found = violations(domainFiles, (spec) =>
      /^@\/(application|infrastructure|presentation|components|lib|db|app)\b/.test(spec) ||
      spec.startsWith("../../application") ||
      spec.startsWith("../../infrastructure"),
    );
    expect(found).toEqual([]);
  });

  it("domain は Next.js / Drizzle / 外部SDK に依存しない", () => {
    const forbidden = [
      "next",
      "next/",
      "react",
      "react-dom",
      "drizzle-orm",
      "drizzle-orm/",
      "@opennextjs/cloudflare",
      "better-auth",
      "wrangler",
      "cloudflare:",
    ];
    const found = violations(domainFiles, (spec) =>
      forbidden.some((f) => (f.endsWith("/") || f.endsWith(":") ? spec.startsWith(f) : spec === f)),
    );
    expect(found).toEqual([]);
  });

  it("application は infrastructure と presentation に依存しない", () => {
    const found = violations(filesUnder("application"), (spec) =>
      /^@\/(infrastructure|presentation|components|app|db)\b/.test(spec),
    );
    expect(found).toEqual([]);
  });

  it("infrastructure は presentation に依存しない", () => {
    const found = violations(filesUnder("infrastructure"), (spec) =>
      /^@\/(presentation|components|app)\b/.test(spec),
    );
    expect(found).toEqual([]);
  });
});

describe("Editorial と Commercial の分離", () => {
  /**
   * 仕様の中核制約。
   * ランキングの文脈から、報酬を扱う文脈へ import が 1 本でも通ったら失敗させる。
   */
  it("domain/ranking は monetization を参照しない", () => {
    const found = violations(filesUnder("domain", "ranking"), (spec) =>
      spec.includes("monetization") || spec.includes("affiliate"),
    );
    expect(found).toEqual([]);
  });

  it("ランキングのユースケースは報酬のポートを参照しない", () => {
    const found = violations(filesUnder("application", "usecases", "ranking"), (spec) =>
      spec.includes("monetization") || spec.includes("affiliate"),
    );
    expect(found).toEqual([]);
  });

  /**
   * ランキング式の重複実装を防ぐ (arch 受け入れ条件)。
   *
   * UI や WebMCP でスコアを再計算し始めると、画面と AI 回答で順位が食い違う。
   * 重み付き合計の語彙が domain/ranking の外に現れたら失敗させる。
   */
  it("ランキングの計算は domain/ranking の外に無い", () => {
    const outside = [
      ...filesUnder("application"),
      ...filesUnder("infrastructure"),
      ...filesUnder("presentation"),
    ];
    const offenders: string[] = [];
    for (const file of outside) {
      const source = readFileSync(file, "utf8");
      // 重み付き合計・閾値判定を外側で書き直していないか
      if (/weight\s*\*|totalScore\s*=|passThreshold\s*[<>]/.test(source)) {
        offenders.push(relative(process.cwd(), file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("domain/evidence と domain/product も報酬を参照しない", () => {
    const found = violations(
      [...filesUnder("domain", "evidence"), ...filesUnder("domain", "product")],
      (spec) => spec.includes("monetization"),
    );
    expect(found).toEqual([]);
  });

  /**
   * 外部の URL を取りに行く経路を 1 本に絞る (SEC-02)。
   *
   * `fetch` を各所で直接呼ぶと、転送先の再検査を通らない経路ができる。
   * 社内アドレスへ転送する URL を渡された時点で守りが無くなるため、
   * 入口は `infrastructure/http/guarded-fetch.ts` だけにする。
   */
  it("外部への取得は guarded-fetch だけが行う", () => {
    const offenders: string[] = [];
    for (const file of [...filesUnder("infrastructure"), ...filesUnder("application")]) {
      const rel = relative(process.cwd(), file);
      if (rel.endsWith("infrastructure/http/guarded-fetch.ts")) continue;
      const source = readFileSync(file, "utf8");
      if (/(?<![.\w])fetch\s*\(/.test(source)) offenders.push(rel);
    }
    expect(
      offenders,
      "外部の取得は guardedFetch を通してください。転送先の再検査が抜けます。",
    ).toEqual([]);
  });
});
