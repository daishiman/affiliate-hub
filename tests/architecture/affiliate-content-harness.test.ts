/**
 * @tier 1
 * @req REQ-QC03, REQ-QC05, REQ-QC12
 */
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const BLOG_VALIDATOR = join(
  ROOT,
  ".claude/plugins/affiliate-content-harness/scripts/validate-blog-content.mjs",
);
const CONTENT_SET_VALIDATOR = join(
  ROOT,
  ".claude/plugins/affiliate-content-harness/scripts/validate-content-set.mjs",
);
const QUIET_RENTAL = join(ROOT, "blog-content/quiet-rental");
const KIDS_ENGLISH = join(ROOT, "blog-content/kids-english-trial");
const ARTICLE_FIXTURE = join(
  ROOT,
  "blog-content/quiet-rental/articles/silentbase-mat-20mm.json",
);

type JsonObject = Record<string, unknown>;

function articleWithClaim(overrides: JsonObject): string {
  const dir = mkdtempSync(join(tmpdir(), "affiliate-claim-"));
  const path = join(dir, "article.json");
  const article = JSON.parse(readFileSync(ARTICLE_FIXTURE, "utf8")) as JsonObject;
  const sections = article.sections as JsonObject[];
  const claims = sections[0].claims as JsonObject[];
  claims[0] = { ...claims[0], ...overrides };
  writeFileSync(path, `${JSON.stringify(article, null, 2)}\n`);
  return path;
}

function validateArticle(path: string) {
  return spawnSync(process.execPath, [BLOG_VALIDATOR, "--article", path], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

function copiedContentSet(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "affiliate-content-set-"));
  const contentSet = join(dir, "content-set");
  cpSync(source, contentSet, { recursive: true });
  return contentSet;
}

function validateContentSet(path: string) {
  return spawnSync(process.execPath, [CONTENT_SET_VALIDATOR, "--content-set", path], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

describe("ブログ記事の主張を公開前に検品する", () => {
  it.each([
    ["id", { id: "" }, "言い切りに id がありません"],
    ["statement", { statement: "" }, "言い切りの本文が空です"],
  ])("claim の %s が空なら公開を止め、直し方を伝える", (_field, overrides, message) => {
    const articlePath = articleWithClaim(overrides);

    try {
      const result = validateArticle(articlePath);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status, output).toBe(1);
      expect(output).toContain(message);
    } finally {
      rmSync(join(articlePath, ".."), { recursive: true, force: true });
    }
  });

  it("画面の正本と違う呼び名があれば、公開を止めて統一語を伝える", () => {
    const articlePath = articleWithClaim({ statement: "PR記事として公開します。" });

    try {
      const result = validateArticle(articlePath);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status, output).toBe(1);
      expect(output).toContain("使ってはいけない言い換え「PR記事」");
      expect(output).toContain("広告（アフィリエイトリンク）を含む記事");
    } finally {
      rmSync(join(articlePath, ".."), { recursive: true, force: true });
    }
  });
});

describe("1案件ぶんの成果物を同じ入口で公開前検品する", () => {
  it.each([
    ["記事と5媒体がある案件", QUIET_RENTAL],
    ["記事を展開先に含めない3媒体の案件", KIDS_ENGLISH],
  ])("%s は5つの検品をまとめて通る", (_case, contentSet) => {
    const result = validateContentSet(contentSet);
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status, output).toBe(0);
    expect(output).toContain("5 つの検品を完了しました");
  });

  it("案件で予定した媒体が無ければ、公開を止めて不足を伝える", () => {
    const contentSet = copiedContentSet(QUIET_RENTAL);
    rmSync(join(contentSet, "posts/silentbase-mat-2026h2.x-short.json"));

    try {
      const result = validateContentSet(contentSet);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status, output).toBe(1);
      expect(output).toContain("不足している媒体: X 短文投稿 (x-short)");
    } finally {
      rmSync(join(contentSet, ".."), { recursive: true, force: true });
    }
  });

  it("案件で予定していない媒体があれば、公開を止めて過剰を伝える", () => {
    const contentSet = copiedContentSet(QUIET_RENTAL);
    const campaignPath = join(contentSet, "campaign-brief.json");
    const campaign = JSON.parse(readFileSync(campaignPath, "utf8")) as JsonObject;
    campaign.media = (campaign.media as string[]).filter((medium) => medium !== "x-short");
    writeFileSync(campaignPath, `${JSON.stringify(campaign, null, 2)}\n`);

    try {
      const result = validateContentSet(contentSet);
      const output = `${result.stdout}${result.stderr}`;

      expect(result.status, output).toBe(1);
      expect(output).toContain("予定にない媒体: X 短文投稿 (x-short)");
    } finally {
      rmSync(join(contentSet, ".."), { recursive: true, force: true });
    }
  });
});
