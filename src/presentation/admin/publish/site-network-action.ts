"use server";

import { revalidatePath } from "next/cache";
import { NETWORK_ROLES, NETWORK_STATUSES } from "@/domain/blogops";
import { blogOpsEntry, signedInActor } from "@/presentation/composition";
import {
  parseEnumOrFailure,
  parseFiniteIntegerOrFailure,
  parseIntentOrFailure,
  parsePresentTextOrFailure,
} from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const PATH = "/admin/site-network";

function revalidatePublicSite(siteSlug: string): void {
  revalidatePath(`/s/${siteSlug}`, "layout");
}

/**
 * ブログ同士のつながりを足す・直す・外す。
 *
 * 3 つを 1 つの関数にしているのは、**どれも同じ 1 本の線を触る操作**だからである。
 * 画面側で 3 つに割ると、ログインの確認と入力の検査が 3 か所に散る。
 * 何をするかは `intent` が決め、行き先はユースケースが 3 つに分かれて受ける。
 */
export async function manageSiteNetworkAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログのつながりの編集");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const intent = parseIntentOrFailure(
    text("intent"),
    ["create", "update", "delete", "restore"] as const,
  );
  if (!intent.ok) return intent.failure;

  if (intent.value === "delete") {
    const result = await entry.deleteNetworkNode.execute(actor, {
      nodeId: text("nodeId"),
      reason: text("reason"),
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(PATH);
    revalidatePath(`${PATH}/deleted`);
    revalidatePublicSite(result.value.siteSlug);
    return {
      status: "done",
      message: `「${result.value.name}」を外しました。`,
    };
  }

  if (intent.value === "restore") {
    const result = await entry.restoreNetworkNode.execute(actor, { nodeId: text("nodeId") });
    if (!result.ok) return failureFromDomainError(result.error);
    revalidatePath(PATH);
    revalidatePath(`${PATH}/deleted`);
    revalidatePublicSite(result.value.siteSlug);
    return {
      status: "done",
      message: `「${result.value.name}」を同じ URL でサイト網へ戻しました。`,
    };
  }

  const parsedParentSlug = parsePresentTextOrFailure(formData, {
    field: "parentSlug",
    label: "親のブログ",
  });
  if (!parsedParentSlug.ok) return parsedParentSlug.failure;
  const parentSlug = parsedParentSlug.value === "" ? null : parsedParentSlug.value;

  if (intent.value === "update") {
    const status = parseEnumOrFailure(text("status"), NETWORK_STATUSES, {
      field: "status",
      label: "公開状態",
    });
    if (!status.ok) return status.failure;
    const position = parseFiniteIntegerOrFailure(formData, {
      field: "position",
      label: "並び順",
    });
    if (!position.ok) return position.failure;
    const result = await entry.updateNetworkNode.execute(actor, {
      nodeId: text("nodeId"),
      name: text("name"),
      oneLine: text("oneLine"),
      position: position.value,
      status: status.value,
      parentSlug,
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(PATH);
    revalidatePublicSite(result.value.siteSlug);
    return {
      status: "done",
      message:
        result.value.changed.length === 0
          ? "変わったところがないので、そのままにしました。"
          : `${result.value.changed.join("・")} を直しました。`,
    };
  }

  const role = parseEnumOrFailure(text("role"), NETWORK_ROLES, {
    field: "role",
    label: "ブログの役割",
  });
  if (!role.ok) return role.failure;
  const result = await entry.createNetworkNode.execute(actor, {
    siteSlug: text("siteSlug"),
    role: role.value,
    parentSlug,
    name: text("name"),
    oneLine: text("oneLine"),
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(PATH);
  revalidatePublicSite(result.value.siteSlug);
  return { status: "done", message: `「${result.value.siteSlug}」をつながりに足しました。` };
}
