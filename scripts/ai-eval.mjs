/**
 * AI 評価セットの実行入口。
 *
 * **提供元へ問い合わせる部分は「作らない」と決めた**（2026-08-17・`ah-gzq`）。
 * **未実装ではなく、意図的な対象外である。** 生成された文章の良し悪しを機械で判定するには、
 * 結局 AI をもう一度呼ぶことになる。すると **判定する側が正しいかを確かめる手段が無いまま
 * 従量課金だけが発生する**。たたき台の段階では割に合わない。
 *
 * ここに残してあるのは見積りと費用の見張り（`ai-eval-budget.mjs`）だけで、
 * これは**将来この判断を覆すときの枠**として置いてある。
 * 順序の問題でもあり、問い合わせる仕組みを先に作ると上限が無いまま 1 回目が走る。
 * 費用が出てから上限を足す設計にはしない。
 *
 * **`--run` は 0 件で成功して終わらない。終了コード 1 で落ちる。**
 * 0 件・0 円で緑になると、押した人は「評価セットが通った」と受け取る。
 * 中身の無い緑は、赤よりたちが悪い（無いものが、あることになる）。
 *
 * ```
 * node scripts/ai-eval.mjs              見積りを出して終わる（終了コード 0）
 * node scripts/ai-eval.mjs --run        作らないと決めた旨を出して落ちる（終了コード 1）
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
  console.log("\n--run を付けても評価は走りません（下記のとおり、作らないと決めています）。");
  process.exit(0);
}

const guard = createBudgetGuard();
// 判断を覆すときは、ここに提供元への問い合わせを入れる。
// 1 件ごとに guard.spend() を**先に**呼ぶ（呼んでから使う、ではない）。
// いまは 1 件も回さない。
const spent = guard.spent();

console.log("\n実測（走らせた後）");
console.log(`  件数        ${spent.cases} 件`);
console.log(`  トークン    ${spent.tokens.toLocaleString()}`);
console.log(`  実費用      約 ${spent.yen} 円`);

if (spent.cases === 0) {
  console.error("\nNG 1 件も評価していません。**作らないと決めた**ためです（2026-08-17 / ah-gzq）。");
  console.error("理由: 文章の良し悪しを機械で判定するには AI をもう一度呼ぶことになり、");
  console.error("      判定する側が正しいかを確かめる手段が無いまま従量課金だけが発生します。");
  console.error("");
  console.error("**この結果をもって「評価セットが通った」と書かないこと。**");
  console.error("代わりに使えるもの: tests/evals/generation-eval-set.test.ts");
  console.error("  （AI を呼ばずに、評価ケースの定義が仕様項目を覆っているかだけを見る。無料）");
  console.error("");
  console.error("判断を覆すときは docs/product/traceability.md の REQ-CI13 を先に直してください。");
  process.exit(1);
}
