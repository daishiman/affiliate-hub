"use client";

import { useId } from "react";
import type { SelectOption } from "./select";
import styles from "./ui.module.css";

/**
 * 複数選べる選択肢。
 *
 * `Field` と同じ作法を守る（ラベル・任意の印・補足・誤りの位置）。
 * **違うのは「選ばない」が有効な答えになり得ること**で、
 * そのため「1 つ以上選んでください」は補足ではなく誤りとして出す。
 *
 * `fieldset` + `legend` にしているのは、読み上げで
 * 「何についての選択肢か」が各項目の前に読まれるようにするため。
 * `div` + `label` だと項目名しか読まれない。
 */
export type CheckboxGroupProps = {
  readonly name: string;
  readonly label: string;
  readonly options: readonly SelectOption[];
  readonly selected: readonly string[];
  readonly onSelectedChange: (selected: readonly string[]) => void;
  readonly hint?: string;
  readonly error?: string | null;
  readonly optional?: boolean;
  /** この欄が AI から見て何の値かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
};

export function CheckboxGroup({
  name,
  label,
  options,
  selected,
  onSelectedChange,
  hint,
  error = null,
  optional = false,
  toolParamDescription,
}: CheckboxGroupProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  function toggle(value: string, checked: boolean): void {
    // 元の並び順を保つ。押した順に並べ替えると、押すたびに項目が動く。
    const next = options
      .map((o) => o.value)
      .filter((v) => (v === value ? checked : selected.includes(v)));
    onSelectedChange(next);
  }

  return (
    <fieldset
      className={styles.field}
      aria-describedby={
        [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined
      }
      toolparamdescription={toolParamDescription}
    >
      <legend className={styles.label}>
        {label}
        {optional && <span className={styles.optional}>任意</span>}
      </legend>

      <div className={styles.choiceGroup}>
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={[styles.choiceItem, checked ? styles.choiceItemChecked : null]
                .filter(Boolean)
                .join(" ")}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                onChange={(e) => toggle(option.value, e.target.checked)}
              />
              {option.label}
            </label>
          );
        })}
      </div>

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
    </fieldset>
  );
}
