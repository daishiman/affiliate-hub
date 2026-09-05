/**
 * @tier 1
 * @req REQ-FD01, REQ-FD02, REQ-TM12, REQ-SEC02, REQ-SEC04, REQ-TS09
 * @types code-boundary
 *
 * 印を 1 行に収めてあるのは、`scripts/required-test-types.mjs` の `@req` が
 * 1 行しか読まないため（折り返すと 2 行目が黙って落ちる）。
 */
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

/**
 * 素の取得の書き方。**別名で呼ぶ形も拾う。**
 * `globalThis.fetch(` は `.` が前に付くので、否定先読みだけでは拾えない。
 */
const RAW_FETCH =
  /(?<![.\w])fetch\s*\(|(?:globalThis|window|self)\s*(?:\.\s*fetch\s*\(|\[\s*["'`]fetch["'`]\s*\])/;

/**
 * guarded-fetch を通さなくてよいもの。**理由を 1 件ずつ書く。**
 *
 * ここに載るのは「行き先を人が決められない」ものだけで、
 * SSRF が問題にしている「サーバーが外から渡された URL を取りに行く」形ではない。
 * 形は 2 通り: ブラウザから自分のサイトの相対パスを叩くものと、
 * コードに固定した相手へ**送る**もの。どちらも転送先を再検査する相手が居ない。
 */
const FETCH_EXEMPT: readonly { readonly file: string; readonly why: string }[] = [
  {
    file: "app/signin/google-signin-button.tsx",
    why: "ブラウザから自分のサイトの `/api/auth/sign-in/social` を叩く。行き先は固定の相対パスで、外から渡された URL ではない",
  },
  {
    file: "presentation/telemetry/collector.tsx",
    why: "ブラウザから計測の受け口へ送る。送り先は自分のサイトの相対パスで、取りに行っているのではなく送っている",
  },
  {
    file: "presentation/reader/behavior-probe.tsx",
    why: "ブラウザから読者の行動の受け口 `/api/reader-events` へ送る。上の collector と同型で、送り先は自分のサイトの相対パス（`endpoint` の既定値）であり、取りに行っているのではなく送っている。離脱時は `sendBeacon` に落ちる",
  },
  {
    file: "presentation/tools/webmcp-adapter.ts",
    why: "ブラウザのページ内 AI が自分のサイトの道具の入口を叩く。行き先は同一オリジンの相対パス",
  },
  {
    file: "infrastructure/domains/cloudflare-custom-hostname.ts",
    why: "Cloudflare for SaaS の custom hostname 操作。行き先はコードに固定した https://api.cloudflare.com/client/v4 だけで、外から渡された URL ではない。登録・削除は送信 (POST/DELETE) なので、取得専用の guardedFetch では運べない",
  },
  {
    file: "infrastructure/indexnow/indexnow-client.ts",
    why: "IndexNow への通知。行き先はコードに固定した https://api.indexnow.org だけで、外から渡された URL ではない。guardedFetch は取得（GET）専用なので、この送信（POST）は運べない",
  },
];

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
  // 2026-08-31 に取り直した実数は 98（前の括弧書き 37 は 2026-08-19 時点）。
  // 15 は実数の 15% で、管理画面が 8 割方消えても緑のままだった。
  // 実数の 8 割にあたる 78 へ上げる。20 件ぶんの余裕があるので画面の増減では動かない。
  // **`page.tsx` の数（86）ではない。**ここが数えるのは `listTsFiles`、
  // つまり `.ts` / `.tsx` すべてである。取り直すときは同じ数え方ですること。
  "app/admin": 78, // (98 @2026-08-31)
  app: 40, // (71) 外部取得の走査に要る（2026-08-21 に足した）
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

  /**
   * **逆向きも見る。**上の 3 件は domain・application・infrastructure から
   * 外へ出る向きだけを見ていて、`presentation → infrastructure` は
   * どこにも書かれていなかった。2026-08-21 に実測: `presentation/site/page-frame.tsx`
   * へ `@/infrastructure/persistence/d1/telemetry-repository` の import を
   * 1 行足しても、`dependency-direction` 24 件・`ui-layers` 9 件とも緑だった。
   * `ui-layers.test.ts` が見ているのは `src/presentation/ui` の下だけで、
   * `presentation/site` も `presentation/admin` も範囲の外にある。
   *
   * 差し込みの 1 箇所（`presentation/composition.ts`）だけが例外である。
   * ここが増えると、画面から保存先を直接叩く道が開き、
   * 差し替えの利かない結び付きが画面の中に散る。
   */
  it("presentation は infrastructure を差し込みの 1 箇所からしか読まない", () => {
    const allowed = "src/presentation/composition.ts";
    const found = violations(filesUnder("presentation"), (spec) =>
      /^@\/infrastructure\b/.test(spec),
    ).filter((v) => v.file.split("\\").join("/") !== allowed);
    expect(
      found,
      `画面から保存先を直接読んでいます。差し込みは ${allowed} の 1 箇所です。`,
    ).toEqual([]);

    // **空振り防止。**許した 1 箇所が実際に読んでいることを見る。
    // ここが 0 件になったら、上の 0 件は「誰も読んでいない」の 0 件である。
    const viaComposition = violations(filesUnder("presentation"), (spec) =>
      /^@\/infrastructure\b/.test(spec),
    ).filter((v) => v.file.split("\\").join("/") === allowed);
    expect(
      viaComposition.length,
      `${allowed} が infrastructure を 1 つも読んでいません。差し込みの場所が移ったか、走査先が外れています`,
    ).toBeGreaterThan(0);
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
   *
   * --- 2026-08-21 に測って分かった穴 2 つ ---
   * 追跡表 REQ-SEC02 は「外部への取得は guarded-fetch だけが行う」と書いていたが、
   * 実際には次の 2 通りが**素通りしていた**（どちらも実測）。
   *   1. **走査が `infrastructure` と `application` にしか届いていなかった。**
   *      `src/presentation/site/policy-page.tsx` へ
   *      `fetch("http://169.254.169.254/latest/meta-data/")` を書いても緑。
   *      サーバー側で動く画面のコードは `presentation` と `app` にある。
   *   2. **`globalThis.fetch(` が判定の否定先読み `(?<![.\w])` に弾かれていた。**
   *      走査範囲の中（`infrastructure/http/`）へ書いても緑。
   * 対照として素の `fetch(` を同じ場所へ書くと赤になったので、
   * 走査そのものは届いていた（「壊し方が届かなかった」ではない）。
   */
  it("外部への取得は guarded-fetch だけが行う", () => {
    const offenders: string[] = [];
    const scanned = [
      ...filesUnder("infrastructure"),
      ...filesUnder("application"),
      ...filesUnder("presentation"),
      ...filesUnder("app"),
    ];
    // 母集団の床。走査が空になったら「違反 0 件」は常に成り立つ。
    expect(scanned.length, "走査対象が消えています").toBeGreaterThan(200);
    for (const file of scanned) {
      const rel = relative(process.cwd(), file);
      if (rel.endsWith("infrastructure/http/guarded-fetch.ts")) continue;
      if (FETCH_EXEMPT.some((e) => rel.endsWith(e.file))) continue;
      const source = readFileSync(file, "utf8");
      if (RAW_FETCH.test(source)) offenders.push(rel);
    }
    expect(
      offenders,
      "外部の取得は guardedFetch を通してください。転送先の再検査が抜けます。",
    ).toEqual([]);
  });

  /**
   * 免除に、実在しない行が残っていないこと。
   *
   * 免除は理由つきで残るので、対象が消えたあとも気づかれずに居座る。
   * 居座った行は、あとで同じ名前のファイルが生まれた日に**黙って穴になる**。
   */
  it("外部取得の免除に、実在しない行が残っていない", () => {
    const files = [
      ...filesUnder("infrastructure"),
      ...filesUnder("application"),
      ...filesUnder("presentation"),
      ...filesUnder("app"),
    ].map((f) => relative(process.cwd(), f));
    expect(files.length, "走査対象が消えています").toBeGreaterThan(200);
    const stale = FETCH_EXEMPT.filter((e) => !files.some((f) => f.endsWith(e.file)));
    expect(stale.map((e) => e.file), "免除の相手が居ません。行を消してください").toEqual([]);
    for (const e of FETCH_EXEMPT) {
      expect(e.why.length, `${e.file} の理由が空です`).toBeGreaterThan(10);
    }
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
