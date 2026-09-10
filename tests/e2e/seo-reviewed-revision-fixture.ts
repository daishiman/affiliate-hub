import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import type { PublishedArticle } from "../../src/application/read-models/published-article";
import { sampleSites } from "../../src/infrastructure/persistence/sample/site-sample-repository";

// 実行中のNode 22には存在するが、このrepoのNode型にはまだ無いAPIだけを局所宣言する。
type LocalSqlite = {
  readonly isTransaction: boolean;
  exec(sql: string): void;
  prepare(sql: string): { all(): readonly Record<string, unknown>[] };
  close(): void;
};
const { DatabaseSync } = createRequire(join(process.cwd(), "package.json"))("node:sqlite") as {
  readonly DatabaseSync: new (path: string, options?: { readonly readOnly: boolean }) => LocalSqlite;
};

let databasePath: string | undefined;
/** 正本テーブルを持つローカルDBが1つだけのときに限り、fixtureを接続する。 */
function localDatabasePath(): string {
  if (databasePath !== undefined) return databasePath;
  const directory = join(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  const candidates = readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.sqlite$/.test(name)).map((name) => join(directory, name)).filter((path) => {
    const db = new DatabaseSync(path, { readOnly: true });
    try {
      return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('workspaces','published_articles','seo_finding','published_article_revision_counter')").all().length === 4;
    } finally { db.close(); }
  });
  if (candidates.length !== 1) throw new Error(`SEO fixtureのローカルD1を一意に決められません（${candidates.length}件）。`);
  databasePath = candidates[0]!;
  return databasePath;
}

/**
 * previewと同じSQLiteへfixtureだけを書く。アプリの保存経路は実Worker/実D1を通る。
 * 操作のたびにWrangler CLIを起動すると、別workerdがpreviewと資源を取り合う。
 */
function localSql(query: string): readonly { readonly results: readonly Record<string, unknown>[] }[] {
  const db = new DatabaseSync(localDatabasePath());
  try {
    db.exec("PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    if (/^SELECT\b/i.test(query.trim())) return [{ results: db.prepare(query).all() }];
    db.exec(`BEGIN IMMEDIATE;\n${query}\nCOMMIT;`);
    return [{ results: [] }];
  } catch (cause) {
    if (db.isTransaction) db.exec("ROLLBACK;");
    throw new Error("ローカルD1 fixtureの実行に失敗しました。", { cause });
  } finally { db.close(); }
}
const q = (value: string) => `'${value.replaceAll("'", "''")}'`;

export function seoRevisionFixture(project: string, scenario: string, origin: string) {
  const workspaceId = `e2e-seo-${project}-${scenario}`;
  const siteSlug = workspaceId;
  const userId = `${workspaceId}-editor`;
  const token = `${workspaceId}-local-session`;
  const now = Math.floor(Date.now() / 1000);
  const created = new Date((now - 86400) * 1000).toISOString();
  const pageKey = (slug: string) => `${new URL(origin).host}/s/${siteSlug}/guides/${slug}`;
  const article = (slug: string): PublishedArticle => ({
    siteSlug, slug, type: "guide", title: slug === "article-a" ? "差分を確認する記事A" : "選んでいない記事B", summary: "",
    categorySlug: "basics", publishedAt: created, updatedAt: created,
    author: { slug: "writer", name: "検証用の筆者", bio: "", credentials: [] }, disclosureRequired: false,
    sections: [{ id: "lead", heading: "選び方の要点", paragraphs: [`${slug === "article-a" ? "机の奥行き" : "椅子の高さ"}を先に確かめます。次に置く場所を決めます。`] }],
  });
  const cleanup = () => {
    localSql(["seo_search_query_metric", "seo_search_query_sync", "seo_page_metric", "seo_auto_apply_log", "seo_finding", "seo_source_collection", "seo_measurement_setting", "published_articles", "published_article_revision_counter", "site_network_node", "site_blueprints", "memberships", "sessions"].map((table) => `DELETE FROM ${table} WHERE workspace_id=${q(workspaceId)};`).join("\n") + `\nDELETE FROM workspaces WHERE id=${q(workspaceId)};`);
  };
  const setup = () => {
    cleanup();
    const originalBlueprint = sampleSites()[0]!.blueprint;
    const blueprint = { ...originalBlueprint, id: `${workspaceId}-site`, workspaceId, name: "差分反映の検証ブログ" };
    const statements = [
      `INSERT INTO workspaces(id,name,owner_user_id) VALUES (${q(workspaceId)},'SEO差分検証',${q(userId)});`,
      `INSERT INTO memberships(id,workspace_id,user_id,invited_email,roles,scoped_brand_ids,display_name,accepted_at) VALUES (${q(workspaceId)},${q(workspaceId)},${q(userId)},'seo-e2e@example.invalid','["owner"]','[]','SEO差分の検証担当',${now});`,
      `INSERT INTO sessions(token_hash,user_id,workspace_id,expires_at) VALUES (${q(createHash("sha256").update(token).digest("hex"))},${q(userId)},${q(workspaceId)},${now + 3600});`,
      `INSERT INTO site_blueprints(id,workspace_id,slug,name,pattern,published_at,blueprint_json) VALUES (${q(blueprint.id)},${q(workspaceId)},${q(siteSlug)},${q(blueprint.name)},${q(blueprint.pattern)},${now},${q(JSON.stringify(blueprint))});`,
      `INSERT INTO site_network_node(id,workspace_id,site_slug,role,parent_slug,name,one_line,position,status,created_at,updated_at) VALUES (${q(`${workspaceId}-node`)},${q(workspaceId)},${q(siteSlug)},'hub',NULL,${q(blueprint.name)},'記事差分の公開確認',0,'active',${now},${now});`,
      `INSERT INTO seo_measurement_setting(workspace_id,introduced_at) VALUES (${q(workspaceId)},${now - 7 * 86400});`,
    ];
    for (const slug of ["article-a", "article-b"]) {
      const content = article(slug);
      statements.push(`INSERT INTO published_articles(workspace_id,site_slug,slug,source_article_id,type,title,summary,category_slug,author_slug,author_name,published_at,updated_at,article_json,search_text,created_at) VALUES (${q(workspaceId)},${q(siteSlug)},${q(slug)},NULL,'guide',${q(content.title)},'','basics','writer','検証用の筆者',${q(created)},${q(created)},${q(JSON.stringify(content))},${q(content.sections[0]!.paragraphs[0]!)},${q(created)});`);
      statements.push(`INSERT INTO seo_finding(id,workspace_id,site_slug,article_slug,page_key,source,code,detail,observed_at) VALUES (${q(`${workspaceId}-${slug}`)},${q(workspaceId)},${q(siteSlug)},${q(slug)},${q(pageKey(slug))},'static_audit','missing_meta_description','要約がありません',${now});`);
    }
    statements.push(`INSERT INTO seo_page_metric(id,workspace_id,page_key,metric_date,impressions,clicks,position,ai_citations) VALUES (${q(workspaceId)},${q(workspaceId)},${q(pageKey("article-a"))},${q(new Date(now * 1000).toISOString().slice(0,10))},100,20,3.2,NULL);`);
    statements.push(`INSERT INTO seo_page_metric(id,workspace_id,page_key,metric_date,impressions,clicks,position,ai_citations) VALUES (${q(`${workspaceId}-zero`)},${q(workspaceId)},${q(pageKey("article-a"))},${q(new Date((now - 86400) * 1000).toISOString().slice(0,10))},0,0,0,0);`);
    // AIのみの日は保存契約の未観測flagを使う。読取portがGSC値をnullへ変換する。
    statements.push(`INSERT INTO seo_page_metric(id,workspace_id,page_key,metric_date,impressions,clicks,position,ai_citations,search_console_observed) VALUES (${q(`${workspaceId}-ai`)},${q(workspaceId)},${q(pageKey("article-a"))},${q(new Date((now - 2 * 86400) * 1000).toISOString().slice(0,10))},0,0,0,1,0);`);
    const queryDate = new Date(now * 1000).toISOString().slice(0, 10);
    const queryRunId = `${workspaceId}-query-run`;
    statements.push(`INSERT INTO seo_search_query_sync(workspace_id,site_slug,metric_date,active_run_id,active_may_be_limited,active_completed_at,run_id,status,next_start_row,revision,may_be_limited,started_at,updated_at) VALUES (${q(workspaceId)},${q(siteSlug)},${q(queryDate)},${q(queryRunId)},0,${now},${q(queryRunId)},'complete',0,2,0,${now},${now});`);
    statements.push(`INSERT INTO seo_search_query_metric(id,run_id,workspace_id,site_slug,page_key,metric_date,query,impressions,clicks,position,collected_at) VALUES (${q(`${workspaceId}-query`)},${q(queryRunId)},${q(workspaceId)},${q(siteSlug)},${q(pageKey("article-a"))},${q(queryDate)},'初心者にも使いやすい高さを調整できる机の奥行きと選び方',42,6,3.4,${now});`);
    localSql(statements.join("\n"));
  };
  const saved = () => localSql(`SELECT slug,title,summary,revision FROM published_articles WHERE workspace_id=${q(workspaceId)} ORDER BY slug;`)[0]!.results;
  const editAfterReview = () => {
    const changed = { ...article("article-a"), title: "確認後に人が編集した題名" };
    localSql(`UPDATE published_articles SET title=${q(changed.title)},article_json=${q(JSON.stringify(changed))} WHERE workspace_id=${q(workspaceId)} AND slug='article-a';`);
  };
  return { siteSlug, token, setup, cleanup, saved, editAfterReview };
}
