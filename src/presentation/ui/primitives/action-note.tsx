import type { ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * 押す物に添える 1 文。
 *
 * `Callout` との違いは見た目ではなく**いつ読まれるか**にある。
 * 画面の上に置いた告知は、押す瞬間には視界の外にある。
 * 「画面のどこかに書いてある」は「押す前に読まれた」と同じではない。
 *
 * 金銭が動く・秘密が一度しか出ない・外へ公開されるといった、
 * **押した後に戻せない**ことだけをここに書く。それ以外を書くと、
 * 押す物すべてに文が付き、どれも読まれなくなる。
 *
 * 置く場所は押す物と同じ塊の中。間に別の要素を挟まない。
 */
export function ActionNote({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  /** `danger` は戻せない操作。色は補助で、意味は文が持つ。 */
  readonly tone?: "neutral" | "danger";
}) {
  return (
    <p className={styles.actionNote} data-tone={tone}>
      {children}
    </p>
  );
}
