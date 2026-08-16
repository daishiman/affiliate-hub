import styles from "./patterns.module.css";

/**
 * 絞り込みの棚（切り口を選ぶ部品）。
 *
 * この部品が守っているのは 3 つ。
 *
 * 1. **選べない切り口を、選択肢が空のまま出さない。**
 *    「商品」で絞れないのに空の選び欄だけがあると、
 *    選んでも何も起きない欄を延々と触ることになる。
 *    選べない軸は、欄の代わりに理由を出す。
 *
 * 2. **いま何で絞っているかを、常に文で出す。**
 *    絞り込んだあとの数字は、絞ったことを忘れると必ず読み違える。
 *
 * 3. **JavaScript が動かなくても絞り込める。**
 *    素の `<form method="get">` にしてある。
 *    選んで「絞り込む」を押すと URL が変わるだけなので、
 *    その URL をそのまま共有すれば同じ条件を相手も見られる。
 */

export type FilterAxis = {
  readonly key: string;
  readonly label: string;
  /** その軸で何が分かるか。欄の下に出す。 */
  readonly whatItTells: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly selected: string | null;
  /** 選べない理由。null 以外なら欄を出さずこれを出す。 */
  readonly unavailableReason: string | null;
  /** 報酬の出どころに近い軸か。印を付けて注意を促す。 */
  readonly commercial: boolean;
};

export function FilterBar({
  axes,
  action,
  summary,
  legend,
  clearHref,
  keep,
  submitLabel = "絞り込む",
  clearLabel = "絞り込みを外す",
}: {
  readonly axes: readonly FilterAxis[];
  /** 送り先。空なら同じ画面へ。 */
  readonly action: string;
  /**
   * 絞り込みと関係なく持ち越す値（画面の別の切り替えなど）。
   * これが無いと、絞り込んだ瞬間に他の選択が初期値へ戻る。
   */
  readonly keep?: Readonly<Record<string, string>>;
  /** いま何で絞っているかの一文。絞っていなければ null。 */
  readonly summary: string | null;
  /** この絞り込みが何のためかの見出し。読み上げのために必須。 */
  readonly legend: string;
  readonly clearHref: string;
  readonly submitLabel?: string;
  readonly clearLabel?: string;
}) {
  const unavailable = axes.filter((a) => a.unavailableReason !== null);

  return (
    <form method="get" action={action} className={styles.filterBar}>
      {Object.entries(keep ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <fieldset className={styles.filterFields}>
        <legend className={styles.filterLegend}>{legend}</legend>

        {axes
          .filter((a) => a.unavailableReason === null)
          .map((axis) => (
            <label key={axis.key} className={styles.filterField}>
              <span className={styles.filterLabel}>
                {axis.label}
                {axis.commercial ? (
                  <span className={styles.filterCommercial}>（報酬に直結する切り口）</span>
                ) : null}
              </span>
              <select
                name={axis.key}
                defaultValue={axis.selected ?? ""}
                className={styles.filterSelect}
              >
                {/* 空欄は「絞らない」。「該当なし」ではない。 */}
                <option value="">すべて</option>
                {axis.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <span className={styles.filterHint}>{axis.whatItTells}</span>
            </label>
          ))}
      </fieldset>

      <div className={styles.filterActions}>
        <button type="submit" className={styles.filterSubmit}>
          {submitLabel}
        </button>
        {summary === null ? null : <a href={clearHref}>{clearLabel}</a>}
      </div>

      {summary === null ? (
        <p className={styles.filterSummary}>絞り込んでいません。全体の数字を出しています。</p>
      ) : (
        <p className={styles.filterSummary}>{summary}</p>
      )}

      {unavailable.length === 0 ? null : (
        <ul className={styles.filterUnavailable}>
          {unavailable.map((a) => (
            <li key={a.key}>
              {a.label}：{a.unavailableReason}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
