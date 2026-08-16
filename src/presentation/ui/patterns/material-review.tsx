import { Callout } from "../primitives/callout";
import styles from "./patterns.module.css";

/**
 * 取り込んだ文章を、指示として読ませようとしていないか確かめる欄。
 *
 * 仕様に直結する見せ方なので、画面ごとに書き起こさずここに置く。
 * 見せ方の要点は 2 つ。
 *   1. 引っかかった箇所を**消さずに見せる**。消して通すと、
 *      仕掛けられたこと自体が誰にも見えなくなる。
 *   2. 引っかかった文章は、そのまま読ませる形にしない。
 *      前後だけを短く出し、何を狙った書き方かを言葉で添える。
 *
 * 送信は普通のフォーム（GET）。JavaScript が動かない環境でも確かめられる。
 */
export type MaterialFinding = {
  readonly patternId: string;
  readonly whatItTries: string;
  readonly excerpt: string;
};

export function MaterialReview({
  action,
  fieldName,
  value,
  accepted,
  heldReason,
  findings,
  whatHappensNext,
}: {
  readonly action: string;
  readonly fieldName: string;
  readonly value: string;
  /** まだ何も入力していないときは null。 */
  readonly accepted: boolean | null;
  readonly heldReason: string | null;
  readonly findings: readonly MaterialFinding[];
  readonly whatHappensNext: string | null;
}) {
  return (
    <div className={styles.materialForm}>
      <form method="get" action={action}>
        <label className={styles.materialLabel} htmlFor="material-review-text">
          取り込んだ文章を貼り付けて確かめる
        </label>
        <textarea
          id="material-review-text"
          name={fieldName}
          rows={6}
          defaultValue={value}
          className={styles.materialInput}
          aria-describedby="material-review-hint"
        />
        <p className={styles.materialHint} id="material-review-hint">
          商品の説明文や他所から取った文章を貼ってください。ここで確かめた文章は資料として扱い、指示としては読ませません。
        </p>
        <button type="submit" className={styles.filterSubmit}>
          確かめる
        </button>
      </form>

      {accepted === null ? null : accepted ? (
        <Callout
          tone="info"
          title="指示として読ませようとする書き方は見つかりませんでした"
          reason={whatHappensNext ?? ""}
        />
      ) : (
        <>
          <Callout tone="warn" title="担当者の確認へ回します" reason={heldReason ?? ""} />
          <ul className={styles.findingList}>
            {findings.map((f) => (
              <li key={f.patternId} className={styles.findingItem}>
                <span className={styles.findingWhat}>{f.whatItTries}</span>
                <span className={styles.findingExcerpt}>{f.excerpt}</span>
              </li>
            ))}
          </ul>
          <p className={styles.materialHint}>{whatHappensNext}</p>
        </>
      )}
    </div>
  );
}
