"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution";
import { Button, Callout, Field, FormResult, FormValue, Select, ToolForm } from "@/presentation/ui";
import { schedulePublicationAction } from "./schedule-publication-action";
import { INITIAL_SCHEDULE_STATE } from "./schedule-publication-state";
import { adminOperation } from "./admin-operation-manifest";

/**
 * 記事の画面から「この記事を、ここへ出す」を始める欄。
 *
 * **出し先の一覧は登録表から作る。** ここに手で並べると、
 * 出し先を 1 つ足した日に画面だけが古くなり、
 * 「AI からは出せるのに画面からは選べない」が生まれる。
 *
 * 予約時刻は空のままでよい。空 = いま出す、で、
 * 「即時」を選ぶための別のボタンは置かない（選び方が 2 通りになる）。
 */
export function SchedulePublicationForm({
  variantId,
  variants,
}: {
  /** 記事の画面から開いたときの、その記事。配信の画面から開いたときは空。 */
  readonly variantId?: string;
  /**
   * 出せる記事の一覧。渡すと選ぶ欄が出る。
   *
   * 記事の画面から開いたときは渡さない。開いた記事があるのに選ばせると、
   * **見ている記事と出す記事が違う**という取り違えが起きる。
   */
  readonly variants?: readonly {
    readonly value: string;
    readonly label: string;
  }[];
}) {
  const operation = adminOperation("publication.create");
  const [state, action, pending] = useActionState(schedulePublicationAction, INITIAL_SCHEDULE_STATE);
  const [chosenVariantId, setChosenVariantId] = useState(variantId ?? "");
  const [channelKind, setChannelKind] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  const selected = channelKind === "" ? null : CHANNEL_CAPABILITIES[channelKind as ChannelKind];
  const manualOnly = selected !== null && selected.publishMode === "manual_export";

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="承認済みの記事を、指定した先へ出す配信を作る"
    >
      {variants === undefined ? (
        <FormValue name="variantId" value={chosenVariantId} />
      ) : (
        <Select
          name="variantId"
          label="出す記事"
          value={chosenVariantId}
          onValueChange={setChosenVariantId}
          options={variants}
          placeholder="選んでください"
          hint="承認済みの記事だけが出せます。ここに無ければ、まだ承認が済んでいません。"
          error={state.field === "variantId" ? state.message : null}
          toolParamDescription="出す記事の識別子"
        />
      )}

      <Select
        name="channelKind"
        label="出し先"
        value={channelKind}
        onValueChange={setChannelKind}
        options={Object.values(CHANNEL_CAPABILITIES).map((c) => ({
          value: c.kind,
          label: c.label,
        }))}
        placeholder="選んでください"
        error={state.field === "channelKind" ? state.message : null}
        toolParamDescription="出し先の種類（own_site / x / instagram など）"
      />

      {/* 自動で投稿できない先は、押す前に伝える。押してから知らせると、
          「登録したのに出ていない」と読まれる。 */}
      {manualOnly ? (
        <Callout
          tone="warn"
          reason={`${selected.label} には公開された投稿の仕組みがありません。配信は登録できますが、投稿はご自身で行います（下書きの書き出しが使えます）。`}
        />
      ) : null}

      <Field
        name="scheduledAt"
        type="datetime-local"
        label="出す日時"
        value={scheduledAt}
        onValueChange={setScheduledAt}
        optional
        hint="空のままにすると、承認され次第すぐに出ます。過ぎた日時は指定できません。"
        error={state.field === "scheduledAt" ? state.message : null}
        toolParamDescription="出す日時（ISO 8601 の文字列。空なら即時）"
      />

      <FormResult
        state={state}
        // 「すでにあった」は失敗ではない。2 回押しても 1 件のまま、という結果。
        doneTone={state.alreadyExisted === true ? "info" : "success"}
        doneAction={
          state.publicationPath === undefined ? null : (
            <Link href={state.publicationPath}>登録した配信を見る</Link>
          )
        }
      >
        {/* この画面だけの知らせ。手で出す先は、登録しただけでは届かない。 */}
        {state.status === "done" && state.manualExportNotice != null ? (
          <Callout tone="warn" reason={state.manualExportNotice} />
        ) : null}
      </FormResult>

      <Button type="submit" tone="primary" disabled={pending || channelKind === "" || chosenVariantId === ""}>
        {pending ? "登録しています…" : "この先へ出す配信を作る"}
      </Button>
    </ToolForm>
  );
}
