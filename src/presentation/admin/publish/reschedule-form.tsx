"use client";

import { useActionState, useState } from "react";
import { Button, Callout, Field, FormValue, ToolForm } from "@/presentation/ui";
import { reschedulePublicationAction } from "./reschedule-action";
import { INITIAL_RESCHEDULE_STATE } from "./reschedule-state";

/**
 * 投稿予定日を変える欄。
 *
 * 日時を選ぶ欄 1 つと実行ボタン 1 つだけにしてある。
 * カレンダーの升目を掴んで動かす操作は、
 * キーボードだけを使う人・手が震える人が扱えないため、
 * **この欄を正の手段**にしている（掴む操作は後から足す）。
 *
 * 変えられない配信では、欄そのものを出さずに理由を出す。
 * 押せないボタンだけを置くと、なぜ押せないかが分からない。
 */
export function RescheduleForm({
  publicationId,
  currentValue,
  disabledReason,
  label,
}: {
  readonly publicationId: string;
  /** YYYY-MM-DDTHH:mm。未設定なら空文字。 */
  readonly currentValue: string;
  readonly disabledReason: string | null;
  /** 何の配信の予定かが分かる言葉。読み上げのために欄ごとに変える。 */
  readonly label: string;
}) {
  const [state, action, pending] = useActionState(reschedulePublicationAction, INITIAL_RESCHEDULE_STATE);
  const [value, setValue] = useState(currentValue);

  if (disabledReason !== null) {
    return <Callout tone="info" title="予定日は変えられません" reason={disabledReason} />;
  }

  return (
    <ToolForm action={action} toolName="reschedule_publication" toolDescription="配信の予定日時を変える">
      <FormValue name="publicationId" value={publicationId} />
      <Field
        name="scheduledAt"
        type="datetime-local"
        label={`${label}の予定日時`}
        value={value}
        onValueChange={setValue}
        hint="空にすると「承認され次第すぐに出す」に戻ります。過去の日時は指定できません。"
        error={state.status === "failed" ? state.message : null}
        toolParamDescription="配信を出す日時。YYYY-MM-DDTHH:mm 形式。空文字にすると予定日を外す。"
        optional
      />
      {state.status === "done" ? (
        <Callout tone="info" title="予定日を変えました" reason={state.message} />
      ) : null}
      <Button type="submit" tone="primary" busy={pending} busyLabel="変えています">
        予定日を変える
      </Button>
    </ToolForm>
  );
}
