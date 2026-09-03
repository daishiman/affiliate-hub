"use client";

import { useState } from "react";
import styles from "./patterns.module.css";

/**
 * 案内の折りたたみ操作。
 *
 * **畳むのは見た目だけ。** 項目の名前も行き先も HTML からは消さない。
 * 消す作りにすると、読み上げで使う人には「押せる何かが 19 個並んでいる」だけになる。
 * 見えるものを減らすために、聞こえるものまで減らさない。
 *
 * そのため、この部品がやるのは `<html data-nav-collapsed>` を立てることだけで、
 * 実際に文字を潰すのは CSS が行う。React の分岐で消す作りにすると、
 * 分岐を書き忘れた項目が 1 つ生えた時点で、その項目だけ読み上げから消える。
 *
 * 状態を html 要素に置くのは、サイドバー自身がサーバー側で描かれるため。
 * 押すたびにサーバー部品を描き直さずに済む。
 */

/** 畳み具合の置き場。CSS はこの属性を見る。 */
export const NAV_COLLAPSED_ATTR = "data-nav-collapsed";

export function NavCollapseToggle({
  defaultCollapsed = false,
}: {
  /** 最初に畳んでおくか。前回の選択をサーバー側で復元するときに渡す。 */
  readonly defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = (): void => {
    const next = !collapsed;
    setCollapsed(next);
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute(NAV_COLLAPSED_ATTR, String(next));
    }
  };

  return (
    <button
      type="button"
      className={styles.navCollapseToggle}
      // 名前を先に置く。押す前に「何のボタンか」が分かる必要がある。
      aria-label={collapsed ? "案内を開く" : "案内を畳む"}
      aria-expanded={!collapsed}
      onClick={toggle}
    >
      {/* 向きだけを絵で示す。意味は aria-label が持つので読み上げからは隠す。 */}
      <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
    </button>
  );
}
