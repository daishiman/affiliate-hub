/**
 * 系統が止まっていることの検出（NFR6）。
 *
 * ==========================================================================
 * 止まったことは、画面が壊れる形では現れない
 * ==========================================================================
 *
 * 収集が止まっても、所見の一覧は表示される。載っているのは前回までの所見で、
 * 数も減らない。**運営者から見て「順調」と区別がつかない。**
 * だから止まったことを名指しで出す仕掛けを別に持つ。
 *
 * 検出は「最後に収集できた時刻」だけを見る。失敗の回数や例外の種類は見ない。
 * 失敗が記録されないまま止まる壊れ方（呼び出し自体が起きない）を
 * 拾えなくなるからで、**最後に成功したのがいつか**だけが、
 * どんな止まり方でも同じ形で残る事実である。
 *
 * この検出は収集とは別の契機で走らせる（仕様の要求）。同じ契機に乗せると、
 * 収集が止まる壊れ方で検出も一緒に止まり、誰も気づかない。
 */

import {
  MEASUREMENT_SOURCES,
  MEASUREMENT_SOURCE_LABEL,
  MEASUREMENT_SOURCE_NEEDS_CREDENTIAL,
  MEASUREMENT_STALE_AFTER_MS,
  type MeasurementSource,
} from "./measurement-source";

/** 系統ごとの最後の収集時刻。まだ 1 度も収集していなければ null。 */
export type LastCollectedAt = Readonly<Record<MeasurementSource, string | null>>;

export type SourceHealth = {
  readonly source: MeasurementSource;
  readonly label: string;
  readonly state: "ok" | "stalled" | "never_collected" | "not_configured";
  readonly lastCollectedAt: string | null;
  /** 運営者が次にすることが分かる 1 文。状態の名前だけを見せない。 */
  readonly message: string;
};

/**
 * 各系統の様子を出す。
 *
 * ==========================================================================
 * 「一度も収集していない」を「止まっている」と言わない
 * ==========================================================================
 *
 * 導入した直後は全系統が未収集である。それを「止まっています」と出すと、
 * 運営者は入れた初日に 3 件の警告を見ることになり、本当に止まった日に
 * 同じ画面が同じ見え方をする。**警告に慣れた画面は、警告として働かない。**
 *
 * 鍵が要る系統（②③）が未登録のときは `not_configured` にする。
 * 鍵を入れていないのは壊れているのではなく、まだ使っていないという意味である。
 */
export function sourceHealth(
  lastCollectedAt: LastCollectedAt,
  configured: Readonly<Record<MeasurementSource, boolean>>,
  now: string,
): readonly SourceHealth[] {
  const nowMs = Date.parse(now);

  return MEASUREMENT_SOURCES.map((source) => {
    const label = MEASUREMENT_SOURCE_LABEL[source];
    const last = lastCollectedAt[source];

    if (MEASUREMENT_SOURCE_NEEDS_CREDENTIAL[source] && !configured[source]) {
      return {
        source,
        label,
        state: "not_configured" as const,
        lastCollectedAt: last,
        message: `${label}はまだ使っていません。使うなら Cloudflare の画面で鍵を登録してください。`,
      };
    }

    if (last === null) {
      return {
        source,
        label,
        state: "never_collected" as const,
        lastCollectedAt: null,
        message: `${label}はまだ 1 度も収集していません。最初の収集を待ってください。`,
      };
    }

    const elapsed = nowMs - Date.parse(last);
    if (elapsed > MEASUREMENT_STALE_AFTER_MS[source]) {
      const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
      return {
        source,
        label,
        state: "stalled" as const,
        lastCollectedAt: last,
        message: `${label}は ${days} 日更新されていません。止まっている可能性があります。`,
      };
    }

    return {
      source,
      label,
      state: "ok" as const,
      lastCollectedAt: last,
      message: `${label}は動いています。`,
    };
  });
}

/**
 * 自動反映そのものが止まっている疑い（NFR6 後段）。
 *
 * 収集は動いているのに反映が起きないと、**未反映の所見が増え続ける**。
 * 増え続けていること自体が、反映の経路が止まっている合図になる。
 *
 * 件数の閾値だけでは足りない。所見が本当に多いだけの日もあるので、
 * 「一番古い未反映の所見がいつのものか」も見る。古いものが残り続けて
 * いるなら、増減にかかわらず処理されていない。
 */
export const UNAPPLIED_BACKLOG_THRESHOLD = 20;
export const UNAPPLIED_AGE_THRESHOLD_MS = 21 * 24 * 60 * 60 * 1000;

export function autoApplyStalled(
  unappliedCount: number,
  oldestUnappliedAt: string | null,
  now: string,
): boolean {
  if (oldestUnappliedAt === null) return false;
  const age = Date.parse(now) - Date.parse(oldestUnappliedAt);
  return unappliedCount >= UNAPPLIED_BACKLOG_THRESHOLD && age > UNAPPLIED_AGE_THRESHOLD_MS;
}
