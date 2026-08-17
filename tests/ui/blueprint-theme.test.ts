/** @tier 2 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_THEMES, DEFAULT_THEME } from "@/domain/authoring";

/**
 * ブランドテーマの名前が、実体（トークンの上書き）と一致していることの確認。
 *
 * Site Blueprint は色そのものを持たず、テーマの**名前**だけを持つ。
 * 名前と実体が別ファイルにあるので、放っておくと必ずずれる。
 * ずれると「設定した色にならないブログ」が黙って出来上がる。
 *
 * ここが落ちたら、themes.css と site-blueprint.ts のどちらかを直す。
 * どちらを直すかは「そのテーマを本当に使うか」で決める。
 */

const THEMES_CSS = readFileSync(
  join(process.cwd(), "src/presentation/ui/tokens/themes.css"),
  "utf8",
);

/** themes.css が定義しているテーマ名。 */
function themeNamesInCss(): string[] {
  return [...THEMES_CSS.matchAll(/\[data-brand-theme="([a-z0-9-]+)"\]/g)].map((m) => m[1]).sort();
}

describe("ブランドテーマの名前と実体", () => {
  it("Blueprint が選べるテーマは、すべて themes.css に実体がある", () => {
    const inCss = new Set(themeNamesInCss());
    const missing = BRAND_THEMES.filter((name) => !inCss.has(name));
    expect(
      missing,
      `themes.css に実体が無いテーマ名です。設定できるのに見た目が変わりません: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("themes.css にあるテーマは、すべて Blueprint から選べる", () => {
    const declared = new Set<string>(BRAND_THEMES);
    const orphans = themeNamesInCss().filter((name) => !declared.has(name));
    expect(
      orphans,
      `どのブログからも選べないテーマが残っています: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("既定テーマは選べる名前のひとつ", () => {
    expect(BRAND_THEMES).toContain(DEFAULT_THEME.brandTheme);
  });

  it("テーマの中では色を直に書かず、2 段目トークンだけを上書きしている", () => {
    // ブロックの中身だけを見る。ファイル冒頭の説明コメントは対象外。
    const blocks = [...THEMES_CSS.matchAll(/\[data-brand-theme="[a-z0-9-]+"\]\s*\{([^}]*)\}/g)];
    expect(blocks.length).toBe(BRAND_THEMES.length);

    for (const [, body] of blocks) {
      for (const line of body.split("\n")) {
        const code = line.split("/*")[0];
        const declaration = code.match(/^\s*(--[a-z0-9-]+)\s*:/);
        if (declaration === null) continue;
        expect(
          declaration[1] === "--brand-theme-name" ||
            declaration[1].startsWith("--color-") ||
            declaration[1].startsWith("--focus-") ||
            declaration[1].startsWith("--surface-"),
          `テーマが役割トークン以外を上書きしています: ${declaration[1]}`,
        ).toBe(true);
      }
    }
  });
});
