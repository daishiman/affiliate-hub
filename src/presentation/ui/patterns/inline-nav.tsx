import type { ReactNode } from "react";
import styles from "./patterns.module.css";

export type InlineNavItem = {
  readonly href: string;
  readonly label: string;
};

/** 同格の行き先を、読み上げ可能な一覧として横に並べる。 */
export function InlineNav({
  label,
  items,
  renderLink,
}: {
  readonly label: string;
  readonly items: readonly InlineNavItem[];
  /** 画面遷移の仕組みは presentation pattern へ固定せず、呼び出し側が渡す。 */
  readonly renderLink: (href: string, label: string) => ReactNode;
}) {
  return (
    <nav aria-label={label} className={styles.inlineNav}>
      <ul>
        {items.map((item) => (
          <li key={item.href}>{renderLink(item.href, item.label)}</li>
        ))}
      </ul>
    </nav>
  );
}
