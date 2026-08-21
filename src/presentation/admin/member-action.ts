"use server";

import { revalidatePath } from "next/cache";
import { ROLE_LABEL } from "@/application/usecases/identity/manage-workspace";
import type { Role } from "@/domain/shared";
import { settingsUseCases, signedInActor } from "@/presentation/composition";
import { notSignedInText, refusalText } from "@/presentation/refusal-text";
import type { MemberState } from "./member-state";

const PATH = "/admin/settings";

/**
 * 送られてきた役割の一覧を、**知っている役割だけ**に絞る。
 *
 * 画面から来る値は文字列で、そのまま `Role` として扱うと型の上でだけ正しい
 * 別物が権限の表に入る。表に無い役割は `capabilitiesOf` で何も返さないため、
 * 「役割は付いているのに何もできない担当者」が静かに増える。
 * ここで落として、空になれば下の検査が断る。
 */
function toRoles(values: readonly string[]): readonly Role[] {
  const known = new Set(Object.keys(ROLE_LABEL));
  return values.filter((v) => known.has(v)) as readonly Role[];
}

/**
 * 担当者を招く・役割を変える・担当を外す。
 *
 * --- 3 つを 1 つの関数にしている理由 ---
 * ユースケース側が 1 つの口だからである（`manage_members`）。画面側だけ 3 つに割ると、
 * ログインの確認と権限の確認が 3 か所へ散り、どれか 1 つが緩いまま残る。
 *
 * --- ログインを見るのは、いちばん先である ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は確かめられないとき
 * 見本の身元へ落ちるので、**ログインしていない人が担当者を招ける**ことになる。
 * 招待は権限そのものなので、ここだけは見本へ落とさない。
 *
 * --- 招待は「入れる」ことと同じではない ---
 * ここで足すのは名簿の 1 行であって、入口の許可（`AUTH_ALLOWED_EMAILS`）ではない。
 * 2 つの門は別のままにしてある。片方だけを通しても入れないので、
 * 招待の直後に相手が入れないことは**不具合ではない**。画面の文でもそう伝える。
 */
export async function manageMemberAction(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  const actor = await signedInActor();
  if (actor === null) {
    return { status: "failed", message: notSignedInText("担当者の招待・役割の変更・取り消し") };
  }

  const intent = String(formData.get("intent") ?? "");
  const uc = await settingsUseCases();

  const input =
    intent === "invite"
      ? ({
          action: "invite" as const,
          invitedEmail: String(formData.get("invitedEmail") ?? ""),
          displayName: String(formData.get("displayName") ?? ""),
          roles: toRoles(formData.getAll("roles").map(String)),
        } as const)
      : intent === "change_roles"
        ? ({
            action: "change_roles" as const,
            membershipId: String(formData.get("membershipId") ?? ""),
            roles: toRoles(formData.getAll("roles").map(String)),
            reason: String(formData.get("reason") ?? ""),
          } as const)
        : ({
            action: "revoke" as const,
            membershipId: String(formData.get("membershipId") ?? ""),
            reason: String(formData.get("reason") ?? ""),
          } as const);

  const result = await uc.manageMembers.execute(actor, input);

  if (!result.ok) {
    return {
      status: "failed",
      message: refusalText(result.error),
      field: result.error.field,
    };
  }

  revalidatePath(PATH);

  return { status: "done", message: result.value.message };
}
