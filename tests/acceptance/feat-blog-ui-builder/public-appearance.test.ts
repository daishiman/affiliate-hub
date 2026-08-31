/**
 * @tier 1
 * @req REQ-BLOG02, A2, A8
 * @types equivalence, regression, fault-injection
 *
 * 受入 **A2-4**「公開面が正本側から配色を読む」の確認。
 *
 * `template-and-theme.test.ts` が見ているのは 2 層の合成規則そのもの
 * （`resolvePageTheme`）で、こちらが見るのは **公開面がその規則へ
 * 実際につながっているか**である。合成が正しくても、公開面が
 * `site_blueprints.theme` を読んだままなら、管理画面で選んだ色は
 * 保存されるだけで読者に一生出ない。二重管理の破れはそこに出る。
 */
import { describe, expect, it } from "vitest";
import type { BlogAppearancePort } from "@/application/ports/blog-appearance";
import { readPublicBlogAppearance } from "@/application/read-models/public-blog-appearance";
import type { Appearance } from "@/domain/authoring/appearance";
import type { BlogTheme, PageThemeOverride } from "@/domain/authoring/blog-template";
import { domainError, err, ok, taggedString, type WorkspaceId } from "@/domain/shared";

const WS = taggedString<"WorkspaceId">("ws_test") as WorkspaceId;

/** 設計図の配色（旧正本）。ブログ既定が無いときだけ効く土台。 */
const BLUEPRINT: Appearance = { brandTheme: "graphite-amber", colorMode: "auto" };

function fakePort(input: {
  readonly theme?: BlogTheme | null;
  readonly override?: PageThemeOverride | null;
  readonly broken?: boolean;
}): BlogAppearancePort {
  const fail = () => err(domainError("UPSTREAM_UNAVAILABLE", "保存先を読めませんでした。"));
  const unused = () => {
    throw new Error("この検査では呼ばれない口です。");
  };
  return {
    themeOf: async () => (input.broken === true ? fail() : ok(input.theme ?? null)),
    overrideOf: async () => (input.broken === true ? fail() : ok(input.override ?? null)),
    templateOf: unused,
    saveTemplate: unused,
    saveTheme: unused,
    listOverrides: unused,
    saveOverride: unused,
    clearOverride: unused,
  } as unknown as BlogAppearancePort;
}

async function read(port: BlogAppearancePort, pagePath = "/about") {
  return readPublicBlogAppearance({
    port,
    workspaceId: WS,
    siteSlug: "home-office-desk",
    pagePath,
    fallback: BLUEPRINT,
  });
}

describe("A2-4 公開面の配色は保存された 2 層から決まる", () => {
  it("ブログ既定が保存されていれば、設計図ではなくそちらが出る", async () => {
    const result = await read(fakePort({ theme: { brandTheme: "blue", colorMode: "dark" } }));

    expect(result.appearance).toEqual({ brandTheme: "blue", colorMode: "dark" });
    expect(result.resolved).toBe(true);
  });

  it("ブログ既定が未登録なら設計図へ落ちる（行が無いのは正常）", async () => {
    const result = await read(fakePort({ theme: null }));

    expect(result.appearance).toEqual(BLUEPRINT);
  });

  /**
   * **軸ごとに独立**（`theme-contract.md` §3.2）。
   * 片方だけ上書きしたいという要求は正当で、
   * 表せない設計にすると「明暗だけ暗くしたい 1 ページ」が作れない。
   */
  it("ページ上書きは軸ごとに効き、指定していない軸はブログ既定のまま", async () => {
    const result = await read(
      fakePort({
        theme: { brandTheme: "blue", colorMode: "light" },
        override: { colorMode: "dark" },
      }),
    );

    expect(result.appearance).toEqual({ brandTheme: "blue", colorMode: "dark" });
  });

  it("上書きが無い（行の不在）ならブログ既定へ戻る", async () => {
    const result = await read(
      fakePort({ theme: { brandTheme: "pink", colorMode: "light" }, override: null }),
    );

    expect(result.appearance).toEqual({ brandTheme: "pink", colorMode: "light" });
  });

  /**
   * 保存先を信用しない（`theme-contract.md` §4）。
   * 語彙の外の名札は migration や手作業の SQL で実際に入り得る。
   * 素通しすると、どのテーマも当たらない「色が半分だけ既定」の画面になる。
   */
  it("語彙の外の名札は既定へ落ちる（素通ししない）", async () => {
    const result = await read(
      fakePort({ theme: { brandTheme: "そんな色はない", colorMode: "auto" } }),
    );

    expect(result.appearance.brandTheme).toBe(BLUEPRINT.brandTheme);
  });

  /**
   * 配色が読めないことを理由に記事を止めない。
   * 止めると `blog_theme` の読み取り 1 つで記事全体が
   * 「いま表示できません」になり、読者が失うものが釣り合わない。
   */
  it("保存先が読めなくても記事は出る。ただし落ちたことは隠さない", async () => {
    const result = await read(fakePort({ broken: true }));

    expect(result.appearance).toEqual(BLUEPRINT);
    expect(result.resolved).toBe(false);
  });

  /**
   * 保存したときと同じ正規化を読み取りでも通す。
   * 揃えないと `/about` で保存した上書きが `/about/` を開いた読者に効かない。
   */
  it("末尾スラッシュの有無で上書きが外れない", async () => {
    /*
      保存済みの行は `/about` ちょうど 1 本。
      正規化を通していなければ `/about/` の読者には見つからず、
      明暗がブログ既定（light）のまま出る。
    */
    const port = {
      themeOf: async () => ok({ brandTheme: "blue", colorMode: "light" as const }),
      overrideOf: async (i: { readonly pagePath: string }) =>
        ok(i.pagePath === "/about" ? { colorMode: "dark" as const } : null),
    } as unknown as BlogAppearancePort;

    expect((await read(port, "/about/")).appearance.colorMode).toBe("dark");
    expect((await read(port, "about")).appearance.colorMode).toBe("dark");
    expect((await read(port, "/other")).appearance.colorMode).toBe("light");
  });
});
