import type { ReactNode } from "react";
import { Callout, type CalloutTone } from "../primitives/callout";

/**
 * フォームを送った結果の出し方。
 *
 * --- なぜ部品にしたか（2026-08-22 / ah-brd）---
 *
 * `content-form.tsx` と `product-form.tsx` が、**同じ名前・同じ引数**の
 * `FormResult` を各々のファイルの中で定義していた。中身も同じ骨格で、
 * 失敗を warn の `Callout`、成功を success の `Callout` で出していた。
 *
 * 写しであることの被害は、片方だけ直したときに出る。実際に差が付いていた。
 *
 * | | 失敗時の見出し | 完了後のリンクの置き方 |
 * |---|---|---|
 * | content-form | 「この操作はできませんでした」 | `Callout` の `action` |
 * | product-form | 見出しなし | `<p><Link/></p>` を別に置く |
 *
 * 見出しの有無は「決めた」のか「書き忘れた」のか、2 つのファイルからは分からない。
 * リンクの置き方が 2 通りあるのは、同じ意味のものが画面ごとに違う場所に出るということ。
 *
 * ここへ寄せて、**完了後の導線は `Callout` の `action` に一本化**した。
 *
 * --- 全画面へ広げたとき見つかったこと（2026-08-22 / ah-brd）---
 *
 * 同じ骨格は 2 ファイルどころか **14 ファイル・18 か所**にあった。写しである
 * あいだに、次の 3 つが割れていた。
 *
 * | 割れていたもの | 通り数 | 内訳 |
 * |---|---|---|
 * | 失敗時の見出し | 4 | 無し 15／「できませんでした」／「この操作は…」／「この配信は…」 |
 * | 成功の呼び名 | 3 | `done` 15／`sent`（問い合わせ）／`passed`+`flagged`（事実確認） |
 * | 成功時の色 | 4 | `success` 固定／変更0なら `info`／注意付きなら `warn`／既存なら `info` |
 *
 * 割れ方の意味はそれぞれ違う。
 *
 * - **見出し**は 4 通りとも同じことを言っている。よって**引数の口ごと無くした**。
 *   口を残すと、次に書く人がまた別の言い回しを足せてしまう。`tone="warn"` が
 *   すでに「うまくいかなかった」を伝えているので、見出しは同じことの二度言い。
 * - **成功の呼び名**のうち `sent` は `done` と同義だったので `done` へ寄せた。
 *   `passed`/`flagged`（通った／指摘あり）は**本当に別の意味**なので寄せない。
 *   区別せず揃えると、意味の違いを名前から消すことになる。この 1 ファイルだけは
 *   ここに載らず、自前で書く。
 * - **色**は画面ごとに違う事実（「すでにあった」「何も変わらなかった」）を
 *   指しているので、`doneTone` として残した。
 *
 * --- 段（層）---
 *
 * 「失敗は warn、成功は success」「欄に紐づく断りはここで出さない」は
 * 画面の作法（決めごと）であって、`Callout` の使い方より 1 段上にある。よって patterns。
 *
 * --- 欄に紐づく断りを出さない理由 ---
 *
 * `field` が付いた断りは、その欄の下に出る。ここでも出すと同じ文言が 2 か所に現れ、
 * 直すときにどちらを直せばよいか分からなくなる。
 */
export type FormOutcome = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  /** 断りが特定の入力欄に紐づくとき、その欄の名前。付いていれば、ここでは出さない。 */
  readonly field?: string;
};

export function FormResult({
  state,
  doneTone = "success",
  doneAction,
  children,
}: {
  readonly state: FormOutcome;
  /**
   * 成功したときの色。
   *
   * 既定は `success`。**この口があるのは、画面ごとに違う事実を指せるから**で、
   * 見た目の好みで変えるためではない。使ってよいのは次のような場合。
   *
   *   - `info` … 成功したが何も変わらなかった（「すでにあった」「変更0件」）
   *   - `warn` … 成功したが人が見るべきものが残った
   *
   * 「成功したのに success でない」と書くときは、**なぜそうなのかを
   * その場のコメントに残す**。残さないと、次に読む人は書き間違いと区別できない。
   */
  readonly doneTone?: CalloutTone;
  /** 完了後に開く先への導線。ここ以外に置かない。 */
  readonly doneAction?: ReactNode;
  /** その画面だけの追加の知らせ（承認が外れた・波及先がある等）。 */
  readonly children?: ReactNode;
}) {
  return (
    <>
      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" reason={state.message} />
      ) : null}

      {state.status === "done" ? (
        <Callout tone={doneTone} reason={state.message} action={doneAction ?? undefined} />
      ) : null}

      {children}
    </>
  );
}
