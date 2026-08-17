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
    const offenders: string[] = [];
    for (const file of allFiles.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/#[0-9a-f]{6}\b/i.test(line) && /(color|background|border|fill|stroke)/i.test(line)) {
          offenders.push(`${relative(ROOT, file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }
    expect(
      offenders,
      "style 属性やコードに色を書くと、テーマの切り替えとダークモードの両方が効かなくなります。",
    ).toEqual([]);
  });
});
