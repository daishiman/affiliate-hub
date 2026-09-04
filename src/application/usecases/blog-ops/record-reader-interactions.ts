import type { ReaderInteractionIntakePort } from "@/application/ports/blog-observability";
import {
  type ConsentSignals,
  INTERACTION_KINDS,
  type InteractionKind,
  MAX_DWELL_SECONDS,
  MAX_ELEMENT_KEY_LENGTH,
  MAX_EVENT_BACKDATE_DAYS,
  MAX_EVENT_ID_LENGTH,
  MAX_SESSION_KEY_LENGTH,
  READER_SEGMENTS,
  type ReaderSegment,
  type ReaderInteractionWireEvent,
  VIEWPORT_BANDS,
  type ViewportBand,
  decideConsent,
} from "@/domain/analytics";
import { type ActorContext, type DomainError, type Result, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 読者の行動を受け取って観測層へ積む。**公開面から呼ばれる唯一の口。**
 *
 * --- ここに権限の検査が無い理由 ---
 * 読者は誰でもない。`requireCapability` を置くと、記録できるのは
 * 管理画面に入れる人だけになり、観測したいものがまるごと落ちる。
 * 代わりにここが守るのは「何を受け取るか」で、送り主の資格ではない。
 *
 * --- 何を守っているか ---
 *   1. 同意。`allowBehaviour` が偽なら 1 件も積まない (`decideConsent`)。
 *   2. 値の形。列挙にない種別・範囲外の比率・長すぎる鍵は落とす。
 *   3. 時刻。端末が名乗る発生時刻は信じきらず、外れたぶんは受信時刻へ寄せる。
 *
 * --- 1 件の不正で全部を落とさない ---
 * 壊れた 1 件で束ごと捨てると、古い版の JS を掴んだままの読者が 1 人いる
 * だけで、その日の観測が全部消える。だから**不正な件だけ**を落とす。
 * ただし落とした数は返す。黙って捨てると、送信側が壊れていることを
 * 誰も観測できなくなり、数字が減ったことにも気づけない。
 */

/** 端末から届く 1 件。**全項目が信用できない値**として扱う。 */
export type RawReaderInteraction = {
  readonly [Field in keyof ReaderInteractionWireEvent]?: unknown;
};

export type RecordReaderInteractionsDeps = {
  readonly intake: ReaderInteractionIntakePort;
  readonly now: () => Date;
};

export type RecordReaderInteractionsInput = {
  /**
   * この束を受け取るブログ。**呼び出し側が URL 名から引いた 1 つ**で、
   * `actor.workspaceId` はこれを元に決まっている。ブログ名を event ごとに
   * 重ねず、束の envelope だけを信頼元にする。
   */
  readonly siteSlug: string;
  readonly events: readonly RawReaderInteraction[];
  readonly signals: ConsentSignals;
};

export type RecordReaderInteractionsResult = {
  readonly accepted: number;
  /** 形が合わずに落とした件数。0 でないことは送信側の不具合を意味する。 */
  readonly rejected: number;
  /** 同意が無くて 1 件も積まなかったときだけ、その理由。 */
  readonly suppressedReason: string | null;
};

const KINDS = new Set<string>(INTERACTION_KINDS);
const SEGMENTS = new Set<string>(READER_SEGMENTS);
const BANDS = new Set<string>(VIEWPORT_BANDS);

/** 空でない、上限内の文字列だけを通す。切り詰めない（切ると別の鍵になる）。 */
function presentText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > max) return null;
  return trimmed;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type NormalizedEvent = Parameters<ReaderInteractionIntakePort["record"]>[1][number];

/**
 * 1 件を正規化する。通らなければ `null`（この件だけ落とす）。
 *
 * `siteSlug` は envelope からだけ受ける。event にも置くと同じ意味の値が
 * 2 つになり、食い違いを正規化する規則が必要になるためである。
 */
function normalize(
  raw: RawReaderInteraction,
  siteSlug: string,
  now: Date,
): NormalizedEvent | null {
  const eventId = presentText(raw.eventId, MAX_EVENT_ID_LENGTH);
  if (eventId === null) return null;

  const kind = presentText(raw.kind, 16);
  const segment = presentText(raw.segment, 16);
  const band = presentText(raw.viewportBand, 16);
  if (kind === null || !KINDS.has(kind)) return null;
  if (segment === null || !SEGMENTS.has(segment)) return null;
  if (band === null || !BANDS.has(band)) return null;

  const positionRatio =
    raw.positionRatio === undefined ? 0 : finiteNumber(raw.positionRatio);
  if (positionRatio === null || positionRatio < 0 || positionRatio > 1) return null;

  const dwellRaw = finiteNumber(raw.dwellSeconds) ?? 0;
  if (dwellRaw < 0) return null;
  // 上限は超えたら落とすのではなく**そこで頭打ちにする**。放置された窓を
  // 落とすと、その読者の他の観測（表示・押下）まで一緒に消える。
  const dwellSeconds = Math.min(dwellRaw, MAX_DWELL_SECONDS);

  const sessionKey = presentText(raw.sessionKey, MAX_SESSION_KEY_LENGTH);
  if (sessionKey === null) return null;

  return {
    eventId,
    siteSlug,
    articleSlug: presentText(raw.articleSlug, 128),
    kind: kind as InteractionKind,
    segment: segment as ReaderSegment,
    viewportBand: band as ViewportBand,
    positionRatio,
    dwellSeconds,
    elementKey: kind === "click" ? presentText(raw.elementKey, MAX_ELEMENT_KEY_LENGTH) : null,
    sessionKey,
    occurredAt: settleOccurredAt(raw.occurredAt, now),
  };
}

/**
 * 端末が名乗る発生時刻を、受信時刻に照らして決める。
 *
 * 未来は一切許さない。過去は `MAX_EVENT_BACKDATE_DAYS` まで許し、
 * それより古いものと読めないものは受信時刻に寄せる。**捨てない。**
 * 捨てると、時計がずれた端末を使う層だけが数字から消える。
 */
function settleOccurredAt(value: unknown, now: Date): Date {
  if (typeof value !== "string") return now;
  const at = new Date(value);
  const millis = at.getTime();
  if (Number.isNaN(millis)) return now;
  if (millis > now.getTime()) return now;
  const oldest = now.getTime() - MAX_EVENT_BACKDATE_DAYS * 24 * 60 * 60 * 1000;
  return millis < oldest ? now : at;
}

export function createRecordReaderInteractionsUseCase(
  deps: RecordReaderInteractionsDeps,
): UseCase<RecordReaderInteractionsInput, RecordReaderInteractionsResult> {
  const { intake, now } = deps;

  return {
    async execute(
      actor: ActorContext,
      input: RecordReaderInteractionsInput,
    ): Promise<Result<RecordReaderInteractionsResult, DomainError>> {
      const consent = decideConsent(input.signals);
      if (!consent.allowBehaviour) {
        return ok({ accepted: 0, rejected: 0, suppressedReason: consent.reason });
      }

      const at = now();
      const events: NormalizedEvent[] = [];
      let rejected = 0;
      for (const raw of input.events) {
        const normalized = normalize(raw, input.siteSlug, at);
        if (normalized === null) {
          rejected += 1;
          continue;
        }
        events.push(normalized);
      }

      if (events.length === 0) {
        return ok({ accepted: 0, rejected, suppressedReason: null });
      }

      const recorded = await intake.record(actor.workspaceId, events);
      if (!recorded.ok) return recorded;

      return ok({ accepted: recorded.value.accepted, rejected, suppressedReason: null });
    },
  };
}
