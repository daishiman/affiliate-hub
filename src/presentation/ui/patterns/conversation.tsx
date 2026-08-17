import styles from "./patterns.module.css";

/**
 * 会話ブロック（要求仕様 §11.2・§30.5「会話・比較・商品カードを利用できる」）。
 *
 * 記事の中で「読者がつまずく行き違い」を、質問と答えの形で見せる。
 *
 * **共通部品に置く理由は見た目ではなく、話し手の扱い。**
 * 誰が話しているかを画面ごとに書くと、
 * 案内役が実体験を語る形の文章が、どこかの画面で必ず生まれる。
 * 話し手の種類を仕様 §11.2 の 4 種類に固定し、それ以外を表現できなくしておく。
 *
 * 話し手の呼び方は**ここが画面側の唯一の正本**。
 * 保存側の名前（ReaderQuestion など）との対応は
 * `src/presentation/site/view-model.ts` が 1 箇所で行う。
 *
 * 読み上げでも会話だと分かるよう、話し手は見出しではなく
 * 各発言に付く短いラベルとして出す（読み飛ばしの単位を発言に揃える）。
 */
export const SPEAKERS = ["reader", "writer", "expert", "assistant"] as const;
export type Speaker = (typeof SPEAKERS)[number];

/** 話し手の呼び方。ここが唯一の正本。 */
export const SPEAKER_LABEL: Readonly<Record<Speaker, string>> = {
  reader: "読者",
  writer: "書き手",
  expert: "監修者",
  assistant: "案内役",
};

export type ConversationLine = {
  readonly speaker: Speaker;
  readonly text: string;
};

export function Conversation({
  lines,
  heading = "よくある行き違い",
}: {
  readonly lines: readonly ConversationLine[];
  readonly heading?: string;
}) {
  if (lines.length === 0) return null;
  return (
    <section className={styles.section} aria-label={heading}>
      <h2 className={styles.sectionHeading}>{heading}</h2>
      <div className={styles.conversation}>
        {lines.map((line, i) => (
          <div key={`${line.speaker}-${i}`} className={styles.conversationLine}>
            <span className={styles.conversationSpeaker}>{SPEAKER_LABEL[line.speaker]}</span>
            <p className={styles.conversationText}>{line.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
