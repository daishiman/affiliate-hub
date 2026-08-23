/** @tier 2 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 共通UIの構造の機械チェック。
 *
 * 見ているのは 3 点:
 *   1. 3 段の依存の向きが一方向 (primitives ← patterns ← templates)
 *   2. 部品が業務判断・データ取得を持っていない
 *   3. 仕様固有の重要UI (広告表示・順位・事実区分) を画面が自分で書いていない
 *
 * 3 が最も重要。広告表示の実装が画面ごとに散ると、
 * 法令要件が変わったときの直し漏れが必ず出る。
 */

const ROOT = process.cwd();
const UI = join(ROOT, "src/presentation/ui");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const code = (f: string): boolean => f.endsWith(".ts") || f.endsWith(".tsx");
const uiFiles = walk(UI).filter(code);
const primitives = uiFiles.filter((f) => f.includes("/primitives/"));
const patterns = uiFiles.filter((f) => f.includes("/patterns/"));
const templates = uiFiles.filter((f) => f.includes("/templates/"));

/**
 * 画面側のコード。
 *
 * **`src/app` だけでは足りない。** 2026-08-21 に実測: 読者向けの記事を実際に描いている
 * `src/presentation/site/article-page.tsx` へ `rel="sponsored"` と「広告を含みます」を
 * 手で書き込んでも、下の「自前で書いていない」は**緑のまま**だった。
 * `src/app` 側は薄い入口で、法令に関わる表示が実際に並ぶのは `presentation/site` と
 * `presentation/admin` のほうである。走査がそこへ届いていなかった。
 */
const screens = [
  ...walk(join(ROOT, "src/app")).filter(code),
  ...walk(join(ROOT, "src/presentation/site")).filter(code),
  ...walk(join(ROOT, "src/presentation/admin")).filter(code),
];

/**
 * 画面と共通部品の**あいだ**の層。欄・結果表示など、画面が組み立てて使うもの。
 *
 * 到達の起点（`roots`）には入れない。ここ自身も「画面から使われているか」を
 * 問われる側だからで、起点に入れると自分で自分を正当化できてしまう。
 * 入れるのは**伝播の候補**——画面 → この層 → 共通部品と辿れるようにするため。
 *
 * これを足す前は `src/app` から直接呼ばれる部品しか辿れず、この層を経由する
 * 共通部品（`FormResult`）が「どこからも使われていない」と誤判定された
 * （2026-08-22）。`ah-brd` で重複検査に見つかったのと同じ、走査が `src/app`
 * で止まっている穴である。
 */
const middle = [
  ...walk(join(ROOT, "src/presentation/admin")),
  ...walk(join(ROOT, "src/presentation/site")),
].filter(code);

function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

describe("共通UIの3段構成", () => {
  it("検査対象を実際に読めている", () => {
    expect(primitives.length, "primitives が空です").toBeGreaterThan(3);
    expect(patterns.length, "patterns が空です").toBeGreaterThan(4);
    expect(templates.length, "templates が空です").toBeGreaterThan(0);
    expect(screens.length, "画面が空です").toBeGreaterThan(2);
  });

  it("土台 (primitives) が上の段を読んでいない", () => {
    const offenders: string[] = [];
    for (const file of primitives) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec.includes("patterns/") || spec.includes("templates/")) {
          offenders.push(`${relative(ROOT, file)} → ${spec}`);
        }
      }
    }
    expect(
      offenders,
      "依存が逆流しています。順位表を直したらボタンが壊れる、という状態になります。",
    ).toEqual([]);
  });

  it("パターンが画面の骨格 (templates) を読んでいない", () => {
    const offenders: string[] = [];
    for (const file of patterns) {
      for (const spec of importsOf(readFileSync(file, "utf8"))) {
        if (spec.includes("templates/")) offenders.push(`${relative(ROOT, file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("部品が業務判断とデータ取得を持っていない", () => {
    const offenders: string[] = [];
    for (const file of uiFiles) {
      const source = readFileSync(file, "utf8");
      for (const spec of importsOf(source)) {
        // 部品は「渡されたものを出す」だけ。取ってくる側になった時点で使い回せなくなる。
        if (spec.startsWith("@/domain") || spec.startsWith("@/application")) {
          offenders.push(`${relative(ROOT, file)} → ${spec}（業務のきまりを持ち込んでいます）`);
        }
        if (spec.startsWith("@/infrastructure")) {
          offenders.push(`${relative(ROOT, file)} → ${spec}（データ取得を持ち込んでいます）`);
        }
      }
      if (/\bfetch\s*\(/.test(source)) {
        offenders.push(`${relative(ROOT, file)} が通信しています`);
      }
    }
    expect(
      offenders,
      "共通UIは表示だけを行います。業務判断は application 層、データ取得は infrastructure 層の仕事です。",
    ).toEqual([]);
  });
});

describe("仕様固有の重要UIの一元化", () => {
  /**
   * 画面が自分で書いてはいけないもの。
   * 見つけたら、対応するパターン部品を使わせる。
   */
  const CENTRALIZED: readonly { readonly pattern: RegExp; readonly use: string }[] = [
    { pattern: /rel=["'][^"']*sponsored/, use: "AffiliateLink" },
    { pattern: /広告を含みます|アフィリエイトリンクが含まれ/, use: "DisclosureNotice" },
    { pattern: /根拠あり|推測です/, use: "FactualityBadge" },
    { pattern: /順位づけに報酬/, use: "CriteriaDisclosure" },
    { pattern: /data-stub=/, use: "StubNotice / StubLabel" },
  ];

  it("画面が広告表示・順位・事実区分を自前で書いていない", () => {
    const offenders: string[] = [];
    // 母集団の床。画面が 1 枚も見えていなければ「違反 0 件」は常に成り立つ。
    expect(screens.length, "画面が見えていません").toBeGreaterThan(100);
    for (const file of screens) {
      const source = readFileSync(file, "utf8");
      for (const rule of CENTRALIZED) {
        if (rule.pattern.test(source)) {
          offenders.push(`${relative(ROOT, file)} は ${rule.use} を使ってください`);
        }
      }
    }
    expect(
      offenders,
      "法令に関わる表示を画面ごとに書くと、要件が変わったときの直し漏れが必ず出ます。",
    ).toEqual([]);
  });

  /**
   * 計測の印 (`data-tel-*`) を手で書かせない。
   *
   * 印を画面に直接書くと、種類の一覧 (`TELEMETRY_ELEMENT_KINDS` /
   * `TELEMETRY_SECTION_KINDS`) を通らないので、綴りの誤りも
   * 一覧に無い種類も誰にも止められない。**必ず部品が名乗る。**
   *
   * 2026-08-21 に測ったところ、`src/app` の画面へ
   * `data-tel-kind="cta_button"` を手で書いても全部緑だった。
   * 追跡表の前書き 2 が指す検査が実際には無かったので、ここに足した。
   */
  it("計測の印を画面や部品が手で書いていない", () => {
    // 印の名前そのものを決めている場所だけが、文字列で書いてよい。
    const DEFINITION = "src/presentation/ui/telemetry-attrs.ts";
    const offenders: string[] = [];
    for (const file of [...screens, ...uiFiles]) {
      const rel = relative(ROOT, file);
      if (rel === DEFINITION) continue;
      if (/["'\s]data-tel-/.test(readFileSync(file, "utf8"))) {
        offenders.push(`${rel} が計測の印を手で書いています`);
      }
    }
    expect(
      offenders,
      "計測の印は telemetryAttrs / telemetrySectionAttrs から出します。手で書くと、種類の一覧を通らずに綴りの誤りが素通りします。",
    ).toEqual([]);
  });

  it("仕様固有のパターンが一式そろっている", () => {
    // 「まだ作っていない」を見逃さないための一覧。
    const required = [
      "factuality.tsx",
      "evidence.tsx",
      "disclosure.tsx",
      "ranking-table.tsx",
      "comparison-table.tsx",
      "conversation.tsx",
      "product-card.tsx",
      "approval.tsx",
      "stub-notice.tsx",
    ];
    const present = patterns.map((f) => f.split("/").pop());
    expect(required.filter((r) => !present.includes(r))).toEqual([]);
  });

  /**
   * 使われていない共通部品を残さない。
   *
   * 「部品はあるが、どの画面からも呼ばれていない」状態は、
   * 一覧の上では実装済みに見えるのに読者には何も届いていない。
   * API はあるが画面が無い、と同じ壊れ方をする。
   */
  it("すべてのパターンがどこかの画面から使われている", () => {
    // 見本帳は「全部の部品を並べる画面」なので、ここを数に入れると
    // どの部品も必ず使われていることになり、この検査が何も見なくなる。
    const roots = [...screens.filter((f) => !f.includes("/ui-catalog/")), ...templates];

    /*
     * 画面・骨格から**辿り着けるか**を見る。
     *
     * 以前は「画面か骨格が直接使っているか」だけを見ていた。
     * その形だと、パターンがパターンを組み立てている正しい作り
     * （改善要望のボタンが、印を付ける台紙を内側で使う、など）が
     * 「孤立」と判定される。判定を避けるために画面へ引き出すと、
     * 部品の組み立てが画面へ漏れ出し、共通化そのものが崩れる。
     *
     * 逆に、互いに呼び合うだけで画面から辿り着けない部品の塊は、
     * 到達できないままなので、これまでどおり見つかる。
     */
    const reachable = new Set(roots);
    const nameOf = (f: string): string => (f.split("/").pop() ?? "").replace(/\.tsx?$/, "");
    for (let grew = true; grew; ) {
      grew = false;
      const source = [...reachable].map((f) => readFileSync(f, "utf8")).join("\n");
      for (const file of [...middle, ...patterns, ...primitives]) {
        if (reachable.has(file)) continue;
        const exported = [...readFileSync(file, "utf8").matchAll(/export function (\w+)/g)].map(
          (m) => m[1],
        );
        const used =
          source.includes(`/${nameOf(file)}"`) ||
          exported.some((n) => new RegExp(`<${n}[\\s/>]`).test(source));
        if (used) {
          reachable.add(file);
          grew = true;
        }
      }
    }

    /*
     * **`middle` を足したぶんの床**（2026-08-22）。
     *
     * 伝播の候補を広げるのは「到達できる」を増やす向きなので、広げすぎれば
     * 最後は全部が到達済みになり、この検査は何も見つけないまま緑になる。
     *
     * 中間層は画面から辿り着けなければ、それ自体が使われていない部品である。
     * 到達した中間層が十分にあること＝画面がこの層を本当に使っていること。
     *
     * **実測 61 で、これは中間層の全件**。いま孤立した中間層は 1 つも無い。
     * つまりこの床が測れるのは「`middle` を集められていて、伝播が届いている」
     * ことまでで、中間層の孤立そのものは別に測る必要がある（下の `orphans`
     * は `patterns` しか見ていない）。床を 30 に置いてあるので、`walk` の
     * 対象がずれる・伝播が止まるといった壊れ方はここで赤くなる。
     */
    const reachedMiddle = middle.filter((f) => reachable.has(f)).length;
    expect(
      reachedMiddle,
      "中間層に 1 つも辿り着けていません。middle の集め方か伝播が壊れています",
    ).toBeGreaterThan(30);

    const orphans = patterns
      .filter((f) => f.endsWith(".tsx") && !reachable.has(f))
      .map((f) => f.split("/").pop() ?? "");
    expect(
      orphans,
      "どの画面からも辿り着けない部品です。使うか、消してください。",
    ).toEqual([]);
  });

  it("入口 (index.ts) から全パターンを出している", () => {
    const index = readFileSync(join(UI, "index.ts"), "utf8");
    for (const name of [
      "FactualityBadge",
      "EvidenceList",
      "DisclosureNotice",
      "AffiliateLink",
      "RankingTable",
      "ComparisonTable",
      "Conversation",
      "ProductCard",
      "ApprovalFlow",
      "StubNotice",
    ]) {
      expect(index.includes(name), `${name} が入口から出ていません`).toBe(true);
    }
  });

  /**
   * 見本帳（`/admin/ui-catalog`）に全部の部品が載っていること。
   *
   * 見本帳の値打ちは**網羅していること**にしかない。
   * 1 つでも載っていない部品があると、次に画面を作る人が
   * 「ここに無いから作る」で同じものを二重に作る。共通化はそこから崩れる。
   *
   * 手で目視すると必ず抜けるので、機械で見る。
   */
  it("見本帳に全部の部品が載っている", () => {
    // 見本帳を構成するファイルは全部読む。1 つ読み落とすと、
    // そこに載っている部品だけが「載っていない」と誤判定される。
    const catalog = walk(join(ROOT, "src/app/admin/ui-catalog"))
      .filter(code)
      .map((f) => readFileSync(f, "utf8"))
      .join("\n");

    const missing: string[] = [];
    for (const file of [...primitives, ...patterns]) {
      if (!file.endsWith(".tsx")) continue;
      const source = readFileSync(file, "utf8");
      const exported = [...source.matchAll(/export function (\w+)/g)].map((m) => m[1]);
      for (const name of exported) {
        // 見本帳が組み立てのために内部で使う包み（Provider 類）は対象外。
        // 見た目を持たないため、並べても何も確かめられない。
        if (name.endsWith("Provider")) continue;
        if (new RegExp(`<${name}[\\s/>]`).test(catalog)) continue;
        missing.push(`${relative(ROOT, file)} の ${name}`);
      }
    }
    expect(
      missing,
      "見本帳に載っていない部品です。/admin/ui-catalog へ追加してください。",
    ).toEqual([]);
  });
});
