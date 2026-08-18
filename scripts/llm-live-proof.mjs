/**
 * **実際の鍵で 1 度でも呼んだ提供元**を、本物の D1 から数えて記録する。
 *
 * なぜ要るか:
 *   偽の応答での検査が緑になっても、それは「呼び出しの形が合っている」までで、
 *   「つながった」ではない。この 2 つを同じ言葉で扱うと、鍵を 1 度も使わないまま
 *   「4 社に対応済み」と読める状態ができる。
 *
 *   スタブ台帳は「呼ぶと必ず失敗を返すもの」を数える場所なので、
 *   実装が入った時点で件数が減る（減ってよい）。だが**残っている仕事**は減っていない。
 *   その減らない側を数えるのがこのファイルである。
 *
 * 数え方:
 *   `llm_usages` に **成功した下書き（`purpose = 'draft'`, `succeeded = 1`）** の行が
 *   1 件でもある提供元を「呼んだことがある」とする。確認や失敗は数えない
 *   （確認は鍵の生死しか見ておらず、下書きが 1 本出たことにはならない）。
 *
 * ```
 * node scripts/llm-live-proof.mjs --stage D      dev の D1 から作り直す
 * node scripts/llm-live-proof.mjs --stage P      本番の D1 から作り直す
 * node scripts/llm-live-proof.mjs --check        いまの記録と D1 が一致するか見る
 * ```
 *
 * **この記録の限界（正直に書く）**:
 *   出力は JSON ファイルなので、手で書けば数字は動かせる。防いでいるのは
 *   「うっかり減る」ことであって、「意図して偽る」ことではない。
 *   ただし証拠の欄（`lu_` で始まる記録の識別子）を埋める必要があるため、
 *   偽るには実在しない識別子を書くことになり、`--check` で必ず露見する。
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROOF_PATH = join(process.cwd(), "docs/product/llm-live-proof.json");

/** 鍵を預けて呼ぶ提供元。Workers AI は鍵ではなく結び付けで呼ぶので入らない。 */
const KEYED_PROVIDERS = ["anthropic", "google", "openai", "xai"];

const SQL =
  "SELECT provider_id, model_id, id, occurred_at FROM llm_usages " +
  "WHERE purpose = 'draft' AND succeeded = 1 ORDER BY occurred_at ASC";

const args = process.argv.slice(2);
const stage = args.includes("--stage") ? args[args.indexOf("--stage") + 1] : null;
const checkOnly = args.includes("--check");

if (!checkOnly && stage !== "D" && stage !== "P") {
  console.error("段を指定してください: --stage D（dev）または --stage P（本番）");
  process.exit(2);
}

function queryD1(which) {
  // 本物の D1 を読む。手元の SQLite（L）は数えない。
  // L は自分で行を入れられるので、「呼んだ」の証拠にならない。
  const out = execFileSync(
    "pnpm",
    [
      "exec",
      "wrangler",
      "d1",
      "execute",
      "affiliate-hub-db-dev",
      "--remote",
      "--json",
      "--command",
      SQL,
      ...(which === "P" ? ["--env", "production"] : []),
    ],
    { encoding: "utf8" },
  );
  const parsed = JSON.parse(out);
  const rows = parsed?.[0]?.results ?? parsed?.result?.[0]?.results ?? [];
  return rows;
}

function buildProof(rows, which) {
  /** @type {Record<string, unknown>} */
  const proven = {};
  for (const row of rows) {
    const id = String(row.provider_id);
    if (!KEYED_PROVIDERS.includes(id)) continue;
    if (proven[id]) continue; // 最初の 1 件だけを証拠にする
    proven[id] = {
      usageId: String(row.id),
      modelId: String(row.model_id),
      occurredAt: Number(row.occurred_at),
      stage: which,
    };
  }
  return {
    生成のしかた: "scripts/llm-live-proof.mjs が本物の D1 から作る。手で書かない。",
    数え方: "llm_usages に purpose='draft' かつ succeeded=1 の行がある提供元だけを数える",
    確認した段: which,
    確認日: new Date().toISOString().slice(0, 10),
    証拠: proven,
  };
}

function readProof() {
  try {
    return JSON.parse(readFileSync(PROOF_PATH, "utf8"));
  } catch {
    return null;
  }
}

if (checkOnly) {
  const current = readProof();
  if (current === null) {
    console.error(`NG ${PROOF_PATH} が読めません。`);
    process.exit(1);
  }
  const which = current.確認した段;
  if (which !== "D" && which !== "P") {
    // まだ 1 度も確かめていない状態。ここは赤にしない（事実として正しいため）。
    console.log("実際の鍵で呼んだ提供元はまだ 0 社です（確認した段が未設定）。");
    process.exit(0);
  }
  const fresh = buildProof(queryD1(which), which);
  const before = Object.keys(current.証拠 ?? {}).sort();
  const after = Object.keys(fresh.証拠 ?? {}).sort();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    console.error(`NG 記録と D1 が食い違います。記録: ${before.join(",")} / D1: ${after.join(",")}`);
    process.exit(1);
  }
  console.log(`OK 実際の鍵で呼んだ提供元 ${after.length} / ${KEYED_PROVIDERS.length} 社。`);
  process.exit(0);
}

const proof = buildProof(queryD1(stage), stage);
writeFileSync(PROOF_PATH, `${JSON.stringify(proof, null, 2)}\n`, "utf8");
const count = Object.keys(proof.証拠).length;
console.log(`OK ${PROOF_PATH} を更新しました。`);
console.log(`  実際の鍵で呼んだ提供元      ${count} / ${KEYED_PROVIDERS.length}`);
console.log(`  1 度も呼んでいない提供元    ${KEYED_PROVIDERS.length - count}`);
console.log("スタブ台帳を作り直してください: UPDATE_STUB_LEDGER=1 pnpm vitest run tests/infrastructure/stub-ledger.test.ts");
