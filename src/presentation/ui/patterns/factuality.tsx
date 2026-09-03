import { UI_COPY } from "../copy";
import { Icon, type IconName } from "../primitives/icon";
import styles from "./patterns.module.css";

/**
 * 事実と推測の区別。
 *
 * 仕様の中核。**根拠のない内容を黙って断定形で出さない。**
 * 画面ごとに書き方を変えると、ある画面だけ推測が事実に見える状態になる。
 * だからここ 1 箇所に閉じる。
 *
 * 色だけで区別しない。アイコン + 文字を必ず添える
 * （色覚特性・白黒印刷・スクリーンリーダーのすべてで伝わるようにする）。
 */

export type Factuality = "fact" | "inference" | "opinion";

const ICON: Readonly<Record<Factuality, IconName>> = {
  fact: "fact",
  inference: "inference",
  opinion: "opinion",
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
      <Icon name={ICON[kind]} />
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

/**
 * 事実の出どころ 6 種類。
 *
 * 「根拠あり」で一括りにすると、メーカーの公表値と当サイトの実測が
 * 同じ見た目で並ぶ。読者はそこを区別できない。
 *
 * 並びは domain の ClaimType と同じ。ここで型を持ち直しているのは、
 * 共通UIが業務のきまりを読まない決まりにしているため
 * （ずれていないことは `tests/ui/fact-source.test.ts` が見ている）。
 */
export type FactSource =
  | "official"
  | "measured"
  | "experience"
  | "inference"
  | "external"
  | "commercial";

export const FACT_SOURCES: readonly FactSource[] = [
  "official",
  "measured",
  "experience",
  "inference",
  "external",
  "commercial",
];

/** 出どころごとのアイコン。色だけで区別しないため、必ず文字も添える。 */
const SOURCE_ICON: Readonly<Record<FactSource, IconName>> = {
  official: "official",
  measured: "measured",
  experience: "experience",
  inference: "inference",
  external: "external",
  commercial: "commercial",
};

/** 断定してよいか。断定できないものは推測の見た目に寄せる。 */
const SOURCE_CLASS: Readonly<Record<FactSource, string>> = {
  official: styles.factBadgeFact,
  measured: styles.factBadgeFact,
  experience: styles.factBadgeOpinion,
  inference: styles.factBadgeInference,
  external: styles.factBadgeOpinion,
  commercial: styles.factBadgeInference,
};

export function FactSourceBadge({ source }: { readonly source: FactSource }) {
  return (
    <span className={[styles.factBadge, SOURCE_CLASS[source]].join(" ")}>
      <Icon name={SOURCE_ICON[source]} />
      {UI_COPY.factSource[source]}
    </span>
  );
}
