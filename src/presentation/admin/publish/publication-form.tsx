"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { CHANNEL_CAPABILITIES, type ChannelKind } from "@/domain/distribution";
import { Button, Callout, Field, FormResult, FormValue, Select, ToolForm } from "@/presentation/ui";
import { updatePublicationAction } from "./publication-form-action";
import { INITIAL_PUBLICATION_FORM_STATE } from "./publication-form-state";
import { adminOperation } from "../admin-operation-manifest";

export type PublicationEditDefaults = {
  readonly publicationId: string;
  readonly channelKind: string;
  /** `datetime-local` がそのまま読める形。予約が無ければ空。 */
  readonly scheduledAt: string;
};

/**
 * 送信前の配信を直す欄。
 *
 * 出す記事を選ぶ欄は無い。差し替えられると、承認したものと違う文章が
 * **承認済みの配信で外へ出る**。記事を変えたいときは、この配信を取り消して
 * 新しく作る（取り消しの記録が残る）。
 */
export function UpdatePublicationForm({ defaults }: { readonly defaults: PublicationEditDefaults }) {
  const operation = adminOperation("publication.update");
  const [state, action, pending] = useActionState(updatePublicationAction, INITIAL_PUBLICATION_FORM_STATE);
  const [channelKind, setChannelKind] = useState(defaults.channelKind);
  const [scheduledAt, setScheduledAt] = useState(defaults.scheduledAt);

  const selected = channelKind === "" ? null : CHANNEL_CAPABILITIES[channelKind as ChannelKind];
  const manualOnly = selected != null && selected.publishMode === "manual_export";

  return (
    <ToolForm
      action={action}
      toolName={operation.tool}
      toolDescription="送信前の配信の出し先と時刻を直す"
    >
      <FormValue name="publicationId" value={defaults.publicationId} />

      <Select
        name="channelKind"
        label="出し先"
        value={channelKind}
        onValueChange={setChannelKind}
        options={Object.values(CHANNEL_CAPABILITIES).map((c) => ({
          value: c.kind,
          label: c.label,
        }))}
        error={state.field === "channelKind" ? state.message : null}
        toolParamDescription="出し先の種類（own_site / x / instagram など）"
      />

      {/* 自動で投稿できない先は、押す前に伝える。押してから知らせると、
          「直したのに出ていない」と読まれる。 */}
      {manualOnly ? (
        <Callout
          tone="warn"
          reason={`${selected.label} には公開された投稿の仕組みがありません。配信は残せますが、投稿はご自身で行います。`}
        />
      ) : null}

      <Field
        name="scheduledAt"
        type="datetime-local"
        label="出す日時"
        value={scheduledAt}
        onValueChange={setScheduledAt}
        optional
        hint="空にすると予約が外れ、承認され次第すぐに出ます。過ぎた日時は指定できません。"
        error={state.field === "scheduledAt" ? state.message : null}
        toolParamDescription="出す日時（ISO 8601 の文字列。空なら即時）"
      />

      <FormResult
        state={state}
        doneAction={
          state.publicationPath === undefined ? null : (
            <Link href={state.publicationPath}>この配信を見る</Link>
          )
        }
      >
        {/* この画面だけの知らせ。手で出す先は、直しただけでは届かない。 */}
        {state.status === "done" && state.manualExportNotice != null ? (
          <Callout tone="warn" reason={state.manualExportNotice} />
        ) : null}
      </FormResult>

      <Button type="submit" tone="primary" disabled={pending}>
        {pending ? "直しています…" : "この配信を直す"}
      </Button>
    </ToolForm>
  );
}
