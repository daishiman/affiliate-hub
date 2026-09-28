/** @tier 2 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 参照元を**真似ていない**ことを、機械で見張る。
 *
 * ==========================================================================
 * 何を移してよく、何を移してはいけないのか
 * ==========================================================================
 *
 * トップ画面の設計は `https://kajetblog.com/` を観測して作った
 * （観測 fact は `system-spec/retrieval-evidence/kajetblog-top-analysis.md`）。
 * 移してよいのは **情報の階層と操作の原則** ── 「おすすめが先、記事が次、
 * カテゴリーは探すための入口、一覧は出口」という並びの考え方や、
 * 「全画像に寸法を持たせて CLS を抑える」という原則である。
 *
 * 移してはいけないのは **参照元に属する物** ── 文章、写真、ロゴ、固有名、
 * テーマ（SWELL / SANGO）の class 名や色値。これらは観測できてしまう分、
 * うっかり写しやすい。「参考にした」と「写した」の境目は目視では守れないので、
 * ここが機械で見張る。
 *
 * ==========================================================================
 * なぜ判定を関数に切り出すのか
 * ==========================================================================
 *
 * 走査そのものは「1 件も見つからない」で緑になる。**緑は、規則が正しいことも、
 * 規則が何も見ていないことも、同じ形で表す。** 綴りを 1 文字間違えた規則は
 * 永遠に緑のまま、何も守らない。
 *
 * だから判定は `imitationHitsIn` という関数に切り出し、
 * **その関数自身に、各規則が実際に反応することを見せる検査**を別に置く。
 * 規則の分類ごとに、当たる文字列と当たらない文字列を両方通す。
 */

/** 参照元に属する物の規則。`why` は「なぜこれが参照元の物なのか」。 */
type ImitationRule = {
  readonly kind: "proper-noun" | "domain" | "theme-class" | "theme-color" | "verbatim";
  readonly pattern: RegExp;
  readonly why: string;
};

const RULES: readonly ImitationRule[] = [
  {
    kind: "proper-noun",
    pattern: /kajetblog|カジェログ|kajet_jt|makuring|マクリング/i,
    why: "参照元および比較参照のサイト名・アカウント名",
  },
  {
    kind: "domain",
    pattern: /kajetblog\.com|makuring\.jp/i,
    why: "参照元の住所。ここへ繋ぐと、こちらの画面が相手の資産を配ることになる",
  },
  {
    kind: "theme-class",
    // SWELL / SANGO が配る class の綴り。写すと見た目ごと移る。
    pattern: /\b(?:l-fixHeader|c-headLogo|c-catchphrase|c-gnavWrap?|c-iconBtn|c-iconList)\b/,
    why: "参照元テーマ（SWELL）の class 名",
  },
  {
    kind: "theme-color",
    // SWELL 既定のブランド色。観測した色値をそのまま置かない。
    pattern: /#(?:04384e|1bb4d3|f7f7f7f7)\b/i,
    why: "参照元テーマの配色。色は primitives.css の自前の値だけを使う",
  },
  {
    kind: "verbatim",
    pattern: /カジュアルで分かりやすい|イヤホン・オーディオレビューブログ/,
    why: "参照元の `<title>` とキャッチコピーの原文",
  },
];

/** 1 行分の文字列に、参照元由来の物が混じっているか。混じっていれば全件返す。 */
export function imitationHitsIn(text: string): readonly ImitationRule[] {
  return RULES.filter((rule) => rule.pattern.test(text));
}

const SOURCE_ROOT = join(process.cwd(), "src");

/**
 * `src/` 配下の全ファイル。**拡張子で絞らない。**
 * 写り込みは `.tsx` だけでなく CSS・JSON・SVG からも入る。
 */
function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else out.push(full);
  }
  return out;
}

describe("参照元の非模倣", () => {
  it("src/ 配下に、参照元に属する物が 1 つも無い", () => {
    const found: string[] = [];
    const files = collectSourceFiles(SOURCE_ROOT);

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, index) => {
        for (const rule of imitationHitsIn(line)) {
          const where = `${file.slice(process.cwd().length + 1)}:${index + 1}`;
          found.push(`${where} [${rule.kind}] ${rule.why} :: ${line.trim().slice(0, 100)}`);
        }
      });
    }

    // 走査対象が 0 件だと、この検査は何も見ずに緑になる。床を先に固める。
    expect(files.length, "走査対象のファイルが読めていません").toBeGreaterThan(100);
    expect(found, `参照元に属する物が混入しています:\n${found.join("\n")}`).toEqual([]);
  });

  it("判定関数は、規則の分類ごとに実際に反応する", () => {
    const samples: Readonly<Record<ImitationRule["kind"], string>> = {
      "proper-noun": "const siteName = 'カジェログ';",
      domain: 'href="https://kajetblog.com/"',
      "theme-class": '<div className="l-fixHeader">',
      "theme-color": "--brand: #04384e;",
      verbatim: "カジュアルで分かりやすいレビュー",
    };

    for (const [kind, sample] of Object.entries(samples)) {
      const hits = imitationHitsIn(sample);
      expect(
        hits.map((h) => h.kind),
        `${kind} の規則が反応しません: ${sample}`,
      ).toContain(kind);
    }

    // 全 5 分類が上の表で踏まれていること（規則を足したら見本も足す）。
    expect(new Set(RULES.map((r) => r.kind)).size).toBe(Object.keys(samples).length);
  });

  it("判定関数は、自分たちの普通のコードには反応しない", () => {
    const innocent = [
      'import styles from "@/presentation/ui/templates/site.module.css";',
      "<header className={styles.siteHeader}>",
      "--neutral-900: #1a1a1a;",
      "カテゴリーから探す",
      "公開中の記事をすべて見る",
    ];

    for (const line of innocent) {
      expect(imitationHitsIn(line), `普通の行を模倣と判定しました: ${line}`).toEqual([]);
    }
  });

  it("移してよいのは階層と原則だけ、という前提が資料として残っている", () => {
    // 「なぜ真似ていないと言えるのか」の根拠は、観測 fact の側にある。
    // 資料ごと消えると、この検査は「何を守っているのか」を説明できなくなる。
    const analysis = join(
      process.cwd(),
      "system-spec/retrieval-evidence/kajetblog-top-analysis.md",
    );
    const text = readFileSync(analysis, "utf8");
    expect(text, "観測資料が観測 fact の宣言を失っています").toContain("本ファイルは観測 fact のみを記す");
  });
});
