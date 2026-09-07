import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";
import { sampleSites } from "../../src/infrastructure/persistence/sample/site-sample-repository";
import { SESSION_COOKIE_NAME } from "../../src/infrastructure/identity/session-actor";

function q(value: string): string { return `'${value.replace(/'/g, "''")}'`; }

/** Unique tenant, article and login per test. All commands are hard-wired to isolated local state. */
export function createBlockEditorFixture(project: string) {
  const root = process.env.BLOCK_EDITOR_E2E_ROOT;
  const state = process.env.BLOCK_EDITOR_E2E_STATE;
  if (!root || !state || !existsSync(join(root, ".block-editor-e2e-owned")) || state !== join(root, "isolated-state")) {
    throw new Error("Dedicated owned local state is required; shared seed is never used.");
  }
  const sql = <T extends Record<string, unknown>>(command: string): readonly T[] => {
    const output = execFileSync("pnpm", ["exec", "wrangler", "d1", "execute", "DB", "--local", "--persist-to", state, "--json", "--command", command], {
      cwd: root, encoding: "utf8", env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: ["ignore", "pipe", "pipe"],
    });
    const result = JSON.parse(output) as readonly { results: readonly T[] }[];
    return result.flatMap((entry) => entry.results);
  };
  const nonce = `${project}-${randomUUID().slice(0, 12)}`;
  const workspaceId = `w_block_e2e_${nonce}`;
  const articleId = `a_block_e2e_${nonce}`;
  const siteSlug = `block-editor-${nonce}`;
  const articleSlug = `saved-${nonce}`;
  const userId = `u_block_e2e_${nonce}`;
  const title = `ブロック公開検証 ${nonce}`;
  const authorName = "専用E2E";
  const productName = `検証商品 ${nonce}`;
  const brand = "E2E専用";
  const token = `${randomUUID()}${randomUUID()}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = Math.floor(Date.now() / 1000);
  const base = sampleSites()[0]!.blueprint;
  const blueprint = { ...base, id: `sb_block_e2e_${nonce}`, workspaceId, name: `検証ブログ ${nonce}` };
  sql([
    `INSERT INTO workspaces (id,name,owner_user_id) VALUES (${q(workspaceId)},${q(title)},${q(userId)});`,
    `INSERT INTO sessions (token_hash,user_id,workspace_id,created_at,expires_at,revoked_at) VALUES (${q(tokenHash)},${q(userId)},${q(workspaceId)},${now},${now + 3600},NULL);`,
    `INSERT INTO memberships (id,workspace_id,user_id,invited_email,roles,scoped_brand_ids,display_name,invited_at,accepted_at) VALUES (${q(`m_${nonce}`)},${q(workspaceId)},${q(userId)},${q(`${nonce}@example.invalid`)},'["owner"]','[]','専用E2E',${now},${now});`,
    `INSERT INTO site_blueprints (id,workspace_id,slug,name,pattern,published_at,blueprint_json) VALUES (${q(blueprint.id)},${q(workspaceId)},${q(siteSlug)},${q(blueprint.name)},${q(blueprint.pattern)},${now},${q(JSON.stringify(blueprint))});`,
    `INSERT INTO site_network_node (id,workspace_id,site_slug,role,name,status) VALUES (${q(`sn_${nonce}`)},${q(workspaceId)},${q(siteSlug)},'hub',${q(blueprint.name)},'active');`,
    `INSERT INTO articles (id,workspace_id,site_slug,slug,article_template,type,title,lead,status,author_name,created_at,updated_at) VALUES (${q(articleId)},${q(workspaceId)},${q(siteSlug)},${q(articleSlug)},'T4','guide',${q(title)},'保存・公開・匿名閲覧を検証します。','draft',${q(authorName)},${now},${now});`,
    `INSERT INTO blog_article_block (id,workspace_id,article_id,kind,heading,body,position) VALUES (${q(`b_${nonce}`)},${q(workspaceId)},${q(articleId)},'intro-box','確認する内容','公開前の本文',0);`,
    `INSERT INTO catalog_products (id,workspace_id,brand,name,identity_keys,description,specifications,image_asset_ids,official_source_ids,provenance_source_type,provenance_source_name,provenance_retrieved_at,provenance_confidence,provenance_permitted_usage) VALUES (${q(`p_${nonce}`)},${q(workspaceId)},${q(brand)},${q(productName)},'[]','公開時に同じ商品名を表示します。','{}','[]','[]','manual','専用E2E',${now},1,'ローカル検証のみ');`,
  ].join("\n"));

  return {
    title, authorName, brand, productName, editPath: `/admin/blog/articles/${articleId}`, publicPath: `/s/${siteSlug}/blog/${articleSlug}`,
    // A valid 1×1 PNG, uploaded via the actual file control rather than mocking the API.
    png: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1sAAAAASUVORK5CYII=", "base64"),
    async authenticate(context: BrowserContext) {
      await context.addCookies([{ name: SESSION_COOKIE_NAME, value: token, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax", secure: false, expires: now + 3600 }]);
    },
    cleanup() {
      const images = sql<{ object_key: string }>(`SELECT object_key FROM article_image WHERE workspace_id=${q(workspaceId)} AND article_id=${q(articleId)};`);
      for (const image of images) {
        if (!image.object_key.startsWith(`article-images/${workspaceId}/${articleId}/`)) throw new Error("Refusing to remove an unowned image object.");
        execFileSync("pnpm", ["exec", "wrangler", "r2", "object", "delete", `affiliate-hub-assets-dev/${image.object_key}`, "--local", "--persist-to", state], { cwd: root, stdio: "pipe" });
      }
      // Explicit ownership manifest: fixture rows plus the article save/upload audit rows.
      // D1 forbids table-valued PRAGMA; no database inspection bypass is needed for cleanup.
      const tables = ["published_article_tombstones", "published_articles", "article_image", "blog_article_tag", "blog_article_block", "blog_affiliate_placement", "audit_logs", "articles", "catalog_products", "site_network_node", "site_blueprints", "memberships", "sessions"];
      const deletes = tables.map((name) => `DELETE FROM "${name}" WHERE workspace_id=${q(workspaceId)};`);
      sql([...deletes, `DELETE FROM workspaces WHERE id=${q(workspaceId)};`].join("\n"));
      // D1 caps compound SELECT terms; separate statements still verify every owned table.
      const remaining = sql<{ count: number }>(`${tables.map((name) => `SELECT count(*) AS count FROM "${name}" WHERE workspace_id=${q(workspaceId)}`).join(";\n")};`);
      if (remaining.some((row) => row.count !== 0)) throw new Error("Owned fixture rows remain after cleanup.");
      if (sql<{ count: number }>(`SELECT count(*) AS count FROM workspaces WHERE id=${q(workspaceId)};`)[0]?.count !== 0) throw new Error("Owned fixture cleanup did not complete.");
    },
  };
}
