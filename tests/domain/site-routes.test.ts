import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_ROUTES, buildPath, footerRoutes, routesFor } from "@/domain/authoring";
import {
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  createSampleSiteRepository,
} from "@/infrastructure/persistence/sample/site-sample-repository";

/**
 * ルート表と実際の画面が一致していることの確認。
 *
 * 「表には書いたが画面が無い」と「画面はあるが表に無い」の両方を止める。
 * 片方だけを見ると、リンク先が 404 の一覧や、どこからも行けない画面が残る。
 *
 * 併せて、**ブログを増やしても画面のコードが増えない**ことも確認する。
 * ブログ 2 本が同じルート表・同じファイル一式で動いていることを、
 * 「2 本目のために作られたファイルが 1 つも無い」という形で機械的に見る。
 */

const APP_SITE_DIR = join(process.cwd(), "src/app/s/[site]");

/** ルート表のパスを Next.js のフォルダ名へ写す。`/best/{topic}` → `best/[topic]` */
function toSegments(path: string): string {
  return path === "/" ? "" : path.slice(1).replace(/\{(\w+)\}/g, "[$1]");
}

/** `src/app/s/[site]` の下にある page.tsx をルートの形で集める。 */
function actualRoutePaths(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === "page.tsx") {
        const rel = relative(APP_SITE_DIR, join(full, "..")).split("\\").join("/");
        found.push(rel);
      }
    }
  };
  walk(APP_SITE_DIR);
  return found.sort();
}

describe("ブログのルート表", () => {
  it("表にあるルートには、必ず画面のファイルがある", () => {
    const missing = SITE_ROUTES.filter(
      (route) => !existsSync(join(APP_SITE_DIR, toSegments(route.path), "page.tsx")),
    ).map((r) => r.path);

    expect(missing, `画面のファイルが無いルートです: ${missing.join(", ")}`).toEqual([]);
  });

  it("画面のファイルには、必ず表の行がある（孤立した画面を作らない）", () => {
    const declared = new Set(SITE_ROUTES.map((r) => toSegments(r.path)));
    const orphans = actualRoutePaths().filter((p) => !declared.has(p));

    expect(
      orphans,
      `ルート表に無い画面です。どこからも案内されない可能性があります: ${orphans.join(", ")}`,
    ).toEqual([]);
  });

  it("すべてのルートに「どこから来るか」が書いてある", () => {
    const noEntry = SITE_ROUTES.filter((r) => r.reachedFrom.trim() === "").map((r) => r.key);
    expect(noEntry, `導線が書かれていないルートです: ${noEntry.join(", ")}`).toEqual([]);
  });

  it("ルートの名前とパスは重複しない", () => {
    expect(new Set(SITE_ROUTES.map((r) => r.key)).size).toBe(SITE_ROUTES.length);
    expect(new Set(SITE_ROUTES.map((r) => r.path)).size).toBe(SITE_ROUTES.length);
  });

  it("パスの差し込みは、与えた値だけを置き換える", () => {
    const review = SITE_ROUTES.find((r) => r.key === "review");
    expect(review).toBeDefined();
    expect(buildPath(review!, { product: "abc" })).toBe("/reviews/abc");
    // 値が無いときは壊れた URL を作らず、印を残したままにする（気づけるようにする）。
    expect(buildPath(review!, {})).toBe("/reviews/{product}");
  });
});

describe("ブログを増やしても画面は増えない", () => {
  it("見本のブログ 2 本は、同じルート表から画面を組み立てる", async () => {
    const repo = createSampleSiteRepository();
    const first = await repo.findBySlug(SAMPLE_SITE_SLUG);
    const second = await repo.findBySlug(SECOND_SITE_SLUG);

    expect(first.ok && first.value !== null).toBe(true);
    expect(second.ok && second.value !== null).toBe(true);
    if (!first.ok || first.value === null || !second.ok || second.value === null) return;

    // 設計図の中身は違う（本当に別のブログである）。
    expect(second.value.pattern).not.toBe(first.value.pattern);
    expect(second.value.theme.brandTheme).not.toBe(first.value.theme.brandTheme);

    // それでも、出るルートはどちらも同じ表の部分集合。
    for (const blueprint of [first.value, second.value]) {
      for (const route of routesFor(blueprint)) {
        expect(SITE_ROUTES).toContain(route);
      }
      // 信頼に関わるページは、どのブログでも必ず足元に出る。
      const footerKeys = footerRoutes(blueprint).map((r) => r.key);
      for (const required of [
        "methodology",
        "editorial-policy",
        "advertising-policy",
        "ai-policy",
        "corrections",
        "privacy",
        "contact",
      ]) {
        expect(footerKeys, `${blueprint.name} の足元に ${required} がありません`).toContain(
          required,
        );
      }
    }
  });

  it("2 本目のブログ専用の画面ファイルは 1 つも無い", () => {
    const paths = actualRoutePaths();
    const perBlog = paths.filter(
      (p) => p.includes(SAMPLE_SITE_SLUG) || p.includes(SECOND_SITE_SLUG),
    );
    expect(
      perBlog,
      `ブログ名がファイル構成に混ざっています。分岐したコードの兆候です: ${perBlog.join(", ")}`,
    ).toEqual([]);
  });
});
