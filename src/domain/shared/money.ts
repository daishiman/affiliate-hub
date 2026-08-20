import { type DomainError, validationError } from "./errors";
import { type Result, err, ok } from "./result";

/**
 * 金額。
 *
 * 小数で持つと丸め誤差が出るため最小単位の整数で持つ (日本円は 1 円)。
 * 「価格が不明」は 0 円ではなく null で表す。仕様 (ブログ層 §17.3) が
 * 「価格不明時は『価格を確認』と表示する」と定めており、0 円と混同すると
 * 誤表示になる。
 */
export type CurrencyCode = "JPY" | "USD";

/*
 * ここに「既定の通貨」を 1 つ置きたくなるが、置かない。
 *
 * 素の字の `"JPY"` は 3 箇所に在り、最初はまとめて `DEFAULT_CURRENCY` にした。
 * 数え直すと**同じ値の理由が 2 種類**だった: 編集部の価格表示の基準
 * (`DEFAULT_WORKSPACE_CURRENCY`) と、通貨未確定の成果を直す欄の当座の置き
 * (`DEFAULT_REWARD_CURRENCY`)。片方が動く日に、もう片方まで動いてしまう。
 * **「同じ値が複数箇所にある」は、名前を付ける合図であって、1 つにまとめる合図ではない。**
 */

export type Money = {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
};

const MINOR_UNIT: Record<CurrencyCode, number> = { JPY: 0, USD: 2 };

export function money(amountMinor: number, currency: CurrencyCode): Result<Money, DomainError> {
  if (!Number.isInteger(amountMinor)) {
    return err(validationError("金額は最小単位の整数で指定してください。", "amountMinor"));
  }
  if (amountMinor < 0) {
    return err(validationError("金額に負の数は指定できません。", "amountMinor"));
  }
  return ok({ amountMinor, currency });
}

export function jpy(yen: number): Result<Money, DomainError> {
  return money(yen, "JPY");
}

/** 表示用文字列。通貨と桁区切りを 1 箇所に閉じる。 */
export function formatMoney(m: Money, locale = "ja-JP"): string {
  const digits = MINOR_UNIT[m.currency];
  const value = m.amountMinor / 10 ** digits;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
    maximumFractionDigits: digits,
  }).format(value);
}

/** 通貨が違う金額は比較しない。混ざったら失敗にする。 */
export function compareMoney(a: Money, b: Money): Result<number, DomainError> {
  if (a.currency !== b.currency) {
    return err(validationError("通貨が異なる金額は比較できません。", "currency"));
  }
  return ok(a.amountMinor - b.amountMinor);
}
