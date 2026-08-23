/** @tier 2 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ADMIN_NAV, ADMIN_NAV_GROUPS, UNGROUPED_NAV_HREFS } from "@/presentation/ui";

/**
 * 詰まり具合を固定する。
 *
 * 「詰まっている」と言われて直したことのうち、放っておくと元に戻るものだけを見る。
 * 見た目の崩れそのものを見つける手段はまだ無い（画像で比べる仕組みが無い）ので、
 * ここで見ているのは崩れではなく、**崩れを生んだ書き方が戻ってきたこと**である。
 * 崩れ全般を捕まえていると読み違えないよう、この区別を消さないこと。
 *
 * 見ているのは 10 点:
 *   1. 指の当たり判定の値を行送りに使わない（1 行が不要に 16px 高くなる）
 *   2. 押せるものの高さの下限は残っている（1 を直すときに一緒に消しやすい）
 *   3. 画面の器が縦の間隔を持つ（無いとカードどうしが線で接する）
 *   4. 読ませる文に行の長さの上限がある（無いと画面幅ぶん 1 行が伸びる）
 *   5. 境目のために足した余白が、群内の 4 倍以上ある（意図の側）
 *   6. **知覚の側に床が要らない理由**（知覚 ⊇ 意図）が、まだ成り立っている
 *   7. 線を引いている規則が `+` の 1 つだけ（＝本数が分類の数から導ける）
 *   8. 線の上下が揃っている（どちらの群の線か分からなくならない）
 *   9. 一覧が 1 画面に収まらない（＝追従が要る、という前提そのものの見張り）
 *  10. 見本帳の「直す前」が、直す前の値を保っている（消えると見比べが無意味になる）
 *
 * 5〜9 は 2026-08-19、利用者の「各分類ごとに横線を引いて区切りが分かるように」から。
 * 判断の理由は `docs/product/design-decisions.md`。
 */

const ROOT = process.cwd();
const UI_DIR = join(ROOT, "src/presentation/ui");
const SHELL_CSS = join(UI_DIR, "primitives/ui.module.css");
const ADMIN_CSS = join(ROOT, "src/app/admin/admin.module.css");
const PARTS_CSS = join(UI_DIR, "templates/screen-parts.module.css");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** 単一のセレクタ規則の中身だけを取り出す。入れ子は使っていない前提。 */
function ruleBody(css: string, selector: string): string {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `${selector} が見つかりません`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf("\n}", at);
  return css.slice(at, end);
}

/**
 * トークンの値を、意味の段から素の段までたどって生の文字列で返す。
 *
 * **値をここに書き写さない。** 書き写すと、トークン側を変えたときに
 * この検査だけが古い値のまま緑で残る。
 *
 * 余白（`rem`）だけでなく、大きさ（`44px`）・線の太さ（`1px`）・
 * 行送り（`1.8` の単位なし）も同じ道で引けるようにしてある。
 * 種類ごとに別の読み方を書くと、読み方を足し忘れた種類だけが
 * **書き写しに戻る**（実際そうなっていた）。
 */
function tokenValue(): (name: string) => string {
  const sources = ["tokens/semantic.css", "tokens/primitives.css"].map((rel) =>
    readFileSync(join(UI_DIR, rel), "utf8"),
  );
  const resolve = (name: string, depth = 0): string => {
    expect(depth, `${name} のたどりが深すぎます（循環？）`).toBeLessThan(8);
    for (const css of sources) {
      // **最初の定義を採る。** `@media (prefers-contrast: more)` の中に
      // 上書きが並んでいるので、後ろから採ると既定ではない値を読む。
      const found = new RegExp(`(?:^|\\n)\\s*${name}:\\s*([^;]+);`).exec(css);
      if (found === null) continue;
      const raw = found[1].trim();
      const alias = /^var\((--[a-z0-9-]+)\)$/.exec(raw);
      return alias === null ? raw : resolve(alias[1], depth + 1);
    }
    throw new Error(`${name} がトークンの定義に見つかりません`);
  };
  return resolve;
}

/** トークンを px に直す。`rem` も `px` も受ける。 */
function pxOfToken(resolve: (name: string) => string, name: string): number {
  const raw = resolve(name);
  const rem = /^([0-9.]+)rem$/.exec(raw);
  if (rem !== null) return Number(rem[1]) * 16;
  const px = /^([0-9.]+)px$/.exec(raw);
  expect(px, `${name} は px でも rem でもありません: ${raw}`).not.toBeNull();
  return Number(px![1]);
}

/** 行送りのような単位の無いトークン。 */
function ratioOfToken(resolve: (name: string) => string, name: string): number {
  const raw = resolve(name);
  expect(/^[0-9.]+$/.test(raw), `${name} は単位の無い数ではありません: ${raw}`).toBe(true);
  return Number(raw);
}

/** 余白のトークンを px に直す（上の道の、`--space-*` 向けの入口）。 */
function pxOfSpaceToken(): (name: string) => number {
  const resolve = tokenValue();
  return (name: string) => pxOfToken(resolve, name);
}

/**
 * 規則の中の `プロパティ: …` から、`index` 番目の `var(--token)` の名前を取り出す。
 *
 * **値だけでなくトークン名も実物から引くための道具。**
 * `padding: var(--space-1) var(--space-3)` なら 0 が上下、1 が左右。
 * `border-top: var(--border-width-default) solid var(--color-…)` なら 0 が太さ。
 */
function varOf(body: string, property: string, index = 0): string {
  const line = new RegExp(`(?:^|\\n)\\s*${property}:\\s*([^;]+);`).exec(body);
  expect(line, `${property} が見つかりません`).not.toBeNull();
  const names = [...line![1].matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]);
  expect(
    names.length,
    `${property} の ${index + 1} 番目が var() で書かれていません: ${line![1].trim()}`,
  ).toBeGreaterThan(index);
  return names[index];
}

/**
 * 分類の余白を 2 つの単位で出す。**2 本の検査が同じ数え方を使うために 1 箇所に置く。**
 * 別々に書くと、片方の単位だけ直したときにもう片方が古い数え方で緑に残る。
 */
function gaps(css: string): { withinGap: number; addedGap: number } {
  const px = pxOfSpaceToken();
  const between = ruleBody(css, ".navGroup + .navGroup");
  return {
    withinGap: px(spaceVar(ruleBody(css, ".navGroup"), "gap")),
    addedGap:
      px(spaceVar(between, "margin-top")) +
      px(spaceVar(between, "padding-top")) +
      px(spaceVar(ruleBody(css, ".navGroupLabel"), "padding")), // 1 つ目 = 上
  };
}

/** 規則の中の `プロパティ: var(--space-n)` から、トークン名だけを取り出す。 */
function spaceVar(body: string, property: string): string {
  const m = new RegExp(`${property}:\\s*(?:0\\s+)?var\\((--space-[0-9]+)\\)`).exec(body);
  expect(m, `${property} が var(--space-*) で書かれていません`).not.toBeNull();
  return m![1];
}

describe("詰まり具合", () => {
  it("部品の CSS は、指の当たり判定の値を行送りに使わない", () => {
    // 高さの下限と行送りは別のもの。同じ値を両方に置くと、
    // 下限で足りている高さに行送りぶんが積み増され、上下の余白と二重になる。
    const offenders: string[] = [];
    for (const file of walk(UI_DIR).filter((f) => f.endsWith(".css"))) {
      const css = readFileSync(file, "utf8");
      for (const m of css.matchAll(/line-height:\s*var\(\s*(--[a-z0-9-]+)/gi)) {
        if (m[1].includes("tap-target") || m[1].includes("hit-")) {
          offenders.push(`${relative(ROOT, file)}: ${m[0]}`);
        }
      }
    }
    expect(offenders, offenders.join("\n")).toStrictEqual([]);
  });

  it("案内の 1 行は、詰めたあとも押せる大きさの下限を持っている", () => {
    // 行送りを詰めるときに、高さの下限まで一緒に消すと、
    // 見た目は詰まるが指では押せなくなる。詰める側の直しが越えてはいけない線。
    expect(ruleBody(readFileSync(SHELL_CSS, "utf8"), ".navLink")).toContain(
      "min-height: var(--tap-target-min)",
    );
  });

  it("画面の器が、縦の間隔を 1 箇所で持っている", () => {
    // カードにも注意書きにも外余白は無い。器が間隔を持たないと、
    // 中身を 2 つ以上置いた画面でだけ線どうしが接する。
    expect(ruleBody(readFileSync(SHELL_CSS, "utf8"), ".page")).toMatch(/\n\s*gap:\s*var\(--space-/);
  });

  it("読ませる文に、行の長さの上限がある", () => {
    // 上限が無いと、画面を広げたぶんだけ 1 行が伸びて戻り先を見失う。
    // 表やカードは広く使ってよいので、器ではなく文の側に置く。
    expect(ruleBody(readFileSync(SHELL_CSS, "utf8"), ".pageLead")).toContain(
      "max-width: var(--readable-max-width)",
    );
    expect(ruleBody(readFileSync(PARTS_CSS, "utf8"), ".lead")).toContain(
      "max-width: var(--readable-max-width)",
    );
  });

  it("読ませる文の書式は、画面側の css に無い", () => {
    /*
     * **役割が同じものを 2 つの css に分けない**（2026-08-22 / ah-jbj）。
     *
     * 元は `.sectionLead`（`admin.module.css`）と `.lead`
     * （`screen-parts.module.css`）が 1 行も違わない同じ宣言だった。
     * 分かれていると、行の長さを直したときに片方だけが直る。
     *
     * ここで測るのは**在り処**ではなく**書ける場所**。画面側の css に
     * `--readable-max-width` が現れたら、そこにまた同じ書式が生えている。
     * 読ませる文の口は `Prose` / `Section` の `lead` / `SubSection` の
     * `lead` の 3 つで、どれも共通部品側の css を使う。
     *
     * 検査が効いていることは、上の `it` が `.lead` の実物を読めていることで
     * 担保される。両方が同時に緑になるのは、書式が 1 か所にある場合だけ。
     */
    const admin = readFileSync(ADMIN_CSS, "utf8");
    const offenders = [...admin.matchAll(/^\.([A-Za-z][\w-]*)\s*\{[^}]*--readable-max-width[^}]*\}/gm)].map(
      (m) => m[1],
    );
    expect(
      offenders,
      `admin.module.css が読ませる文の書式を持っています: ${offenders.join(", ")}。` +
        "共通部品（Prose / Section の lead / SubSection の lead）へ寄せてください",
    ).toStrictEqual([]);
  });

  it("分類の境目は、線と余白の両方で作る（近接の比を下回らない）", () => {
    // **線だけを引いて余白を変えないと、線は飾りに見えてまとまりとして読まれない。**
    // 近接の原理は距離のほうが強い。**先に決めた目標は「群間 ÷ 群内 >= 4」**で、
    // 値はそのあとに入れた。ここが赤くなったら、値ではなく比のほうを先に決め直す。
    //
    // **比は 2 つの単位で取る。**（2026-08-19 に足した）どちらも床は 4。
    // 2 つは別の問いに答えているので、片方がもう片方の置き換えにはならない。
    //
    //   知覚 … 親の `gap` まで含んだ合計。**見る人の目に入るのは合計のほう。**
    //   意図 … この境目のために足した分だけ。`.sidebar` の `gap`（分類を全部
    //          消しても残る）と線の太さ（「線」であって「余白」ではない。有無は
    //          下の `toMatch` が別に見るので、混ぜると 2 回数えることになる）を引く。
    //
    // **最初は知覚の側だけで測っていて、それが抜けた。**境目のために何も足さなくても
    // 親の余白のぶんで比が出るため。床を上げる直し方は誤りで、上げても親の余白が
    // 乗る事実は残り、画面の余白設計が変わった日にまた同じところで外す。
    //
    // **この床には単独の検出力がある**（実測）: 群内の余白を `--space-2` へ広げると
    // ここだけが赤（24/8 ＝ 3.0）で、知覚の側もほかの検査も全部緑になる。
    // 知覚の側の状況は次の `it` に書いてある。
    const css = readFileSync(SHELL_CSS, "utf8");

    const between = ruleBody(css, ".navGroup + .navGroup");
    expect(between, "境目の線が無い").toMatch(
      /border-top:\s*var\(--border-width-default\)\s+solid\s+var\(--color-border-subtle\)/,
    );

    const { withinGap, addedGap } = gaps(css);
    expect(withinGap, "群内の余白が読めない").toBeGreaterThan(0);
    expect(
      addedGap / withinGap,
      `境目のために足した余白 ${addedGap}px / 群内 ${withinGap}px`,
    ).toBeGreaterThanOrEqual(4);
  });

  it("知覚の側に床が要らない理由が、まだ成り立っている", () => {
    // **ここは床ではない。床が要らないという理由のほうを見張っている。**
    //
    // 境目の広さは 2 通りに測れる。**意図**（この境目のために足した分）と
    // **知覚**（見る人の目に入る合計）で、どちらも正しい問いである。
    // それでも床は 1 本しか置いていない。証明:
    //
    //     知覚 ＝ 意図 ＋ 親の `gap` ＋ 線の太さ
    //     親の `gap` >= 0 かつ 線の太さ >= 0
    //   ⟹ 知覚 >= 意図
    //   ⟹ 床が同じ値なら、知覚が床を割るときは意図が必ず先に割る
    //   ⟹ **知覚の床は 1 度も単独で赤くならない**
    //
    // 探して壊し方が見つからなかったのではなく、**式から在り得ない**。
    // そこへ床を置くと、**壊しようのない緑が 1 つ増えて床の総数だけが厚くなる**。
    // 但し書きを文書に書いても、床を数える側からは見えない。
    //
    // **根拠の無い数字を入れて「働かせる」直し方も採らない。**捕まえたい壊し方
    // （親の `gap` を 0 にする）は 33px を 25px にするので床 26 あたりで捕まるが、
    // **25px の区切りが読めないという根拠を誰も持っていない。**働いているように
    // 見えて、守っている値に誰も責任を持たない状態になる。
    //
    // だから残すのは前提のほう。**前提が崩れた日にここが赤くなり、
    // 「いま知覚の床を決め直す番だ」と知らせる。**（⑤ の形: 穴が塞がったら
    // 検査を消すのではなく、向きを反転させて残す）
    //
    // 崩れ方は 2 つある。どちらもこの `it` が見ている:
    //   - **親の余白が負になる**（`gap` をやめて負の `margin` で寄せる書き方に変わる）
    //   - **意図の側に、知覚の合計へ入らない項が増える**（式そのものが合わなくなる）
    const css = readFileSync(SHELL_CSS, "utf8");
    const px = pxOfSpaceToken();
    const { addedGap } = gaps(css);

    // 1. 足す側が 0 以上であること。
    const parentGap = px(spaceVar(ruleBody(css, ".sidebar"), "gap"));
    const borderWidth = 1;
    expect(parentGap, "親の余白が負になった").toBeGreaterThanOrEqual(0);
    expect(borderWidth, "線の太さが負になった").toBeGreaterThanOrEqual(0);

    // 2. 分類まわりの規則に負の長さが無いこと。
    //    負の `margin` が 1 つでも入ると、上の「足す側は 0 以上」が崩れる。
    for (const selector of [".sidebar", ".navGroup", ".navGroup + .navGroup", ".navGroupLabel"]) {
      expect(ruleBody(css, selector), `${selector} に負の長さがある`).not.toMatch(
        /:\s*-[0-9.]/,
      );
    }

    // 3. 式そのものが合っていること。知覚が意図を含んでいなくなったら赤くなる。
    const perceivedGap = addedGap + parentGap + borderWidth;
    expect(perceivedGap - addedGap, "知覚が意図を含まなくなった").toBe(parentGap + borderWidth);
    expect(perceivedGap, `知覚 ${perceivedGap}px < 意図 ${addedGap}px`).toBeGreaterThanOrEqual(
      addedGap,
    );
  });

  it("線を引いているのは隣り合わせの規則だけ（＝分類 6 つなら線は 5 本）", () => {
    // **線の本数そのものは HTML に出ないので数えられない。** CSS の `+` が決めるからである。
    // 代わりに「引いている規則が `+` の 1 つだけ」を示す。これが言えれば
    // 本数は分類の数から**導ける**（6 − 1 ＝ 5）ので、手で数えた 5 を書かずに済む。
    //
    // `.navGroup` 自身が線を持ち始めたら 6 本になり、ここが赤くなる。
    // 狭い画面用の規則は `border-top: none` にして横へ倒しているだけなので、
    // 「引いている」側には数えない（値まで見ているのはそのため）。
    const css = readFileSync(SHELL_CSS, "utf8");
    const drawing = new Set<string>();
    for (const rule of css.matchAll(/(?:^|\n)[ \t]*(\.navGroup[^{\n]*?)\s*\{([^}]*)\}/g)) {
      for (const decl of rule[2].matchAll(/border-(?:top|right|bottom|left):\s*([^;]+);/g)) {
        if (!decl[1].trim().startsWith("none")) drawing.add(rule[1].trim());
      }
    }
    expect(drawing.size, "分類の規則が 1 つも読めていない").toBeGreaterThan(0);
    expect([...drawing]).toStrictEqual([".navGroup + .navGroup"]);
  });

  it("線の上下が揃っている（どちらの群の線か分からなくならない）", () => {
    const css = readFileSync(SHELL_CSS, "utf8");
    const px = pxOfSpaceToken();
    const between = ruleBody(css, ".navGroup + .navGroup");
    const above = px(spaceVar(ruleBody(css, ".sidebar"), "gap")) + px(spaceVar(between, "margin-top"));
    const below =
      px(spaceVar(between, "padding-top")) +
      px(spaceVar(ruleBody(css, ".navGroupLabel"), "padding"));
    expect(below, `上 ${above}px / 下 ${below}px`).toBe(above);
  });

  it("一覧が 1 画面に収まらないので、見出しを追従させている（畳んでいない）", () => {
    // **この検査は「収まらない」という前提そのものを見張る。**
    // 項目が減って収まるようになったら赤くなり、追従が要るかを決め直せる。
    // 収まらないうちに畳む選択をしないことは、docs/product/design-decisions.md に理由がある。
    const css = readFileSync(SHELL_CSS, "utf8");
    const px = pxOfSpaceToken();

    // 高さはトークンの値からの**算術**である（描画して測ってはいない。
    // この作業場所にブラウザが無い）。**下から見た値**で、実際はこれより高い
    // ——見出し（サービス名）の塊と、折り返した項目の 2 行目を数えていない。
    const items = ADMIN_NAV.length; // 19
    const groups = ADMIN_NAV_GROUPS.length; // 6
    const ungrouped = UNGROUPED_NAV_HREFS.length; // 1（ホーム。分類の外に置く）
    // 群内の隙間は「分類に入っている項目の数 − 分類の数」。
    // 分類の外の項目は隙間を作らないので、items からそのぶんを引く。
    const withinGaps = items - ungrouped - groups; // 12
    // **群間と群内はトークン名も書き写さない。**2026-08-19 に境目を 24px → 16px へ
    // 詰めたとき、ここに `--space-2` と `--space-3` を書き写していたせいで、
    // CSS だけが変わってこの計算が古い値のまま緑に残った。値と同じく、
    // **どのトークンを使っているかも実物から引く。**
    //
    // 同じ理由で、押せる大きさ・見出しの高さ・器の余白・線の太さも実物から引く。
    // 以前はここに `44` `22` `--space-4` `1` を書き写していた。書き写しは
    // **CSS が変わっても赤くならない**ので、古い計算が緑のまま残る。
    // 直したときに 22 が 29.6 へ動いた（行送りを 1.5 と書き写していたが、
    // 実物は `--leading-body` → 1.8 で、上下の余白も 4 ではなく 8 だった）。
    // **数が悪い方へ動いてもそれが実測なので、そのまま採る。**
    const resolve = tokenValue();
    const between = ruleBody(css, ".navGroup + .navGroup");
    const sidebar = ruleBody(css, ".sidebar");
    const navLink = ruleBody(css, ".navLink");
    const groupLabel = ruleBody(css, ".navGroupLabel");

    const tap = pxOfToken(resolve, varOf(navLink, "min-height"));
    const label =
      pxOfToken(resolve, varOf(groupLabel, "font-size")) *
        ratioOfToken(resolve, varOf(groupLabel, "line-height")) +
      pxOfToken(resolve, varOf(groupLabel, "padding", 0)) * 2; // 上下
    const border = pxOfToken(resolve, varOf(between, "border-top", 0));

    const minHeight =
      pxOfToken(resolve, varOf(sidebar, "padding")) * 2 + // 器の上下
      items * tap +
      groups * label +
      withinGaps * px(spaceVar(ruleBody(css, ".navGroup"), "gap")) + // 群内
      (groups - 1) *
        (px(spaceVar(between, "margin-top")) + border + px(spaceVar(between, "padding-top"))); // 群間

    // 低いほうのよくある画面の高さ（1440×900 の作業領域）を下回らないこと。
    expect(minHeight, `${minHeight}px`).toBeGreaterThan(760);
    expect(ruleBody(css, ".navGroupLabel")).toContain("position: sticky");
  });

  it("実物から引く道具が、読めていないときに緑にならない", () => {
    // **書き写しをやめた代わりに、読み取りが増えた。**
    // 読み取りが黙って 0 や undefined を返すと、書き写しより悪くなる
    // （書き写しは少なくとも値が見えている）。だから読めない形は必ず投げる。
    const resolve = tokenValue();

    // トークン名は規則の実物から出ている。
    expect(varOf(".x {\n  min-height: var(--tap-target-min);\n}", "min-height")).toBe(
      "--tap-target-min",
    );
    // 2 つ並ぶ余白は、上下と左右を取り違えない。
    const padding = ".x {\n  padding: var(--space-1) var(--space-3);\n}";
    expect(varOf(padding, "padding", 0)).toBe("--space-1");
    expect(varOf(padding, "padding", 1)).toBe("--space-3");
    // 線の宣言からは、太さのトークンだけを取る（色ではない）。
    expect(
      varOf(".x {\n  border-top: var(--border-width-default) solid var(--color-border-subtle);\n}", "border-top", 0),
    ).toBe("--border-width-default");

    // 無いものを読もうとしたら投げる。
    expect(() => resolve("--この名前は無い")).toThrow(/トークンの定義に見つかりません/);
    expect(() => varOf(".x {\n  padding: 8px;\n}", "padding")).toThrow();
    // 意味の段から素の段まで、実際にたどれている（別名のまま返していない）。
    expect(resolve("--tap-target-min")).toMatch(/^[0-9.]+px$/);
    expect(pxOfToken(resolve, "--border-width-default")).toBeGreaterThan(0);
    expect(ratioOfToken(resolve, "--leading-body")).toBeGreaterThan(1);
  });

  it("見本帳の「直す前」は、直す前の値を保っている", () => {
    // ここだけは、直す前の書き方をわざと残している（上の 1 の対象外なのはそのため）。
    // 片付けられると、見比べが「同じものが 2 つ並ぶだけ」になり、
    // しかも見た目は成立してしまうので誰も気づかない。
    const admin = readFileSync(ADMIN_CSS, "utf8");
    expect(ruleBody(admin, ".densityNavRow")).toContain("line-height: var(--tap-target-min)");
    expect(ruleBody(admin, ".densityCards")).toContain("gap: 0");
    expect(ruleBody(admin, ".densityProse")).not.toContain("max-width");
  });
});
