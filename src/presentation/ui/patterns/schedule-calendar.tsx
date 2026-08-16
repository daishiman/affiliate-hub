import type { ReactNode } from "react";
import styles from "./patterns.module.css";

/**
 * 予定カレンダー（月の枠に予定を並べる部品）。
 *
 * この部品が守っているのは 2 つ。
 *
 * 1. **カレンダーを表として読めるようにする。**
 *    `<table>` で組み、曜日を列の見出し、日付を行内の見出しにしている。
 *    div を並べた見た目だけのカレンダーは、読み上げでは
 *    「17 なんとか」という文字列の羅列になり、日付と予定の対応が失われる。
 *
 * 2. **その日に気をつけることを、色ではなく言葉で出す。**
 *    「同じ日に同じ先へ 3 件」のような偏りは、
 *    枠を赤くしただけでは何が問題か伝わらない。理由の文を必ず持たせる。
 *
 * 曜日の並びは日曜始まり。何曜日始まりかを画面ごとに変えると、
 * 同じ月を見ているのに違う位置に予定が出るため、ここで 1 つに決めている。
 */

export type ScheduleCalendarEntry = {
  readonly id: string;
  /** 1 行目に出る短い見出し（例: 媒体名）。 */
  readonly headline: string;
  /** 2 行目に出る補足（例: アカウント名と承認状態）。 */
  readonly detail: string;
  /** 手当てが要る理由。null なら通常の予定として出す。 */
  readonly attentionReason: string | null;
  readonly href: string;
};

export type ScheduleCalendarDay = {
  /** YYYY-MM-DD。 */
  readonly date: string;
  readonly dayOfMonth: number;
  /** 0=日曜。 */
  readonly weekday: number;
  readonly isToday: boolean;
  readonly entries: readonly ScheduleCalendarEntry[];
  readonly warnings: readonly string[];
};

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/** 月の日を、週ごとの行に分ける。1 週目の頭は空欄で埋める。 */
function toWeeks(days: readonly ScheduleCalendarDay[]): readonly (ScheduleCalendarDay | null)[][] {
  if (days.length === 0) return [];
  const weeks: (ScheduleCalendarDay | null)[][] = [];
  let week: (ScheduleCalendarDay | null)[] = Array.from({ length: days[0].weekday }, () => null);
  for (const day of days) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export function ScheduleCalendar({
  days,
  caption,
  renderLink,
}: {
  readonly days: readonly ScheduleCalendarDay[];
  /** 何の予定表かの説明。表の見出しとして読み上げられる。 */
  readonly caption: string;
  readonly renderLink: (href: string, label: string) => ReactNode;
}) {
  const weeks = toWeeks(days);

  return (
    <table className={styles.calendar}>
      <caption className={styles.calendarCaption}>{caption}</caption>
      <thead>
        <tr>
          {WEEKDAY_LABELS.map((label) => (
            <th key={label} scope="col" className={styles.calendarWeekday}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, index) => (
          // 週の並びは固定なので、index を鍵にしてよい（入れ替えが起きない）。
          <tr key={`week-${index}`}>
            {week.map((day, slot) =>
              day === null ? (
                <td key={`empty-${slot}`} className={styles.calendarEmpty} aria-hidden="true" />
              ) : (
                <td
                  key={day.date}
                  className={`${styles.calendarCell} ${
                    day.isToday ? styles.calendarCellToday : ""
                  }`.trim()}
                >
                  <p className={styles.calendarDate}>
                    {day.dayOfMonth}
                    {day.isToday ? <span className={styles.srOnly}>（本日）</span> : null}
                  </p>

                  {day.warnings.map((warning) => (
                    <p key={warning} className={styles.calendarWarning}>
                      {warning}
                    </p>
                  ))}

                  {day.entries.length === 0 ? (
                    <p className={styles.srOnly}>予定はありません</p>
                  ) : (
                    <ul className={styles.calendarEntries}>
                      {day.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className={`${styles.calendarEntry} ${
                            entry.attentionReason === null ? "" : styles.calendarEntryAttention
                          }`.trim()}
                        >
                          {renderLink(entry.href, entry.headline)}
                          <span className={styles.calendarEntryDetail}>{entry.detail}</span>
                          {entry.attentionReason === null ? null : (
                            <span className={styles.calendarEntryReason}>
                              {entry.attentionReason}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
