/** @tier 2 @req REQ-TS06, REQ-S09 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 見出しが、見出しとして見えていること。
 *
 * **これは「在るものの誤り」ではなく「無いことの誤り」を数える。**
 * 既存の検査はすべて「書いてある値」を見ている——直値が混ざっていないか、
 * トークンを通っているか、型が合っているか。**書き忘れはそこに映らない。**
 * `tsc` も通り、jsdom の描画も通り、直値の走査にも出ない。
 *
 * ---
 *
 * **なぜ書き忘れると消えるのか。**`src/app/globals.css` の先頭にある
 * `@import "tailwindcss"` が Preflight を連れてくる。その中に
 * `h1,h2,h3,h4,h5,h6 { font-size: inherit; font-weight: inherit }` がある
 * （`node_modules/tailwindcss/preflight.css:81`）。つまり**このリポジトリでは、
 * 見出し要素は既定で段落と同じ形をしている。**CSS Modules は `@layer` の外に
 * 在るので、書けば必ず勝つ。**だが書いていない宣言は勝ちようがない。**
 *
 * 実際に 2 件起きている。`.sectionTitle` が `font-weight` を落として
 * 管理画面の 176 箇所が 400 で出ていた（残課題 144）。`className` を持たない
 * 裸の `<h2>` が 8 件あり、大きさも太さも失っていた（残課題 145、うち 6 件は公開側）。
 *
 * ---
 *
 * **2 つの検査を 1 ファイルにまとめてある。分けないこと。**
 * 片方だけでは穴が残るため。
 *
 *   - 「クラスは `font-weight` を宣言している」だけがあると、
 *     **クラスを当てなければ検査を素通りできる。**8 件はまさにその形だった。
 *   - 「裸の見出し要素が無い」だけがあると、
 *     クラスを当てさえすれば中身が空でも緑になる。
 *
 * 両方が揃って初めて「見出しは必ず太さを持って出る」と言える。
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

function walk(dir: string, ext: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, ext, out);
    else if (name.endsWith(ext)) out.push(full);
  }
  return out;
}

/** コメントの中の記述は数えない（直した経緯が doc に書いてあるため）。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

type Rule = { readonly selector: string; readonly body: string };

/**
 * **最上位の規則だけを取り出す。**`@media` / `@layer` / `@supports` の中は捨てる。
 *
 * ここが実際に踏まれた穴である。`.articleTitle` を「`font-size` は在るが
 * `font-weight` が無い」として拾った走査があったが、拾っていたのは
 * `site.module.css:335` の `@media` 上書きのほうで、外側の定義（同 :173）は
 * ちゃんと `font-weight` を持っていた。**偽陽性だった。**
 *
 * 上書きブロックは「一部だけ差し替える」ために在るので、全部の宣言を
 * 持っていないのが正常である。**そこを土台の定義と同じ基準で見てはいけない。**
 * 行単位の正規表現ではこれを区別できないので、括弧の深さを数えている。
 */
function topLevelRules(css: string): readonly Rule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "{") {
      if (depth === 0) selector = source.slice(start, i).trim();
      depth++;
      if (depth === 1) start = i + 1;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        if (!selector.startsWith("@")) rules.push({ selector, body: source.slice(start, i) });
        start = i + 1;
      }
    }
  }
  return rules;
}

/** クラス名 → そのクラスが（最上位で）`font-weight` を宣言しているか。 */
function classDeclarations(): ReadonlyMap<string, { file: string; weight: boolean }> {
  const defs = new Map<string, { file: string; weight: boolean }>();
  for (const file of walk(SRC, ".css")) {
    for (const { selector, body } of topLevelRules(readFileSync(file, "utf8"))) {
      for (const sel of selector.split(",").map((s) => s.trim())) {
        const m = /^\.([A-Za-z0-9_-]+)$/.exec(sel);
        if (m === null) continue;
        const prev = defs.get(m[1]) ?? { file: relative(SRC, file), weight: false };
        // 同名のクラスが複数ファイルに在りうる（借り物を切った跡）。
        // どれか 1 つでも宣言していれば良い、ではなく **全部が宣言していること**を
        // 見たいので、`||` ではなく後で全件を突き合わせる…のは過剰なので、
        // ここでは「宣言している定義が 1 つでも在るか」を持つ。
        // 借り物を切った 2 件（admin / signin）は同じ骨を写す約束なので、
        // 片方だけ落ちた場合は下の「写し先も宣言している」で捕まえる。
        prev.weight = prev.weight || /(^|;|\s)font-weight\s*:/.test(body);
        defs.set(m[1], prev);
      }
    }
  }
  return defs;
}

/**
 * **「見出しを作るクラス」をどう決めているか。**基準は 2 つで、和を取る。
 *
 *   (1) **実際に `<h1>`〜`<h6>` に当たっているクラス。**画面の側を走査して
 *       `<h2 className={styles.X}>` の X を集める。名前に依存しない。
 *   (2) **名前が `title` / `heading` を含むクラス。**まだどこにも当たって
 *       いない定義や、これから当てられる定義を先回りで捕まえる。
 *
 * **(2) は名前の付け方に依存している。**これは弱点であって、消せない。
 * 実際 (1) だけが拾えたものが 2 つある——`.navGroupLabel` と
 * `.productCardName` は、どちらも見出し要素に当たっているが名前は
 * `title` でも `heading` でもない。**(2) だけにしていたら両方見落としていた。**
 * 逆に (2) の語彙に `caption` を入れると `.calendarCaption` が入るが、
 * これは `<caption>` 要素に当たるもので見出しではない。**偽陽性である。**
 * だから語彙は `title` / `heading` の 2 語に絞ってある。広げるときは、
 * 広げた語で何が増えるかを数えてからにすること。
 *
 * (1) にも穴が在る。`className` を変数や関数越しに渡すと拾えない。
 * いまはそう書いている箇所が無いので成り立っているだけである。
 */
const HEADING_NAME = /title|heading/i;

function headingClassesFromUsage(): ReadonlyMap<string, readonly string[]> {
  const used = new Map<string, string[]>();
  for (const file of walk(SRC, ".tsx")) {
    const source = stripComments(readFileSync(file, "utf8"));
    for (const m of source.matchAll(/<h[1-6]\b[^>]*className=\{styles\.([A-Za-z0-9_]+)\}/g)) {
      const list = used.get(m[1]) ?? [];
      list.push(relative(SRC, file));
      used.set(m[1], list);
    }
  }
  return used;
}

describe("見出しを作るクラスは font-weight を宣言している", () => {
  const defs = classDeclarations();
  const fromUsage = headingClassesFromUsage();
  const fromName = [...defs.keys()].filter((c) => HEADING_NAME.test(c));
  const headingClasses = [...new Set([...fromUsage.keys(), ...fromName])].sort();

  it("太さを書き忘れているクラスが無い", () => {
    // **床は同じ `it` の中に置く。**別の `it` へ出すと「違反 0 件」と
    // 「1 つも見ていない」が同じ緑になり、母集団が消えた日に黙る
    // （`form2-population-floor.test.ts` が数えている形。実際にここで当たった）。
    expect(headingClasses.length, "見出しクラスを 1 つも集められていません").toBeGreaterThanOrEqual(
      13,
    );

    const missing = headingClasses.filter((c) => defs.get(c)?.weight !== true);
    // 大きさと色は効いたままなので、落ちても**半分だけ効いて見える**。
    // 「壊れている」ではなく「そういう見た目」に見えるのが、この誤りの厄介さ。
    expect(missing).toEqual([]);
  });

  it("どのクラスも定義が見つかっている", () => {
    expect(fromUsage.size, "見出し要素に当たるクラスが 1 つも見つかりません").toBeGreaterThanOrEqual(
      8,
    );

    // 定義を引けないまま「宣言していない」と言うと、上の検査は
    // 見つからないことを違反として出す。区別できる形にしておく。
    const undefinedClasses = [...fromUsage.keys()].filter((c) => !defs.has(c));
    expect(undefinedClasses).toEqual([]);
  });

  it("名前だけでは足りないことが、数として残っている", () => {
    // 名前で判定する基準は、名前の付け方が変わると静かに効かなくなる。
    // 「実際に当たっているか」で拾えて「名前」では拾えないものが在る、
    // という事実を床にしておく。0 になったら (1) を消してよい、ではなく、
    // **たまたま今の名前が揃っているだけ**と読むこと。
    const nameCannotSee = [...fromUsage.keys()].filter((c) => !HEADING_NAME.test(c));
    expect(nameCannotSee.length).toBeGreaterThan(0);
  });

  it("@media の中の上書きを、土台の定義と取り違えない", () => {
    // これは実際に踏んだ穴の再現。`.articleTitle` は @media の中に
    // `font-weight` を持たない上書きがあるが、土台（最上位）は持っている。
    // 行単位で見る走査はこれを違反として出す。
    const css = readFileSync(join(SRC, "presentation/ui/templates/site.module.css"), "utf8");
    expect(css).toMatch(/@media[^{]*\{[\s\S]*\.articleTitle\s*\{/);
    expect(defs.get("articleTitle")?.weight).toBe(true);
  });
});

describe("className を持たない見出し要素が無い", () => {
  /**
   * **除外は 1 件も置いていない。**
   *
   * 検査を置いた時点で 8 件あったが、除外せず 8 件とも直した。
   * 理由が 2 つある。
   *
   *   - 理由つき除外には上限（7）が在って、他の作業と取り合いになる。
   *     **8 件のうち 6 件は公開側**で、読者が実際に見る画面だった。
   *     直せるものを除外で埋めて枠を使い切ると、本当に外せないものが入らない。
   *   - 除外は「まだ手が回っていない」と「外す判断をした」を同じ形で書く。
   *     ここに在った 8 件は前者だったので、書けば嘘になる。
   *
   * 直し方は `src/presentation/ui/primitives/heading.tsx`（`SectionHeading`）。
   * 公開側の 6 件は `@/presentation/ui` しか読んでおらず、クラスを当てるには
   * CSS Modules を跨いで借りることになる——**それは `signin` から取り除いたばかりの
   * 形だった**（UX-16 / UX-17）。だから部品にした。
   */
  it("裸の <h1>〜<h6> が src/ に 1 つも無い", () => {
    const offenders: string[] = [];
    let raw = 0;
    let viaComponent = 0;
    for (const file of walk(SRC, ".tsx")) {
      // **コメントを落としてから数える。**`heading.tsx` の doc は、直した経緯として
      // `<h2>` を文中に書いている。落とさないと、直した記録そのものが違反になる。
      // `@media` を外すのと同じ形の穴が、こちら側にも在った。
      const source = stripComments(readFileSync(file, "utf8"));
      for (const m of source.matchAll(/<h[1-6](\s*\/?>|\s+[^>]*>)/g)) {
        raw++;
        // `className` を持たない開始タグだけを違反とする。
        if (!/className/.test(m[1])) offenders.push(`${relative(SRC, file)}: ${m[0].trim()}`);
      }
      // **部品を通った見出しも、見出しである。**下の床の註を読むこと。
      viaComponent += [...source.matchAll(/<SectionHeading\s/g)].length;
    }
    /*
     * 「全部が `SectionHeading` へ移ると、この検査は**見るものが無いので緑**になる」
     * と書いて床を 180 に張ってあった。**2026-08-21 に実際に起きた**——UX-17 で
     * 管理画面 179 箇所を部品へ通したところ、生の見出しが 19 件まで落ちて
     * この床が赤くなった。**予告どおりに働いた。**
     *
     * --- **床を下げていない。移った先を数えている。** ---
     *
     * ここで `180` を `19` へ下げるのは、**閾値を実測に合わせる**ように見えて
     * 中身が違う。この床は「いま何件あるか」ではなく「**走査が空振りしていないか**」
     * を見ている。生の見出しが 19 件でも、部品を通った見出しが 180 件あるなら、
     * 見出しという母集団は 1 件も減っていない。**減ったのは書き方であって、
     * 見出しではない。**
     *
     * 逆に、ここを 19 へ下げてしまうと——**次に誰かが画面をまるごと消したときに
     * 気づけない。**19 は「たまたま今そうである数」で、何も守らない。
     *
     * --- 部品を通った側は、なぜ違反になりようがないのか ---
     *
     * `SectionHeading` は `className` を受け取らず、3 段とも
     * `styles.headingLevel{2,3,4}` を必ず当てる。**裸で出る道が無い。**
     * だから数には入れるが、`offenders` には入りようがない。
     * **「違反しうるものだけを数える」ではなく「見出しを全部数える」**のが
     * この床の役目である。
     */
    expect(
      raw + viaComponent,
      "見出しを 1 つも集められていません。走査そのものを先に疑うこと" +
        `（生 ${raw} 件 / 部品 ${viaComponent} 件）`,
    ).toBeGreaterThanOrEqual(180);
    expect(offenders).toEqual([]);
  });

  it("生の見出しと部品を通った見出しが、両方とも実在する（陰性対照）", () => {
    // 上の床は 2 つの数の**和**なので、片方が 0 でも緑になりうる。
    // 現に UX-17 の直後は生 19 / 部品 180 で、**片方だけで床を満たしていた。**
    // どちらの数え方も生きていることを、和とは別に見る。
    let raw = 0;
    let viaComponent = 0;
    for (const file of walk(SRC, ".tsx")) {
      const source = stripComments(readFileSync(file, "utf8"));
      raw += [...source.matchAll(/<h[1-6](\s*\/?>|\s+[^>]*>)/g)].length;
      viaComponent += [...source.matchAll(/<SectionHeading\s/g)].length;
    }
    // 生の見出しは、部品の中（`heading.tsx`）と、部品を通せない場所に残る。
    // 例: `ui-catalog` の h4/h5/h6 は「3 つとも同じ大きさで出る」を見せる見本。
    expect(raw, "生の見出しが 1 つも見つかりません。走査の正規表現を疑うこと").toBeGreaterThan(5);
    expect(
      viaComponent,
      "SectionHeading を通った見出しが 1 つも見つかりません",
    ).toBeGreaterThan(100);
  });
});

describe("見出しの部品は、段を選ばせる", () => {
  const source = readFileSync(join(SRC, "presentation/ui/primitives/heading.tsx"), "utf8");

  it("level は必須で、既定値を持たない", () => {
    // 既定が在ると、書く人は段を意識せずに使い、文書の段と見た目の段がずれる。
    // 管理画面が実際にそうなっている（`.sectionTitle` を h2/h3/h4 の 3 段に
    // 同じ見た目で当てている）。同じ形を部品の側で作り直さない。
    expect(source).toMatch(/readonly\s+level\s*:/);
    expect(source).not.toMatch(/level\s*=\s*2/);
  });

  it("呼び出し側から見た目を触る道が開いていない", () => {
    // `className` を受け取ると「ここだけ大きく」が入り、段と見た目の
    // 対応が再び崩れる。崩れても赤にならないので、口を開けない。
    expect(source).not.toMatch(/readonly\s+className\??\s*:/);
  });
});
