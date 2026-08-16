import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./ui.module.css";

/**
 * ボタン。
 *
 * 画面ごとに `<button className="...">` を書かない。
 * 大きさ・押したときの見た目・実行中の表し方を 1 箇所に集める。
 *
 * 役割の決め方:
 *   primary   … その画面でいちばんしてほしいこと。1 画面に 1 つ。
 *   secondary … 併記する操作。
 *   quiet     … 目立たせたくない操作 (取り消し・閉じる)。
 *   danger    … 取り消せない操作。押す前に確認を出す。
 */
export type ButtonTone = "primary" | "secondary" | "quiet" | "danger";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly tone?: ButtonTone;
  /**
   * 実行中か。
   * true のあいだは押せなくなり、文言も「〜しています」に変わる。
   * 二重送信を画面側で気をつけるのではなく、部品で防ぐ。
   */
  readonly busy?: boolean;
  /** 実行中に出す文言。何が起きているか分かる言葉にする。 */
  readonly busyLabel?: string;
  readonly children: ReactNode;
};

const TONE_CLASS: Readonly<Record<ButtonTone, string>> = {
  primary: styles.buttonPrimary,
  secondary: styles.buttonSecondary,
  quiet: styles.buttonQuiet,
  danger: styles.buttonDanger,
};

export function Button({
  tone = "secondary",
  busy = false,
  busyLabel,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const classes = [styles.button, busy ? styles.buttonBusy : TONE_CLASS[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...rest}
      className={classes}
      disabled={disabled === true || busy}
      // 読み上げにも「処理中」を伝える
      aria-busy={busy || undefined}
    >
      {busy && <span className={styles.spinner} aria-hidden="true" />}
      {busy ? (busyLabel ?? "処理しています") : children}
    </button>
  );
}
