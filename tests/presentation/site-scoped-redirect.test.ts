/** @tier 2 @req REQ-S09 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_SITE_SCOPED_ROUTES,
  SITE_PICKER_PATH,
  resolveSiteSlug,
  siteScopedRedirectTarget,
} from "@/presentation/admin/site-scoped-redirect";

/**
 * 旧 URL から site 配下へ送る規則 (受入 A2 / A3)。
 *
 * 規則を純粋関数にしてあるので、対応表の全件をここで一度に検査できる。
 * 画面ごとに検査すると、5 本のうち 1 本だけ規則がずれた状態を見逃す。
 *
 * 規範: docs/spec/feat-site-scoped-authoring-ia/redirect-contract.md
 */

const SLUGS = ["first-camera", "run-and-recover"] as const;

describe("resolveSiteSlug: どのブログかを決める", () => {
  it("明示された `?site=` を、記憶している cookie より優先する", () => {
    /*
      逆にすると、リンクで指定したブログを「前に開いていた別のブログ」が
      上書きする。明示は常に記憶より強い。
    */
    expect(
      resolveSiteSlug({
        querySite: "first-camera",
        cookieSite: "run-and-recover",
        siteSlugs: SLUGS,
      }),
    ).toBe("first-camera");
  });

  it("明示が無ければ cookie を使う", () => {
    expect(resolveSiteSlug({ cookieSite: "run-and-recover", siteSlugs: SLUGS })).toBe(
      "run-and-recover",
    );
  });

  it("実在しない slug は、どの段でも採用しない", () => {
    /*
      消したブログの slug が cookie に残っている人だけが
      存在しない住所へ送られて 404 に当たる、という事故を防ぐ。
    */
    expect(
      resolveSiteSlug({ querySite: "deleted", cookieSite: "gone", siteSlugs: SLUGS }),
    ).toBeNull();
  });

  it("ブログが 1 本しか無ければ、指定が無くてもそれに決まる", () => {
    expect(resolveSiteSlug({ siteSlugs: ["first-camera"] })).toBe("first-camera");
  });

  it("2 本以上あって手がかりが無ければ、決めない", () => {
    // 勝手に 1 本目を選ぶと、別のブログの読者像を「このブログのもの」として見せる。
    expect(resolveSiteSlug({ siteSlugs: SLUGS })).toBeNull();
  });
});

describe("siteScopedRedirectTarget: どこへ送るかを決める", () => {
  it("対応表の 5 件すべてが site 配下へ送られる", () => {
    for (const legacy of Object.keys(LEGACY_SITE_SCOPED_ROUTES)) {
      const target = siteScopedRedirectTarget(legacy, "first-camera");
      expect(target, `${legacy} の行き先`).toMatch(
        /^\/admin\/sites\/first-camera\//,
      );
      expect(target, `${legacy} に置換し残しがあります`).not.toContain("[site]");
    }
  });

  it("対応表に無い住所は転送しない", () => {
    expect(siteScopedRedirectTarget("/admin/content", "first-camera")).toBeNull();
  });

  it("ブログが決まらないときはブログ選択へ送る (A3)", () => {
    for (const legacy of Object.keys(LEGACY_SITE_SCOPED_ROUTES)) {
      expect(siteScopedRedirectTarget(legacy, null), legacy).toBe(SITE_PICKER_PATH);
    }
  });

  it("`site` 以外のクエリは引き継ぐ", () => {
    expect(
      siteScopedRedirectTarget("/admin/writing", "first-camera", {
        type: "ranking",
        site: "run-and-recover",
      }),
    ).toBe("/admin/sites/first-camera/writing?type=ranking");
  });

  it("同じ鍵の複数値を 1 件に畳まない", () => {
    // 複数選択の絞り込みを畳むと、転送のたびに条件が減る。
    expect(
      siteScopedRedirectTarget("/admin/personas", "first-camera", { tag: ["a", "b"] }),
    ).toBe("/admin/sites/first-camera/authors?tag=a&tag=b");
  });

  it("slug を URL として安全な形にしてから差し込む", () => {
    /*
      `/` を含む slug を作れた日に、転送先が別の画面になるのを防ぐ。
      slug の検証は resolveSiteSlug 側でも行うが、ここでも守る。
    */
    expect(siteScopedRedirectTarget("/admin/personas", "a/b")).toBe(
      "/admin/sites/a%2Fb/authors",
    );
  });
});
