/**
 * @tier 2
 * @req REQ-UX07
 * @types code-boundary
 *
 * A7: 新規ブログ構築時のブログ別コンポーネント作成仕様が文書化され、
 * 実際に scaffold できる。
 *
 * 「ブログを足す」が「共通部品に分岐を 1 本足す」になった時点で、この feature は負ける。
 * 分岐は足すたびに増え、増えた分岐は消えない。ブログ 5 本目の変更が
 * ブログ 1 本目を壊す形になる。
 *
 * だから見るのは 5 つ。
 *   1. 共通部品にブログ名の分岐が無い
 *   2. ブログ固有の部品を置く場所と形が決まっている
 *   3. 固有部品には、なぜ固有なのかを書いた README が伴う
 *   4. 固有部品を読む口が 1 つに決まっている
 *   5. 固有部品を持つブログが管理画面で分かる
 *
 * 3 が要る理由は、固有部品が「共通化をさぼった跡」と見分けが付かないため。
 * 理由が書かれていなければ、次の人はそれを共通へ引き上げようとする。
 *
 * 4 と 5 が「実際に scaffold できる」の実体。契約は既定でファイルを生成しないと
 * 決めているので、**固有部品が 0 件でも、足したときに読まれる口が要る**。
 * 口が無ければ、足したファイルはどこからも読まれない。
 * 5 は README がコードを読む人にしか見えないことへの対処で、
 * 例外が積み上がっていることに気付ける場所を運用する人の側にも置く。
 *
 * 規範: docs/spec/feat-uiux-overhaul/blog-scaffold-contract.md
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const UI_DIR = join(ROOT, "src/presentation/ui");
const SITES_DIR = join(ROOT, "src/presentation/sites");
const CONTRACT = join(ROOT, "docs/spec/feat-uiux-overhaul/blog-scaffold-contract.md");

/** `SiteBlueprint.id` の形。表示名（日本語・空白入り）を混ぜない。 */
const ID_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function tsFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) tsFiles(full, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("A7 §1 作成仕様が文書化されている", () => {
  it("blog-scaffold-contract.md がある", () => {
    expect(existsSync(CONTRACT), `${relative(ROOT, CONTRACT)} がありません`).toBe(true);
  });

  it("置き場所・命名・README の 3 点が書かれている", () => {
    if (!existsSync(CONTRACT)) {
      expect.fail("blog-scaffold-contract.md がありません");
      return;
    }
    const doc = readFileSync(CONTRACT, "utf8");
    // 書いてあるだけでなく、次の人が同じ形に作れる程度に具体である必要がある。
    for (const anchor of ["src/presentation/sites/", "index.ts", "README.md"]) {
      expect(doc, `作成仕様に「${anchor}」の記述がありません`).toContain(anchor);
    }
  });
});

describe("A7 §2 共通部品にブログ名の分岐が無い", () => {
  const files = tsFiles(UI_DIR);

  it("共通部品のファイルを読めている", () => {
    // 0 件だと、以下の判定が「分岐が見つからない」で緑になる。
    expect(files.length, "src/presentation/ui のファイルが 1 件も読めていません").toBeGreaterThan(0);
  });

  it("slug で分岐しているところが無い", () => {
    // 0 件の母集団に対する「分岐が無い」は、分岐が無いことを何も言わない。
    // 上の it とは別に、**この it の中で**床を張る（別の it の緑はここへ効かない）。
    expect(files.length, "src/presentation/ui のファイルが 1 件も読めていません").toBeGreaterThan(0);
    // ここが 1 本でも生えると、ブログを足すたびに共通部品を触ることになる。
    const branching = /\b(slug|siteId|blogId)\s*===\s*["'][^"']+["']|case\s+["'][a-z0-9-]+["']\s*:/;
    const offenders = files
      .filter((f) => branching.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f));
    expect(
      offenders,
      `共通部品がブログで分岐しています: ${offenders.join(", ")}\n` +
        `違いは設計図（SiteBlueprint）の値として渡し、部品側では分岐しないでください`,
    ).toEqual([]);
  });
});

/** 実在するブログ固有部品のディレクトリ。§3 と §4 の両方が見るのでここに置く。 */
const dirs = existsSync(SITES_DIR)
  ? readdirSync(SITES_DIR).filter((n) => statSync(join(SITES_DIR, n)).isDirectory())
  : [];

/**
 * 判定の陽性対照。
 *
 * **固有部品 0 件は異常ではなく正常である。**契約が「既定ではファイルを生成しない」と
 * 決めているので、`dirs` は空のまま緑であることが期待される状態になっている。
 * ところがそのとき §3 の 3 つの判定は `[] === []` を照合しているだけで、
 * **判定式を丸ごと壊しても緑のまま**になる。母集団の床を張ろうにも、
 * 「実在すること」自体が要件でないので張れない（張れば要件と反対のことを強制する）。
 *
 * そこで床の代わりに、**必ず捕まるはずの見本を母集団へ混ぜて回す**。
 * 判定が死ねば見本が捕まらなくなり、`dirs` が空でもこの検査は赤くなる。
 * 見本は 3 つの判定それぞれに 1 つずつ要る——1 つで兼ねると、
 * 兼ねられなかった判定だけが黙って死ぬ。
 */
const BAD_SHAPE = { name: "サンプル ブログ", hasEntry: false, hasReadme: false };
/** README はあるが見出しだけで理由が無い見本。上の見本では 3 つ目の判定を突けない。 */
const BAD_README = { name: "sample-no-reason", body: "# サンプル\n" };

describe("A7 §3 ブログ固有部品の形", () => {
  it("ディレクトリ名が SiteBlueprint.id の形である", () => {
    // 表示名を使うと、ブログ名を変えたときにディレクトリまで動かすことになる。
    const names = [...dirs, BAD_SHAPE.name];
    expect(names.length, "見本すら母集団に入っていません").toBeGreaterThan(0);
    const odd = names.filter((d) => !ID_SHAPE.test(d));
    expect(odd, "見本の悪い形を捕まえていません。ID_SHAPE が死んでいます").toContain(BAD_SHAPE.name);
    const real = odd.filter((d) => d !== BAD_SHAPE.name);
    expect(real, `id の形でないディレクトリ: ${real.join(", ")}`).toEqual([]);
  });

  // 固有部品ゼロは正常。契約が「既定では生成しない」と決めているため。
  it("各ディレクトリが index.ts と README.md を伴う", () => {
    const entries = [
      ...dirs.map((d) => ({
        name: d,
        hasEntry: existsSync(join(SITES_DIR, d, "index.ts")),
        hasReadme: existsSync(join(SITES_DIR, d, "README.md")),
      })),
      BAD_SHAPE,
    ];
    expect(entries.length, "見本すら母集団に入っていません").toBeGreaterThan(0);

    const noEntry = entries.filter((e) => !e.hasEntry).map((e) => e.name);
    expect(noEntry, "見本の欠落を捕まえていません。index.ts の判定が死んでいます").toContain(
      BAD_SHAPE.name,
    );
    const realNoEntry = noEntry.filter((n) => n !== BAD_SHAPE.name);
    expect(realNoEntry, `index.ts がありません: ${realNoEntry.join(", ")}`).toEqual([]);

    // 理由が無い固有部品は、共通化のさぼりと見分けが付かない。
    const noReason = entries.filter((e) => !e.hasReadme).map((e) => e.name);
    expect(noReason, "見本の欠落を捕まえていません。README.md の判定が死んでいます").toContain(
      BAD_SHAPE.name,
    );
    const realNoReason = noReason.filter((n) => n !== BAD_SHAPE.name);
    expect(
      realNoReason,
      `README.md がありません: ${realNoReason.join(", ")}（なぜ共通部品で足りないのかを書いてください）`,
    ).toEqual([]);
  });

  it("README に固有である理由が書かれている", () => {
    const readmes = [
      ...dirs
        .filter((d) => existsSync(join(SITES_DIR, d, "README.md")))
        .map((d) => ({ name: d, body: readFileSync(join(SITES_DIR, d, "README.md"), "utf8") })),
      BAD_README,
    ];
    expect(readmes.length, "見本すら母集団に入っていません").toBeGreaterThan(0);
    const empty = readmes
      .filter((r) => r.body.replace(/^#.*$/gm, "").trim().length <= 40)
      .map((r) => r.name);
    expect(empty, "見出しだけの見本を捕まえていません。判定が死んでいます").toContain(
      BAD_README.name,
    );
    const real = empty.filter((n) => n !== BAD_README.name);
    expect(real, `README に理由が書かれていない: ${real.join(", ")}`).toEqual([]);
  });
});

describe("A7 §4 固有部品を読む口がある", () => {
  // 契約は「既定ではファイルを生成しない」と決めている。だから固有部品は 0 件が正常で、
  // ディレクトリを数えるだけでは A7 は測れない。測るのは「足したときに読まれるか」。
  it("固有部品の登録簿がある", () => {
    expect(
      existsSync(join(SITES_DIR, "index.ts")),
      "src/presentation/sites/index.ts がありません（固有部品を足しても読まれません）",
    ).toBe(true);
  });

  it("有無と理由を引ける", async () => {
    let mod: Record<string, unknown>;
    try {
      mod = (await import("@/presentation/sites")) as Record<string, unknown>;
    } catch {
      expect.fail("src/presentation/sites/index.ts を読み込めません");
      return;
    }
    // 有無だけ分かっても、管理画面には出せない。理由まで実行時に引ける必要がある。
    expect(typeof mod.hasSiteOverrides, "hasSiteOverrides がありません").toBe("function");
    expect(typeof mod.siteOverrideReason, "siteOverrideReason がありません").toBe("function");
    const has = mod.hasSiteOverrides as (slug: string) => boolean;
    expect(has("__not-a-real-blog__"), "無いブログを有りと答えます").toBe(false);
  });

  it("登録簿とディレクトリが食い違っていない", async () => {
    let mod: Record<string, unknown>;
    try {
      mod = (await import("@/presentation/sites")) as Record<string, unknown>;
    } catch {
      expect.fail("src/presentation/sites/index.ts を読み込めません");
      return;
    }
    const has = mod.hasSiteOverrides as (slug: string) => boolean;
    // ここも `dirs` が空でありうる。**登録簿へ「無いはずのもの」を 1 つ混ぜて問う**ことで、
    // `has` が常に true を返す実装（食い違いを一切検出できない状態）を赤にする。
    const probes = [
      ...dirs.map((d) => ({ name: d, registered: true })),
      { name: "__not-a-real-blog__", registered: false },
    ];
    expect(probes.length, "見本すら母集団に入っていません").toBeGreaterThan(0);
    // 登録し忘れたディレクトリは、置いてあるのに読まれない。
    const wrong = probes.filter((p) => has(p.name) !== p.registered).map((p) => p.name);
    expect(wrong, `登録簿とディレクトリが食い違っています: ${wrong.join(", ")}`).toEqual([]);
  });
});

describe("A7 §5 固有部品を持つことが管理画面で分かる", () => {
  it("/admin/sites/[site] が固有部品の有無を出している", () => {
    const page = join(ROOT, "src/app/admin/sites/[site]/page.tsx");
    if (!existsSync(page)) {
      expect.fail("/admin/sites/[site] の画面がありません");
      return;
    }
    // README はコードを読む人しか見ない。例外の積み上がりに気付く場所を運用側にも置く。
    const source = readFileSync(page, "utf8");
    expect(
      /hasSiteOverrides|siteOverrideReason/.test(source),
      "固有部品の有無・理由を画面へ出していません",
    ).toBe(true);
  });
});
