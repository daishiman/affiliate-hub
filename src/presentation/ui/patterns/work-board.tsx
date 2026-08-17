import type { ReactNode } from "react";
import styles from "./patterns.module.css";

/**
 * 作業ボード（ホーム画面に並ぶ数字）。
 *
 * **数字だけのカードを作れない形にしてある。**
 * 受け取る 1 枚には `valueLabel`（値）・`reason`（その数の意味）・
 * `href` と `actionLabel`（解消できる画面）が必須で、
 * どれかを省いた呼び出しは型が通らない。
 *
 * 「未処理 3」とだけ出た画面は、見た人が次に何をすればよいか分からず、
 * 数日で誰も見なくなる。それを部品の側で防ぐ。
 *
 * 値が出せないとき (`unavailableReason`) は 0 と書かない。
 * 「0 件」と「数えられなかった」を同じ見た目にすると、
 * 接続が切れていることに誰も気づかない。
 */

export type WorkBoardItem = {
  readonly key: string;
  readonly label: string;
  /** 表示する文字列。単位や通貨は呼び出し側で確定済みのものを渡す。 */
  readonly valueLabel: string;
  readonly reason: string;
  /** neutral = 手当て不要 / attention = 手が要る / problem = 止まっている */
  readonly tone: "neutral" | "attention" | "problem";
  readonly href: string;
  readonly actionLabel: string;
  /** 値が出せない理由。null 以外なら値の代わりにこれを出す。 */
  readonly unavailableReason: string | null;
};

const TONE_CLASS: Readonly<Record<WorkBoardItem["tone"], string>> = {
  neutral: "",
  attention: styles.boardItemAttention,
  problem: styles.boardItemProblem,
};

/** 色に頼らず、読み上げでも区別できるようにするための言葉。 */
const TONE_TEXT: Readonly<Record<WorkBoardItem["tone"], string>> = {
  neutral: "手当ては要りません",
  attention: "手が要ります",
  problem: "止まっています",
};

export function WorkBoard({
  items,
  caption,
  renderLink,
}: {
  readonly items: readonly WorkBoardItem[];
  /** 何の一覧かの説明。読み上げの見出しになる。 */
  readonly caption: string;
  /**
   * 行き先の描き方。
   * 部品側で `next/link` を読むと、記事側の静的な画面でも
   * ルーターを引き込むことになるため、描き方は呼び出し側に任せる。
   */
  readonly renderLink: (href: string, label: string) => ReactNode;
}) {
  return (
    <ul className={styles.board} aria-label={caption}>
      {items.map((item) => (
        <li key={item.key} className={`${styles.boardItem} ${TONE_CLASS[item.tone]}`.trim()}>
          <p className={styles.boardLabel}>{item.label}</p>
          {item.unavailableReason === null ? (
            <>
              <strong className={styles.boardValue}>
                {item.valueLabel}
                {/* 色だけで状態を表さない。読み上げ用に言葉でも添える。 */}
                <span className={styles.srOnly}> — {TONE_TEXT[item.tone]}</span>
              </strong>
              <p className={styles.boardReason}>{item.reason}</p>
            </>
          ) : (
            <>
              <strong className={`${styles.boardValue} ${styles.boardValueUnavailable}`}>
                いま数えられません
              </strong>
              <p className={styles.boardReason}>{item.unavailableReason}</p>
            </>
          )}
          <span className={styles.boardLink}>{renderLink(item.href, item.actionLabel)}</span>
        </li>
      ))}
    </ul>
  );
}
