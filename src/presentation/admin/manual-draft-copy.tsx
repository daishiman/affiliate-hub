"use client";

import { UI_COPY } from "@/presentation/ui";
import { CopyButton } from "./copy-button";

/**
 * 貼り付け用の下書きを持ち出すためのボタン 2 つ。
 *
 * 本文と手順を**別のボタン**にしてある。まとめて 1 つにすると、
 * 貼り付け先の記事本文に手順書まで混ざる。それを消すのは貼り付ける人の仕事になり、
 * 消し損ねると読者の目に「1. note を開き…」が出る。
 *
 * 記録（誰がいつ書き出したか）は画面を開いた時点で残っている。
 * ここは持ち出しやすさだけを足すので、押しても記録は増えない。
 */
export function ManualDraftCopy({
  markdown,
  instructions,
}: {
  readonly markdown: string;
  readonly instructions: string;
}) {
  return (
    <>
      <CopyButton label={UI_COPY.distribution.copyBody} text={markdown} />
      <CopyButton label={UI_COPY.distribution.copySteps} text={instructions} />
    </>
  );
}
