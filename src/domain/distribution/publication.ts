import {
  type ChannelConnectionId,
  type ContentVariantId,
  type DomainError,
  type PublicationId,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";
import type { GateResult } from "../compliance/publish-gate";
import { type ChannelKind, CHANNEL_CAPABILITIES, supportsDirectPublish } from "./channel";

/**
 * Distribution コンテキスト / Publication 集約 (プラットフォーム層 §18.2)。
 *
 * 1 回の「どこへ・いつ・何を出すか」を表す。
 * 公開ゲート (Compliance) を通っていない Publication は SENDING へ進めない。
 * これが集約の不変条件であり、画面・API・MCP のどの経路から来ても同じ判定になる。
 */
export const PUBLICATION_STATES = [
  "QUEUED",
  "RENDERING",
  "VALIDATING",
  "SENDING",
  "PUBLISHED",
  "MANUAL_EXPORT_READY", // 公式 API が無いチャネル (note) の到達点
  "FAILED_VALIDATION",
  "FAILED_SEND",
  "RETRY_SCHEDULED",
  "CANCELLED",
] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

const ALLOWED: Readonly<Record<PublicationState, readonly PublicationState[]>> = {
  QUEUED: ["RENDERING", "CANCELLED"],
  RENDERING: ["VALIDATING", "FAILED_VALIDATION", "CANCELLED"],
  VALIDATING: ["SENDING", "MANUAL_EXPORT_READY", "FAILED_VALIDATION", "CANCELLED"],
  SENDING: ["PUBLISHED", "FAILED_SEND"],
  PUBLISHED: [],
  MANUAL_EXPORT_READY: ["PUBLISHED", "CANCELLED"],
  FAILED_VALIDATION: ["QUEUED", "CANCELLED"],
  FAILED_SEND: ["RETRY_SCHEDULED", "CANCELLED"],
  RETRY_SCHEDULED: ["SENDING", "CANCELLED"],
  CANCELLED: [],
};

/** 再試行の上限。無限に叩くと相手先の規約違反になる。 */
export const MAX_SEND_ATTEMPTS = 5;

export type Publication = {
  readonly id: PublicationId;
  readonly workspaceId: WorkspaceId;
  readonly variantId: ContentVariantId;
  readonly channelKind: ChannelKind;
  readonly connectionId: ChannelConnectionId | null;
  readonly state: PublicationState;
  /** 予約時刻。null は即時。 */
  readonly scheduledAt: Date | null;
  /**
   * 冪等キー。
   * 同じキーの送信は 1 回しか行わない。
   * 再試行・二重クリック・Queue の再配信で同じ投稿が 2 つ出るのを防ぐ。
   */
  readonly idempotencyKey: string;
  readonly attempts: number;
  /** 送信先での ID。取り下げと計測に必要。 */
  readonly externalId: string | null;
  readonly externalUrl: string | null;
  /** 直近の失敗理由。利用者にそのまま見せる文。 */
  readonly lastError: string | null;
  readonly publishedAt: Date | null;
};

export function createPublication(input: {
  id: PublicationId;
  workspaceId: WorkspaceId;
  variantId: ContentVariantId;
  channelKind: ChannelKind;
  connectionId: ChannelConnectionId | null;
  scheduledAt?: Date | null;
  idempotencyKey: string;
}): Result<Publication, DomainError> {
  if (input.idempotencyKey.trim() === "") {
    return err(
      validationError(
        "冪等キーが必要です。無いと同じ投稿が二重に出ることを防げません。",
        "idempotencyKey",
      ),
    );
  }
  if (supportsDirectPublish(input.channelKind) && input.connectionId === null) {
    return err(
      validationError(
        `${CHANNEL_CAPABILITIES[input.channelKind].label} へ出すには、先に接続の設定が必要です。`,
        "connectionId",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    variantId: input.variantId,
    channelKind: input.channelKind,
    connectionId: input.connectionId,
    state: "QUEUED",
    scheduledAt: input.scheduledAt ?? null,
    idempotencyKey: input.idempotencyKey.trim(),
    attempts: 0,
    externalId: null,
    externalUrl: null,
    lastError: null,
    publishedAt: null,
  });
}

/**
 * 状態を進める。
 *
 * VALIDATING から先へ進むときだけ、公開ゲートの結果を要求する。
 * 引数で受け取る理由: ゲート判定は Compliance の仕事であり、
 * Distribution はその結果に従うだけにしたいため (責務を混ぜない)。
 */
export function advance(
  publication: Publication,
  to: PublicationState,
  context: { gate?: GateResult; at: Date },
): Result<Publication, DomainError> {
  if (!ALLOWED[publication.state].includes(to)) {
    return err(
      domainError("CONFLICT", `この配信は ${publication.state} から ${to} へ進めません。`, {
        suggestedAction: `進める先: ${ALLOWED[publication.state].join(" / ") || "なし"}`,
      }),
    );
  }

  if (publication.state === "VALIDATING" && (to === "SENDING" || to === "MANUAL_EXPORT_READY")) {
    if (!context.gate) {
      return err(
        domainError("PUBLISH_GATE_FAILED", "公開前の確認が行われていません。", {
          suggestedAction: "記事の公開前チェックを実行してください。",
        }),
      );
    }
    if (!context.gate.ok) {
      return err(
        domainError(
          "PUBLISH_GATE_FAILED",
          `公開前の確認に通っていません: ${context.gate.failures.map((f) => f.message).join(" / ")}`,
          { suggestedAction: "上記を直してから、もう一度公開してください。" },
        ),
      );
    }
  }

  // 公式 API が無いチャネルへ「送信」しようとした場合は止める。
  if (to === "SENDING" && !supportsDirectPublish(publication.channelKind)) {
    return err(
      domainError(
        "FORBIDDEN",
        `${CHANNEL_CAPABILITIES[publication.channelKind].label} には自動投稿の仕組みがありません。`,
        { suggestedAction: "下書きを書き出して、ご自身で投稿してください。" },
      ),
    );
  }

  if (to === "SENDING" && publication.attempts >= MAX_SEND_ATTEMPTS) {
    return err(
      domainError("CONFLICT", `送信を ${MAX_SEND_ATTEMPTS} 回試して成功しませんでした。`, {
        suggestedAction: "接続設定を確認してから、あらためて実行してください。",
      }),
    );
  }

  return ok({
    ...publication,
    state: to,
    attempts: to === "SENDING" ? publication.attempts + 1 : publication.attempts,
    publishedAt: to === "PUBLISHED" ? context.at : publication.publishedAt,
  });
}

export function recordSendFailure(publication: Publication, message: string): Publication {
  return { ...publication, state: "FAILED_SEND", lastError: message };
}

export function recordSendSuccess(
  publication: Publication,
  external: { id: string; url: string | null },
  at: Date,
): Publication {
  return {
    ...publication,
    state: "PUBLISHED",
    externalId: external.id,
    externalUrl: external.url,
    publishedAt: at,
    lastError: null,
  };
}

/**
 * 再試行してよいか。
 *
 * 相手先の一時的な失敗 (5xx・レート制限) だけ再試行する。
 * 内容が悪い失敗を再試行しても同じ結果になり、規約違反の連打になる。
 */
export function canRetry(publication: Publication, retryable: boolean): boolean {
  return (
    retryable && publication.state === "FAILED_SEND" && publication.attempts < MAX_SEND_ATTEMPTS
  );
}

/**
 * 冪等キーを組み立てる。
 *
 * 「同じ原稿を同じチャネルへ同じ予定時刻で」出す要求は 1 回とみなす。
 * 時刻を含める理由: 定期投稿で同じ原稿を意図的に再投稿する場合があるため。
 */
export function buildIdempotencyKey(input: {
  variantId: ContentVariantId;
  channelKind: ChannelKind;
  scheduledAt: Date | null;
}): string {
  const when = input.scheduledAt ? input.scheduledAt.toISOString() : "immediate";
  return `${input.variantId}:${input.channelKind}:${when}`;
}
