import type { DomainError } from "@/domain/shared";

/**
 * 断ったときに画面へ出す文を作る。
 *
 * --- なぜ 1 か所に寄せるのか ---
 * 各操作はそれぞれ `suggestedAction ?? message` と書いていた。
 * 次に何をすればよいかだけを出す形で、**次にすることが書いてある限り、
 * 何が起きたかは画面から消える**。
 *
 * 記録を残せなかったときの断りが入って、この差が実害になった。
 * 「ブログは作られていて読む人からも見えます。ただし記録を残せませんでした」の
 * 前半が落ちると、押した人は作られていないと思って名前を変えてもう一度作り、
 * 同じブログが 2 本並ぶ。金額の修正も同じで、直っているのに直しに戻る。
 *
 * **済んだことと、次にすることは、どちらも要る。**
 * 片方を落とす判断を各操作でやり直せる状態にしておくと、
 * 新しい操作を足すたびに同じ抜け方が起きる。
 *
 * `admin/` ではなく `presentation/` 直下に置いてあるのは、
 * 押して何かが変わる操作が管理画面だけではないため
 * （読者側の問い合わせも同じ）。片側だけの決まりにすると、
 * もう片側で同じ抜け方がもう一度生まれる。
 */
export function refusalText(error: DomainError): string {
  return error.suggestedAction === undefined
    ? error.message
    : `${error.message}\n${error.suggestedAction}`;
}
