"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Callout, CheckboxGroup, FormValue, TextArea, ToolForm } from "@/presentation/ui";
import type { DeleteFormState } from "./delete-form-state";
import { INITIAL_DELETE_FORM_STATE } from "./delete-form-state";

/**
 * 消す前の確認。商品・記事・ブログで同じ 1 つを使う。
 *
 * **消す画面（`/…/delete`）を作らない。** 消す対象を見ている場所で消せないと、
 * 「別の画面へ移って、そこにあるものを消す」ことになり、
 * 目の前の物と消す物が同じかを確かめる手段が無くなる。
 *
 * 対象の名前を打たせる方式は採らない。打ち写しは**読まずに写す**動作で、
 * 手は止まっても頭は止まらない。代わりに求めるのは
 * 「なぜ消すか」の一文で、これは書くために一度考える必要がある。
 * 理由はそのまま記録に残り、後から「なぜ無いのか」に答えられる。
 */
export function DeleteConfirm({
  action,
  toolName,
  toolDescription,
  idName,
  idValue,
  label,
  verb,
  consequence,
  requiresReason = true,
  acknowledgement = "戻せないことを確かめました",
}: {
  readonly action: (prev: DeleteFormState, formData: FormData) => Promise<DeleteFormState>;
  readonly toolName: string;
  readonly toolDescription: string;
  /** 識別子を渡す欄の名前（`productId` など）。 */
  readonly idName: string;
  readonly idValue: string;
  /** 消す物の名前。押す直前に、何が消えるかをもう一度出す。 */
  readonly label: string;
  /**
   * 終止形の動詞（「消す」「取り下げる」）。
   *
   * 活用形をこちら側で作らない。「消し」「消せ」を渡させると、
   * 呼ぶ側が 3 つの形を書き分けることになり、1 つだけ言い回しの違う
   * 画面が混ざる。ここでは終止形のまま置ける文だけを組み立てる。
   */
  readonly verb: string;
  /** 消すと何が失われるか。一般論ではなく、この物に起きることを書く。 */
  readonly consequence: string;
  /**
   * 理由を求めるか。既定は求める。
   *
   * 求めないのは、**渡した理由を受け取る口が向こうに無いとき**だけ。
   * 口が無いのに欄を出すと、書いた一文は送信の瞬間に捨てられる。
   * 「記録に残ります」と書いてある欄が残らないのは、ただの嘘になる。
   */
  readonly requiresReason?: boolean;
  /** 押す前に確かめさせる一文。既定は「戻せないこと」。 */
  readonly acknowledgement?: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_DELETE_FORM_STATE);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState<readonly string[]>([]);

  // 消し終わったら、押せる欄を残さない。同じ物をもう一度消そうとしても断られるが、
  // 断られるための欄を出しておく理由が無い。
  if (state.status === "done") {
    return (
      <Callout
        tone="success"
        title="終わりました"
        reason={state.message}
        action={state.listPath === undefined ? null : <Link href={state.listPath}>一覧へ戻る</Link>}
      />
    );
  }

  return (
    <ToolForm action={formAction} toolName={toolName} toolDescription={toolDescription}>
      <FormValue name={idName} value={idValue} />

      <Callout tone="warn" title={`${label} を${verb}`} reason={consequence} />

      {requiresReason ? (
        <TextArea
          name="reason"
          label={`なぜ${verb}のか`}
          value={reason}
          onValueChange={setReason}
          rows={3}
          hint="記録に残ります。後から「なぜ無いのか」を聞かれたときに、ここが答えになります。"
          error={state.field === "reason" ? state.message : null}
          toolParamDescription={`${verb}理由（記録に残る）`}
        />
      ) : null}

      <CheckboxGroup
        name="acknowledged"
        label="確認"
        selected={acknowledged}
        onSelectedChange={setAcknowledged}
        options={[{ value: "yes", label: acknowledgement }]}
      />

      {state.status === "failed" && state.field === undefined ? (
        <Callout tone="warn" title="できませんでした" reason={state.message} />
      ) : null}

      <Button
        type="submit"
        tone="danger"
        disabled={pending || (requiresReason && reason.trim() === "") || acknowledged.length === 0}
      >
        {pending ? "実行しています…" : `${label} を${verb}`}
      </Button>
    </ToolForm>
  );
}
