import { type DomainError, domainError } from "./errors";
import { type Result, err, ok } from "./result";

/**
 * 文脈をまたいで伝える「起きたこと」の正本（プラットフォーム層 §23.2）。
 *
 * **文脈どうしを直接呼び合わせないための仕組み。**
 * 記事の文脈が配信の文脈の関数を直接呼ぶと、片方を直すたびに両方が壊れる。
 * 「起きたこと」だけを流し、受け手が自分の都合で反応する形にしておくと、
 * 受け手を増やしても送り手は変わらない。
 *
 * 名前をここに列挙するのは、送り手と受け手で綴りがずれる事故を型で止めるため。
 * 文字列を直接書いた瞬間に、受け取れないイベントが静かに生まれる。
 */

/** 送り手の文脈（境界づけられたコンテキスト）。 */
export type EventContext =
  | "monetization"
  | "product"
  | "authoring"
  | "distribution"
  | "evidence"
  | "compliance";

export type EventSpec = {
  /** どの文脈が出すか。受け手はどの文脈でもよい。 */
  readonly context: EventContext;
  /** 何が起きたかの 1 文。運用者がログで読む文。 */
  readonly description: string;
  /**
   * 受け手が必ず使う項目。
   * ここに無いものを受け手が読み始めたら、それは送り手との約束を増やしたということ。
   */
  readonly requiredKeys: readonly string[];
};

export const DOMAIN_EVENTS = {
  "affiliate_url.submitted": {
    context: "monetization",
    description: "成果リンクが受信箱に入った",
    requiredKeys: ["ingestionId", "url"],
  },
  "affiliate_url.resolved": {
    context: "monetization",
    description: "受信したリンクの行き先と広告主が判明した",
    requiredKeys: ["ingestionId", "programId"],
  },
  "product.matched": {
    context: "product",
    description: "リンクの行き先が既知の商品と結びついた",
    requiredKeys: ["ingestionId", "productId"],
  },
  "product.enriched": {
    context: "product",
    description: "商品の属性が新しい情報源で補われた",
    requiredKeys: ["productId", "sourceArtifactId"],
  },
  "comparison.ready": {
    context: "product",
    description: "比較の候補がそろい、比較表を作れる状態になった",
    requiredKeys: ["comparisonSetId"],
  },
  "content_package.created": {
    context: "authoring",
    description: "記事のまとまり（同じ素材から作る一式）が作られた",
    requiredKeys: ["contentPackageId"],
  },
  "content_variant.generated": {
    context: "authoring",
    description: "媒体ごとの原稿ができた（まだ公開してよい状態ではない）",
    requiredKeys: ["variantId"],
  },
  "content_variant.approved": {
    context: "authoring",
    description: "人が原稿を承認した",
    requiredKeys: ["variantId", "approvedBy"],
  },
  "publication.scheduled": {
    context: "distribution",
    description: "出し先と日時が決まった",
    requiredKeys: ["publicationId", "scheduledAt"],
  },
  "publication.published": {
    context: "distribution",
    description: "出し先へ公開された",
    requiredKeys: ["publicationId"],
  },
  "publication.failed": {
    context: "distribution",
    description: "出し先への公開に失敗した",
    requiredKeys: ["publicationId", "reason"],
  },
  "affiliate_link.broken": {
    context: "monetization",
    description: "成果リンクが切れている（読者を行き止まりに送っている）",
    requiredKeys: ["affiliateLinkId", "reason"],
  },
  "affiliate_program.terminated": {
    context: "monetization",
    description: "提携そのものが終了した（掲載中の記事の見直しが要る）",
    requiredKeys: ["programId"],
  },
  "claim.expired": {
    context: "evidence",
    description: "根拠の有効期限が切れた（その主張はもう出せない）",
    requiredKeys: ["claimId"],
  },
  "content.refresh_due": {
    context: "authoring",
    description: "記事の見直し時期が来た",
    requiredKeys: ["variantId"],
  },
  "conversion.received": {
    context: "monetization",
    description: "成果が計上された",
    requiredKeys: ["conversionId"],
  },
} as const satisfies Readonly<Record<string, EventSpec>>;

export type DomainEventName = keyof typeof DOMAIN_EVENTS;

export const DOMAIN_EVENT_NAMES = Object.keys(DOMAIN_EVENTS) as readonly DomainEventName[];

export function describeEvent(name: DomainEventName): EventSpec {
  return DOMAIN_EVENTS[name];
}

/** 出来事そのもの。誰の作業場所で、いつ、何が起きたか。 */
export type OutgoingEvent = {
  readonly name: DomainEventName;
  readonly workspaceId: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<Record<string, unknown>>;
};

/**
 * 出来事を組み立てる。
 *
 * 受け手が必ず使う項目が欠けていたら、送る前に断る。
 * 欠けたまま流すと、受け手側で「なぜか動かない」として現れ、原因が追えなくなる。
 */
export function buildEvent(
  name: DomainEventName,
  workspaceId: string,
  occurredAt: Date,
  payload: Readonly<Record<string, unknown>>,
): Result<OutgoingEvent, DomainError> {
  const missing = DOMAIN_EVENTS[name].requiredKeys.filter(
    (key) => payload[key] === undefined || payload[key] === null,
  );
  if (missing.length > 0) {
    return err(
      domainError("VALIDATION_FAILED", `出来事「${name}」に必要な項目がありません。`, {
        suggestedAction: `不足している項目: ${missing.join(" / ")}`,
        details: { name, missing: missing.join(" / ") },
      }),
    );
  }
  return ok({ name, workspaceId, occurredAt, payload });
}
