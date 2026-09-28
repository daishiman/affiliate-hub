/** @tier 2 @req REQ-TH02 @types code-boundary */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { coverPaletteFor } from "@/application/seo/fallback-cover";
import { BRAND_THEMES } from "@/domain/authoring/site-blueprint";

/**
 * 代替図版（SVG）の色が、画面の色と同じかを見張る。
 *
 * `src/application/seo/fallback-cover.ts` は色値を直に持っている。持たざるを
 * 得ない ─ SVG は単体の画像として配られるので、ページの CSS 変数が届かない。
 * その代わり `tests/ui/design-tokens.test.ts` の色検問はこのファイルを名指しで
 * 通している。**通した分の埋め合わせがここ。**
 *
 * 見るのは 1 点だけ:「図版が使う色は、すべて primitives.css に実在する値か」。
 * 逆向き（primitives の全色が図版に出るか）は見ない。図版が使う色は 10 配色 ×
 * 4 役ぶんで、primitives の全部を使う道理が無いため。
 *
 * ここが落ちるときに起きているのは「画面の色と、SNS へ流れる共有画像の色が違う」。
 * 人の目には届きにくい壊れ方なので、機械に見せる。
 */

const PRIMITIVES = readFileSync(
  join(process.cwd(), "src/presentation/ui/tokens/primitives.css"),
  "utf8",
);

/** `--neutral-950: #16171a;` の右辺だけを集める。 */
function primitiveColorValues(css: string): Map<string, string> {
  const byValue = new Map<string, string>();
  for (const m of css.matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*(#[0-9a-f]{3,8})\s*;/gim)) {
    byValue.set(m[2].toLowerCase(), m[1]);
  }
  return byValue;
}

const PRIMITIVE_BY_VALUE = primitiveColorValues(PRIMITIVES);

const ROLES = ["surface", "primary", "secondary", "onSurface"] as const;

describe("代替図版の配色", () => {
  /** 検査対象が空だと下が全部緑になる。先に潰す。 */
  it("primitives.css の色を実際に読めている", () => {
    expect(PRIMITIVE_BY_VALUE.size, "1 段目の色が 1 つも読めていません").toBeGreaterThan(20);
    expect(BRAND_THEMES.length).toBeGreaterThan(0);
  });

  it("図版の色はすべて primitives.css に実在する", () => {
    const strays: string[] = [];
    for (const theme of BRAND_THEMES) {
      const palette = coverPaletteFor(theme);
      for (const role of ROLES) {
        const value = palette[role].toLowerCase();
        if (!PRIMITIVE_BY_VALUE.has(value)) strays.push(`${theme}.${role} = ${value}`);
      }
    }
    expect(
      strays,
      [
        "代替図版の色が 1 段目のトークンから外れています:",
        ...strays.map((s) => `  ${s}`),
        "",
        "画面は primitives.css の色で描かれ、共有画像はこの値で描かれます。",
        "片方だけ変えると、SNS に流れた画像だけ色が違う状態になります。",
        "primitives.css の値を変えたのなら、fallback-cover.ts の同じ役の値も変えてください。",
      ].join("\n"),
    ).toEqual([]);
  });

  /**
   * 配色を持たないブログ（保存済みの古い設定・知らない名前）でも図版は出す。
   * 名前を弾いて画像を落とすより、既定の色で出す方が害が小さい。
   */
  it("知らない配色名でも既定の色を返す", () => {
    const unknown = coverPaletteFor("no-such-theme");
    expect(unknown).toEqual(coverPaletteFor("graphite-amber"));
  });

  /** 地と文字が同じ色だと、図版の中の文字が読めなくなる。 */
  it("地の色と文字の色が同じ配色は無い", () => {
    const collisions = BRAND_THEMES.filter((theme) => {
      const p = coverPaletteFor(theme);
      return p.surface.toLowerCase() === p.onSurface.toLowerCase();
    });
    expect(collisions, "地と文字が同色で、図版の題字が読めません").toEqual([]);
  });
});
