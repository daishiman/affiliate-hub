import type { ReactNode } from "react";
import { Button, type ButtonTone } from "./button";
import { HumanOnlyForm } from "./human-only-form";

/**
 * ボタン 1 つだけの操作。
 *
 * `form action={...}` と `Button type="submit"` の組は画面のあちこちに現れる。
 * 各画面で生の `form` を書くと、押せる物の見た目と余白が画面ごとにずれ、
 * 「押すと何が起きるか」の書き方も画面ごとにばらける。
 *
 * `ToolForm` との違いは**入力欄を持つかどうか**ではなく、**AI へ渡すかどうか**。
 * `ToolForm` は AI が呼べる操作の宣言を伴う（1 画面 1 つ）。
 * ここは画面だけの操作（下書きを始める、鍵を失効する）に使う。
 *
 * 隠し値が要るときは `children` に `FormValue` を置く。生の隠し入力欄は書かない
 * （宣言は `form-value.tsx` の 1 箇所だけ）。
 *
 * --- なぜ `reason` を要るようにしたか ---
 *
 * 「画面だけの操作に使う」と説明文へ書いても、**呼ぶ側の 1 行からは見えない**。
 * 楽に書けるほうへ手が伸びるので、`ToolForm` で名乗るべき操作がここへ流れ込む。
 * 流れ込んだ結果は素の `<form>` と同じで、「渡さないと決めた」と
 * 「渡し忘れた」が同じ見た目になる。理由を引数にすると、消せば型が通らない。
 * 中身は `HumanOnlyForm` に任せてある（同じ約束を 2 箇所に書かない）。
 */
export function ActionButton({
  action,
  label,
  reason,
  tone = "primary",
  children,
}: {
  /**
   * 押したときに走る server action、または送り先の URL。
   *
   * URL を渡した場合だけ `method="post"` を付ける。server action は
   * React が送り方を決めるので、こちらで指定すると送信が壊れる。
   */
  readonly action: string | ((formData: FormData) => void | Promise<void>);
  /** ボタンの文言。何が起きるかを動詞で書く。 */
  readonly label: string;
  /**
   * この操作を AI から呼べなくしている理由。
   *
   * 書けないなら、それは `ToolForm` で名乗るべき操作である。
   */
  readonly reason: string;
  readonly tone?: ButtonTone;
  /** 送る隠し値。表示物は置かない。 */
  readonly children?: ReactNode;
}) {
  return (
    <HumanOnlyForm
      action={action}
      method={typeof action === "string" ? "post" : undefined}
      reason={reason}
    >
      {children}
      <Button type="submit" tone={tone}>
        {label}
      </Button>
    </HumanOnlyForm>
  );
}
