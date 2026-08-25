/** @tier 2 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * デザインシステムの機械チェック。
 *
 * 「トークンを使いましょう」は運用ルールでは守られない。必ず破られる。
 * 破れた瞬間にここが落ちる状態にしておくのが、唯一守れるやり方。
 *
 * 見ているのは 5 点:
 *   1. 部品に生の値 (色コード・px・ms) を書いていない
 *   2. 部品が 1 段目 (プリミティブ) を直接読んでいない
 *   3. 部品が使う変数がすべて 2 段目 (セマンティック) に定義されている
 *   4. ブランドテーマが全員おなじトークン集合を上書きしている
 *   5. 折り返し位置の数値がトークンの値と一致している
 */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const TOKENS_DIR = join(SRC, "presentation/ui/tokens");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const allFiles = walk(SRC);

/** 部品と画面のスタイル。トークン定義そのものは含めない。 */
const componentCss = allFiles.filter((f) => f.endsWith(".module.css"));

/** 変数名を定義している行から名前を集める。 */
function definedNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) names.add(m[1]);
  return names;
}

/** 参照している変数名を集める。 */
function referencedNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const m of css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) names.add(m[1]);
  return names;
}

const primitiveCss = readFileSync(join(TOKENS_DIR, "primitives.css"), "utf8");
const semanticCss = readFileSync(join(TOKENS_DIR, "semantic.css"), "utf8");
const themesCss = readFileSync(join(TOKENS_DIR, "themes.css"), "utf8");

const primitiveNames = definedNames(primitiveCss);
const semanticNames = definedNames(semanticCss);

// --- 画面のコードの色 -------------------------------------------------------

type ColorHit = { file: string; line: number; text: string };

/**
 * 行に色が書かれているかだけを見る。**何の色かは見ない。**
 *
 * 元はここに「同じ行に `color|background|border|fill|stroke` がある」という条件が
 * 付いていた。`ctx.fillStyle = "#fff000"` を狙った条件だが、同じ色を
 * `const PALETTE = { warn: "#fff000" }` と書き直すだけで条件から外れる。
 * **書き方が変わっただけで色は変わっていないのに緑になる。**
 * だから語の条件は持たない。色の形をしていれば拾う。
 *
 * コメントの中の色も拾う。見張りはコードとコメントを区別できないが、
 * 区別しないほうが安上がりで正しい（区別を作れば、その区別が次の死角になる）。
 */
function scanColorLines(lines: readonly string[], file = ""): ColorHit[] {
  const hits: ColorHit[] = [];
  lines.forEach((text, i) => {
    if (/#[0-9a-f]{3,8}\b/i.test(text) || /\b(rgb|rgba|hsl|hsla)\(/i.test(text)) {
      hits.push({ file, line: i + 1, text });
    }
  });
  return hits;
}

function codeColorHits(): ColorHit[] {
  const hits: ColorHit[] = [];
  for (const file of allFiles.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))) {
    const rel = relative(ROOT, file);
    const lines = readFileSync(file, "utf8")
      .split("\n")
      .map((l) => l.trim());
    hits.push(...scanColorLines(lines, rel));
  }
  return hits;
}

const formatHit = (hit: ColorHit) => `${hit.file}:${hit.line}  ${hit.text}`;

/**
 * 色を直に書いてよい場所と、その理由。
 *
 * **例外を「例外らしい書き方」で表さない。**ソースへ目印のコメントを置く方式にすると、
 * その目印を書くこと自体が緑にする手順になり、検問の中身が空になる。
 * ここは行の中身をそのまま写す。色を変えれば写しがずれて、例外は外れて赤に戻る。
 *
 * 理由を書く手間がそのまま検問である。書けないものは例外ではない。
 */
const CODE_COLOR_EXEMPTIONS: readonly { file: string; text: string; reason: string }[] = [
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: 'red: "#d92d20",',
    reason:
      "canvas は画素へ直に書くので CSS 変数が届かない。注釈の線の色は domain の ANNOTATION_COLORS と対で、tests/ui/capture-canvas.test.tsx が一致を見ている。",
  },
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: 'brown: "#8a5a2b",',
    reason: "同上（COLOR_CODE。canvas へ直に描く注釈色）。",
  },
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: 'blue: "#1d6fd0",',
    reason: "同上（COLOR_CODE。canvas へ直に描く注釈色）。",
  },
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: 'black: "#101010",',
    reason: "同上（COLOR_CODE。canvas へ直に描く注釈色）。",
  },
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: "* 無かった間、検査は `\"#000000\"` と書き写すほかなく、ここを薄い色に変えても",
    reason:
      "コメントの中の色。REDACT_CODE を export した経緯を説明している文であって、描画には使われない。コードとコメントを区別しない方針の代わりに、ここで名指しで通す。",
  },
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: 'export const REDACT_CODE = "#000000";',
    reason:
      "canvas の黒塗り。透けないことが目的で、テーマで薄くなっては困る（薄くなると隠したものが読める）。だからテーマの切り替えを受けてはならない色である。",
  },
  {
    file: "src/presentation/ui/patterns/capture-canvas.tsx",
    text: 'const CARET_CODE = { light: "#ffffff", dark: "#101010" } as const;',
    reason:
      "canvas に描く位置の目印。下の画像が何色か分からないので明暗を重ねる。CSS 変数は canvas へ届かない。",
  },
];

const exemptionFor = (hit: ColorHit) =>
  CODE_COLOR_EXEMPTIONS.find((ex) => ex.file === hit.file && ex.text === hit.text);

describe("デザイントークン", () => {
  /**
   * 検査対象が 0 件だと、下のテストは全部「合格」になる。
   * 中身を見ずに緑になる状態を先に潰しておく。
   */
  it("検査対象を実際に読めている", () => {
    expect(componentCss.length, "部品の CSS が 1 つも見つかっていません").toBeGreaterThan(0);
    expect(primitiveNames.size, "1 段目のトークンが読めていません").toBeGreaterThan(20);
    expect(semanticNames.size, "2 段目のトークンが読めていません").toBeGreaterThan(20);
    // 部品が実際に 2 段目を参照していること（空ファイルを検査して緑、を防ぐ）
    const used = componentCss.flatMap((f) => [...referencedNames(readFileSync(f, "utf8"))]);
    expect(used.filter((n) => semanticNames.has(n)).length).toBeGreaterThan(20);
  });

  it("部品に生の色コードを書いていない", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (line.trim().startsWith("/*") || line.trim().startsWith("*")) return;
        if (/#[0-9a-f]{3,8}\b/i.test(line) || /\b(rgb|rgba|hsl|hsla)\(/i.test(line)) {
          offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      "色は tokens/semantic.css の変数だけを使います。ここに直接書くと、テーマの切り替えが効きません。",
    ).toEqual([]);
  });

  it("部品に生の px / ms / rem を書いていない（折り返し位置を除く）", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("/*") || trimmed.startsWith("*")) return;
        // @media は変数を受け取れない。唯一の例外として数値を許すが、
        // どのトークンの写しかを注記させる（下のテストで値の一致も見る）。
        if (trimmed.startsWith("@media")) return;
        if (/\b\d+(\.\d+)?(px|rem|m?s)\b/.test(line)) {
          offenders.push(`${relative(ROOT, file)}:${i + 1}  ${trimmed}`);
        }
      });
    }
    expect(
      offenders,
      "寸法・時間は tokens/semantic.css の変数だけを使います。刻みを外れた値が混ざると全体の縦のリズムが崩れます。",
    ).toEqual([]);
  });

  it("部品が 1 段目（プリミティブ）を直接読んでいない", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const css = readFileSync(file, "utf8");
      for (const name of referencedNames(css)) {
        // 2 段目にも同名があるなら 2 段目を読んでいるとみなす
        if (primitiveNames.has(name) && !semanticNames.has(name)) {
          offenders.push(`${relative(ROOT, file)}  ${name}`);
        }
      }
    }
    expect(
      offenders,
      "1 段目は「値」であって「意味」ではありません。--neutral-600 ではなく --color-text-muted を使ってください。",
    ).toEqual([]);
  });

  it("部品が使う変数がすべて 2 段目に定義されている", () => {
    const offenders: string[] = [];
    for (const file of componentCss) {
      const css = readFileSync(file, "utf8");
      const local = definedNames(css);
      for (const name of referencedNames(css)) {
        if (!semanticNames.has(name) && !local.has(name)) {
          offenders.push(`${relative(ROOT, file)}  ${name}`);
        }
      }
    }
    expect(
      offenders,
      "定義の無い変数は無言で効かなくなります（値が空になるだけでエラーが出ない）。綴りを確認してください。",
    ).toEqual([]);
  });

  it("2 段目が 1 段目にない変数を参照していない", () => {
    const offenders: string[] = [];
    for (const name of referencedNames(semanticCss)) {
      if (!primitiveNames.has(name) && !semanticNames.has(name)) offenders.push(name);
    }
    expect(offenders).toEqual([]);
  });

  it("ブランドテーマが全員おなじトークン集合を上書きしている", () => {
    // [data-brand-theme="..."] { ... } を切り出す
    const blocks = [...themesCss.matchAll(/\[data-brand-theme="([^"]+)"\]\s*\{([\s\S]*?)\n\}/g)];
    expect(blocks.length, "テーマが 1 つも読めていません").toBeGreaterThan(1);

    const perTheme = blocks.map(([, name, body]) => ({
      name,
      // 名札 (--brand-theme-name) は上書き対象ではないので除く
      tokens: [...definedNames(body)].filter((t) => t !== "--brand-theme-name").sort(),
    }));

    // 既定テーマは上書きしない（何も差し替えない、が正しい状態）
    const overriding = perTheme.filter((t) => t.tokens.length > 0);
    expect(overriding.length, "上書きするテーマがありません").toBeGreaterThan(0);

    const reference = overriding[0];
    for (const theme of overriding.slice(1)) {
      expect(
        theme.tokens,
        `テーマ「${theme.name}」の上書き範囲が「${reference.name}」と違います。` +
          "一部だけ上書きすると、そのテーマにだけ既定色が混ざります。",
      ).toEqual(reference.tokens);
    }

    // 上書きしてよいのは 2 段目のトークンだけ
    for (const theme of overriding) {
      for (const token of theme.tokens) {
        expect(
          semanticNames.has(token),
          `テーマ「${theme.name}」が 2 段目にない ${token} を作っています。` +
            "テーマは値の差し替えであって、新しい意味を作る場所ではありません。",
        ).toBe(true);
      }
    }
  });

  it("テーマは 1 段目の値だけを差し替えている（生の色を作らない）", () => {
    const offenders: string[] = [];
    themesCss.split("\n").forEach((line, i) => {
      if (/#[0-9a-f]{3,8}\b/i.test(line)) offenders.push(`themes.css:${i + 1}  ${line.trim()}`);
    });
    expect(
      offenders,
      "テーマで新しい色を作ると、その色の AA 検証がテーマの数だけ必要になります。1 段目に階調を足してから参照してください。",
    ).toEqual([]);
  });

  it("折り返し位置の数値がトークンと一致している", () => {
    const tokenValues = new Map<string, string>();
    for (const m of primitiveCss.matchAll(/(--breakpoint-[a-z]+)\s*:\s*([^;]+);/g)) {
      tokenValues.set(m[1], m[2].trim());
    }
    expect(tokenValues.size, "--breakpoint-* が読めていません").toBeGreaterThan(0);

    // globals.css の @theme（Tailwind へ渡す写し）
    const globals = readFileSync(join(SRC, "app/globals.css"), "utf8");
    for (const [name, value] of tokenValues) {
      const found = globals.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
      expect(found, `globals.css に ${name} がありません`).not.toBeNull();
      expect(found?.[1].trim(), `${name} が primitives.css と globals.css でずれています`).toBe(value);
    }

    // 部品 CSS の @media（同じく写し）。注記されたトークン名と値が一致すること。
    const knownValues = new Set(tokenValues.values());
    for (const file of componentCss) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!line.trim().startsWith("@media")) return;
        const sizes = [...line.matchAll(/\b(\d+(?:\.\d+)?(?:px|rem))\b/g)].map((m) => m[1]);
        if (sizes.length === 0) return;
        const note = line.match(/\/\*\s*(--breakpoint-[a-z]+)\s*\*\//);
        expect(
          note,
          `${relative(ROOT, file)}:${i + 1} の @media に、どのトークンの写しかの注記がありません`,
        ).not.toBeNull();
        for (const size of sizes) {
          expect(
            knownValues.has(size),
            `${relative(ROOT, file)}:${i + 1} の ${size} はトークンに無い値です`,
          ).toBe(true);
          expect(
            tokenValues.get(note![1]),
            `${relative(ROOT, file)}:${i + 1} の注記 ${note![1]} と値 ${size} が一致しません`,
          ).toBe(size);
        }
      });
    }
  });

  it("画面のコードに色を直接書いていない", () => {
    const offenders = codeColorHits().filter((hit) => exemptionFor(hit) === undefined);
    expect(
      offenders.map(formatHit),
      "style 属性やコードに色を書くと、テーマの切り替えとダークモードの両方が効かなくなります。" +
        "canvas のように CSS 変数が届かない場所なら、上の CODE_COLOR_EXEMPTIONS へ理由つきで書き足してください。",
    ).toEqual([]);
  });

  /**
   * 死角そのものを固定する。
   *
   * 元の検査は「同じ行に `color|background|border|fill|stroke` がある」ときだけ数えていた。
   * だから `ctx.strokeStyle = "#ffffff"` は赤くなり、
   * `const CARET_CODE = { light: "#ffffff" }` は緑になった。**色は 1 つも変わっていない。**
   * 実測では `#rrggbb` を含む 7 行のうち、旧検査に見えていたのは 0 行だった。
   *
   * ここは「見えていない行が 0 件」を主張する。例外に回したものは
   * CODE_COLOR_EXEMPTIONS に理由つきで載っているので、未分類の行だけが残る。
   */
  it("色を含む行が 1 件残らず分類されている（死角が無い）", () => {
    const hits = codeColorHits();
    const unclassified = hits.filter((hit) => exemptionFor(hit) === undefined);
    // 未分類 = 上のテストで赤くなる側。ここではその存在ではなく「取りこぼしが無いこと」を見る。
    expect(
      hits.length,
      "src の .ts/.tsx から色を 1 つも拾えていません。走査が壊れています（0 件は常に緑になる）。",
    ).toBeGreaterThan(0);
    expect(unclassified.length + hits.filter((h) => exemptionFor(h) !== undefined).length).toBe(
      hits.length,
    );
  });

  /**
   * 例外は消えるべきときに消える。
   *
   * 例外表は書いた瞬間から腐る。対象の行が消えたり色が変わったりしても表が残ると、
   * 次に同じ場所へ入った別の色をその表が黙って通す。**枯れた例外は死角に戻る。**
   */
  it("例外表に、実在しない行が残っていない", () => {
    const hits = codeColorHits();
    const stale = CODE_COLOR_EXEMPTIONS.filter(
      (ex) => !hits.some((hit) => hit.file === ex.file && hit.text === ex.text),
    ).map((ex) => `${ex.file}  ${ex.text}`);
    expect(
      stale,
      "この例外はもう対象がありません。行が消えたか、色が変わっています。表から削ってください。",
    ).toEqual([]);
  });

  /**
   * 検査そのものを検査する。
   *
   * 「定数表へ括り出すと見えなくなる」が塞がったことを、実ファイルではなく作り物で示す。
   * 実ファイルは中身が変われば主張も変わるが、ここは変わらない。
   */
  describe("走査が定数表の中まで届いている", () => {
    it("オブジェクトリテラルの値に書いた色を拾う", () => {
      const lines = ['const PALETTE = { light: "#ffffff", dark: "#101010" } as const;'];
      expect(scanColorLines(lines).map((h) => h.text)).toEqual([lines[0]]);
    });

    it("色という語がどこにも無い行でも拾う", () => {
      // 旧検査が落としていた形。`color|background|border|fill|stroke` が 1 つも無い。
      expect(scanColorLines(['export const REDACT_CODE = "#000000";'])).toHaveLength(1);
      expect(scanColorLines(["  red: \"#d92d20\","])).toHaveLength(1);
    });

    it("同じ行に色という語がある従来の形も引き続き拾う", () => {
      expect(scanColorLines(['ctx.strokeStyle = "#ffffff";'])).toHaveLength(1);
    });

    it("rgb() / hsl() でも拾う", () => {
      expect(scanColorLines(["const x = rgba(0, 0, 0, 0.5);"])).toHaveLength(1);
      expect(scanColorLines(["const y = hsl(210 40% 50%);"])).toHaveLength(1);
    });

    it("色ではない # を拾わない", () => {
      expect(scanColorLines(["const url = `/docs#section`;", "// 手順 #3 を見る"])).toEqual([]);
    });
  });
});

/**
 * 画面ぜんぶに効く 2 つの土台。
 *
 * どちらも「在ること」で守られていて、消えても画面は出る。
 * 追跡表は REQ-S08 / REQ-S09 の判定欄でこの 2 つを根拠にしていたが、
 * **2026-08-21 の時点で、これを見ている検査は 1 つも無かった**
 *（`tests/ui/theme-contrast.test.ts` は `.filterSelect:focus-visible` の
 * 明暗差だけを見る。土台の指定がまるごと消えても、その 1 件は緑のまま）。
 * axe も見ない。焦点の輪は「見えるかどうか」で、jsdom は描画しないため。
 */
describe("画面ぜんぶに効く土台", () => {
  it("焦点の輪が、触れる要素すべてに 1 箇所からかかっている", () => {
    // `:where()` で書くのは、部品側の指定に競り負けないようにするため。
    const rule = semanticCss.match(/:where\(([^)]*)\):focus-visible\s*\{([^}]*)\}/);
    expect(rule, "共通の :focus-visible 指定が semantic.css から消えています").not.toBeNull();
    const targets = (rule?.[1] ?? "").split(",").map((s) => s.trim());
    // 触れる要素の種類。1 つでも外すと、その種類だけ焦点が見えなくなる。
    for (const tag of ["a", "button", "input", "select", "textarea", "summary", "[tabindex]"]) {
      expect(targets, `焦点の輪がかからない要素: ${tag}`).toContain(tag);
    }
    // 輪そのものが引かれていること（対象だけ並べて中身が空、を通さない）。
    expect(rule?.[2] ?? "").toMatch(/outline/);
  });

  /**
   * 文の中のリンクが、地の文と別の見た目を持っているか（UX-12）。
   *
   * --- なぜ要るのか（2026-08-21 の実物） ---
   * `/signin` の「管理画面へ戻る」が灰色の地の文にしか見えなかった。
   * 素の `a` の見た目を決める規則が**どこにも無かった**ため。Tailwind の
   * preflight が `a { color: inherit; text-decoration: inherit }` を敷くので、
   * 何も書かなければ下線は消える。
   *
   * --- なぜ「何か違えばよい」にしないか ---
   * 「地の文と違う見た目を持つ」を素直に書くと、色を 1 段変えただけでも通る
   * 検査になる。それでは WCAG 1.4.1（色だけに頼らない）が守られたか分からない。
   * ここは **UX-02 で決めた形そのもの**を見る:
   *   - 常に下線が出る（`:hover` のときだけ、にしない）
   *   - 色を継承しない（`.linkNote` の中でも沈まない）
   * 決めごとを変えるならこの検査も一緒に変える。それが「決めた」ということ。
   *
   * --- 捕まえないもの ---
   * 各 `*.module.css` が `text-decoration: none` で外した先に何も足していない形は、
   * ここでは見えない（`.siteNav a` / `.cardTitle a` は**意図して**外している）。
   */
  it("文の中のリンクが、色以外の手掛かりを常に持っている", () => {
    const rule = semanticCss.match(/\n:where\(a\[href\]\)\s*\{([^}]*)\}/);
    expect(rule, "素のリンクの見た目を決める規則が semantic.css から消えています").not.toBeNull();
    const body = rule?.[1] ?? "";

    // 色**以外**の手掛かり。これが無いと色覚に依存する。
    expect(body, "下線が常には出ません（色だけで示しています）").toMatch(
      /text-decoration-line:\s*underline/,
    );
    // 地の文が薄い所（`.linkNote`）に置かれても沈まないよう、色を自分で持つ。
    expect(body, "リンクが色を継承しています").toMatch(/color:\s*var\(--color-action-/);
    // 生の値を書いていないこと（この規則は他の走査の対象外なので、ここで見る）。
    expect(body, "生の値が書かれています").not.toMatch(/#[0-9a-fA-F]{3}|\d+px/);
  });

  it("動きを減らす設定のとき、動きが止まる", () => {
    const at = semanticCss.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(at, "動きを減らす設定への対応が semantic.css から消えています").toBeGreaterThan(-1);
    const block = semanticCss.slice(at, at + 800);
    // 部品ごとに書かせない。`*` にかけて、書き忘れた部品も止まる形にする。
    expect(block).toMatch(/\*,/);
    expect(block).toMatch(/animation-duration:[^;]*!important/);
    expect(block).toMatch(/transition-duration:[^;]*!important/);
  });
});

/**
 * **`gap` を黙って無効にする書き方の型**を、CSS の文面から探す（UX-11）。
 *
 * --- なぜ要るのか（2026-08-21 の実物） ---
 * `/signin` で、見出し・説明文・警告の箱・ボタン・注記の**すべての間隔が
 * 同じだけ間延びし、警告の箱の下半分が空のまま伸びる**崩れが起きた。
 * 原因は `site.module.css` の `.siteMain` が `flex: 1` かつ `display: grid` で、
 * 親の `.siteShell` が `min-height: 100vh` だったこと。中身が短い画面では
 * この箱が画面の高さまで伸び、grid の `align-content` の初期値 `stretch` が
 * 行がすべて `auto` のときに**余った高さを全部の行へ均等に配ぶんする**。
 * 結果、`gap: var(--space-6)` に書いた値が意味を失う。
 *
 * **`gap` は消えていない。効かなくなるだけ**なので、`gap` を見る検査では捕まらない。
 * 目で見て初めて分かった崩れであり、機械は 1 つも見ていなかった。
 *
 * --- 何を見るか ---
 * 同じ規則ブロックの中に「伸びる指定（`flex` / `flex-grow` が 0 でない）」と
 * `display: grid` が同居していて、`align-content` が**無い**こと。
 * **値は見ない。**`start` でも `end` でも `center` でも、書いてあれば
 * 「配ぶんの仕方を意識して決めた」ということなので通す。
 * 事故になるのは**書き忘れ**（初期値の `stretch` が黙って効く）だけである。
 *
 * --- 捕まえないもの（先に書く） ---
 * この型は **`flex` を使わずに高さが伸びる形を見ない**。具体的には:
 *   - `height: 100%` / `block-size: 100%` で親いっぱいに伸びる grid
 *   - 親の `grid-template-rows: 1fr` に置かれた子の grid
 *   - `position: absolute; inset: 0` で広がる grid
 *   - `align-content` を別の規則（`@media` の中や、より詳細度の高い селектор）で
 *     後から足している形（同居していないので「無い」と判定する＝過検出になりうる）
 * これらは「実際に描かせて余白を測る」側（UX-11 の案 (b)）でしか見えない。
 * また `align-content` に `stretch` を**明示的に**書いた場合も通す。
 * 明示なら意図した選択だとみなす——見ているのは書き忘れである。
 *
 * --- 既知の緑 ---
 * `align-content: start` を持つ規則は実測 3 箇所（`admin.module.css` の
 * `.densitySide` / `patterns.module.css` の `.boardItem` /
 * `ui.module.css` の `.pageBody`）。ただし**この 3 つはそもそも `flex` を持たない**ので、
 * `align-content` を消してもこの検査は赤くならない（実測で確かめた）。
 * この検査が現に見張っているのは `site.module.css` の `.siteMain` **1 件**である。
 *
 * 規範: docs/product/ui-ux-tasks.md UX-01 / UX-11
 */

/** すべての CSS。`*.module.css` に限らない（`globals.css` にも同じ型は書ける）。 */
const allCss = allFiles.filter((f) => f.endsWith(".css"));

type CssRule = { file: string; selector: string; declarations: string };

/**
 * 一番内側の `{...}` を規則ブロックとして拾う。
 * `@media` などの入れ子は、外側が宣言を持たないので自然に落ちる。
 */
function rulesOf(file: string): CssRule[] {
  const body = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: CssRule[] = [];
  for (const m of body.matchAll(/([^{}]*)\{([^{}]*)\}/g)) {
    const declarations = m[2];
    // 宣言を 1 つも持たない塊（`@media (...) {` の外側など）は規則ではない。
    if (!/[a-z-]+\s*:/i.test(declarations)) continue;
    out.push({
      file: relative(ROOT, file),
      selector: (m[1].split(/[{}]/).pop() ?? "").trim(),
      declarations,
    });
  }
  return out;
}

/**
 * 宣言の値を取り出す。**先読みで「0 でない」を書くと、空白の分だけ後戻りして
 * 先読みをすり抜ける**（`flex: 0 0 auto` が「伸びる」と判定された。対照で捕まえた）。
 * 値そのものを取ってから見る。
 */
const valueOf = (d: string, prop: string): string | null => {
  const m = new RegExp(`(?:^|;|\\{|\\s)${prop}\\s*:([^;}]*)`, "i").exec(d);
  return m ? m[1].trim().toLowerCase() : null;
};

/** 伸びる指定を持つか。`flex: 0 ...` と `flex: none` は伸びないので除く。 */
const grows = (d: string) => {
  const grow = valueOf(d, "flex-grow");
  if (grow !== null && Number.parseFloat(grow) > 0) return true;
  const flex = valueOf(d, "flex");
  if (flex === null) return false;
  if (flex === "none" || flex === "initial") return false;
  if (flex === "auto") return true; // `flex: auto` は `1 1 auto`
  // 一括指定の 1 つ目が `flex-grow`。
  return Number.parseFloat(flex) > 0;
};
const isGrid = (d: string) => {
  const v = valueOf(d, "display");
  return v === "grid" || v === "inline-grid";
};

/** `place-content` は `align-content` の一括指定なので、これも「書いてある」。 */
const hasAlignContent = (d: string) =>
  valueOf(d, "align-content") !== null || valueOf(d, "place-content") !== null;

describe("余白が黙って効かなくなる書き方（UX-11）", () => {
  it("探す側が、狙ったものだけを見分ける（対照）", () => {
    // **「赤が出た」と「狙ったものを見て赤が出た」は別。**
    // 通る例と止まる例を、同じ検査の中に置く。
    const yes = "flex: 1; display: grid; gap: var(--space-6);";
    expect(grows(yes) && isGrid(yes) && !hasAlignContent(yes), "見逃しています").toBe(true);

    // 値は見ない。書いてあれば通す。
    for (const value of ["start", "end", "center", "space-between", "stretch"]) {
      const d = `flex: 1; display: grid; align-content: ${value};`;
      expect(hasAlignContent(d), `align-content: ${value} を読み落としています`).toBe(true);
    }

    // 伸びないものは対象外。
    expect(grows("flex: 0 0 auto; display: grid;")).toBe(false);
    expect(grows("flex: none; display: grid;")).toBe(false);
    expect(grows("flex-grow: 0;")).toBe(false);
    expect(grows("flex-grow: 1;")).toBe(true);
    expect(grows("flex: 1 1 auto;")).toBe(true);
    expect(grows("flex: auto;")).toBe(true);
    expect(grows("flex: initial;")).toBe(false);
    expect(grows("display: grid;")).toBe(false);
    // `flex-basis` は伸びる指定ではない。名前の一部で拾わないこと。
    expect(grows("flex-basis: 20rem;")).toBe(false);

    // grid でないものは対象外（flex の並びに `align-content` は要らない）。
    expect(isGrid("flex: 1; display: flex;")).toBe(false);
    expect(isGrid("flex: 1; display: inline-grid;")).toBe(true);

    // 語の一部を拾わない。
    expect(hasAlignContent("justify-content: start;")).toBe(false);
    expect(hasAlignContent("place-content: start;"), "place-content を見落としています").toBe(true);
    expect(isGrid("display: grid-template-columns-ish;")).toBe(false);
    expect(isGrid("grid-template-columns: 1fr;")).toBe(false);
  });

  it("伸びる grid には、必ず配ぶんの仕方が書いてある", () => {
    const rules = allCss.flatMap(rulesOf);

    // **母集団の床。**「違反 0 件」を主張するので、読めていないだけの 0 を弾く。
    // 値は違反の一覧から取らない（`0 >= 0` で通ってしまう）。実測 298 件に対し、
    // 余裕を見て 200 を素の数で置く。CSS を大きく削る日には、ここで一度止まる。
    expect(rules.length, "CSS の規則ブロックを読めていません").toBeGreaterThanOrEqual(200);
    expect(allCss.length, "CSS ファイルを読めていません").toBeGreaterThanOrEqual(5);

    const offenders = rules
      .filter((r) => grows(r.declarations) && isGrid(r.declarations))
      .filter((r) => !hasAlignContent(r.declarations))
      .map((r) => `${r.file} の ${r.selector}`);

    expect(
      offenders,
      "伸びる grid に align-content がありません。余った高さが行の間へ均等に配ぶんされ、gap が効かなくなります",
    ).toEqual([]);
  });
});
