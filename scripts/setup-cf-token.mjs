#!/usr/bin/env node
/**
 * デプロイ用の Cloudflare API トークンを「必要最小の権限で」自動発行し、
 * そのまま GitHub Secrets (CLOUDFLARE_API_TOKEN) に登録する。
 *
 * 使い方 (どれか 1 つ):
 *   pnpm setup:cf-token                      # 対話 (TTY のあるターミナルで)
 *   pnpm setup:cf-token < .cf-credentials    # 1 行目にメール、2 行目に Global API Key
 *   CLOUDFLARE_EMAIL=... CLOUDFLARE_API_KEY=... pnpm setup:cf-token
 *
 * .cf-credentials は .gitignore 済み。使い終わったら消すこと。
 *
 * 必要なもの: Cloudflare の Global API Key (ダッシュボード → My Profile → API Tokens)
 * ※ wrangler の OAuth トークンでは発行できない。OAuth のスコープに
 *   「API トークンの管理」が存在しないため (GET /user/tokens が 403 / code 9109)。
 *
 * 発行したトークンの値は標準出力にも会話ログにも出さず、gh へ直接渡す。
 */
import { execFileSync } from "node:child_process";

const API = "https://api.cloudflare.com/client/v4";

// 失敗時にスタックトレースではなく理由だけ出す
for (const ev of ["uncaughtException", "unhandledRejection"]) {
  process.on(ev, (e) => {
    console.error(`\n❌ ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  });
}

// このプロジェクトのデプロイに必要な権限だけ。増やさないこと。
// - Workers Scripts: Worker 本体のデプロイ
// - Workers R2 Storage: R2 バインディング
// - D1: マイグレーション適用
// - Account Settings Read: wrangler がアカウントを解決するのに使う
const WANTED = [
  "Workers Scripts Write",
  "Workers R2 Storage Write",
  "D1 Write",
  "Account Settings Read",
];

function prompt(question, { mute = false } = {}) {
  return new Promise((resolve) => {
    const ETX = String.fromCharCode(3);   // Ctrl-C
    const DEL = String.fromCharCode(127); // Backspace
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setEncoding("utf8");
    // Global API Key はエコーさせない
    if (mute && stdin.isTTY) stdin.setRawMode(true);

    let buf = "";
    const finish = () => {
      if (mute && stdin.isTTY) stdin.setRawMode(false);
      stdin.removeListener("data", onData);
      stdin.removeListener("end", finish);
      stdin.pause();
      process.stdout.write("\n");
      resolve(buf.trim());
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\n" || ch === "\r") return finish();
        if (ch === ETX) process.exit(130);
        if (ch === DEL || ch === "\b") { buf = buf.slice(0, -1); continue; }
        buf += ch;
      }
    };
    stdin.on("data", onData);
    // stdin が閉じた場合も必ず解決させる。放置すると
    // top-level await が宙に浮いて Node が exit 13 で落ちる。
    stdin.on("end", finish);
  });
}

/** メールと Global API Key を、環境変数 → パイプ入力 → 対話 の順で取得する */
async function readCredentials() {
  if (process.env.CLOUDFLARE_EMAIL && process.env.CLOUDFLARE_API_KEY) {
    return { email: process.env.CLOUDFLARE_EMAIL, globalKey: process.env.CLOUDFLARE_API_KEY };
  }

  // TTY が無い (パイプ / リダイレクト / CI) 場合は 2 行まとめて読む
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const lines = Buffer.concat(chunks).toString("utf8").split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      throw new Error(
        "TTY が無い環境では対話入力ができません。次のどちらかで渡してください:\n" +
          "  1) 1 行目にメール / 2 行目に Global API Key を書いたファイルを作り\n" +
          "       pnpm setup:cf-token < .cf-credentials\n" +
          "  2) CLOUDFLARE_EMAIL / CLOUDFLARE_API_KEY を環境変数で渡す",
      );
    }
    return { email: lines[0], globalKey: lines[1] };
  }

  const email = process.env.CLOUDFLARE_EMAIL || (await prompt("Cloudflare のメールアドレス: "));
  const globalKey =
    process.env.CLOUDFLARE_API_KEY || (await prompt("Global API Key (入力は表示されません): ", { mute: true }));
  return { email, globalKey };
}

async function cf(path, { auth, method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...auth, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.success) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

const { email, globalKey } = await readCredentials();
const auth = { "x-auth-email": email, "x-auth-key": globalKey };

// 1. アカウント ID
const accounts = await cf("/accounts", { auth });
if (accounts.length === 0) throw new Error("アカウントが見つからない");
const account = accounts.length === 1 ? accounts[0] : accounts.find((a) => a.id === process.env.CLOUDFLARE_ACCOUNT_ID);
if (!account) {
  throw new Error(
    `アカウントが複数あります。CLOUDFLARE_ACCOUNT_ID を指定してください:\n` +
      accounts.map((a) => `  ${a.id}  ${a.name}`).join("\n"),
  );
}
console.log(`アカウント: ${account.name} (${account.id})`);

// 2. 権限グループを名前で引く。ID をハードコードすると Cloudflare 側の変更で壊れる。
const groups = await cf("/user/tokens/permission_groups", { auth });
const permissions = WANTED.map((name) => {
  const g = groups.find((x) => x.name === name && x.scopes?.includes("com.cloudflare.api.account"));
  if (!g) throw new Error(`権限グループ "${name}" が見つからない`);
  return { id: g.id, name: g.name };
});
console.log("付与する権限:\n" + permissions.map((p) => `  - ${p.name}`).join("\n"));

// 3. トークン発行。resources をこのアカウントだけに絞る
//    (全アカウント許可だと、漏れたときに他プロジェクトの Worker まで巻き込む)
const token = await cf("/user/tokens", {
  auth,
  method: "POST",
  body: {
    name: `affiliate-hub-deploy-${account.id.slice(0, 6)}`,
    policies: [
      {
        effect: "allow",
        resources: { [`com.cloudflare.api.account.${account.id}`]: "*" },
        permission_groups: permissions,
      },
    ],
  },
});

// 4. 発行直後に自己検証。壊れたトークンを Secrets に入れない
const verify = await fetch(`${API}/user/tokens/verify`, {
  headers: { authorization: `Bearer ${token.value}` },
}).then((r) => r.json());
if (verify.result?.status !== "active") {
  throw new Error(`検証に失敗: ${JSON.stringify(verify.errors ?? verify.result)}`);
}
console.log(`トークン発行 OK (id: ${token.id})`);

// 5. GitHub Secrets へ。値は stdin 経由で渡し、シェル履歴にも残さない
execFileSync("gh", ["secret", "set", "CLOUDFLARE_API_TOKEN"], { input: token.value, stdio: ["pipe", "inherit", "inherit"] });
execFileSync("gh", ["secret", "set", "CLOUDFLARE_ACCOUNT_ID"], { input: account.id, stdio: ["pipe", "inherit", "inherit"] });
console.log("\n✅ CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID を GitHub Secrets に登録しました");
console.log("   トークンの値はどこにも出力していません。再取得はできないので、必要なら再実行してください。");
