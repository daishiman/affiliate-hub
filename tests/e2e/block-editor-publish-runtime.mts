/** Dedicated production-like E2E. Never prepares shared seed or touches the dev build/state. */
import { execFileSync } from "node:child_process";
import { closeSync, cpSync, mkdtempSync, openSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const source = process.cwd();
const root = mkdtempSync(join(tmpdir(), "block-editor-publish-"));
const state = join(root, "isolated-state");
const port = process.env.BLOCK_EDITOR_E2E_PORT ?? "8794";
const excluded = ["node_modules", ".git", ".next", ".open-next", ".wrangler", ".dev.vars*", ".env*", ".beads", ".claude", ".agents", ".codex", "test-results", "coverage", "*.tsbuildinfo"];
execFileSync("rsync", ["-a", ...excluded.map((name) => `--exclude=${name}`), `${source}/`, `${root}/`], { stdio: "inherit" });
// Turbopack disallows a node_modules symlink outside the project filesystem root.
// APFS clone-copy keeps the installed versions without rewriting the shared install.
if (process.platform === "darwin") execFileSync("cp", ["-cR", resolve(source, "node_modules"), join(root, "node_modules")]);
else cpSync(resolve(source, "node_modules"), join(root, "node_modules"), { recursive: true });
writeFileSync(join(root, ".block-editor-e2e-owned"), "isolated local build and storage only\n");
console.log(`BLOCK_EDITOR_E2E_ROOT=${root}`);
console.log(`BLOCK_EDITOR_E2E_PORT=${port}`);
const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", WRANGLER_SEND_METRICS: "false", BLOCK_EDITOR_E2E_ROOT: root, BLOCK_EDITOR_E2E_STATE: state, BLOCK_EDITOR_E2E_PORT: port, BLOCK_EDITOR_E2E_OUTPUT: join(source, "test-results", `block-editor-publish-${Date.now()}`) };
execFileSync("pnpm", ["run", "build:worker"], { cwd: root, env, stdio: "inherit" });
const migrationLog = join(root, "migration-evidence.log");
const migrationFd = openSync(migrationLog, "w");
try {
  execFileSync("pnpm", ["exec", "wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", state], { cwd: root, env, stdio: ["ignore", migrationFd, migrationFd] });
} finally { closeSync(migrationFd); }
console.log(`Isolated D1 migration log: ${migrationLog}`);
execFileSync("pnpm", ["exec", "playwright", "test", "--config", "tests/e2e/block-editor-publish.config.ts"], { cwd: source, env, stdio: "inherit" });
console.log(`Isolated build evidence retained at ${root}; test-created rows and image objects were cleaned by fixture teardown.`);
