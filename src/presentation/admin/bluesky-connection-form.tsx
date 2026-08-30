"use client";

import { useActionState } from "react";
import { Button, Callout, FormResult, HumanOnlyForm } from "@/presentation/ui";
import { registerBlueskyConnectionAction } from "./bluesky-connection-action";
import { INITIAL_BLUESKY_CONNECTION_STATE } from "./bluesky-connection-state";

const HUMAN_ONLY_REASON =
  "channel_connection.manage は人の承認が必要なworkspace共通操作で、" +
  "AI・REST・MCPへ開くと配信先DIDを人の確認なしに固定できてしまうため。";

/** Cloudflareへ登録済みのBluesky認証情報で、接続先を実認証する。 */
export function BlueskyConnectionForm() {
  const [state, action, pending] = useActionState(
    registerBlueskyConnectionAction,
    INITIAL_BLUESKY_CONNECTION_STATE,
  );

  return (
    <HumanOnlyForm action={action} reason={HUMAN_ONLY_REASON}>
      <Callout
        tone="info"
        reason="Cloudflareに登録した認証情報を使います。アプリパスワードはこの画面では入力も表示もしません。"
      />
      <Button type="submit" tone="primary" busy={pending} busyLabel="接続を確かめています">
        Blueskyとの接続を確認する
      </Button>
      <FormResult state={state} />
    </HumanOnlyForm>
  );
}
