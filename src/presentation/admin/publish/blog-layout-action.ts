"use server";

import { revalidatePath } from "next/cache";
import {
  DELIVERY_PARTS,
  LAYOUT_REGIONS,
  TOP_BANDS,
} from "@/domain/blogops";
import { siteBasePathBySlug } from "@/domain/authoring/site";
import { blogOpsEntry, siteUseCases, signedInActor } from "@/presentation/composition";
import { requestOriginFromNextHeaders } from "@/presentation/http/request-origin";
import {
  parseCheckboxWithMarkerOrFailure,
  parseEnumOrFailure,
  parseFiniteIntegerOrFailure,
  parseIntentOrFailure,
} from "./blog-action-input";
import type { BlogOpsState } from "./blog-ops-state";
import { failureFromDomainError, notSignedInFailure } from "../use-case-result";

const LAYOUT_PATH = "/admin/blog/layout";
const DELIVERY_PATH = "/admin/blog/delivery";

/**
 * ヘッダー・サイドバー・フッターの枠と、トップの帯を保存する。
 *
 * 枠と帯を 1 つの口にしているのは、**画面が 1 枚だから**である。
 * 版面の画面では枠と帯を並べて見比べながら直すので、
 * 口を割ると「どちらを保存したか」を画面側が覚えることになる。
 */
export async function manageBlogLayoutAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("ブログの版面の設定");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const siteSlug = text("siteSlug");
  const intent = parseIntentOrFailure(text("intent"), ["slot", "band"] as const);
  if (!intent.ok) return intent.failure;
  const enabled = parseCheckboxWithMarkerOrFailure(formData, {
    field: "enabled",
    markerField: "enabledPresent",
    label: "表示設定",
  });
  if (!enabled.ok) return enabled.failure;

  if (intent.value === "band") {
    const band = parseEnumOrFailure(text("band"), TOP_BANDS, {
      field: "band",
      label: "トップの帯",
    });
    if (!band.ok) return band.failure;
    const itemLimit = parseFiniteIntegerOrFailure(formData, {
      field: "itemLimit",
      label: "並べる本数",
      min: 0,
      max: 24,
    });
    if (!itemLimit.ok) return itemLimit.failure;
    const position = parseFiniteIntegerOrFailure(formData, {
      field: "position",
      label: "並び順",
    });
    if (!position.ok) return position.failure;
    const result = await entry.saveLayoutBand.execute(actor, {
      siteSlug,
      band: band.value,
      title: text("title"),
      enabled: enabled.value,
      position: position.value,
      itemLimit: itemLimit.value,
    });
    if (!result.ok) {
      return failureFromDomainError(result.error);
    }
    revalidatePath(LAYOUT_PATH);
    return { status: "done", message: "帯の設定を保存しました。" };
  }

  const region = parseEnumOrFailure(text("region"), LAYOUT_REGIONS, {
    field: "region",
    label: "枠の置き場所",
  });
  if (!region.ok) return region.failure;
  const position = parseFiniteIntegerOrFailure(formData, {
    field: "position",
    label: "並び順",
  });
  if (!position.ok) return position.failure;
  const result = await entry.saveLayoutSlot.execute(actor, {
    siteSlug,
    region: region.value,
    slotKey: text("slotKey"),
    title: text("title"),
    body: text("body"),
    position: position.value,
    enabled: enabled.value,
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(LAYOUT_PATH);
  return { status: "done", message: "枠の設定を保存しました。" };
}

/**
 * 配信部品（feed・sitemap・AI 向けの案内など）の出し入れ。
 *
 * 版面と口を分けてあるのは、**触る相手が違う**からである。
 * 版面は読者の目に映る位置の話で、配信は機械が読む経路の話。
 * 経路を切ると検索や AI から見えなくなるので、切った理由を `note` に残させる。
 */
export async function manageBlogDeliveryAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("配信部品の設定");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const part = parseEnumOrFailure(text("part"), DELIVERY_PARTS, {
    field: "part",
    label: "配信部品",
  });
  if (!part.ok) return part.failure;
  const enabled = parseCheckboxWithMarkerOrFailure(formData, {
    field: "enabled",
    markerField: "enabledPresent",
    label: "配信設定",
  });
  if (!enabled.ok) return enabled.failure;
  const position = parseFiniteIntegerOrFailure(formData, {
    field: "position",
    label: "並び順",
  });
  if (!position.ok) return position.failure;

  const result = await entry.saveDeliveryPart.execute(actor, {
    siteSlug: text("siteSlug"),
    part: part.value,
    enabled: enabled.value,
    note: text("note"),
    position: position.value,
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(DELIVERY_PATH);
  return { status: "done", message: "配信部品の設定を保存しました。" };
}

/**
 * 配信物を実際に組み立ててみて、結果を積む (受入 A9)。
 *
 * **設定の保存と口を分けてある。**保存のついでに点検すると、
 * 「保存したから緑」になり、点検が保存の言い換えになる。
 * 押した時刻の結果が 1 件ずつ残ることに意味があるので、押す口も別にする。
 *
 * 住所の起点は**届いたリクエストから作る**（sitemap/RSS の口と同じ規則）。
 * 環境変数に持つと、開発と本番で違う住所を点検したまま緑になる。
 */
export async function checkBlogDeliveryAction(
  _prev: BlogOpsState,
  formData: FormData,
): Promise<BlogOpsState> {
  const actor = await signedInActor();
  if (actor === null) return notSignedInFailure("配信物の点検");

  const entry = await blogOpsEntry();
  if (!entry.ready) return { status: "failed", message: entry.reason };

  const siteSlug = String(formData.get("siteSlug") ?? "").trim();
  const origin = await requestOriginFromNextHeaders();
  if (origin === null) {
    return {
      status: "failed",
      message: "住所の起点が分からないため点検できません。ブラウザから開き直してください。",
    };
  }
  // 設計図（名前・目的・案内文を出すか）は読者側と同じ口から引く。
  // ここで別に持つと、点検した設計図と実際に配る設計図がずれる。
  const site = await (await siteUseCases()).getSite.execute(actor, { siteSlug });
  if (!site.ok) {
    return failureFromDomainError(site.error);
  }

  const result = await entry.checkDelivery.execute(actor, {
    siteSlug,
    siteName: site.value.blueprint.name,
    purpose: site.value.blueprint.purpose,
    origin,
    basePath: siteBasePathBySlug(siteSlug),
    emitLlmsTxt: site.value.blueprint.emitLlmsTxt,
  });
  if (!result.ok) {
    return failureFromDomainError(result.error);
  }
  revalidatePath(DELIVERY_PATH);
  return {
    status: "done",
    message:
      result.value.missing.length === 0
        ? `${result.value.checked} 種すべてを点検し、欠落はありませんでした。`
        : `${result.value.checked} 種を点検し、${result.value.missing.length} 種で欠落が見つかりました。`,
  };
}
