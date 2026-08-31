"use server";

import { revalidatePath } from "next/cache";
import { settingsUseCases, signedInActor } from "@/presentation/composition";
import type { ComplianceState } from "./compliance-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const PATH = "/admin/settings/compliance";

/**
 * 広告表記を登録・変更する。
 *
 * --- 読者に出る文を、この関数で組み立てない ---
 * 送られてくるのは関係の種類と関与の範囲だけである。表示文は domain が作る。
 * ここで文を受け取れる形にすると、画面から短い文（「PR」だけ）を
 * 送れるようになり、**規制が求めている判別しやすさが画面ごとに崩れる。**
 *
 * --- ログインを先に見る ---
 * `currentActor()` ではなく `signedInActor()` を使う。前者は身元を確かめられない
 * とき見本の身元へ落ちるので、**ログインしていない人の変更が保存先まで届く。**
 */
export async function editDisclosureAction(
  _prev: ComplianceState,
  formData: FormData,
): Promise<ComplianceState> {
  const actor = await signedInActor();
  if (actor === null) {
    return notSignedInFailure("広告表記の変更");
  }

  const uc = await settingsUseCases();
  const advertiser = String(formData.get("advertiserOrSupplier") ?? "").trim();
  const disclosureId = String(formData.get("disclosureId") ?? "").trim();

  const result = await uc.editDisclosure.execute(actor, {
    ...(disclosureId === "" ? {} : { disclosureId }),
    relationshipType: String(formData.get("relationshipType") ?? ""),
    advertiserOrSupplier: advertiser === "" ? null : advertiser,
    editorialInfluence: String(formData.get("editorialInfluence") ?? ""),
    aiAssisted: formData.get("aiAssisted") !== null,
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) {
    return failureFromDomainError(result.error);
  }

  revalidatePath(PATH);

  // **保存した文をそのまま返す。**「保存しました」だけだと、
  // 読者に何が出ることになったのかを確かめるために画面を読み直すことになる。
  return {
    status: "done",
    message: `${result.value.message} 読者にはこう出ます:「${result.value.visibleMessage}」`,
  };
}

/**
 * 表記のきまりを足す・止める・効かせる。
 *
 * 足すのと止めるのを 1 つの関数にしているのは、ユースケース側が 1 つの口
 * （`editPolicyRule`）だからである。画面側だけ 2 つに割ると、
 * ログインと役の確認が 2 か所に散り、どちらかが緩いまま残る。
 *
 * 分野・出し先・強さは文字列のまま渡す。ここで型を付けて通すと、
 * **語彙にない値が型の上でだけ正しくなって保存先まで届く。**
 * 語彙の確認はユースケース（domain の判定関数）が行う。
 */
export async function editPolicyRuleAction(
  _prev: ComplianceState,
  formData: FormData,
): Promise<ComplianceState> {
  const actor = await signedInActor();
  if (actor === null) {
    return notSignedInFailure("表記のきまりの変更");
  }

  const uc = await settingsUseCases();
  const intent = String(formData.get("intent") ?? "");
  const reason = String(formData.get("reason") ?? "");

  const result = await uc.editPolicyRule.execute(
    actor,
    intent === "set_enabled"
      ? {
          action: "set_enabled",
          ruleId: String(formData.get("ruleId") ?? ""),
          enabled: String(formData.get("enabled") ?? "") === "true",
          reason,
        }
      : {
          action: "save",
          name: String(formData.get("name") ?? ""),
          domainScope: String(formData.get("domainScope") ?? ""),
          channelScope: String(formData.get("channelScope") ?? ""),
          severity: String(formData.get("severity") ?? ""),
          pattern: String(formData.get("pattern") ?? ""),
          basis: String(formData.get("basis") ?? ""),
          suggestion: String(formData.get("suggestion") ?? ""),
          reason,
        },
  );

  if (!result.ok) {
    return failureFromDomainError(result.error);
  }

  revalidatePath(PATH);
  return { status: "done", message: result.value.message };
}
