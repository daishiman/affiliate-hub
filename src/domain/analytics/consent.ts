import type { ConsentRequirement, TelemetryEventKey } from "./telemetry-events";
import { TELEMETRY_EVENTS } from "./telemetry-events";

/**
 * 同意と、読者を数えるための仮の目印。
 *
 * **後付けできない設計**なのでここに置く。
 * 「まず全部記録して、同意管理は後で足す」とすると、
 * 足す時点で既に同意なしの記録が貯まっており、消すところから始まる。
 *
 * 判断の順番は 1 つだけ:
 *   端末の拒否表示 (DNT / GPC) → 本人の選択 → 何も無ければ「断った」扱い
 * **黙っている＝同意とみなさない。** これは運用の都合で緩めない。
 */

/** 本人の選択。`unset` は「まだ聞いていない」。 */
export const CONSENT_CHOICES = ["granted", "denied", "unset"] as const;
export type ConsentChoice = (typeof CONSENT_CHOICES)[number];

export const CONSENT_CHOICE_LABELS: Readonly<Record<ConsentChoice, string>> = {
  granted: "詳しい計測を許可",
  denied: "詳しい計測を断る",
  unset: "未回答",
};

/**
 * 判断に使う材料。
 *
 * `doNotTrack` はブラウザの DNT ヘッダ、`globalPrivacyControl` は GPC。
 * どちらも「追跡しないで」の意思表示であり、**本人の選択より強く扱う**。
 * 表示だけして無視するなら、最初から読まない方が誠実なので、実際に効かせる。
 */
export type ConsentSignals = {
  readonly choice: ConsentChoice;
  readonly doNotTrack: boolean;
  readonly globalPrivacyControl: boolean;
  /** プレビュー表示や自動巡回。数字に混ぜない。 */
  readonly isBot: boolean;
  readonly isPreview: boolean;
};

export const DEFAULT_CONSENT_SIGNALS: ConsentSignals = {
  choice: "unset",
  doNotTrack: false,
  globalPrivacyControl: false,
  isBot: false,
  isPreview: false,
};

export type ConsentDecision = {
  /** 詳しい計測 (consent: behaviour) をしてよいか。 */
  readonly allowBehaviour: boolean;
  /** 仮の目印を付けてよいか。同意が無ければ付けない。 */
  readonly allowReaderKey: boolean;
  /** 一切記録しないか (bot・プレビュー)。 */
  readonly suppressAll: boolean;
  /** なぜそう決まったか。管理画面と読者向け説明ページにそのまま出す。 */
  readonly reason: string;
};

export function decideConsent(signals: ConsentSignals): ConsentDecision {
  if (signals.isBot || signals.isPreview) {
    return {
      allowBehaviour: false,
      allowReaderKey: false,
      suppressAll: true,
      reason: signals.isBot
        ? "自動巡回のアクセスのため記録しません。"
        : "公開前のプレビュー表示のため記録しません。",
    };
  }
  if (signals.globalPrivacyControl || signals.doNotTrack) {
    return {
      allowBehaviour: false,
      allowReaderKey: false,
      suppressAll: false,
      reason: signals.globalPrivacyControl
        ? "ブラウザの設定 (GPC) で追跡拒否が示されています。回数だけ数えます。"
        : "ブラウザの設定 (DNT) で追跡拒否が示されています。回数だけ数えます。",
    };
  }
  if (signals.choice === "granted") {
    return {
      allowBehaviour: true,
      allowReaderKey: true,
      suppressAll: false,
      reason: "詳しい計測を許可いただいています。いつでも取り消せます。",
    };
  }
  return {
    allowBehaviour: false,
    allowReaderKey: false,
    suppressAll: false,
    reason:
      signals.choice === "denied"
        ? "詳しい計測を断られているため、回数だけ数えます。"
        : "まだ回答をいただいていないため、回数だけ数えます。",
  };
}

/**
 * そのイベントを記録してよいか。
 *
 * **画面側はこの関数だけを見る。** 画面ごとに
 * 「これは同意が要るか」を判断させると、判断が分かれて必ず漏れる。
 */
export function mayRecord(key: TelemetryEventKey, decision: ConsentDecision): boolean {
  if (decision.suppressAll) return false;
  const required: ConsentRequirement = TELEMETRY_EVENTS[key].consent;
  return required === "none" || decision.allowBehaviour;
}

/**
 * 保存しておく期間。
 *
 * **期間を決めずに貯めない。** 決めないと「消す仕組み」が作られず、
 * 何年も前の記録が残り続ける。日数はこちらで置いた仮の値であり、
 * 運用の判断で変えてよいが、「無期限」だけは選べないようにしてある。
 */
export const RETENTION_DAYS: Readonly<Record<ConsentRequirement, number>> = {
  /** 回数だけの集計。個人に結び付かないので長めに持てる。 */
  none: 400,
  /** 読み方の細かい記録。短く持ち、集計後は消す。 */
  behaviour: 90,
};

export function retentionDeadline(key: TelemetryEventKey, occurredAt: Date): Date {
  const days = RETENTION_DAYS[TELEMETRY_EVENTS[key].consent];
  return new Date(occurredAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isExpired(key: TelemetryEventKey, occurredAt: Date, now: Date): boolean {
  return retentionDeadline(key, occurredAt).getTime() <= now.getTime();
}

/**
 * 仮の目印の作り方。
 *
 * IP アドレスや端末情報から作らない。**それは仮名ではなく指紋**で、
 * 本人が消す手段を持てない。ここではブラウザ側で作った使い捨ての値を
 * 日付とサイトで区切って混ぜ、日をまたぐと別人として数える。
 *
 * 「同じ人が 30 日後に戻ってきたか」は分からなくなるが、
 * それを知るために消せない目印を配るのは割に合わない。
 */
export function readerKeyScope(siteSlug: string, occurredAt: Date): string {
  const day = occurredAt.toISOString().slice(0, 10);
  return `${siteSlug}:${day}`;
}
