/**
 * 一覧の 1 行に添える絵。**管理面限定。読者面へ出さない。**
 *
 * ==========================================================================
 * なぜ管理面の側に置くのか
 * ==========================================================================
 *
 * 読者面のカード（`ui/patterns`）は、画像が無い記事にも必ず代替図版を出す。
 * 一覧の高さを揃えるためで、読者に「絵の無い記事」を見せない設計である。
 *
 * 管理面はその逆で、**絵がまだ無いことを見せる**のが仕事になる。
 * この画面の見出しは「次に手を入れる記事を決めます。」であり、
 * 実画像を持たない記事が一目で分かることが、そのまま次の作業になる。
 *
 * 同じ棚に置いて公開 export すると、読者面のページから読み込むのを
 * 妨げるものが無くなる。棚を分けて、その境界を機械的に保つ。
 */

import styles from "./article-thumbnail-cell.module.css";

export type ArticleThumbnailCellProps = {
  /** 実画像の URL。無い記事は `null`（代替図版はここでは描かない）。 */
  readonly url: string | null;
  /** 出どころの表示名（`THUMBNAIL_SOURCE_LABEL` の値）。 */
  readonly sourceLabel: string;
  /** 記事の題名。読み上げの説明に使う。 */
  readonly title: string;
};

export function ArticleThumbnailCell({ url, sourceLabel, title }: ArticleThumbnailCellProps) {
  if (url === null) {
    return (
      /*
        `aria-label` に題名を含めるのは、読み上げでは行の並びが失われ、
        「自動生成の代替図版」だけが連続して読まれるためである。
        どの記事の話なのかが分からないと、この欄は情報にならない。

        `role="img"` を付けるのは飾りではない。**素の `span` に `aria-label` は
        効かない**（読み上げは名前を持てない要素の名前を無視してよいことになって
        いて、axe も `aria-prohibited-attr` として止める）。役を宣言して初めて
        上の名前が読まれる。役を外すと、名前だけが残って**書いた側は書いた気に
        なり、聞く側には何も届かない**状態になる。
      */
      <span
        role="img"
        className={`${styles.frame} ${styles.placeholder}`}
        aria-label={`${title}：${sourceLabel}`}
      >
        <span aria-hidden="true">{sourceLabel}</span>
      </span>
    );
  }
  return (
    <span className={styles.frame}>
      {/*
        `next/image` を使わない。ここに来る URL は運用者が入れた外部を含み、
        許可ドメインの表を管理面のために増やし続けることになる。
        管理面の一覧は `--layout-thumbnail-width` の幅で、最適化して得られる分より
        「許可漏れで絵が出ない」ほうが運用上の害が大きい。
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={url} alt={`${title}（${sourceLabel}）`} loading="lazy" />
    </span>
  );
}
