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
 */
export function PublishArticleResult({ state }: { state: PublishArticleFormState }) {
  const skipped = state.skipped ?? [];
  return (
    <FormResult
      state={state}
      doneAction={
        state.url === undefined ? null : (
          <Link href={state.url}>公開した記事を読者の画面で見る</Link>
        )
      }
    >
      {/* 決まり 2。成功の枠に混ぜず、別の枠で残す。 */}
      {state.status === "done" && skipped.length > 0 ? (
        <Callout
          tone="warn"
          reason={`確かめられなかった項目があります: ${skipped
            .map((s) => `${s.label}（${s.reason}）`)
            .join(" / ")}`}
        />
      ) : null}
    </FormResult>
  );
}
