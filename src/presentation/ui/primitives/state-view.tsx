import type { ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * 4 つの状態。
 *
 * 一覧・詳細・検索結果は必ずこの 4 つを持つ。
 * **どの状態にも文言が要る。** 空白のまま出さない。
 *
 *   loading … いま読み込んでいる
 *   empty   … 中身が無い。なぜ無いか + 次にできること
 *   error   … 失敗した。何が起きたか + 復帰の導線
 *   blocked … 見えるが操作できない。なぜできないか + 解決先
 *
 * 「空やゼロが並ぶ表示に理由を 1 行出す」ための部品でもある。
 * 理由の条件式が成立せず無言になる不具合が起きやすいので、
 * `title` と `body` を必須にして、書き忘れをコンパイルで止める。
 */

export function LoadingView({ label }: { readonly label: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite">
      <span className={styles.srOnly}>{label}</span>
      <span className={styles.stateTitle} aria-hidden="true">
        {label}
      </span>
      <span className={styles.skeleton} aria-hidden="true" />
      <span className={styles.skeleton} aria-hidden="true" />
    </div>
  );
}

export function EmptyView({
  title,
  body,
  action,
}: {
  readonly title: string;
  readonly body: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.state}>
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateBody}>{body}</p>
      {action}
    </div>
  );
}

export function ErrorView({
  title,
  body,
  suggestedAction,
  action,
}: {
  readonly title: string;
  readonly body: string;
  /** 次にできること。これが無いと利用者は同じ操作を繰り返す。 */
  readonly suggestedAction?: string | null;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateBody}>{body}</p>
      {suggestedAction && <p className={styles.stateBody}>{suggestedAction}</p>}
      {action}
    </div>
  );
}
