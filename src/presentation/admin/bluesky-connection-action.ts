"use server";

import { revalidatePath } from "next/cache";
import { distributionUseCases, signedInActor } from "@/presentation/composition";
import type { BlueskyConnectionState } from "./bluesky-connection-state";
import { failureFromDomainError, notSignedInFailure } from "./use-case-result";

const BLUESKY_CREDENTIAL_REF = "channel/conn_bluesky/credentials";

/**
 * Cloudflareへ登録済みのBluesky認証情報を、workspace共通の接続として確定する。
 *
 * 秘密値も参照名も画面から受け取らない。受け取れる形にすると、利用者が別の
 * Secretを指定でき、接続先DIDを固定する境界が画面ごとに分岐するためである。
 * 実際のhandleとDIDは既存ユースケースがBlueskyへ認証して得た値だけを保存する。
 */
export async function registerBlueskyConnectionAction(
  _prev: BlueskyConnectionState,
  _formData: FormData,
): Promise<BlueskyConnectionState> {
  const actor = await signedInActor();
  if (actor === null) {
    // currentActor() は未認証時に見本actorへ落ちる。変更操作では使わず、
    // FormDataを読む前に閉じる。今回は固定値だけなのでFormData自体を読まない。
    return notSignedInFailure("Blueskyとの接続");
  }

  const result = await (await distributionUseCases()).registerConnection.execute(actor, {
    channelKind: "bluesky",
    // 実認証後、providerが返したhandleへ置き換わる仮ラベル。
    accountLabel: "Bluesky",
    credentialRef: BLUESKY_CREDENTIAL_REF,
  });

  if (!result.ok) return failureFromDomainError(result.error);

  revalidatePath("/admin/distribution");
  return {
    status: "done",
    message: `Blueskyの「${result.value.accountLabel}」として接続しました。認証で確認したDIDも接続先として固定しました。`,
  };
}
