import { UI_COPY } from "../copy";
import styles from "./patterns.module.css";

/**
 * 事実と推測の区別。
 *
 * 仕様の中核。**根拠のない内容を黙って断定形で出さない。**
 * 画面ごとに書き方を変えると、ある画面だけ推測が事実に見える状態になる。
 * だからここ 1 箇所に閉じる。
 *
 * 色だけで区別しない。記号 + 文字を必ず添える
 * （色覚特性・白黒印刷・スクリーンリーダーのすべてで伝わるようにする）。
 */

export type Factuality = "fact" | "inference" | "opinion";

const MARK: Readonly<Record<Factuality, string>> = {
  fact: "✓",
  inference: "≈",
  opinion: "○",
};

const CLASS: Readonly<Record<Factuality, string>> = {
  fact: styles.factBadgeFact,
  inference: styles.factBadgeInference,
  opinion: styles.factBadgeOpinion,
};

const LABEL: Readonly<Record<Factuality, string>> = {
  fact: UI_COPY.factuality.fact,
  inference: UI_COPY.factuality.inference,
  opinion: UI_COPY.factuality.opinion,
};

const NOTE: Readonly<Record<Factuality, string>> = {
  fact: UI_COPY.factuality.factNote,
  inference: UI_COPY.factuality.inferenceNote,
  opinion: UI_COPY.factuality.opinionNote,
};

export function FactualityBadge({ kind }: { readonly kind: Factuality }) {
  return (
    <span className={[styles.factBadge, CLASS[kind]].join(" ")}>
      <span aria-hidden="true">{MARK[kind]}</span>
      {LABEL[kind]}
    </span>
  );
}

/**
 * 主張 1 件の表示。
 *
 * `kind` を必須にしてあるので、区別を書き忘れたままでは画面に出せない。
 * 「あとで付ける」ができない形にしておくのが唯一の担保。
 */
export function ClaimStatement({
  kind,
  statement,
  children,
}: {
  readonly kind: Factuality;
  readonly statement: string;
  /** 根拠の一覧（EvidenceList）を入れる。fact のときは省略しない。 */
  readonly children?: React.ReactNode;
}) {
  return (
    <div>
      <p className={styles.factNote}>
        <FactualityBadge kind={kind} /> {statement}
      </p>
      <p className={styles.factNote}>{NOTE[kind]}</p>
      {children}
    </div>
  );
}
