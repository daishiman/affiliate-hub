/**
 * AI 評価セットの実行入口。
 *
 * **現況: 提供元へ問い合わせる部分は未実装**（残課題 `ah-gzq`）。
 * いまここにあるのは、見積りの提示と費用の見張り（`ai-eval-budget.mjs`）だけで、
 * 実行すると 0 件・0 円で終わる。**「評価を回した」とは言えない状態**である。
 *
 * 先に見張りだけ作ってあるのは順序の問題で、
 * 問い合わせる仕組みを先に作ると、上限が無いまま 1 回目が走る。
 * 費用が出てから上限を足す設計にはしない。
 *
 * ```
 * node scripts/ai-eval.mjs              見積りを出して終わる
 * node scripts/ai-eval.mjs --run        実行（未実装なので、その旨を出して 0 件で終わる）
 * ```
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §8-4
 */

import { AI_EVAL_BUDGET } from "../quality-gates.config.mjs";
import { createBudgetGuard, estimate } from "./ai-eval-budget.mjs";

const TOKENS_PER_CASE = Math.floor(AI_EVAL_BUDGET.maxTokens / AI_EVAL_BUDGET.maxCases);
const wantRun = process.argv.includes("--run");

const before = estimate(AI_EVAL_BUDGET.maxCases, TOKENS_PER_CASE);
console.log("AI 評価セットの見積り（走らせる前）");
console.log(`  件数        ${before.cases} 件（上限 ${AI_EVAL_BUDGET.maxCases}）`);
console.log(`  トークン    ${before.tokens.toLocaleString()}（上限 ${AI_EVAL_BUDGET.maxTokens.toLocaleString()}）`);
console.log(`  概算費用    約 ${before.yen} 円（置き値での概算。実費用は提供元の明細が正）`);

if (!wantRun) {
  console.log("\n--run を付けると実行します（現況では 0 件で終わります）。");
  process.exit(0);
}

const guard = createBudgetGuard();
// ここに提供元への問い合わせが入る。1 件ごとに guard.spend() を**先に**呼ぶ。
// 未実装なので 1 件も回さない。
const spent = guard.spent();

console.log("\n実測（走らせた後）");
console.log(`  件数        ${spent.cases} 件`);
console.log(`  トークン    ${spent.tokens.toLocaleString()}`);
console.log(`  実費用      約 ${spent.yen} 円`);

if (spent.cases === 0) {
  console.log("\n未実装のため 1 件も評価していません（残課題 ah-gzq）。");
  console.log("**この結果をもって「評価セットが通った」と書かないこと。**");
}
