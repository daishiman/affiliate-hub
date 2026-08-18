/** @tier 1 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 1 つの概念に、定義は 1 つだけ。
 *
 * 同じ名前が 2 か所で定義されていると、次の 2 つのどちらかが起きている。
 *
 * 1. **本当に同じもの**が 2 つある。片方を直しても、もう片方は古いまま残る
 * 2. **違うもの**に同じ名前が付いている。読む側がどちらの話か決められない
 *
 * どちらも、コードを読んだ人の判断が割れる形で残る。
 * 実際にこの検査を入れたとき、収益モデルが「提携販売」と「成果報酬の紹介」の
 * 2 通りで画面に出ていた（作成ウィザードと一覧で別々に持っていた）。
 * 型検査は通る。テストも通る。**画面を並べて見た人だけが気づく**種類の壊れ方である。
 *
 * 規範: docs/spec/10-テスト戦略仕様.md §2-7（契約検査）/ 要求 B（共通化）
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

/**
 * 枠組み（Next.js）が名前を決めているもの。
 *
 * ここは画面ごとに同じ名前で書くことが**要求されている**ので、重複ではない。
 * 名前を変えると動かなくなる。
 */
const FRAMEWORK_OWNED = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "dynamic",
  "revalidate",
  "runtime",
  "metadata",
  "generateMetadata",
  "generateStaticParams",
  "default",
]);

/**
 * 保存の形を書いてあるファイル。
 *
 * ここの型は「机の引き出しの中の形」であって、業務の言葉ではない。
 * 業務側の `Product` と保存側の `Product` は、**意図的に別物**にしてある
 * （保存の都合で業務の形を歪めないため）。
 */
const PERSISTENCE_SHAPES = "src/db/schema.ts";

/**
 * 例外。**理由を書かないと載せられない**ようにしてある。
 *
 * 理由を書く手間があると、「とりあえず通す」ために足すことがしにくくなる。
 * ここが増え続けているなら、それ自体が設計の合図である。
 */
const ALLOWED: readonly { readonly name: string; readonly why: string }[] = [
  {
    name: "AffiliateLink",
    why: "業務の『提携リンク』と、共通UIの表示用 props。UI は渡された形を出すだけで、業務の判断を持たない",
  },
  {
    name: "ExcludedProduct",
    why: "順位づけから外した商品（業務）と、その理由を表に出すための props（UI）",
  },
  {
    name: "MaterialReview",
    why: "取り込んだ素材の検査結果（業務）と、それを人に見せるための props（UI）",
  },
  {
    name: "SectionView",
    why: "記事の節を画面へ渡す形。ユースケース側と共通UI側で、渡す側と受け取る側の両方に要る",
  },
  {
    name: "DEFAULT_LOCALE",
    why: "ブランドの既定の言語（業務）と、文言辞書の既定（表示）。前者を変えても後者は変わらない",
  },
];

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...tsFiles(full));
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

const EXPORT_PATTERN =
  /^export\s+(?:async\s+)?(?:const|function|class|type|interface|enum)\s+([A-Za-z0-9_]+)/gm;

/** 名前 → 定義しているファイル（プロジェクトからの相対パス）。 */
function collectExports(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  for (const file of tsFiles(SRC)) {
    const rel = relative(ROOT, file).split("\\").join("/");
    if (rel === PERSISTENCE_SHAPES) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(EXPORT_PATTERN)) {
      const name = match[1];
      if (FRAMEWORK_OWNED.has(name)) continue;
      const places = found.get(name) ?? new Set<string>();
      places.add(rel);
      found.set(name, places);
    }
  }
  return found;
}

/** 走査は 1 回だけ。テストごとに読み直すと、遅いうえに結果がずれうる。 */
const exports = collectExports();

describe("1 概念 1 定義", () => {
  const allowed = new Set(ALLOWED.map((a) => a.name));

  it("同じ名前を 2 か所で定義していない", () => {
    const duplicated = [...exports.entries()]
      .filter(([name, places]) => places.size > 1 && !allowed.has(name))
      .map(([name, places]) => `${name}: ${[...places].sort().join(" / ")}`)
      .sort();

    expect(
      duplicated,
      "同じ名前が複数の場所にあります。片方を消して 1 つに寄せるか、" +
        "別物なら名前を分けてください。どうしても両方要るなら " +
        "tests/architecture/single-definition.test.ts の ALLOWED に理由つきで足してください。",
    ).toEqual([]);
  });

  it("例外には必ず理由が書いてある", () => {
    for (const entry of ALLOWED) {
      expect(entry.why.length, `${entry.name} に理由がありません`).toBeGreaterThan(15);
    }
  });

  it("例外に、もう重複していない名前が残っていない", () => {
    // 直したのに例外が残ると、次に同じ名前で重複しても気づけない。
    const stale = ALLOWED.filter((a) => (exports.get(a.name)?.size ?? 0) <= 1).map((a) => a.name);
    expect(stale, "重複が解消された名前が例外に残っています。消してください").toEqual([]);
  });
});

/**
 * 保存の形（テーブル定義）を置いてよい場所を固定する。
 *
 * 2026-08-19 まで、要件表 `REQ-FD05`（ブログ層で正規データを再定義しない）の
 * 判定欄には「スキーマ定義が `src/db/schema.ts` のみであること」とだけ書いてあり、
 * **これを見ているテストは 1 つも無かった**。しかも事実としても違っていて、
 * `sqliteTable` は `src/db/schema.ts` と `src/db/auth-schema.ts` の 2 か所にある。
 *
 * 上の `PERSISTENCE_SHAPES` は「1 概念 1 定義」の走査から `schema.ts` を**除く**ための
 * ものなので、置き場所そのものは誰も見ていなかった。除外と検査は別である。
 */
describe("保存の形の置き場所", () => {
  /** テーブルを定義してよいファイル。増やすときは理由を書く。 */
  const TABLE_HOMES: readonly { readonly path: string; readonly why: string }[] = [
    {
      path: "src/db/schema.ts",
      why: "この製品のテーブルの正本。ここ 1 か所を読めば保存されている形が分かる状態を保つ",
    },
    {
      path: "src/db/auth-schema.ts",
      why:
        "Better Auth CLI の生成物（`src/auth.cli.ts` 冒頭の手順、`--output src/db/auth-schema.ts`）。" +
        "手で書き換えても次の生成で消えるので、正本は Better Auth 側にある。" +
        "`schema.ts` から再輸出しているので、読む側の入口は 1 つのまま",
    },
  ];

  const definers = tsFiles(SRC)
    .filter((f) => /\bsqliteTable\s*\(/.test(readFileSync(f, "utf8")))
    .map((f) => relative(ROOT, f).split("\\").join("/"))
    .sort();

  it("テーブルを定義しているファイルが見えている（検査が空振りしていない）", () => {
    expect(definers.length).toBeGreaterThan(0);
  });

  it("テーブルを定義しているのは、決めた場所だけ", () => {
    const homes = new Set(TABLE_HOMES.map((h) => h.path));
    expect(
      definers.filter((f) => !homes.has(f)),
      "ここ以外でテーブルを定義すると、同じ概念の形が 2 通りになります。" +
        "どうしても要るなら tests/architecture/single-definition.test.ts の " +
        "TABLE_HOMES に理由つきで足してください。",
    ).toEqual([]);
  });

  it("決めた場所が、実際にテーブルを定義している", () => {
    // 移動や改名で空になった置き場所が残っていると、次に別の場所へ書かれても気づけない。
    expect(TABLE_HOMES.map((h) => h.path).filter((p) => !definers.includes(p))).toEqual([]);
  });

  /**
   * 置き場所が 2 つあること自体は問題ではない。**読む側の入口が 2 つになる**ことが問題である。
   *
   * `auth-schema.ts` は Better Auth CLI の生成物で、`schema.ts` が再輸出している。
   * 再輸出が外れると、保存されている形を知るのに 2 ファイル読む必要が出る。
   * 「1 か所を読めば分かる」は置き場所の数ではなく、**この再輸出**が支えている。
   */
  it("正本を 1 つ読めば、ほかの置き場所にも届く", () => {
    const CANONICAL = "src/db/schema.ts";
    const source = readFileSync(join(ROOT, CANONICAL), "utf8");
    for (const home of TABLE_HOMES) {
      if (home.path === CANONICAL) continue;
      const name = home.path.replace(/^src\/db\//, "").replace(/\.ts$/, "");
      expect(
        new RegExp(`export\\s+\\*\\s+from\\s+["']\\./${name}["']`).test(source),
        `${CANONICAL} が ${home.path} を再輸出していません。` +
          "再輸出が無いと、保存されている形を知るのに置き場所の数だけファイルを読むことになります",
      ).toBe(true);
    }
  });

  it("置き場所の例外には理由が書いてある", () => {
    for (const home of TABLE_HOMES) {
      expect(home.why.length, `${home.path} に理由がありません`).toBeGreaterThan(15);
    }
  });
});

describe("表示名の正本", () => {
  /**
   * 選択肢の表示名は domain が持ち、ユースケースは持たない。
   *
   * ユースケース側に置くと、同じ選択肢を扱う画面が増えるたびに
   * その画面のユースケースが自分用の言い換えを持ってしまう。
   */
  it("記事タイプ・ブログパターン・収益モデルの表示名が domain にだけある", () => {
    const labels = ["ARTICLE_TYPE_LABEL", "SITE_PATTERN_LABEL", "REVENUE_MODEL_LABEL"];
    for (const label of labels) {
      const places = [...(exports.get(label) ?? [])];
      expect(places, `${label} の定義場所`).toHaveLength(1);
      expect(places[0], `${label} は domain に置いてください`).toMatch(/^src\/domain\//);
    }
  });
});
