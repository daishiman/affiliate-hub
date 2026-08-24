"use client";

import type { FormHTMLAttributes, ReactNode } from "react";

/**
 * **人だけが押せる**フォーム。AI からは呼べない。
 *
 * --- なぜ `ToolForm` の対にこれが要るのか ---
 *
 * この system の原則は「画面でできることは AI からもできる」で、それを担うのが
 * `ToolForm` である。だが原則には例外があり、例外のほうは今まで
 * **素の `<form>`** で書かれていた。素の `<form>` は何も名乗らないので、
 * 結果として「AI から呼べない」状態にはなる。動きは正しい。
 *
 * 正しくないのは、**そう決めたことがコードに残らない**ところだった。
 * 素の `<form>` は 2 つの意味を持ってしまう。
 *
 *   1. 人だけの操作だと決めたので、名乗らせなかった
 *   2. `ToolForm` へ移すのを忘れた
 *
 * 見分けが付かない。実際 `inbox-forms.tsx` では、素の `<form>` の中の欄に
 * `toolParamDescription`（AI へ何の値かを説明する宣言）が書かれていた。
 * 欄は自己紹介しているのに、包む側が名乗っていないので**どこにも届かない**。
 * 2 の取りこぼしが、1 の顔をして 1 年近く残っていた。
 *
 * だからこの部品は `reason` を必須にする。**書かずには使えない。**
 * 理由が書けないなら、それは 1 ではなく 2 である。
 *
 * --- 出力は素の `<form>` と同じ ---
 *
 * `toolname` を付けないことがこの部品の仕事なので、DOM には何も足さない。
 * 見た目も変わらない。変わるのは、読む人と機械が意図を読めることだけ。
 */
export function HumanOnlyForm({
  reason,
  children,
  ...rest
}: Omit<FormHTMLAttributes<HTMLFormElement>, "children"> & {
  /**
   * AI から呼べなくしている理由。仕様の条番号か、根拠になる事実を書く。
   *
   * 「人の操作だから」だけでは足りない。**なぜ人でなければならないか**を
   * 書く。半年後にこの行を読む人が、決め直せるだけのことを残す。
   *
   * この文は DOM へ出さない。押す人に向けた文ではなく、
   * 次にこのコードを触る人に向けた文だからで、
   * 押す人に伝えるべきことは `Callout` で画面に出す。
   */
  readonly reason: string;
  readonly children: ReactNode;
}) {
  // reason は型で必須にしてあるが、空文字は型を通る。
  // 空で書かれた理由は「書いていない」と同じなので、開発時に気付ける形で止める。
  if (process.env.NODE_ENV !== "production" && reason.trim() === "") {
    throw new Error(
      "HumanOnlyForm の reason が空です。AI から呼べなくしている理由を書いてください。" +
        "理由が書けない場合、それは ToolForm への移行漏れです。",
    );
  }

  return <form {...rest}>{children}</form>;
}
