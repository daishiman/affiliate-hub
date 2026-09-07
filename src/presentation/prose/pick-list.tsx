"use client";

import { useId, type ReactNode } from "react";
import styles from "./prose.module.css";

/**
 * 「並んだ選択肢から 1 つ選ぶ」だけを受け持つ小さな一覧。
 *
 * ## なぜ部品にしたのか
 *
 * `/` の部品一覧・商品の検索結果・色の一覧は、見た目も役目も違うのに
 * **中身は同じ形** (`ul > li > button`) をしていた。写しが増えると、
 * 押せる幅や読み上げの当たり方をどれか 1 か所で直したときに、
 * 残りが黙って古いまま残る。`tests/ui/uiux-duplicate-implementation.test.ts`
 * が写しを数えているのは、この「片方だけ直る」を起こさせないためである。
 *
 * ## 何を知らないか
 *
 * ここは**選択肢が何であるかを知らない**。断片の種類も、商品も、色も知らない。
 * 知っているのは「鍵と見せ方の組が並んでいて、押されたら鍵を返す」ことだけ。
 * 知らないからこそ 3 か所から使える。
 */

export type PickOption<T extends string> = {
  readonly key: T;
  /** 読み上げと見た目の両方に使う文言。 */
  readonly label: string;
  /** 文言の前に置くもの (アイコンや色の見本)。無くてよい。 */
  readonly leading?: ReactNode;
  /** 文言の後ろに置くもの (値段など)。無くてよい。 */
  readonly trailing?: ReactNode;
  readonly description?: string;
};

export function PickList<T extends string>({
  options,
  onPick,
  activeKey,
}: {
  readonly options: readonly PickOption<T>[];
  readonly onPick: (key: T) => void;
  readonly activeKey?: T;
}) {
  const groupId = useId();
  return (
    <ul className={styles.proseEditorMenu}>
      {options.map((option) => (
        <li key={option.key}>
          <button
            aria-label={option.label}
            aria-describedby={option.description ? `${groupId}-${option.key}` : undefined}
            className={styles.proseEditorMenuItem}
            data-active={option.key === activeKey || undefined}
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              event.preventDefault();
              const buttons = Array.from(event.currentTarget.closest("ul")?.querySelectorAll<HTMLButtonElement>("button") ?? []);
              const index = buttons.indexOf(event.currentTarget);
              buttons[(index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length]?.focus();
            }}
            onClick={() => onPick(option.key)}
            type="button"
          >
            {option.leading}
            <span>
              <span>{option.label}</span>
              {option.description && <small className={styles.proseMenuDescription} id={`${groupId}-${option.key}`}>{option.description}</small>}
            </span>
            {option.trailing}
          </button>
        </li>
      ))}
    </ul>
  );
}
