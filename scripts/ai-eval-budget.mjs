/**
 * AI 評価セットの費用の見張り。
 *
 * **このリポジトリで従量課金が発生するのはここだけ**である。
 * GitHub Actions の標準ランナーは public リポジトリでは無料・無制限なので、
 * 「実行時間を減らすためにテストを外す」判断は要らない。
 * 減らす必要があるのは、提供元へ問い合わせる回数だけである。
 *
 * 上限の効かせ方は 1 つだけ: **途中で止まる**。
 * 走り終えてから「超えました」と言う作りにすると、
 * 上限は費用を防がず、費用を後から知らせるだけのものになる。
 *
 * 規範: docs/spec/11-CI-CD・品質ゲート仕様.md §8-4
 */

import { AI_EVAL_BUDGET } from "../quality-gates.config.mjs";

/**
 * 1,000 トークンあたりの単価（円）。
 *
 * **実勢ではなく、見積りを出すための置き値**である。実費用は提供元の
 * 明細が正で、この値で置き換えない。ここにあるのは
 * 「走らせる前に桁を知る」ためだけの数字。
 */
export const YEN_PER_1K_TOKENS = 2.4;

/**
 * 見積り費用。走らせる**前**に出す。
 *
 * @param {number} cases 件数
 * @param {number} tokensPerCase 1 件あたりの入出力トークン
 * @returns {{ cases: number, tokens: number, yen: number }}
 */
export function estimate(cases, tokensPerCase) {
  const tokens = cases * tokensPerCase;
  return { cases, tokens, yen: Math.round((tokens / 1000) * YEN_PER_1K_TOKENS * 100) / 100 };
}

/** 上限に当たったときに投げる。呼び出し側が握り潰さないよう、専用の型にする。 */
export class BudgetExceeded extends Error {
  /**
   * @param {string} message
   * @param {{ cases: number, tokens: number }} spent
   */
  constructor(message, spent) {
    super(message);
    this.name = "BudgetExceeded";
    this.spent = spent;
  }
}

/**
 * 上限の見張り。1 件ごとに `spend()` を呼び、超えた時点で例外を投げる。
 *
 * @param {{ maxCases?: number, maxTokens?: number }} [limits]
 */
export function createBudgetGuard(limits = {}) {
  const maxCases = limits.maxCases ?? AI_EVAL_BUDGET.maxCases;
  const maxTokens = limits.maxTokens ?? AI_EVAL_BUDGET.maxTokens;
  let cases = 0;
  let tokens = 0;

  return {
    /**
     * 1 件分を計上する。**問い合わせの前に呼ぶ**。
     * 後に呼ぶと、上限を超える 1 件分の費用は既に発生している。
     *
     * @param {number} tokensForCase この 1 件で使う見込みのトークン
     */
    spend(tokensForCase) {
      const nextCases = cases + 1;
      const nextTokens = tokens + tokensForCase;
      if (nextCases > maxCases) {
        throw new BudgetExceeded(
          `件数の上限 ${maxCases} 件に達したため、${nextCases} 件目の手前で止めました`,
          { cases, tokens },
        );
      }
      if (nextTokens > maxTokens) {
        throw new BudgetExceeded(
          `トークンの上限 ${maxTokens} に達したため、${nextCases} 件目の手前で止めました（ここまで ${tokens}）`,
          { cases, tokens },
        );
      }
      cases = nextCases;
      tokens = nextTokens;
      return { cases, tokens };
    },
    /** ここまでの実測。見積りではなく、実際に計上した分だけを返す。 */
    spent() {
      return { cases, tokens, yen: Math.round((tokens / 1000) * YEN_PER_1K_TOKENS * 100) / 100 };
    },
    limits: { maxCases, maxTokens },
  };
}
