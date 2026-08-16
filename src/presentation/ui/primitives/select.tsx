"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { UI_COPY } from "../copy";
import styles from "./ui.module.css";

/**
 * 選択欄。
 *
 * **入力欄（Field）と同じ作法をそのまま持ち込む。**
 * 選ぶ欄だけラベルの位置や誤りの出し方が違うと、同じ画面の中で作法が割れる。
 *
 * 決めてある作法（Field と共通）:
 *   1. 未選択は「未入力」。既定値を勝手に選んだことにしない。
 *   2. 必須でない欄にだけ「任意」と書く。
 *   3. 誤りは欄の下に、直せる言葉で出す。
 *   4. 文言は copy.ts から取る。
 *
 * Enter の扱いは入力欄と違い、ここでは何もしない。
 * 選択欄の Enter は、開いている一覧の確定として使われるため。
 */
export type SelectOption = {
  readonly value: string;
  readonly label: string;
  readonly disabled?: boolean;
};

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange" | "children"
> & {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  /** 未選択のときに出す文言。空文字を選ぶと「未入力」になる。 */
  readonly placeholder?: string;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly optional?: boolean;
  /** この欄が AI から見て何の値かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
};

export function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  hint,
  error = null,
  optional = false,
  toolParamDescription,
  ...rest
}: SelectProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}>{UI_COPY.field.optional}</span>}
      </label>

      <select
        {...rest}
        id={id}
        className={[styles.input, error ? styles.inputInvalid : null].filter(Boolean).join(" ")}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        aria-invalid={error !== null || undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
        }
        toolparamdescription={toolParamDescription}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>

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
