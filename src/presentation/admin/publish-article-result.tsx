import Link from "next/link";
import { Callout, FormResult } from "@/presentation/ui";
import type { PublishArticleFormState } from "./publish-article-state";

/**
 * 「いまサイトに出す」を押したあとの知らせ。
 *
 * 欄を持つ本体（`publish-article-form.tsx`）から切り出してある。
 * 本体は押した瞬間の状態を React から受け取るので、**結果の出し分けだけを
 * 試したいときに、押す操作ごと組み立てなければならない**。
 * ここを分けておくと、断り・成功・確かめられなかった項目・読者ページへの導線を
 * それぞれ 1 つずつ確かめられる。
 *
 * 出し分けの決まりは 3 つ。
 *   1. 欄が特定できない断り（権限・配信の種類・出せる状態でない）だけをここに出す。
 *      欄が分かる断りは、その欄の下に出したほうが直しやすい。
 *   2. **確かめられなかったことを、成功の知らせに混ぜて消さない。** 別の枠で残す。
 *   3. 出したあとは読者の画面への導線を必ず添える。
 *      「公開しました」だけでは、本当に出たかを確かめる手段が無い。
 *   4. **点検（`phase: "checked"`）と公開（`phase: "published"`）を取り違えない。**
 *      どちらも `status: "done"` で返るが、記事が読者に出たかは正反対である。
 *      `url` の有無から言い当てず、`phase` を見る（REQ-SEO03）。
 */
export function PublishArticleResult({ state }: { state: PublishArticleFormState }) {
  const skipped = state.skipped ?? [];
  // 点検の結果に導線を付けない。**まだ読者に出ていない**ので、開く先が無い。
  const checked = state.phase === "checked";
  return (
    <FormResult
      state={state}
      doneAction={
        checked || state.url === undefined ? null : (
          <Link href={state.url}>公開した記事を読者の画面で見る</Link>
        )
      }
    >
      {/* 決まり 2。成功の枠に混ぜず、別の枠で残す。 */}
      {state.status === "done" && skipped.length > 0 ? (
        <Callout
          tone="warn"
          reason={`${checked ? "このまま出すと確かめられないままになる項目があります" : "確かめられなかった項目があります"}: ${skipped
            .map((s) => `${s.label}（${s.reason}）`)
            .join(" / ")}`}
        />
      ) : null}
      {/*
        AI 検索への備えの点検（REQ-SEO03）。出る場面は 2 つ。

          - 「公開前に点検する」を押したとき。**まだ出ていないので直せる。**
          - 出した直後。ここも「もう一歩直す」気になる瞬間なので同じ場所に出す。

        全て揃っていれば一言で済ませ、足りない項目は**何をすればよいか**（hint）
        まで出す。項目名だけ出すと直し方を人に調べさせることになる。
      */}
      {state.status === "done" && state.aiSearch !== undefined ? (
        <Callout
          tone={state.aiSearch.every((c) => c.ok) ? "success" : "warn"}
          title={`AI 検索への備え: ${state.aiSearch.filter((c) => c.ok).length}/${state.aiSearch.length}`}
          reason={
            state.aiSearch.every((c) => c.ok)
              ? "結論・要点・更新日・著者・出典・よくある質問・説明文の構造が揃っています。"
              : `${state.aiSearch
                  .filter((c) => !c.ok)
                  .map((c) => `${c.check} → ${c.hint}`)
                  .join(" ")}${checked ? "" : " （記事はもう出ています。直したら、もう一度出してください。）"}`
          }
        />
      ) : null}
    </FormResult>
  );
}
