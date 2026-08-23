/** @tier 1 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { SITE_ROUTES, buildPath, footerRoutes, routesFor } from "@/domain/authoring";
import {
  createSampleSiteRepository,
  sampleSites,
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

const APP_S_DIR = join(process.cwd(), "src/app/s");
const APP_SITE_DIR = join(APP_S_DIR, "[site]");

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
    // **母集団の床**（残課題 78 ㉗）。ルート表が空でも同じ 0 件が出る。
    expect(SITE_ROUTES.length, "ルート表が空です").toBeGreaterThan(5);
    const missing = SITE_ROUTES.filter(
      (route) => !existsSync(join(APP_SITE_DIR, toSegments(route.path), "page.tsx")),
    ).map((r) => r.path);

    expect(missing, `画面のファイルが無いルートです: ${missing.join(", ")}`).toEqual([]);
  });

  it("画面のファイルには、必ず表の行がある（孤立した画面を作らない）", () => {
    // **母集団の床**（残課題 78 ㉗）。画面を 1 つも歩けていなくても同じ 0 件が出る。
    expect(actualRoutePaths().length, "画面のファイルを歩けていません").toBeGreaterThan(5);
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
  it("見本のブログすべてが、同じルート表から画面を組み立てる", async () => {
    const repo = createSampleSiteRepository();
    // **母集団の床。**見本を 1 本も引けていなくても、下のループは 0 周で緑になる。
    const slugs = sampleSites().map((s) => s.slug);
    expect(slugs.length, "見本のブログを引けていません").toBeGreaterThanOrEqual(3);

    const blueprints = [];
    for (const slug of slugs) {
      const found = await repo.findBySlug(slug);
      expect(found.ok && found.value !== null, `${slug} の設計図が引けません`).toBe(true);
      if (!found.ok || found.value === null) return;
      blueprints.push(found.value);
    }

    // 設計図の中身は互いに違う（本当に別のブログである）。**総当たりの対で見る。**
    // 2 本だけを比べると、3 本目が 1 本目の丸写しでも気づけない。
    for (let i = 0; i < blueprints.length; i += 1) {
      for (let j = i + 1; j < blueprints.length; j += 1) {
        expect(
          blueprints[j].pattern,
          `${slugs[i]} と ${slugs[j]} が同じ型です`,
        ).not.toBe(blueprints[i].pattern);
        expect(
          blueprints[j].theme.brandTheme,
          `${slugs[i]} と ${slugs[j]} が同じ配色です`,
        ).not.toBe(blueprints[i].theme.brandTheme);
      }
    }

    // それでも、出るルートはどれも同じ表の部分集合。
    for (const blueprint of blueprints) {
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

  it("どのブログ専用の画面ファイルも 1 つも無い", () => {
    const paths = actualRoutePaths();
    // **母集団の床。**画面を歩けていないと `perBlog` は空になり、
    // 「専用ファイルが 1 つも無い」は**何も見ていないときにも成立する。**
    // 上の同じ床に揃えてある。下げない。
    expect(paths.length, "画面のファイルを歩けていません").toBeGreaterThan(5);

    // **ブログ名は見本の一覧から取る。**2 本ぶんを名指しで書いていた頃は、
    // 3 本目（`first-home-appliances`）の名前でフォルダを作っても緑だった。
    // 一覧から取れば、ブログを増やした日に見る対象も増える。
    const slugs = sampleSites().map((s) => s.slug);
    expect(slugs.length, "見本のブログを引けていません").toBeGreaterThanOrEqual(3);

    const perBlog = paths.filter((p) => slugs.some((slug) => p.includes(slug)));
    expect(
      perBlog,
      `ブログ名がファイル構成に混ざっています。分岐したコードの兆候です: ${perBlog.join(", ")}`,
    ).toEqual([]);
  });

  it("`src/app/s/` の直下は `[site]` だけで、ブログ名のフォルダが無い", () => {
    // 上の検査は `src/app/s/[site]` の**下**しか歩かない。
    // **`src/app/s/video-editing-gear/` は兄弟なので、そこからは見えない。**
    // 2026-08-21 に実測: そのフォルダを実際に作っても、このファイルは 7 件とも緑だった。
    // 「作った瞬間に落ちる」と書いてあったのに落ちなかったので、ここで見る。
    const entries = readdirSync(APP_S_DIR).filter((name) =>
      statSync(join(APP_S_DIR, name)).isDirectory(),
    );
    // **母集団の床。**歩き先を間違えると 0 件になり、何も見ずに緑になる。
    expect(entries.length, "src/app/s を歩けていません").toBeGreaterThan(0);

    const perBlog = entries.filter((name) => name !== "[site]");
    expect(
      perBlog,
      `ブログ 1 本のためのフォルダが src/app/s/ に在ります: ${perBlog.join(", ")}`,
    ).toEqual([]);
  });
});
