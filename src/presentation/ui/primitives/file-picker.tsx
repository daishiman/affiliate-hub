"use client";

import type { ChangeEvent, ReactNode } from "react";
import { useId } from "react";
import styles from "./ui.module.css";

/**
 * ファイルを 1 つ選ぶ欄。
 *
 * --- なぜ `Field` を使わないのか ---
 *
 * `Field` は controlled な文字入力である（`value` / `onValueChange`）。
 * `input[type=file]` の `value` は**書き込めない**（書けたら、任意のファイルを
 * 読ませる画面が作れてしまう）。だから同じ部品には乗らない。
 *
 * --- なぜ生の `<input type="file">` を画面へ直接書かないのか ---
 *
 * 押しどころの下限（`--tap-target-min`）と、名札・補足・断りの結び付け
 * （`htmlFor` / `aria-describedby` / `aria-invalid`）は、書く人が毎回思い出す
 * ものにすると必ず抜ける。**抜けても画面は動いてしまう**ので、気づくのは
 * 指の小さい人と、読み上げで聞く人だけになる。ここに 1 組だけ置く。
 *
 * 選んだファイルの下見（`<figure>` の絵）はここでは持たない。何を見せるかは
 * 用途ごとに違う（表紙なら絵、資料なら名前と大きさ）ので、呼ぶ側が描く。
 */
export function FilePicker({
  label,
  name,
  accept,
  onPick,
  disabled = false,
  hint,
  error = null,
  toolParamDescription,
}: {
  readonly label: string;
  readonly name: string;
  /** 受け取る MIME の並び。`accept` は**案内であって検査ではない**ので、業務側でも必ず見る。 */
  readonly accept?: string;
  readonly onPick: (file: File | undefined) => void;
  readonly disabled?: boolean;
  readonly hint?: ReactNode;
  /** 直せる言葉で書く。「invalid」ではなく「8MB までにしてください」。 */
  readonly error?: string | null;
  /** この欄が AI から見て何かの説明 (WebMCP)。 */
  readonly toolParamDescription?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onPick(event.target.files?.[0]);
  }

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>

      <input
        id={id}
        className={[styles.input, error ? styles.inputInvalid : null].filter(Boolean).join(" ")}
        type="file"
        name={name}
        accept={accept}
        onChange={handleChange}
        disabled={disabled}
        aria-invalid={error !== null || undefined}
        aria-describedby={
          [hint !== undefined ? hintId : null, error !== null ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
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
