"use client";
import { useId, type ReactNode, type InputHTMLAttributes } from "react";
import { Icon, type IconName } from "@/presentation/ui";
import styles from "./prose.module.css";

export function IconButton({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  readonly icon: IconName;
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled?: boolean;
}) {
  /*
    同じ絵のボタンが断片の数だけ並ぶ。読み上げは順に読むので、
    どの断片のボタンかを名前に入れる (呼び出し側が入れている)。
    `type="button"` を明示するのは、form の中の button が既定で送信になるため。
  */
  return (
    <button
      aria-label={label}
      className={styles.proseEditorIconButton}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon name={icon} size="sm" />
      <span>{icon === "moveUp" ? "上へ" : icon === "moveDown" ? "下へ" : icon === "addItem" ? "追加" : icon === "removeItem" ? "削除" : label}</span>
    </button>
  );
}

/** 入力直後に結果・エラーを示す枠。URL検証と商品検索で同じ位置に返す。 */
export function ProseInputGroup({ control, feedback, alert = false, children }: {
  readonly control: InputHTMLAttributes<HTMLInputElement>;
  readonly feedback: ReactNode;
  readonly alert?: boolean;
  readonly children?: ReactNode;
}) {
  const feedbackId = useId();
  return <div className={styles.proseEditorStack}>
    <input {...control} className={styles.proseEditorText} aria-describedby={feedback ? feedbackId : undefined} />
    {feedback && <p className={styles.hint} id={feedbackId} role={alert ? "alert" : undefined}>{feedback}</p>}
    {children}
  </div>;
}

/**
 * 装飾を通さない 1 行の欄。
 *
 * 名前・題名・説明のように、**描くときに要素を置けない場所**へ入る文字は
 * ここで受ける。装飾を許すと、`alt` や `title` に `**` が出る。
 */
export function PlainField({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly placeholder: string;
}) {
  return (
    <input
      aria-label={ariaLabel}
      className={styles.proseEditorText}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      type="text"
      value={value}
    />
  );
}

/**
 * 行き先を打つ欄。**通せない行き先はその場で言う。**
 *
 * 描画側でも止めるが、そこで初めて分かると「保存したのに出ない」になる。
 * 打っている本人が直せるうちに言うほうが直せる。
 */
export function UrlField({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  hint,
  check,
}: {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly ariaLabel: string;
  readonly placeholder: string;
  readonly hint: string;
  readonly check: (url: string) => string | null;
}) {
  const bad = value.trim() !== "" && check(value) === null;
  return (
    <ProseInputGroup control={{
      "aria-invalid": bad, "aria-label": ariaLabel,
      onChange: (event) => onValueChange(event.target.value),
      placeholder, type: "text", inputMode: "url", value,
    }} feedback={bad ? "この行き先は使えません。" : hint} />
  );
}
