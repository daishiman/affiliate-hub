/**
 * @tier 1
 * @req REQ-FB08, REQ-FB10, REQ-TM09
 * @types boundary, idempotency, equivalence
 */
import { describe, expect, it } from "vitest";
import {
  CAPTURE_RETENTION_DAYS,
  DIAGNOSTICS_PURGED_TEXT,
  DIAGNOSTICS_RETENTION_DAYS,
  DIAGNOSTICS_RETENTION_NOTICE,
  type TechnicalContext,
  diagnosticsExpireAt,
  diagnosticsPurgeCutoff,
  isDiagnosticsExpired,
  isDiagnosticsPurged,
  purgeDiagnostics,
} from "@/domain/feedback";

/**
 * 技術診断の保持期限。
 *
 * --- なぜ境目を 1 日ずつ確かめるのか ---
 *
 * 「90 日で消えます」と画面に書いた以上、89 日で消えても 91 日で残っても
 * どちらも約束違反になる。しかも**どちらも誰も気づかない**。
 * 消えすぎたことは誰も見に来ないし、消え残ったことは覗かないと分からない。
 * だから境目のちょうど・手前・翌日を、ここで固定する。
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const SUBMITTED = new Date("2026-01-01T00:00:00.000Z");

function daysAfterSubmit(days: number): Date {
  return new Date(SUBMITTED.getTime() + days * DAY_MS);
}

function filledTechnical(): TechnicalContext {
  return {
    jsErrors: ["TypeError: x is not a function"],
    failedRequests: ["GET /api/links 500"],
    recentActions: ["「保存」を押した", "一覧へ戻った"],
    userAgent: "Mozilla/5.0 (Macintosh)",
    redactedCount: 3,
    purgedAt: null,
  };
}

describe("技術診断の保持期限", () => {
  it("期限は届いた時刻から数える（読んだ時刻では延びない）", () => {
    expect(diagnosticsExpireAt(SUBMITTED).getTime()).toBe(
      SUBMITTED.getTime() + DIAGNOSTICS_RETENTION_DAYS * DAY_MS,
    );
  });

  it("削除対象を探す境界は、実行時刻から保存日数を引いた時刻である", () => {
    const now = daysAfterSubmit(DIAGNOSTICS_RETENTION_DAYS);
    expect(diagnosticsPurgeCutoff(now)).toEqual(SUBMITTED);
  });

  it("期限の 1 日手前では、まだ消さない", () => {
    expect(isDiagnosticsExpired(SUBMITTED, daysAfterSubmit(DIAGNOSTICS_RETENTION_DAYS - 1))).toBe(
      false,
    );
  });

  it("期限の 1 ミリ秒手前でも、まだ消さない", () => {
    const justBefore = new Date(diagnosticsExpireAt(SUBMITTED).getTime() - 1);
    expect(isDiagnosticsExpired(SUBMITTED, justBefore)).toBe(false);
  });

  it("期限ちょうどで消す（境目はこちら側に倒す）", () => {
    expect(isDiagnosticsExpired(SUBMITTED, daysAfterSubmit(DIAGNOSTICS_RETENTION_DAYS))).toBe(true);
  });

  it("期限を 1 日過ぎたら、当然消す", () => {
    expect(isDiagnosticsExpired(SUBMITTED, daysAfterSubmit(DIAGNOSTICS_RETENTION_DAYS + 1))).toBe(
      true,
    );
  });

  it("画像の保存期間とは別の数である", () => {
    // 揃えると、片方を直したときにもう片方が黙って一緒に動く。
    expect(DIAGNOSTICS_RETENTION_DAYS).not.toBe(CAPTURE_RETENTION_DAYS);
    // 本人が中身を見ていない方を、本人が選んだ方より長く持たない。
    expect(DIAGNOSTICS_RETENTION_DAYS).toBeLessThan(CAPTURE_RETENTION_DAYS);
  });
});

describe("技術診断を消す", () => {
  const PURGED_AT = new Date("2026-04-01T17:00:00.000Z");

  it("届いたばかりのものは、消してある扱いにならない", () => {
    expect(isDiagnosticsPurged(filledTechnical())).toBe(false);
  });

  it("消すのは中身だけで、伏せた件数と消した時刻は残す", () => {
    const purged = purgeDiagnostics(filledTechnical(), PURGED_AT);
    expect(purged.jsErrors).toEqual([]);
    expect(purged.failedRequests).toEqual([]);
    expect(purged.recentActions).toEqual([]);
    expect(purged.userAgent).toBe("");
    // 「伏せた記録があったこと」まで消すと、後から問われて答えられない。
    expect(purged.redactedCount).toBe(3);
    expect(purged.purgedAt).toEqual(PURGED_AT);
    expect(isDiagnosticsPurged(purged)).toBe(true);
  });

  it("元の値を書き換えない", () => {
    const original = filledTechnical();
    purgeDiagnostics(original, PURGED_AT);
    expect(original.jsErrors.length).toBe(1);
    expect(original.purgedAt).toBeNull();
  });

  it("2 度目に流しても、消した時刻が今日へ化けない", () => {
    const once = purgeDiagnostics(filledTechnical(), PURGED_AT);
    const twice = purgeDiagnostics(once, new Date("2026-07-01T17:00:00.000Z"));
    expect(twice.purgedAt).toEqual(PURGED_AT);
    expect(twice).toBe(once);
  });

  it("中身がもともと空でも、消したことは記録に残る", () => {
    // 「0 件だった」と「消した」を区別できないと、
    // 消し忘れを探すときに空の行を全部拾い直すことになる。
    const empty: TechnicalContext = {
      jsErrors: [],
      failedRequests: [],
      recentActions: [],
      userAgent: "",
      redactedCount: 0,
      purgedAt: null,
    };
    expect(isDiagnosticsPurged(empty)).toBe(false);
    expect(isDiagnosticsPurged(purgeDiagnostics(empty, PURGED_AT))).toBe(true);
  });
});

describe("画面へ出す説明", () => {
  it("日数を文言に含む（画面が数を書かなくて済む）", () => {
    expect(DIAGNOSTICS_RETENTION_NOTICE).toContain(String(DIAGNOSTICS_RETENTION_DAYS));
    expect(DIAGNOSTICS_PURGED_TEXT).toContain(String(DIAGNOSTICS_RETENTION_DAYS));
  });

  it("何が残るのかも書いてある（消える話だけにしない）", () => {
    expect(DIAGNOSTICS_RETENTION_NOTICE).toContain("消えません");
  });
});
