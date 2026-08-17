/** @tier 2 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_THEMES, BRAND_THEME_LABELS } from "@/domain/authoring/site-blueprint";

/**
 * 配色 × 明暗のコントラスト検査（WCAG 2.2 AA）。
 *
 * なぜ機械で見るか:
 *   配色 9 種 × 明暗 2 種 = 18 通り。目で見て確かめる前提にすると、
 *   配色を 1 つ足すたびに 2 通りの見落としが増える。
 *   しかも「暗いときだけ薄い」は、明るい画面で作業していると気づけない。
 *
 * **配色を 1 つ足すと自動で検査対象に入る。**
 * 対象は `BRAND_THEMES`（ドメイン側の正本）から取っており、
 * このファイルに配色名を書き足す必要はない。
 *
 * 何を確かめるか（実際に人が読む組み合わせだけ）:
 *   1. ボタンの文字 vs ボタンの地色      → 4.5:1
 *   2. リンク・操作の色 vs 背景          → 4.5:1（文字として出る）
 *   3. 注意の文字 vs 注意の地色          → 4.5:1
 *   4. 本文 vs 背景 / 補足 vs 背景       → 4.5:1
 *   5. 枠線 vs 背景                      → 3:1（文字ではないので AA は 3:1）
 *
 * 限界（正直に書いておく）:
 *   ここで解いているのは CSS の変数参照であって、ブラウザの描画ではない。
 *   透過（alpha）や重ね合わせ、画像の上の文字は見ていない。
 *   それらを使っていないことが前提で、使い始めたらこの検査では足りない。
 */

const TOKENS_DIR = join(process.cwd(), "src/presentation/ui/tokens");
const primitiveCss = readFileSync(join(TOKENS_DIR, "primitives.css"), "utf8");
const semanticCss = readFileSync(join(TOKENS_DIR, "semantic.css"), "utf8");
const themesCss = readFileSync(join(TOKENS_DIR, "themes.css"), "utf8");

type Mode = "light" | "dark";

/** `--name: value;` を拾う。ブロックの区別はしない（後述の解決で分ける）。 */
function declarations(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim)) {
    out.set(m[1], m[2].trim());
  }
  return out;
}

/** テーマごとのブロックだけを切り出す。 */
function themeBlock(theme: string): Map<string, string> {
  const re = new RegExp(`\\[data-brand-theme="${theme}"\\]\\s*\\{([^}]*)\\}`, "m");
  const m = themesCss.match(re);
  return m === null ? new Map() : declarations(m[1]);
}

const primitives = declarations(primitiveCss);
/** `:root { ... }` の中だけを既定値として使う（メディアクエリ内の上書きは除く）。 */
const rootBlock = semanticCss.match(/:root\s*\{([\s\S]*?)\n\}/);
const semanticDefaults = declarations(rootBlock === null ? "" : rootBlock[1]);

/**
 * 変数を実際の色まで解く。
 *
 * `light-dark(a, b)` は明暗どちらを見ているかで選ぶ。
 * これがこの検査の核心で、**同じ 1 行の定義から 2 通りの色を取り出している**。
 */
function resolve(expr: string, mode: Mode, theme: Map<string, string>, depth = 0): string {
  if (depth > 12) throw new Error(`変数の参照が循環しています: ${expr}`);
  const value = expr.trim();

  const lightDark = value.match(/^light-dark\(\s*([\s\S]+?)\s*,\s*([\s\S]+?)\s*\)$/);
  if (lightDark !== null) {
    return resolve(mode === "light" ? lightDark[1] : lightDark[2], mode, theme, depth + 1);
  }

  const varRef = value.match(/^var\(\s*(--[a-z0-9-]+)\s*\)$/i);
  if (varRef !== null) {
    const name = varRef[1];
    // テーマの上書きが最優先。次に semantic の既定、最後に primitive。
    const next = theme.get(name) ?? semanticDefaults.get(name) ?? primitives.get(name);
    if (next === undefined) throw new Error(`定義が見つかりません: ${name}`);
    return resolve(next, mode, theme, depth + 1);
  }

  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  throw new Error(`色として読めません: ${value}`);
}

/** WCAG 2.2 の相対輝度。 */
function luminance(hex: string): number {
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(Number.parseInt(hex.slice(1, 3), 16));
  const g = channel(Number.parseInt(hex.slice(3, 5), 16));
  const b = channel(Number.parseInt(hex.slice(5, 7), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

type Pair = {
  readonly what: string;
  readonly fg: string;
  readonly bg: string;
  readonly min: number;
};

/**
 * 確かめる組み合わせを**部品の CSS から自動で集める**。
 *
 * 最初は組み合わせを手で書いていたが、書いた 9 組のうち 2 組は
 * **実際には一度も組み合わさらない色**だった（例: 注意の文字は
 * 「注意の地色」ではなく「注意の薄い地色」の上に出る）。
 * 手で書くと、存在しない不合格を追いかけ、実在する組み合わせを見落とす。
 *
 * そこで「同じ規則の中で文字色と背景色の両方を指定している箇所」を
 * 機械で拾う。**新しい部品を足すと、その組み合わせも自動で検査対象に入る。**
 */
function pairsFromComponentCss(): readonly Pair[] {
  const files = [
    "src/presentation/ui/primitives/ui.module.css",
    "src/presentation/ui/patterns/patterns.module.css",
    "src/presentation/ui/templates/site.module.css",
  ];
  const found = new Map<string, Pair>();

  for (const rel of files) {
    const css = readFileSync(join(process.cwd(), rel), "utf8");
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const selector = rule[1].trim().split("\n").pop()?.trim() ?? "";
      const body = rule[2];
      const bg = body.match(/(?:^|\s)background(?:-color)?\s*:\s*var\(\s*(--color-[a-z0-9-]+)\s*\)/);
      const fg = body.match(/(?:^|\s)color\s*:\s*var\(\s*(--color-[a-z0-9-]+)\s*\)/);
      if (bg === null || fg === null) continue;
      const key = `${fg[1]}|${bg[1]}`;
      if (found.has(key)) continue;
      found.set(key, {
        what: `${selector} の文字と地色`,
        fg: fg[1],
        bg: bg[1],
        min: 4.5,
      });
    }
  }
  return [...found.values()];
}

/**
 * 部品の CSS からは拾えない組み合わせ。
 *
 * 本文の色と背景は個々の部品ではなく大枠で決まるため、規則の中に並んでいない。
 * 枠線は文字ではないので下限は 3:1（WCAG 2.2 SC 1.4.11）。
 * **飾りの区切り線（border-subtle / border-default）は対象にしない。**
 * 操作の輪郭を示す線ではないため、同 SC の対象外。
 * ここを 3:1 で縛ると、区切り線を濃くする方向にしか直せなくなる。
 */
const GLOBAL_PAIRS: readonly Pair[] = [
  { what: "本文と背景", fg: "--color-text-default", bg: "--color-surface-default", min: 4.5 },
  { what: "補足の文字と背景", fg: "--color-text-muted", bg: "--color-surface-default", min: 4.5 },
  {
    what: "見出しと一段上げた面",
    fg: "--color-text-strong",
    bg: "--color-surface-raised",
    min: 4.5,
  },
  { what: "本文と沈めた面", fg: "--color-text-default", bg: "--color-surface-sunken", min: 4.5 },
  {
    what: "操作の色と背景（リンクの文字として出る）",
    fg: "--color-action-default",
    bg: "--color-surface-default",
    min: 4.5,
  },
  // 操作の輪郭を示す線。ここは 1.4.11 の対象。
  {
    what: "強い枠線と背景（操作の輪郭）",
    fg: "--color-border-strong",
    bg: "--color-surface-default",
    min: 3,
  },
  {
    what: "焦点の輪と背景（キーボード操作の現在地）",
    fg: "--color-focus-ring",
    bg: "--color-surface-default",
    min: 3,
  },
];

const PAIRS: readonly Pair[] = [...GLOBAL_PAIRS, ...pairsFromComponentCss()];

const MODES: readonly Mode[] = ["light", "dark"];

describe("配色 × 明暗のコントラスト（WCAG 2.2 AA）", () => {
  it("検査対象を実際に読めている", () => {
    // 対象が 0 件だと下のテストは全部「合格」になる。
    expect(BRAND_THEMES.length).toBeGreaterThanOrEqual(9);
    expect(PAIRS.length).toBeGreaterThan(0);
    expect(primitives.size).toBeGreaterThan(20);
    expect(semanticDefaults.size).toBeGreaterThan(20);
  });

  it("利用者が指定した 5 系統がそろっている", () => {
    for (const name of ["blue", "pink", "white", "gray", "green"] as const) {
      expect(BRAND_THEMES).toContain(name);
      // 名札だけ足してトークンを書き忘れていないか。
      expect(themeBlock(name).size, `${name} のトークンが themes.css にありません`).toBeGreaterThan(
        0,
      );
    }
  });

  for (const theme of BRAND_THEMES) {
    for (const mode of MODES) {
      it(`${BRAND_THEME_LABELS[theme]}（${mode === "light" ? "明るい" : "暗い"}）が AA を満たす`, () => {
        const block = themeBlock(theme);
        const failures: string[] = [];

        for (const pair of PAIRS) {
          const fg = resolve(`var(${pair.fg})`, mode, block);
          const bg = resolve(`var(${pair.bg})`, mode, block);
          const ratio = contrast(fg, bg);
          if (ratio < pair.min) {
            failures.push(
              `${pair.what}: ${ratio.toFixed(2)}:1（必要 ${pair.min}:1）` +
                ` ${pair.fg}=${fg} / ${pair.bg}=${bg}`,
            );
          }
        }

        expect(failures, `${theme} / ${mode} で下限を割っています`).toEqual([]);
      });
    }
  }

  it("暗いときの色を明るいときの反転で済ませていない", () => {
    /*
     * 反転で済ませると、暗いときだけ AA を割る。
     * ここでは「明暗で同じ値を使っている操作色」を落とす。
     * 無彩色のテーマでも、操作色は明暗で別の段を指しているはず。
     */
    const same: string[] = [];
    for (const theme of BRAND_THEMES) {
      const block = themeBlock(theme);
      const light = resolve("var(--color-action-default)", "light", block);
      const dark = resolve("var(--color-action-default)", "dark", block);
      if (light === dark) same.push(`${theme}: 明暗とも ${light}`);
    }
    expect(same, "明暗で同じ操作色を使っています").toEqual([]);
  });
});
