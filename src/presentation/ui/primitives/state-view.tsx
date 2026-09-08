import type { ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * 管理画面で扱う 6 状態のうち、共通表示が必要な状態。
 *
 * 一覧・詳細・検索結果は、通常・空・読み込み・一部・失敗・低速を区別する。
 * **どの状態にも文言が要る。** 空白のまま出さない。
 *
 *   loading … いま読み込んでいる
 *   empty   … 中身が無い。なぜ無いか + 次にできること
 *   error   … 失敗した。何が起きたか + 復帰の導線
 *   blocked … 見えるが操作できない。なぜできないか + 解決先
 *
 * **blocked だけ、この file に部品が無い。**`Callout`（`./callout.tsx`）が受け持つ。
 * `Callout` の `reason` は省略できない型なので、理由を書き忘れたまま出せない。
 * ここに一般の差し替え文つきの部品を置くと、その保証が消える
 * （理由が無いときに、それらしい文が代わりに出る）。理由は `copy.ts` の
 * `state.forbiddenTitle` の上に書いてあり、`tests/ui/copy-dictionary.test.ts` が固定している。
 *
 * 「空やゼロが並ぶ表示に理由を 1 行出す」ための部品でもある。
 * 理由の条件式が成立せず無言になる不具合が起きやすいので、
 * `title` と `body` を必須にして、書き忘れをコンパイルで止める。
 */

export function LoadingView({ label }: { readonly label: string }) {
  return (
    <div className={styles.state} role="status" aria-live="polite" data-screen-state="loading">
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
    <div className={styles.state} data-screen-state="empty">
      <p className={styles.stateTitle}>{title}</p>
      <p className={styles.stateBody}>{body}</p>
      {action}
    </div>
  );
}

export function IdealView({ title, body, action }: { readonly title: string; readonly body: string; readonly action?: ReactNode }) {
  return (
    <div className={styles.state} role="status" data-screen-state="ideal">
      <p className={styles.stateTitle}>通常 — {title}</p>
      <p className={styles.stateBody}>{body}</p>
      {action}
    </div>
  );
}

export function PartialView({ title, body, safeToUse, action }: { readonly title: string; readonly body: string; readonly safeToUse: string; readonly action?: ReactNode }) {
  return (
    <div className={styles.state} role="status" data-screen-state="partial">
      <p className={styles.stateTitle}>一部のみ — {title}</p>
      <p className={styles.stateBody}>{body}</p>
      <p className={styles.stateBody}>いま使える情報: {safeToUse}</p>
      {action}
    </div>
  );
}

export function SlowView({ title, body, action }: { readonly title: string; readonly body: string; readonly action?: ReactNode }) {
  return (
    <div className={styles.state} role="status" aria-live="polite" data-screen-state="slow">
      <p className={styles.stateTitle}>時間が掛かっています — {title}</p>
      <p className={styles.stateBody}>{body}</p>
      {action}
    </div>
  );
}

export function ErrorView({
  title,
  body,
  safeToUse = "現在地と入力済みの内容は保持されています。未確定の値は判断に使われません。",
  suggestedAction = "もう一度試すか、前の画面へ戻ってください。",
  action,
}: {
  readonly title: string;
  readonly body: string;
  /** 失敗しても確定済みとして扱える情報。 */
  readonly safeToUse?: string;
  /** 次にできること。これが無いと利用者は同じ操作を繰り返す。 */
  readonly suggestedAction?: string | null;
  readonly action?: ReactNode;
}) {
  return (
    <div className={styles.state} role="alert" data-screen-state="error">
      <p className={styles.stateTitle}>失敗 — {title}</p>
      <p className={styles.stateBody}>{body}</p>
      <p className={styles.stateBody}>守られた情報: {safeToUse}</p>
      <p className={styles.stateBody}>
        次にできること: {suggestedAction ?? "前の画面へ戻って、時間を置いてからもう一度試してください。"}
      </p>
      {action}
    </div>
  );
}
