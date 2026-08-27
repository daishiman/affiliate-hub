/**
 * Playwright が使う preview サーバーの下ごしらえ。
 *
 * **なぜここでデータまで入れるのか。**
 * 画面を実際に押して確かめる道は、この 1 本しかない。
 * 手で `curl` を叩く確かめ方は記録に残らず、次の人が同じ手順を踏めない。
 * ここに入れておけば「実サーバーへ実際に要求を出した」ことが
 * `pnpm test:e2e` の緑として毎回残る。
 *
 * 入れるものは 2 つ。
 *   1. Playwright 用の通行証（`sessions` + `memberships`）。1 時間で切れる。
 *   2. 見本データ一式（`scripts/seed/local-seed-data.ts`）。
 *      記事・ブロック・配信部品・固定ページが無いと、
 *      ブログ運用の画面は空の一覧しか出せず、押す対象が存在しない。
 *
 * 当てる先は `--local`（miniflare のファイル）だけ。remote へ向ける口を置いていない。
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { buildSeedSql, SEED_HUB_SLUG } from "../../scripts/seed/local-seed-data";
import { sampleSites } from "../../src/infrastructure/persistence/sample/site-sample-repository";
import { E2E_LOCAL_SESSION } from "./auth-fixture";
import { buildPublicSiteLifecycleSeedSql } from "./public-site-lifecycle-fixture";
import { readSampleWorkspaceId } from "./source-registries";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const now = Math.floor(Date.now() / 1_000);
const tokenHash = createHash("sha256").update(E2E_LOCAL_SESSION).digest("hex");
const workspaceId = readSampleWorkspaceId();
const userId = "u_playwright_local";

/** 1 文でも失敗したら止める。半分だけ入った状態で画面を確かめても意味がない。 */
function execLocalSql(args: readonly string[]): void {
  execFileSync(pnpm, ["exec", "wrangler", "d1", "execute", "DB", "--local", ...args], {
    stdio: "inherit",
  });
}

// 本番・remoteへは一切向けない。previewと同じローカルD1へ、期限付きの行だけをupsertする。
execFileSync(pnpm, ["db:migrate:local"], { stdio: "inherit" });
const sql = [
  "INSERT INTO sessions (token_hash, user_id, workspace_id, created_at, expires_at, revoked_at)",
  `VALUES ('${tokenHash}', '${userId}', '${workspaceId}', ${now}, ${now + 60 * 60}, NULL)`,
  "ON CONFLICT(token_hash) DO UPDATE SET",
  `user_id='${userId}', workspace_id='${workspaceId}', created_at=${now}, expires_at=${now + 60 * 60}, revoked_at=NULL;`,
  "INSERT INTO memberships",
  "(id, workspace_id, user_id, invited_email, roles, scoped_brand_ids, display_name, invited_at, accepted_at, revoked_at)",
  `VALUES ('m_playwright_local', '${workspaceId}', '${userId}', 'playwright@example.invalid', '[\"owner\"]', '[]', 'Playwright', ${now}, ${now}, NULL)`,
  "ON CONFLICT(id) DO UPDATE SET",
  `workspace_id='${workspaceId}', user_id='${userId}', roles='[\"owner\"]', accepted_at=${now}, revoked_at=NULL;`,
].join(" ");

execLocalSql(["--command", sql]);

// 見本データ。`pnpm seed:local` と同じ値を、同じ関数から作る。
// 写しを作らないのが要点で、片方だけ古くなると
// 「手で見た画面」と「Playwright が見た画面」が黙ってずれる。
const seedFile = join(process.cwd(), ".wrangler", "tmp", "e2e-seed.generated.sql");
const baseBlueprint = sampleSites()[0]?.blueprint;
if (baseBlueprint === undefined) {
  throw new Error("公開サイトE2Eの元にする見本設計図がありません。");
}
const seedStatements = [
  ...buildSeedSql(now),
  ...buildPublicSiteLifecycleSeedSql({
    workspaceId,
    baseBlueprint,
    parentSiteSlug: SEED_HUB_SLUG,
    nowSeconds: now,
  }),
];
mkdirSync(dirname(seedFile), { recursive: true });
writeFileSync(seedFile, `${seedStatements.join("\n")}\n`, "utf8");
execLocalSql(["--file", seedFile]);
