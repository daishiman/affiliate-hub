"use client";

import type { ReactNode, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import { UI_COPY } from "../copy";
import styles from "./ui.module.css";

/**
 * 複数行の入力欄。
 *
 * `Field` と同じ作法を守る（ラベル・任意の印・補足・誤りの位置）。
 * **違うのは Enter の扱いだけ**で、ここでは改行のまま（Field の作法 3）。
 * 本文や理由を書く欄で Enter が「次へ進む」になると、改行できなくなる。
 *
 * 見た目は `.input` を使い回す。専用の色や大きさを足さない。
 * 高さだけは行数 (`rows`) で決める。CSS に固定値を書かないため。
 */
export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "onChange"
> & {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly hint?: ReactNode;
  /** 直せる言葉で書く。 */
  readonly error?: string | null;
  readonly optional?: boolean;
  /** この欄が AI から見て何の値かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
};

export function TextArea({
  label,
  value,
  onValueChange,
  hint,
  error = null,
  optional = false,
  toolParamDescription,
  rows = 8,
  ...rest
}: TextAreaProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}>{UI_COPY.field.optional}</span>}
      </label>

      <textarea
        {...rest}
        id={id}
        rows={rows}
        className={[styles.input, error ? styles.inputInvalid : null].filter(Boolean).join(" ")}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-invalid={error !== null || undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        toolparamdescription={toolParamDescription}
      />

      {hint !== undefined && (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      )}

      {error !== null && (
        <span className={styles.error} id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
