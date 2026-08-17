import type { ActorContext } from "@/domain/shared";
import { taggedString } from "@/domain/shared";
import { SAMPLE_WORKSPACE_ID } from "../persistence/sample/ranking-sample-repository";
import { registerStub } from "../stub-registry";

/**
 * ★ これは仮置きのログイン情報です（スタブ）。★
 *
 * 認証（Better Auth + Google）を入れるまでのあいだ、
 * 画面と AI 入口の経路を通すために「見本の担当者」を返す。
 *
 * ここで返す権限は編集までで、**公開の権限は含めない**。
 * 認証が無い状態で公開まで通せると、誰でも記事を出せる作りになってしまう。
 *
 * 本実装への差し替えはこのファイル 1 つ。画面側は 1 行も変わらない。
 */
const stub = registerStub({
  id: "identity:sample-actor",
  port: "現在のログイン利用者の取得",
  label: "ログイン情報（見本）",
  blockedBy: "Better Auth と Google ログインの設定",
});

export const SAMPLE_ACTOR: ActorContext = {
  workspaceId: SAMPLE_WORKSPACE_ID,
  userId: taggedString<"UserId">("u_sample"),
  /**
   * `analyst` を足してあるのは、成果と収益の画面を実際に確かめられるようにするため。
   * `analyst` が持つのは「数字を読む」権限だけで、承認も公開も含まれない。
   * ここに `publisher` や `owner` を足すと、認証が無いまま公開まで通ってしまう。
   *
   * `feedback_admin` は「使い勝手を直す」の画面を実際に開けるようにするため。
   * これが無いと、右下の改善ボタンも一覧も**常に権限の無い表示**になり、
   * 認証を入れるまで誰もこの機能を確かめられない（実際そうなっていた）。
   * この役割も記事の権限を 1 つも持たないので、公開は通らないままである。
   */
  roles: ["researcher", "writer", "reviewer", "analyst", "feedback_admin"],
  isAiServiceAccount: false,
};

export function sampleActorNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

/** 現在のログイン利用者。認証が入るまでは見本を返す。 */
export async function getCurrentActor(): Promise<ActorContext> {
  return SAMPLE_ACTOR;
}
