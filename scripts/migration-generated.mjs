#!/usr/bin/env node
/**
 * スキーマを変えたのに、データの形の変更（マイグレーション）を作り忘れていないか。
 *
 * 忘れると、公開したコードが存在しない列を読んで本番が落ちる。
 *
 * **この検査が `pnpm run verify` の中にある理由。**
 * これは 2026-08-19 まで `.github/workflows/ci.yml` の中だけにあった。
 * 機械の上でしか走らないので、手元で `pnpm run verify` を打った人は
 * 緑を見て push し、機械の上で初めて落ちる。REQ-CI01 は
 * 「`pnpm verify` が CI とまったく同じ検査を再現する（機械の上でしか
 * 試せない状態を作らない）」なので、**要件そのものが破れていた**。
 * 判定欄には「`ci.yml` の検査ステップは `pnpm run verify` の 1 行のみ」と
 * 書いてあったが、実際には検査ステップが 3 つあった。
 */
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/**
 * `new URL(...).pathname` を使わない。作業場所の名前に ASCII 以外が入ると
 * パーセント符号化された文字列が返り、存在しない場所を指す。
 */
const ROOT = fileURLToPath(new URL("..", import.meta.url));

const generate = spawnSync("pnpm", ["run", "db:generate"], {
  cwd: ROOT,
  stdio: "pipe",
  encoding: "utf8",
});

if (generate.status !== 0) {
  console.error("マイグレーションの生成に失敗しました。");
  console.error(generate.stderr || generate.stdout);
  process.exit(1);
}

/**
 * 生成しても差分が出なければ、作り忘れは無い。
 * 差分が出たら、**生成物はそのまま残す**（消すと何が足りないのか分からなくなる）。
 */
const changed = execFileSync("git", ["status", "--porcelain", "drizzle"], {
  cwd: ROOT,
  encoding: "utf8",
}).trim();

if (changed !== "") {
  console.error("スキーマ変更に対するマイグレーションが未生成でした。");
  console.error("生成したので、次のファイルをコミットに含めてください:");
  console.error(changed);
  process.exit(1);
}

console.log("OK スキーマとマイグレーションが揃っています。");
