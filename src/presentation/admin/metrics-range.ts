/**
 * 集計画面が見る期間を決める。
 *
 * --- 既定を「直近 28 日」にした理由 ---
 * 7 日だと曜日の癖がそのまま形に出て、30 日だと月の切れ目で本数が変わる。
 * 28 日は 4 週ちょうどなので、どの日に開いても曜日の内訳が同じになり、
 * 前の期間と並べて比べられる。
 *
 * --- 未来の日付を切らない ---
 * `to` に未来を渡すと、まだ集計されていない日が 0 として並び、
 * 「急に落ちた」ように見える。ここで今日までに丸める。
 */

/** `YYYY-MM-DD`。UTC で切る（集計側と同じ切り方にする）。 */
export function toDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_SPAN_DAYS = 28;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type MetricsRangeChoice = {
  readonly from: string;
  readonly to: string;
  /** 利用者が指定した値を使えず既定へ戻したとき、その理由。 */
  readonly fallbackReason: string | null;
};

/**
 * 画面の検索文字列から期間を決める。
 *
 * 壊れた値は失敗にせず既定へ戻し、戻したことを画面に出させる。
 * ここで例外にすると、URL を手で書き換えただけで画面が開かなくなる。
 */
export function chooseMetricsRange(
  params: { readonly from?: string; readonly to?: string },
  now: Date = new Date(),
): MetricsRangeChoice {
  const today = toDay(now);
  const defaults = {
    from: toDay(new Date(now.getTime() - (DEFAULT_SPAN_DAYS - 1) * DAY_MS)),
    to: today,
    fallbackReason: null,
  } as const;

  const from = params.from ?? "";
  const to = params.to ?? "";
  if (from === "" && to === "") return defaults;

  if (!DAY_PATTERN.test(from) || !DAY_PATTERN.test(to)) {
    return { ...defaults, fallbackReason: "期間の指定が日付の形（YYYY-MM-DD）ではありませんでした。" };
  }
  if (from > to) {
    return { ...defaults, fallbackReason: "期間の始まりと終わりが逆でした。" };
  }
  if (to > today) {
    return {
      from,
      to: today,
      fallbackReason: "終わりに未来の日付が入っていたため、今日までにしました。",
    };
  }
  return { from, to, fallbackReason: null };
}
