/**
 * @tier 1
 * @req REQ-TS17
 * @types boundary, equivalence
 *
 * **`contract` を名乗っていたが外した**（2026-08-19）。`contract` は
 * 「API 契約（3 入口）」——同じことが画面・REST・WebMCP の 3 つの入口から同じに使えること——
 * であり、この検査はどの入口も通っていない。**名乗りに根拠を書いていなかったことが、
 * そのまま印だった**（`boundary` と `equivalence` には下に根拠がある）。
 * 要件の側も `has-input` だけで、`contract` を求めていない。
 * **満たしていない種別の名前を借りない。**外して、飾りが付いていた事実をここに残す。
 *
 * `equivalence` を名乗る根拠: この検査の本体は**母集団をテストの外から実行時に集めているか
 * どうか**での 2 分割で、族（47 件）と族に入らないもの（253 件）がその 2 クラスである。
 * 検査 1 は**両方のクラスが空でないこと**を見ている。片方だけを見ると、
 * 分割そのものが壊れて全部が片側へ落ちたときに気づけない。
 * `boundary` の根拠は 0 件・上限 24 件・下限 47 件という境目そのものを見ていること。
 *
 * 「0 件である」と主張している検査に、**その 0 の母集団の件数の床**が同居しているか。
 *
 * --- なぜ要るのか ---
 *
 * ② の形（塞げていない穴を「いま 0 件」と固定し、塞がった日に赤くなる）は、
 * **0 が 2 通りの理由で出る**——悪さが消えたときと、**数える対象そのものが消えたとき**。
 * 後者では検査は緑のまま黙る。2026-08-19 に実測した:
 * `spec-state-writer-gap.test.ts` の走査論理を node で走らせると、
 * 走査対象が 5 件でも 0 件でも同じ `[]` が出る。**この 1 件だけでは区別できない。**
 *
 * 同じ日に C03 を再生成したとき、`doctrine-citation-gap.test.ts` だけが
 * 「穴が塞がった」と「母集団が消えた」を見分けられた。**40 文・8 章の床が
 * 同居していたから**である（残課題 102）。床の有無が、そのまま判別できるかどうかだった。
 *
 * --- 対で見る ---
 *
 * `FORM2_MAX_WITHOUT_FLOOR`（上限・下げる向きのみ）だけでは抜けられる。
 * 床を足す代わりに**検査そのものを消せば**上限は下がるからである。
 * `FORM2_MIN_FAMILY`（下限・上げる向きのみ）がその道を塞ぐ。
 * **逆向きであることが仕掛けの本体で、揃えると抜け道が開く。**
 *
 * --- この検査の限界（先に書く）---
 *
 * 床を「`.length` に対する `toBeGreaterThan` 系」で見つけるので、**床が「あるか」は見えるが、
 * それが「何に対して張ってあるか」は見えない。**
 *
 * この限界は 2026-08-19 に 2 件の実例として現れ、**互いに逆向きで相殺していた**
 * （残課題 78 ㉙。数が合っているのは測れているからではない）。
 * 2 件とも直したが、**直したのは検査 2 本の側であって、この数え方ではない。**
 *   - `guard-inline-python-hole.test.ts` … 止まる例（`toBe(2)`）だけで床が無いと見えていた。
 *     見張りの行数の床を足した。**`toBe(2)` を床と認める方向へは緩めていない**——
 *     0 以外の等値をすべて床と認めることになるため。
 *   - `copy-dictionary.test.ts:125` … 床はあるが張り先が辞書だった。走査対象へ床を足した。
 *     **判定（床あり）は前も後も同じで、正しくなったのは中身のほうである。**
 *
 * したがって**同じ形（走査対象ではないものにだけ床がある）は、いまも見つけられない。**
 * 次に触る人はここを疑うこと。数を信じる前に、床の張り先を目で見ること。
 *
 * --- 名前が言っていないこと（2026-08-21 に踏まれた）---
 *
 * **この検査が見ているのは「床が在るか」ではない。「その `it` が、自分の母集団に
 * 床を張っているか」である。**族の単位が `it` だからで、名前（`population-floor`）からは
 * 前者に読める。**読み違えても、書いている本人には最後まで分からない**——
 * ファイルのどこかに床があれば「床は在る」と見えるので、自分は満たしていると思える。
 *
 * 実例。新しい見張り（`tests/ui/heading-is-visible.test.ts`）を書いた人が、
 * 「走査が空振りしていない」を**独立した `it` として切り出した**ところ、
 * 床なしが 27 件（上限 24）になって赤が出た。床は確かに在り、同じファイルの中にあった。
 * 足りなかったのは**その `it` の中に**在ることだった。
 *
 * **直したのは上限ではなく自分の側である**——床を同じ `it` の中へ移した。これが正しい。
 * 「空振りしていないことを別の `it` にすると読みやすい」は本当だが、
 * **読みやすさのために分けると、0 を主張する `it` と、母集団が空でないことを言う `it` が
 * 別々に緑になれる。**そのとき片方だけ壊れても、もう片方は緑のまま黙る。
 * この検査が防いでいるのはまさにその形なので、**分けたい気持ちのほうが違反である。**
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { FORM2_MAX_WITHOUT_FLOOR, FORM2_MIN_FAMILY } from "../../quality-gates.config.mjs";

const ROOT = process.cwd();

/**
 * 「0 件である」と主張している形。**行に依存させない**（整形で改行が入る）。
 *
 * 2026-08-19 に 1 度外した: `toStrictEqual\(\[\]\)` と 1 行で書いていたため、
 * 整形が `toStrictEqual(\n  [],\n)` へ折った `it` を族に数えていなかった。
 * **これは ㉓（行を単位に測ると外れる）そのもので、下限の側で 1 度やった同じ誤りである。**
 * 直す前の条件で族 32 / 床なし 25 / 族外 262、直したあとで族 34 / 床なし 27 / 族外 266。
 * 増えた 2 件（`spec-compiler-fence-seal.test.ts` と `test-honesty.test.ts` の
 * カバレッジプラグマ）には**床を足して 25 へ戻した**。上限は上げていない
 * （残課題 78 ㉗ に経緯。**数える条件を動かしたら、動かす前の条件と数も残す**）。
 *
 * その後さらに 2 度動いている。詳細は `quality-gates.config.mjs` の同名の説明に集約:
 * 族の過小計上を直して族 34 → 47 / 床なし 25 → 37（増分 12 件すべてに床を足して 25 へ）、
 * 次に上の 2 件の検査を直して**床なし 25 → 24**（上限も 24 へ下げた）。
 */
const EMPTY =
  /(toStrictEqual|toEqual)\(\s*\[\s*\]\s*,?\s*\)|toHaveLength\(\s*0\s*,?\s*\)|\.toBe\(\s*0\s*,?\s*\)/;

/** 母集団の件数そのものに張られた床。**行に依存させない**（整形で改行が入る）。 */
const FLOOR = /(\.length|\.size)[\s\S]{0,120}?toBeGreaterThan|toBeGreaterThan(Or\w+)?\(\s*[0-9]/;

/** 母集団が実行時にテストの外から集められている印。 */
const GATHER = /readdirSync|readFileSync|globSync|pythonSources|CONFIRMED|walk\(/;

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) testFiles(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** 波括弧の対応で塊を切り出す。行数や文字数で切ると入れ子で位置を間違える。 */
function blocks(
  text: string,
  re: RegExp,
): { name: string; head: string; body: string; line: number }[] {
  const out: { name: string; head: string; body: string; line: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const open = text.indexOf("{", m.index);
    if (open < 0) continue;
    let depth = 0;
    let i = open;
    for (; i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push({
      name: m[1] ?? "",
      head: text.slice(m.index, text.indexOf("\n", m.index)).trim(),
      body: text.slice(open, i + 1),
      line: text.slice(0, m.index).split("\n").length,
    });
  }
  return out;
}

/** `it(...)` の塊。 */
function itBlocks(text: string) {
  return blocks(text, /\bit(?:\.each\([\s\S]*?\))?\s*\(/g);
}

/**
 * 走査を含む関数の名前。**本体の中だけを見る。**
 *
 * 2026-08-19 まで「関数の宣言から 800 字以内に `readdirSync` があるか」で見ていた。
 * 文字数の窓は関数の切れ目を知らないので、**走査と無関係な短い関数のすぐ後ろに
 * 走査する関数が並んでいるだけで、前者が走査関数と数えられる。**
 * しかも非貪欲の 1 マッチが両方を飲み込むため、**本物のほうは取りこぼす。**
 * 誤検出と取りこぼしが 1 件ずつ出て、合計だけが合っていた
 * （この検査の doc comment が「互いに逆向きで相殺」と警告していたのと同じ形の再発）。
 * 実測: 誤検出 `countMentions` / 取りこぼし `site-routes.test.ts` の `actualRoutePaths`。
 *
 * **新旧どちらの定義でも数えた**（2026-08-19）:
 *   旧（文字数の窓）… 族 48 / 床なし 25 / 族外 259
 *   新（波括弧の対応）… 族 47 / 床なし 25 / 族外 260
 * 露出した 1 件（`site-routes.test.ts` の「2 本目のブログ専用の画面ファイルは 1 つも無い」）に
 * **床を足して 24 へ戻した。上限は上げていない。**
 */
function gatheringFns(text: string): string[] {
  return blocks(text, /function\s+(\w+)\s*\(/g)
    .filter((b) => /readdirSync|globSync/.test(b.body))
    .map((b) => b.name);
}

/**
 * 「母集団を実行時に集めた」変数の名前を集める。**2 段で見る。**
 *
 * 直に `readdirSync` を書いた変数だけを見ていたときは、
 * `const ALL = testFiles(TESTS).map(...)` のように**集める処理を関数へ出した形**を
 * 取りこぼしていた（`tests/architecture/test-honesty.test.ts` の `ALL`。7 件が族外へ落ちていた）。
 * **集める処理は関数に切り出されるのが普通なので、直書きだけを見る数え方は構造的に過小になる。**
 * そこで (1) 走査を含む関数の名前を先に集め (2) その関数を呼んでいる変数も母集団と見なす。
 */
function gatheredVars(text: string): string[] {
  const fns = gatheringFns(text);
  const via = fns.length > 0 ? `|${fns.join("|")}` : "";
  const source = new RegExp(`readdirSync|globSync|pythonSources|walk\\(${via}`);
  // **先読みで見る。**`([\s\S]{0,300})` を捕捉で書くと `lastIndex` が 300 字進み、
  // その中にある次の `const` を丸ごと飛ばす。1 度そう書いて、
  // 拾えるはずの変数が抜けたまま数が出た（数え直しの 5 度目、2026-08-19）。
  return [...text.matchAll(/const\s+(\w+)\s*=\s*(?=([\s\S]{0,300}))/g)]
    .filter((m) => source.test(m[2].split(/\n\s*(?:const|let|function|describe|it)\b/)[0]))
    .map((m) => m[1]);
}

type Unit = { where: string; floored: boolean };

function survey(): { family: Unit[]; literalOnly: number } {
  const family: Unit[] = [];
  let literalOnly = 0;
  for (const file of testFiles(join(ROOT, "tests"))) {
    // この検査自身は数えない。自分の中の正規表現が族に見えてしまう。
    if (file.endsWith("form2-population-floor.test.ts")) continue;
    const text = readFileSync(file, "utf8");
    const topVars = gatheredVars(text);
    for (const b of itBlocks(text)) {
      if (!EMPTY.test(b.body)) continue;
      const gathers =
        GATHER.test(b.body) || topVars.some((v) => new RegExp(`\\b${v}\\b`).test(b.body));
      if (!gathers) {
        literalOnly++;
        continue;
      }
      family.push({
        where: `${relative(ROOT, file)}:${b.line} ${b.head.slice(0, 50)}`,
        floored: FLOOR.test(b.body),
      });
    }
  }
  return { family, literalOnly };
}

describe("0 を主張する検査に、母集団の床が同居していること", () => {
  it("数える側が動いている（族も、族に入らないものも、両方見つかっている）", () => {
    // **0 の作り方は 2 通りある。**下の 2 つが 0 なら、それは
    // 「床が全部ある」のではなく「何も見ていない」ときにも出る数である。
    const { family, literalOnly } = survey();
    expect(family.length, "族が 1 件も見つかりません。切り出し方が壊れています").toBeGreaterThan(0);
    expect(literalOnly, "族に入らないものが 1 件も見つかりません。判別が効いていません").toBeGreaterThan(
      0,
    );
  });

  /**
   * --- 走査関数の見分け方の陽性対照 ---
   *
   * 見分け方が「関数の宣言から一定の文字数」だったとき、**隣に走査関数が並んでいる**
   * という配置だけで結果が変わった。並び順は中身と関係が無いので、
   * **見本は「走査しない短い関数のすぐ後ろに走査関数がある」形にしてある。**
   * 文字数の窓に戻したら、この 2 件が落ちる。
   */
  const NEIGHBOURS = [
    "function tiny(s: string): number { return s.length; }",
    "function scan(dir: string) { return readdirSync(dir); }",
  ].join("\n");

  it("走査しない関数は、隣に走査関数があっても数えない", () => {
    expect(
      gatheringFns(NEIGHBOURS),
      "並び順だけで走査関数と数えています。文字数の窓に戻っていないか確かめてください",
    ).not.toContain("tiny");
  });

  it("走査する関数を取りこぼさない", () => {
    expect(
      gatheringFns(NEIGHBOURS),
      "本物の走査関数が見つかりません。母集団が族外へ落ちます",
    ).toContain("scan");
  });

  it("族そのものが減っていない（検査を消して数字を良くする道を塞ぐ）", () => {
    const { family } = survey();
    expect(
      family.length,
      `0 を主張する検査が ${FORM2_MIN_FAMILY} 件を下回りました。` +
        "床を足す代わりに検査を消していないか確かめてください。**上げる方向にしか動かしません**",
    ).toBeGreaterThanOrEqual(FORM2_MIN_FAMILY);
  });

  it("床を持たないものが増えていない", () => {
    const { family } = survey();
    const without = family.filter((u) => !u.floored);
    expect(
      without.length,
      `母集団の床が無い検査が ${without.length} 件あります（上限 ${FORM2_MAX_WITHOUT_FLOOR}）。\n` +
        `${without.map((u) => `  ${u.where}`).join("\n")}\n` +
        "**下げてよいのは、実際に床を足したときだけです**",
    ).toBeLessThanOrEqual(FORM2_MAX_WITHOUT_FLOOR);
  });
});
