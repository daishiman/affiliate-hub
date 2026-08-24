import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { E2E_LOCAL_SESSION } from "./auth-fixture";
import { readSampleWorkspaceId } from "./source-registries";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const now = Math.floor(Date.now() / 1_000);
const tokenHash = createHash("sha256").update(E2E_LOCAL_SESSION).digest("hex");
const workspaceId = readSampleWorkspaceId();
const userId = "u_playwright_local";

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

execFileSync(
  pnpm,
  ["exec", "wrangler", "d1", "execute", "DB", "--local", "--command", sql],
  { stdio: "inherit" },
);
