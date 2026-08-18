/** @tier 1 */
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

/**
 * 集合ごとの下限。**この表に無い集合は `filesUnder()` が受け付けない。**
 *
 * 下限は、いまの実数ではなく「明らかに下回ったら壊れている数」にしてある。
 * 実数に合わせると、ファイルを 1 つ消すたびにここが赤くなって役に立たない。
 * 右の括弧は 2026-08-19 時点の実数。
 */
const LEAST: Record<string, number> = {
  domain: 40, // (93)
  application: 25, // (61)
  infrastructure: 30, // (74)
  presentation: 40, // (106)
  "domain/ranking": 2, // (3)
  "application/usecases/ranking": 1, // (1)
  "domain/evidence": 2, // (3)
  "domain/product": 3, // (5)
  "app/s": 10, // (21)
  "presentation/site": 5, // (9)
  "app/admin": 15, // (37)
};

/**
 * 対象の一覧を取る。**空なら落ちる。**
 *
 * 以前ここはディレクトリの不在を握りつぶして `[]` を返していた。
 * 空の一覧に対する「違反が 0 件」は常に成り立つので、**層を 1 つ改名しただけで
 * その層の検査が黙って緑になる**。2026-08-19 に実測した: `domain` / `application` /
 * `infrastructure` / `presentation` をそれぞれ存在しない名前へ向けたところ、
 * **4 通りとも 13 件すべて緑**だった。
 *
 * 「読者の画面が 1 枚以上ある」という空振り防止は当時もあったが、あれは `app/s` 側の
 * **別の集合**を守っていたので、ここが空になっても生き残った。
 * **空振り防止は 1 か所にあれば足りるものではない。集合ごとに要る**（残課題 78）。
 */
function filesUnder(...segments: string[]): string[] {
  const key = segments.join("/");
  const least = LEAST[key];
  if (least === undefined) {
    throw new Error(
      `src/${key} の下限が LEAST に書いてありません。` +
        "集合を増やすときは下限も足してください（足さないと、その集合が空でも緑になります）",
    );
  }
  let files: string[];
  try {
    files = listTsFiles(join(SRC, ...segments));
  } catch (cause) {
    throw new Error(
      `src/${key} が読めません。層を改名したなら、LEAST と各検査の呼び出しを両方直してください` +
        "（片方だけ直すと、この検査は黙って緑になります）",
      { cause },
    );
  }
  if (files.length < least) {
    throw new Error(
      `src/${key} が ${files.length} 件しか見えていません（下限 ${least}）。` +
        "検査対象が消えています。減らしたのが意図なら LEAST を下げてください",
    );
  }
  return files;
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

/**
 * 検査対象が空でないことを、**集合ごとに**確かめる。
 *
 * 各検査の中で `filesUnder()` を呼んだ時点でも落ちるが、それだと
 * 「依存方向が破れた」のか「対象が消えた」のかが読み分けられない。
 * ここが先に赤くなれば、直す先が対象のほうだと分かる。
 */
describe("検査対象そのもの", () => {
  it.each(Object.keys(LEAST))("src/%s の下にファイルが見えている", (key) => {
    expect(() => filesUnder(...key.split("/"))).not.toThrow();
  });
});

describe("依存方向", () => {
  it("domain は外側の層に依存しない", () => {
    const found = violations(filesUnder("domain"), (spec) =>
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
    const found = violations(filesUnder("domain"), (spec) =>
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

/**
 * 読者面と発信者面の接続境界（docs/spec/02 §9 項5 / docs/architecture/context-map.md）。
 *
 * 読者の画面（`/s/{site}/…`）が編集・配信・提携・設定のユースケースを直接呼べると、
 * **編集中の状態や報酬の情報が読者側の経路に入り込む**。
 * 読み取りモデルの中身は型で守れるが、呼び出し経路そのものは型では守れない。
 *
 * 接続してよいのは 3 つだけ:
 *   - `application/read-models/`（公開済みの記事。報酬の欄を持たない形）
 *   - `usecases/site/read-site`（どのブログか）
 *   - `usecases/analytics/explain-telemetry`（何を測っているかの説明。読者への開示）
 */
describe("読者面と発信者面の接続境界", () => {
  const readerFiles = () => [...filesUnder("app", "s"), ...filesUnder("presentation", "site")];

  const ALLOWED_USECASES = [
    "application/usecases/site/read-site",
    "application/usecases/analytics/explain-telemetry",
  ];

  it("読者の画面が 1 枚以上ある（検査が空振りしていない）", () => {
    expect(readerFiles().length).toBeGreaterThan(10);
  });

  it("読者の画面は、許した 2 つ以外のユースケースを直接呼ばない", () => {
    const found = violations(
      readerFiles(),
      (spec) =>
        spec.includes("application/usecases/") && !ALLOWED_USECASES.some((a) => spec.includes(a)),
    );
    expect(
      found,
      "読者の画面から発信者側のユースケースを呼んでいます。" +
        "公開済みの記事は application/read-models/ 経由で受け取ってください",
    ).toEqual([]);
  });

  it("読者の画面は、提携・報酬のドメインを読まない", () => {
    // 記事の中の成果リンクは読み取りモデルが持つ（`affiliateUrl` の 1 欄）。
    // 金額・成果・ASP はそこに無く、読者側の経路には最初から現れない。
    const found = violations(readerFiles(), (spec) => spec.includes("domain/monetization"));
    expect(found).toEqual([]);
  });

  it("発信者の画面は、読者向けの見せ方を組み立て直さない", () => {
    // 逆向きも塞ぐ。管理側で同じ形を作り直すと、読者に見えるものが 2 通りになる。
    const found = violations(filesUnder("app", "admin"), (spec) =>
      spec.includes("presentation/site/"),
    );
    expect(found).toEqual([]);
  });
});
