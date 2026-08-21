#!/usr/bin/env node
/**
 * モデルの目録の正本（`config/llm-provider-catalog.json`）を
 * `wrangler.jsonc` の `vars` 3 か所へ写す。
 *
 * --- なぜ写しが 3 つ要るのか ---
 * Wrangler v4 は**トップレベルの `vars` を `env` へ継承しない**。
 * 書かなければその環境から消えるだけで、エラーにはならない。
 * 消えた環境では画面が「選べるモデルがありません」に戻るが、
 * それは設定を入れていないときと**同じ見た目**なので、気づく手がかりが無い。
 *
 * --- なぜ手で貼らないのか ---
 * 貼る先が 3 つある以上、必ずどれか 1 つが古くなる。
 * しかも古くなるのは値上げの直後で、そのとき差が出るのは
 * 「見積りだけ安い環境が 1 つある」という形になる。画面は普通に描ける。
 *
 * ```
 * pnpm run catalog:sync           写して、変わったかどうかを表示する
 * pnpm run catalog:sync --check   写さない。食い違っていたら 1 で終わる
 * ```
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SOURCE = join(ROOT, "config/llm-provider-catalog.json");
const TARGET = join(ROOT, "wrangler.jsonc");
const KEY = "LLM_PROVIDER_CATALOG";
/** 写しが要る場所の数。トップレベル + env.dev + env.production。 */
const EXPECTED_COPIES = 3;

const checkOnly = process.argv.includes("--check");

// 正本は JSON として読み直してから 1 行にする。
// ファイルの中身をそのまま貼ると、整形（空白・改行）の違いだけで
// 「食い違っている」と出る。見ているのは中身であって書き方ではない。
const catalog = JSON.parse(readFileSync(SOURCE, "utf8"));
const wanted = JSON.stringify(JSON.stringify(catalog));

const before = readFileSync(TARGET, "utf8");

/*
  `"LLM_PROVIDER_CATALOG": "…"` の値だけを差し替える。
  JSON として読み書きすると、この設定ファイルの**注釈が全部消える**。
  注釈はここでは説明の正本なので、消すわけにはいかない。
*/
const pattern = new RegExp(`("${KEY}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`, "g");
const found = before.match(pattern) ?? [];
if (found.length !== EXPECTED_COPIES) {
  process.stderr.write(
    `NG ${KEY} の置き場が ${found.length} か所しかありません（${EXPECTED_COPIES} か所必要）。\n` +
      "トップレベル・env.dev・env.production の 3 か所に置いてください。\n" +
      "Wrangler v4 はトップレベルの vars を env へ継承しないため、\n" +
      "書き忘れた環境では黙って目録が空になります。\n",
  );
  process.exit(1);
}

const after = before.replace(pattern, (_m, head) => `${head}${wanted}`);
const stale = found.filter((line) => !line.endsWith(wanted)).length;

if (checkOnly) {
  if (stale > 0) {
    process.stderr.write(
      `NG ${stale} か所が正本と食い違っています。\n` + "`pnpm run catalog:sync` を走らせてください。\n",
    );
    process.exit(1);
  }
  process.stdout.write(`OK ${EXPECTED_COPIES} か所とも正本と同じです。\n`);
  process.exit(0);
}

if (after === before) {
  process.stdout.write(`OK ${EXPECTED_COPIES} か所とも既に正本と同じでした（変更なし）。\n`);
  process.exit(0);
}
writeFileSync(TARGET, after);
process.stdout.write(`OK ${stale} か所を正本の内容へ書き換えました。\n`);
