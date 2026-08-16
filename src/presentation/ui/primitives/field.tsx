"use client";

import type { InputHTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useId } from "react";
import styles from "./ui.module.css";

/**
 * 入力欄。
 *
 * **入力の作法は 1 組だけ。全画面でこれを使う。**
 * タブや手順ごとに作法を変えない (ux-design §4-4)。
 *
 * 決めてある作法:
 *
 *   1. 空欄の意味は「未入力」。0 や「なし」とは区別する。
 *      0 を入れたいときは 0 と書いてもらう。空欄を 0 と読み替えない。
 *
 *   2. 自動で計算された値は、欄の中に初期値として入れる。
 *      別の場所に表示して「反映」ボタンを押させない。
 *      自動値は見た目で区別し（薄い斜体）、由来を欄の下に 1 行で示す。
 *      手で書き換えたら通常の見た目に戻り、「自動に戻す」が出る。
 *
 *   3. Enter は「次の欄へ進む」。フォーム全体の送信はしない。
 *      最後の欄で Enter を押したときだけ、主操作へ焦点を移す。
 *      複数行の入力欄では改行のままにする。
 *
 *   4. 必須ではない欄に「任意」と書く。必須の欄に「必須」と書かない。
 *      ほとんどが必須なので、少ない方に印を付ける。
 */
export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  readonly label: string;
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** 入力のしかたの補足。単位や書式はここに書く。 */
  readonly hint?: ReactNode;
  /** 直せる言葉で書く。「invalid」ではなく「半角数字で入力してください」。 */
  readonly error?: string | null;
  readonly optional?: boolean;
  /** 単位。欄の中に置き、利用者に入力させない。 */
  readonly unit?: string;
  /**
   * 自動計算値。指定すると、その値が初期値として欄に入る。
   * 由来 (`autoValueSource`) は必ず添える。「どこから来た数字か」が分からない値は出さない。
   */
  readonly autoValue?: string | null;
  readonly autoValueSource?: string;
  /** 手で書き換えられているか。呼び出し側が持つ。 */
  readonly overridden?: boolean;
  readonly onResetToAuto?: () => void;
};

/** Enter で次の欄へ。フォーム内の入力可能な要素を順に辿る。 */
function focusNext(current: HTMLElement): void {
  const form = current.closest("form");
  if (form === null) return;

  const focusable = [...form.querySelectorAll<HTMLElement>("input, select, textarea, button")].filter(
    (el) => !el.hasAttribute("disabled") && el.tabIndex !== -1,
  );
  const index = focusable.indexOf(current);
  if (index === -1) return;
  focusable[index + 1]?.focus();
}

export function Field({
  label,
  value,
  onValueChange,
  hint,
  error = null,
  optional = false,
  unit,
  autoValue = null,
  autoValueSource,
  overridden = false,
  onResetToAuto,
  ...rest
}: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const showingAuto = autoValue !== null && !overridden;
  const shownValue = showingAuto ? autoValue : value;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter") return;
    // 送信は主操作のボタンだけが行う。Enter で意図せず確定させない。
    event.preventDefault();
    focusNext(event.currentTarget);
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {optional && <span className={styles.optional}>任意</span>}
      </label>

      <input
        {...rest}
        id={id}
        className={[styles.input, showingAuto ? styles.inputAuto : null, error ? styles.inputInvalid : null]
          .filter(Boolean)
          .join(" ")}
        value={shownValue}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-invalid={error !== null || undefined}
        aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
      />

      {unit !== undefined && <span className={styles.hint}>単位: {unit}</span>}

      {showingAuto && autoValueSource !== undefined && (
        <span className={styles.autoNote}>自動で入力しました（{autoValueSource}）。書き換えられます。</span>
      )}

      {overridden && autoValue !== null && onResetToAuto !== undefined && (
        <span className={styles.autoNote}>
          手で入力した値です。
          <button type="button" className={styles.resetToAuto} onClick={onResetToAuto}>
            自動計算に戻す
          </button>
        </span>
      )}

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
