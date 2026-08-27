/**
 * @tier 1
 * @req REQ-FD06, REQ-BOPS05, REQ-BOPS14
 * @types code-boundary
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * **記事の管理画面は 2 用途、編集正本は 1 表**を固定する。
 *
 * 何が 2 系統あるのか:
 *   - `src/app/admin/content/**` — AI が作る下書きの流れ (`articles` / `content_variants` /
 *     `publications`)。1 本の記事が案 → 変種 → 配信と段を上がっていく盤面である。
 *   - `src/app/admin/blog/**` — 人が書くブログ記事の CRUD。
 *     住所 (slug) と型 (T1–T4) と公開状態を人が決める。
 *
 * P08 は `blog_article` の行を既存 `articles` へ backfill し、過渡表を DROP する。
 * 両画面はユースケース境界を混ぜないが、記事本体を別テーブルに dual-write しない。
 */

const ROOT = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".ts") || full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** AI 生成の盤面の入口。`src/presentation/composition.ts` が出している。 */
const CONTENT_ENTRIES = ["contentUseCases", "editorialContentNotice"];
/** ブログ運用 CRUD の入口。 */
const BLOG_ENTRIES = ["blogOpsEntry"];

function offenders(files: readonly string[], forbidden: readonly string[]): string[] {
  const found: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const name of forbidden) {
      // import 文の中に現れた場合だけを見る。文章中の言及は数えない。
      if (new RegExp(`import[^;]*\\b${name}\\b[^;]*from`, "s").test(source)) {
        found.push(`${relative(ROOT, file)} → ${name}`);
      }
    }
  }
  return found;
}

const contentScreens = walk(join(ROOT, "src", "app", "admin", "content"));
const blogScreens = walk(join(ROOT, "src", "app", "admin", "blog"));

describe("記事の管理画面 2 系統の境界", () => {
  /*
   * **床（母集団が空でないこと）を、0 を主張する `it` の中に置いてある。**
   *
   * 2026-08-26 まで「検査対象を実際に読めている」という独立した `it` に切り出していた。
   * 読みやすさでは勝つが、**走査が空振りした日に「違反 0 件」だけが緑のまま残る。**
   * 空の集合に対する「違反 0 件」は常に成り立つので、この検査は何も見なくなる。
   * 別々の `it` にすると、その 2 つは別々に緑になれてしまう。
   *
   * `tests/architecture/form2-population-floor.test.ts` が、まさにこの形を数えている。
   * 切り出した時点で床なしが 24 → 26 になり、赤が出た。直したのは上限ではなく置き場所。
   *
   * 実測値（2026-08-26）は AI 生成側 6 枚・ブログ運用側 9 枚。
   */
  it("AI 生成の画面が、ブログ運用の入口を掴んでいない", () => {
    expect(contentScreens.length, "admin/content の画面が見つかりません").toBeGreaterThan(4);
    expect(
      offenders(contentScreens, BLOG_ENTRIES),
      "AI 生成の画面がブログ運用の入口を使っています。掴むと 2 系統の状態が 1 画面に混ざります",
    ).toEqual([]);
  });

  it("ブログ運用の画面が、AI 生成の入口を掴んでいない", () => {
    expect(blogScreens.length, "admin/blog の画面が見つかりません").toBeGreaterThan(6);
    expect(
      offenders(blogScreens, CONTENT_ENTRIES),
      "ブログ運用の画面が AI 生成の入口を使っています。掴むと 2 系統の状態が 1 画面に混ざります",
    ).toEqual([]);
  });

  it("articles が記事本体の唯一の編集正本である", () => {
    const schema = readFileSync(join(ROOT, "src", "db", "schema.ts"), "utf8");
    const start = schema.indexOf('"articles"');
    expect(start, "articles 表の定義が見つかりません").toBeGreaterThan(0);
    const end = schema.indexOf("sqliteTable(", start);
    const body = schema.slice(start, end === -1 ? schema.length : end);
    for (const field of ["workspaceId", "siteSlug", 'text("article_template"', "lead", "authorName", "deletedAt"]) {
      expect(body.includes(field), `articles 表に ${field} がありません`).toBe(true);
    }

    expect(schema).not.toMatch(/export const blogArticles\s*=\s*sqliteTable\(/);

    const repository = readFileSync(
      join(ROOT, "src", "infrastructure", "persistence", "d1", "blog-ops-repository.ts"),
      "utf8",
    );
    expect(repository).toContain("articles as blogArticles");

    const migration = readFileSync(join(ROOT, "drizzle", "0028_unify_blog_article_ssot.sql"), "utf8");
    expect(migration).toContain("INSERT INTO `articles`");
    expect(migration).toContain("FROM `blog_article`");
    expect(migration).toContain("DROP TABLE `blog_article`");
  });
});
