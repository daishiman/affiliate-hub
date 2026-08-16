/**
 * 時刻の取得口。
 *
 * ドメイン層で `new Date()` を直接呼ぶと、価格の有効期限・主張の有効期限・
 * 次回確認日といった「時間で結果が変わる判定」がテストできなくなる。
 * 現在時刻は必ず外から渡す。
 */
export type Clock = {
  now(): Date;
};

export const systemClock: Clock = {
  now: () => new Date(),
};

/** テスト用。時刻を固定する。 */
export function fixedClock(at: Date): Clock {
  return { now: () => new Date(at.getTime()) };
}
