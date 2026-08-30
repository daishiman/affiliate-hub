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
import {
  type ChannelKind,
  CHANNEL_CAPABILITIES,
  supportsDirectPublish,
  supportsExternalDirectPublish,
} from "./channel";

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

/**
 * 配信の状態の表示名。**ここが唯一の正本**。
 *
 * 断りの文をここで組み立てるために、domain 側へ置いている。
 * 表示名を上の層だけが持つと、進めなかった理由の文に `PUBLISHED` のような
 * 内部の符号がそのまま出る。符号を見せられた人は、次に何をすればよいか分からない。
 */
export const PUBLICATION_STATE_LABEL: Readonly<Record<PublicationState, string>> = {
  QUEUED: "順番待ち",
  RENDERING: "本文を組み立て中",
  VALIDATING: "出す前の確認中",
  SENDING: "送信中",
  PUBLISHED: "公開済み",
  MANUAL_EXPORT_READY: "書き出し済み（貼り付け待ち）",
  FAILED_VALIDATION: "確認で止まった",
  FAILED_SEND: "送信に失敗した",
  RETRY_SCHEDULED: "再送を待っている",
  CANCELLED: "取りやめ",
};

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

/** 予定日時を人が変更できる状態と、変更時に戻す先。 */
const RESCHEDULE_TARGET: Partial<Record<PublicationState, PublicationState | null>> = {
  QUEUED: null,
  FAILED_VALIDATION: "QUEUED",
  FAILED_SEND: "RETRY_SCHEDULED",
  RETRY_SCHEDULED: null,
  MANUAL_EXPORT_READY: null,
};

export const RESCHEDULABLE_PUBLICATION_STATES = Object.freeze(
  Object.keys(RESCHEDULE_TARGET) as PublicationState[],
);

/** 再試行の上限。無限に叩くと相手先の規約違反になる。 */
export const MAX_SEND_ATTEMPTS = 5;

export type Publication = {
  readonly id: PublicationId;
  readonly workspaceId: WorkspaceId;
  readonly variantId: ContentVariantId;
  /** 予約時に公開前確認を通した本文の版。旧行のnullは送信時にfail-closed。 */
  readonly variantRevision: number | null;
  readonly channelKind: ChannelKind;
  readonly connectionId: ChannelConnectionId | null;
  readonly state: PublicationState;
  /** 予約時刻。null は即時。 */
  readonly scheduledAt: Date | null;
  /** 一時失敗後に、次に試してよい時刻。元の予約時刻は上書きしない。 */
  readonly retryAt: Date | null;
  /** worker停止時に別workerが回収できるようにするclaimの期限。 */
  readonly deliveryLeaseUntil: Date | null;
  /**
   * 冪等キー。
   * 同じキーの送信は 1 回しか行わない。
   * 再試行・二重クリック・Queue の再配信で同じ投稿が 2 つ出るのを防ぐ。
   */
  readonly idempotencyKey: string;
  /** 外部送信claim時に接続から固定したprovider主体。BlueskyではDID。 */
  readonly providerIdentity: string | null;
  /** provider側で使う一意キー。最初のclaimで一度だけ確定する。 */
  readonly providerDeliveryKey: string | null;
  /** provider record本文へ焼き込む時刻。初回claim後はretryでも変更しない。 */
  readonly providerRecordCreatedAt: Date | null;
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
  variantRevision: number;
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
  if (supportsExternalDirectPublish(input.channelKind) && input.connectionId === null) {
    return err(
      validationError(
        `${CHANNEL_CAPABILITIES[input.channelKind].label} へ出すには、先に接続の設定が必要です。`,
        "connectionId",
      ),
    );
  }
  if (!Number.isSafeInteger(input.variantRevision) || input.variantRevision < 1) {
    return err(
      validationError(
        "承認済みの記事の版が必要です。記事を確認してから配信を作り直してください。",
        "variantRevision",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    variantId: input.variantId,
    variantRevision: input.variantRevision,
    channelKind: input.channelKind,
    connectionId: input.connectionId,
    state: "QUEUED",
    scheduledAt: input.scheduledAt ?? null,
    retryAt: null,
    deliveryLeaseUntil: null,
    idempotencyKey: input.idempotencyKey.trim(),
    providerIdentity: null,
    providerDeliveryKey: null,
    providerRecordCreatedAt: null,
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
    const nexts = ALLOWED[publication.state].map((s) => PUBLICATION_STATE_LABEL[s]);
    return err(
      domainError(
        "CONFLICT",
        `この配信は「${PUBLICATION_STATE_LABEL[publication.state]}」なので、` +
          `「${PUBLICATION_STATE_LABEL[to]}」へは進められません。`,
        {
          // 行き止まりのときに「進める先: なし」とだけ返さない。
          // 次にできることが無いなら、別の道を示すのがここの仕事。
          suggestedAction:
            nexts.length === 0
              ? "この配信はここで終わりです。やり直す場合は、記事の画面から新しい配信を作ってください。"
              : `ここから進めるのは ${nexts.join(" / ")} です。`,
        },
      ),
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
  return {
    ...publication,
    state: "FAILED_SEND",
    retryAt: null,
    deliveryLeaseUntil: null,
    lastError: message,
  };
}

export function recordSendSuccess(
  publication: Publication,
  external: { id: string; url: string | null },
  at: Date,
): Publication {
  return {
    ...publication,
    state: "PUBLISHED",
    retryAt: null,
    deliveryLeaseUntil: null,
    externalId: external.id,
    externalUrl: external.url,
    publishedAt: at,
    lastError: null,
  };
}

/**
 * due行を外部送信のclaimへ進める。保存先のCASと組にして使う。
 * staleなSENDINGはlease切れのときだけ回収し、試行回数へ数える。
 */
export function claimPublicationForDelivery(
  publication: Publication,
  input: {
    readonly at: Date;
    readonly leaseUntil: Date;
    readonly providerIdentity: string;
    readonly providerDeliveryKey: string;
    readonly providerRecordCreatedAt: Date;
    readonly gate: GateResult;
  },
): Result<Publication, DomainError> {
  let sending: Result<Publication, DomainError>;
  if (publication.state === "QUEUED") {
    const rendering = advance(publication, "RENDERING", { at: input.at });
    if (!rendering.ok) return rendering;
    const validating = advance(rendering.value, "VALIDATING", { at: input.at });
    if (!validating.ok) return validating;
    sending = advance(validating.value, "SENDING", { at: input.at, gate: input.gate });
  } else if (publication.state === "RETRY_SCHEDULED") {
    sending = advance(publication, "SENDING", { at: input.at });
  } else if (
    publication.state === "SENDING" &&
    publication.deliveryLeaseUntil !== null &&
    publication.deliveryLeaseUntil <= input.at &&
    publication.providerDeliveryKey !== null
  ) {
    // provider応答後・保存前にworkerが止まった可能性がある。同じprovider keyへの
    // 冪等な再実行は新しい論理試行ではないため、attemptsを増やさず回収する。
    sending = ok(publication);
  } else {
    return err(
      domainError("CONFLICT", "この配信は、いま送信を始められる状態ではありません。", {
        suggestedAction: "現在の状態と再試行時刻を確認してください。",
      }),
    );
  }
  if (!sending.ok) return sending;
  if (
    publication.providerIdentity !== null &&
    publication.providerIdentity !== input.providerIdentity
  ) {
    return err(
      domainError("CONFLICT", "この配信に固定した接続先と現在の接続先が一致しません。", {
        suggestedAction: "接続を差し替えず、配信を作り直してください。",
      }),
    );
  }
  return ok({
    ...sending.value,
    state: "SENDING",
    retryAt: null,
    deliveryLeaseUntil: input.leaseUntil,
    providerIdentity: publication.providerIdentity ?? input.providerIdentity,
    providerDeliveryKey: publication.providerDeliveryKey ?? input.providerDeliveryKey,
    providerRecordCreatedAt:
      publication.providerRecordCreatedAt ?? input.providerRecordCreatedAt,
    lastError: null,
  });
}

/** 一時失敗を指数backoffで後刻へ回す。元の予約時刻は不変。 */
export function scheduleSendRetry(publication: Publication, at: Date): Publication {
  const delayMs = Math.min(60, 2 ** Math.max(0, publication.attempts - 1)) * 60_000;
  return {
    ...publication,
    state: "RETRY_SCHEDULED",
    retryAt: new Date(at.getTime() + delayMs),
    deliveryLeaseUntil: null,
  };
}

/**
 * 人が予定日時を変更する唯一のdomain入口。
 *
 * `RETRY_SCHEDULED` はworkerが `retryAt` で検索するため、画面用の
 * `scheduledAt` だけを変えてはならない。日時指定なしは「今から再試行可能」とし、
 * 次のworker実行で必ず到達できる時刻を入れる。
 */
export function changePublicationSchedule(
  publication: Publication,
  scheduledAt: Date | null,
  at: Date,
): Result<Publication, DomainError> {
  if (!RESCHEDULABLE_PUBLICATION_STATES.includes(publication.state)) {
    return err(
      domainError("CONFLICT", "この配信は、いま予定日時を変更できません。", {
        suggestedAction: "最新の状態を読み直してください。",
      }),
    );
  }

  const target = RESCHEDULE_TARGET[publication.state] ?? null;
  const moved = target === null ? ok(publication) : advance(publication, target, { at });
  if (!moved.ok) return moved;

  return ok({
    ...moved.value,
    scheduledAt,
    retryAt: moved.value.state === "RETRY_SCHEDULED" ? (scheduledAt ?? at) : null,
  });
}

/** 古い読み取りで別処理の更新を上書きしようとしたときの共通応答。 */
export function publicationMutationConflict(): DomainError {
  return domainError("CONFLICT", "別の処理が先にこの配信を更新しました。", {
    suggestedAction: "最新の状態を読み直してから、もう一度操作してください。",
  });
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

/** CASで比較するPublication全体の版。列を足したときの比較漏れを分散させない。 */
export function samePublicationVersion(left: Publication, right: Publication): boolean {
  return (
    left.id === right.id &&
    left.workspaceId === right.workspaceId &&
    left.variantId === right.variantId &&
    left.variantRevision === right.variantRevision &&
    left.channelKind === right.channelKind &&
    left.connectionId === right.connectionId &&
    left.state === right.state &&
    sameDate(left.scheduledAt, right.scheduledAt) &&
    sameDate(left.retryAt, right.retryAt) &&
    sameDate(left.deliveryLeaseUntil, right.deliveryLeaseUntil) &&
    left.idempotencyKey === right.idempotencyKey &&
    left.providerIdentity === right.providerIdentity &&
    left.providerDeliveryKey === right.providerDeliveryKey &&
    sameDate(left.providerRecordCreatedAt, right.providerRecordCreatedAt) &&
    left.attempts === right.attempts &&
    left.externalId === right.externalId &&
    left.externalUrl === right.externalUrl &&
    left.lastError === right.lastError &&
    sameDate(left.publishedAt, right.publishedAt)
  );
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
  variantRevision: number;
  channelKind: ChannelKind;
  scheduledAt: Date | null;
}): string {
  const when = input.scheduledAt ? input.scheduledAt.toISOString() : "immediate";
  return `${input.variantId}:r${input.variantRevision}:${input.channelKind}:${when}`;
}
