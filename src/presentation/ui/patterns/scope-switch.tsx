import type { ReactNode } from "react";
import styles from "./patterns.module.css";

/**
 * 「いまどれを見ているか」と、他へ移る行き先の並び。
 *
 * **なぜ `Note` でも `SeeAlso` でもないか。**
 *
 * `Note` は文である。文の中のリンクは WCAG 2.5.8 の行内例外に当たるので
 * 押しどころの下限を当てられない（`see-also.tsx` の doc にその経緯がある）。
 * ところがブログの切り替えは**文ではなく操作**で、押し間違えれば
 * 別のブログの版面を直しはじめることになる。`Note` に入れていた 2026-08-27 まで、
 * この行のリンクは下限を 1 つも持っていなかった
 * （`tests/ui/screen-hit-and-current.test.tsx` が運用画面の中身を
 * 描けるようになった日に、7 画面ぶん一斉に赤くなって表に出た）。
 *
 * `SeeAlso` は「行き先 1 本だけ」と役が縛られている（`tests/ui/note-role.test.ts`）。
 * こちらは選べる先が並ぶので、そこへ寄せると役の縛りが緩む。
 *
 * **`select` にしないのは切り替えを URL に残すため**——理由は
 * `blog-site-switch.tsx` の doc に書いてある。行き先はリンクのまま、
 * 押しどころだけを操作の側の大きさにする。
 *
 * `href` を受け取らないのは `SeeAlso` と同じ理由（`patterns` は `next/link` を
 * 取り込まない）。いま見ているものは呼び出し側が `<strong>` で入れる。
 */
export function ScopeSwitch({
  label,
  children,
}: {
  /** 何を切り替えるのかを言う 1 語。「ブログ」「配信先」など。 */
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <p className={styles.scopeSwitch}>
      <span className={styles.scopeSwitchLabel}>{label}</span>
      {children}
    </p>
  );
}
