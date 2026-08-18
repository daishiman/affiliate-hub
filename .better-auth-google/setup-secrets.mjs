#!/usr/bin/env node
/**
 * ログインに要る値を登録する。
 *
 * **値そのものを画面にも履歴にも残さない。**
 * 貼り付けた文字は表示されず、コマンドの引数にも入らない。
 * この方法にしているのは、コマンドの履歴とファイルは後から誰でも読めるためである。
 *
 * 使い方（お手元のターミナルで、このプロジェクトの中で）:
 *
 *   node .better-auth-google/setup-secrets.mjs            … 手元 + dev 環境
 *   node .better-auth-google/setup-secrets.mjs --prod     … 手元 + 本番
 *   node .better-auth-google/setup-secrets.mjs --local-only … 手元だけ
 *
 * 登録するもの:
 *   GOOGLE_CLIENT_ID       … Google が発行する識別子（非表示で入力）
 *   GOOGLE_CLIENT_SECRET   … Google が発行する秘密の値（非表示で入力）
 *   BETTER_AUTH_SECRET     … このアプリが署名に使う値（自動で作る。人は見ない）
 *   BETTER_AUTH_URL        … このアプリの住所（環境ごとに決まっている）
 *   AUTH_ALLOWED_EMAILS    … 入ってよい人のアドレス（見えるまま入力。秘密ではない）
 */
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { access, appendFile, chmod, readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOCAL_ORIGIN = "http://localhost:8788";
const ORIGINS = {
  dev: "https://affiliate-hub-dev.daishimanju.workers.dev",
  production: "https://affiliate-hub.daishimanju.workers.dev",
};

const LOCAL_ONLY = process.argv.includes("--local-only");
const TARGET_ENV = process.argv.includes("--prod") ? "production" : "dev";
const PNPM = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** 表示せずに 1 行受け取る。貼り付けた文字は画面に出ない。 */
async function readHidden(label) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("対話できるターミナルから実行してください。");
  }
  process.stdout.write(`${label}（入力内容は表示されません）: `);
  const wasRaw = Boolean(process.stdin.isRaw);
  process.stdin.setEncoding("utf8");
  process.stdin.setRawMode(true);
  process.stdin.resume();

  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value.trim());
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("中止しました。"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

/** 見えるまま 1 行受け取る。秘密でない値（アドレスの名簿）に使う。 */
async function readVisible(label) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`${label}: `)).trim();
  } finally {
    rl.close();
  }
}

function setDotenvValues(content, values) {
  const remaining = new Set(Object.keys(values));
  const lines = content
    .split(/\r?\n/)
    .filter((line, index, rows) => index < rows.length - 1 || line !== "");
  const updated = lines.map((line) => {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=/);
    if (!match || !(match[1] in values)) return line;
    remaining.delete(match[1]);
    return `${match[1]}=${values[match[1]]}`;
  });
  for (const key of remaining) updated.push(`${key}=${values[key]}`);
  return `${updated.join("\n")}\n`;
}

function runWrangler(args, options = {}) {
  const result = spawnSync(PNPM, ["exec", "wrangler", ...args], {
    cwd: PROJECT,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture && result.stderr) process.stderr.write(result.stderr);
    throw new Error(`wrangler の実行に失敗しました: ${args.join(" ")}`);
  }
  return result.stdout || "";
}

/** 値は引数に置かず、標準入力から渡す（コマンドの履歴に残さないため）。 */
function putSecret(key, value) {
  return new Promise((resolve, reject) => {
    const child = spawn(PNPM, ["exec", "wrangler", "secret", "put", key, "--env", TARGET_ENV], {
      cwd: PROJECT,
      stdio: ["pipe", "inherit", "inherit"],
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${key} の登録に失敗しました。`)),
    );
    child.stdin.end(`${value}\n`);
  });
}

function validateEmails(raw) {
  const list = raw
    .split(/[,、\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== "");
  if (list.length === 0) throw new Error("アドレスが 1 つも入っていません。");
  const bad = list.filter((s) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s));
  if (bad.length > 0) throw new Error(`アドレスの形をしていません: ${bad.join(" / ")}`);
  return list.join(",");
}

async function main() {
  console.log(`登録先: 手元${LOCAL_ONLY ? "だけ" : ` と ${TARGET_ENV}（${ORIGINS[TARGET_ENV]}）`}`);

  const clientId = await readHidden("Google の Client ID を貼り付けて Enter");
  if (!clientId.endsWith(".apps.googleusercontent.com")) {
    throw new Error("Client ID の形が違います（.apps.googleusercontent.com で終わるはずです）。");
  }
  const clientSecret = await readHidden("Google の Client Secret を貼り付けて Enter");
  if (clientSecret === "") throw new Error("Client Secret が空です。");

  console.log("\n入ってよい人のアドレスを入れてください（複数ならカンマ区切り）。");
  console.log("ここに無いアドレスは、Google の確認が通っても中に入れません。");
  const allowedEmails = validateEmails(await readVisible("許可するアドレス"));

  // --- 手元 ---
  const localFile = path.join(PROJECT, ".dev.vars");
  const gitignore = path.join(PROJECT, ".gitignore");
  const ignoreContent = (await exists(gitignore)) ? await readFile(gitignore, "utf8") : "";
  if (!ignoreContent.split(/\r?\n/).includes(".dev.vars")) {
    await appendFile(gitignore, `${ignoreContent.endsWith("\n") ? "" : "\n"}.dev.vars\n`);
  }

  const current = (await exists(localFile)) ? await readFile(localFile, "utf8") : "";
  // 手元の署名用の値は、既にあるものを使い回す。作り直すと、
  // 開いていた画面のログインが全部切れる。
  const localSecret =
    current.match(/^BETTER_AUTH_SECRET=(.+)$/m)?.[1] || randomBytes(48).toString("base64url");
  await writeFile(
    localFile,
    setDotenvValues(current, {
      BETTER_AUTH_SECRET: localSecret,
      BETTER_AUTH_URL: LOCAL_ORIGIN,
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_CLIENT_SECRET: clientSecret,
      AUTH_ALLOWED_EMAILS: allowedEmails,
    }),
    { encoding: "utf8", mode: 0o600 },
  );
  await chmod(localFile, 0o600).catch(() => {});
  console.log("✓ 手元の設定を .dev.vars に書きました（この中身は git に入りません）。");

  if (LOCAL_ONLY) {
    console.log("完了しました。入力した値はどこにも表示していません。");
    return;
  }

  // --- Cloudflare ---
  runWrangler(["whoami"]);
  const listed = runWrangler(["secret", "list", "--env", TARGET_ENV, "--format", "json"], {
    capture: true,
  });
  if (!listed.includes("BETTER_AUTH_SECRET")) {
    // 本番の署名用の値は、人が見る必要が無いのでここで作って渡すだけにする。
    await putSecret("BETTER_AUTH_SECRET", randomBytes(48).toString("base64url"));
  }
  await putSecret("BETTER_AUTH_URL", ORIGINS[TARGET_ENV]);
  await putSecret("GOOGLE_CLIENT_ID", clientId);
  await putSecret("GOOGLE_CLIENT_SECRET", clientSecret);
  await putSecret("AUTH_ALLOWED_EMAILS", allowedEmails);

  console.log(`✓ ${TARGET_ENV} に登録しました。`);
  console.log("完了しました。入力した値はどこにも表示していません。");
  console.log("\n次にすること: サインイン画面を開いて「Google でログイン」を押してください。");
  console.log(`  ${ORIGINS[TARGET_ENV]}/signin`);
}

main().catch((error) => {
  console.error(`エラー: ${error.message}`);
  process.exitCode = 1;
});
