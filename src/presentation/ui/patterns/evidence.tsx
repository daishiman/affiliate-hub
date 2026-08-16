import { UI_COPY, fill } from "../copy";
import { Callout } from "../primitives/callout";
import styles from "./patterns.module.css";

/**
 * 根拠（Evidence）と由来（Provenance）の表示。
 *
 * 「どこから、いつ取った情報か」を出すのが仕様の要求。
 * 出典が無いときに黙らないことが重要で、
 * **空配列を渡したら理由が出る**ようにしてある（無言の空白を作らない）。
 */

export type EvidenceView = {
  readonly id: string;
  /** 出典の名前。例:「メーカー公式仕様」「自社検証 2026-03」 */
  readonly sourceLabel: string;
  /** 出典 URL。自社検証など URL が無い根拠もあるので任意。 */
  readonly url?: string;
  /** いつ確認したか。表示は年月日まで。 */
  readonly checkedAt: string;
  /** 有効期限切れ。価格や在庫は古くなる。 */
  readonly expired?: boolean;
};

export function EvidenceList({
  items,
  emptyAction,
}: {
  readonly items: readonly EvidenceView[];
  /** 根拠を登録する画面への導線。 */
  readonly emptyAction?: React.ReactNode;
}) {
  if (items.length === 0) {
    return (
      <Callout
        tone="warn"
        title={UI_COPY.evidence.noEvidenceTitle}
        reason={UI_COPY.evidence.noEvidenceBody}
        action={emptyAction}
      />
    );
  }

  return (
    <ul className={styles.evidenceList}>
      {items.map((item) => (
        <li key={item.id} className={styles.evidenceItem}>
          <span>
            {UI_COPY.evidence.sourceLabel}:{" "}
            {item.url === undefined ? (
              item.sourceLabel
            ) : (
              // 出典は広告ではないので rel="sponsored" を付けない。
              // 付けると「広告リンク」と誤って伝わる。
              <a href={item.url} rel="noopener noreferrer nofollow" target="_blank">
                {item.sourceLabel}
              </a>
            )}
          </span>
          <span className={styles.evidenceMeta}>
            <span>
              {UI_COPY.evidence.checkedAt}: {item.checkedAt}
            </span>
            {item.expired === true && <span>{UI_COPY.evidence.expired}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * 由来の 1 行表示。表のセルなど、狭い場所で使う。
 * 「2026-03-01 時点」のように、いつの情報かを必ず添える。
 */
export function ProvenanceNote({ checkedAt }: { readonly checkedAt: string }) {
  return (
    <span className={styles.evidenceMeta}>
      {fill("{checkedAt} 時点", { checkedAt })}
    </span>
  );
}
