/**
 * @tier 1
 * @req REQ-P10
 * @types decision-table, boundary
 *
 * 計測を受け取って記録する入口（`record-telemetry.ts`）。
 *
 * 2026-08-17 の実測で、このファイルには**検査が 1 つも無かった**（生き残り 32 変異）。
 * ここは同意の判定を通す唯一の入口なので、空のままだと
 * 「同意していない人の記録が入っている」が起きても誰も気づけない。
 *
 * 固定したいこと。
 *   1. **読者に権限を求めない。** 求めた瞬間、読者の計測が全部通らなくなる。
 *   2. **同意の判定は domain のものをそのまま効かせる。** ここで作り直さない。
 *   3. **落としたものを黙って消さない。** 同意で落ちた数と、形が違って落ちた理由を返す。
 *   4. **記録の失敗を読者の失敗にしない。** 読者の画面はここの成否と無関係に動く。
 */
import { describe, expect, it } from "vitest";
import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import {
  type IncomingEvent,
  type RecordTelemetryInput,
  createRecordTelemetryUseCase,
} from "@/application/usecases/analytics/record-telemetry";
import type { ConsentSignals, TelemetryEvent } from "@/domain/analytics";
import { domainError, err, ok } from "@/domain/shared";
import { WORKSPACE, aNobody } from "../support/actors";

/** 読者。役割を 1 つも持たない人で通ることが、ここで確かめたいこと。 */
const reader = aNobody({ workspaceId: WORKSPACE });

/** 同意が要らないイベント（`consent: "none"`）。 */
function pageView(over: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    key: "page_view",
    payload: { path: "/a", siteSlug: "blog-a", referrerKind: "search" },
    ...over,
  };
}

/** 同意が要るイベント（`consent: "behaviour"`）。 */
function scrollDepth(over: Partial<IncomingEvent> = {}): IncomingEvent {
  return {
    key: "scroll_depth",
    payload: { path: "/a", siteSlug: "blog-a", percent: 60 },
    ...over,
  };
}

/** 記録先の代わり。**書き込まれた中身を覚える**（何が残ったかを外から見るため）。 */
function sinkOf(options: { fails?: boolean } = {}) {
  const written: TelemetryEvent[] = [];
  let calls = 0;
  const notUsed = () => {
    throw new Error("このテストでは呼ばれません");
  };
  const port: TelemetrySinkPort = {
    aiUsage: notUsed,
    purgeExpired: notUsed,
    forgetReader: notUsed,
    async recordBatch(_ws, events) {
      calls += 1;
      if (options.fails) return err(domainError("UPSTREAM_UNAVAILABLE", "記録先に書けません。"));
      written.push(...events);
      return ok({ accepted: events.length, rejected: 0 });
    },
  };
  return { port, written, callCount: () => calls };
}

async function record(input: RecordTelemetryInput, options: { fails?: boolean } = {}) {
  const sink = sinkOf(options);
  const r = await createRecordTelemetryUseCase({ sink: sink.port }).execute(reader, input);
  if (!r.ok) throw new Error(r.error.message);
  return { out: r.value, ...sink };
}

describe("読者に権限を求めない", () => {
  it("役割を 1 つも持たない人でも記録できる", async () => {
    const { out } = await record({ events: [pageView()], signals: { choice: "granted" } });
    expect(out.accepted).toBe(1);
  });
});

describe("同意の判定をそのまま効かせる", () => {
  it("未回答のときは、同意の要らないイベントだけ通す", async () => {
    // 黙っている＝同意ではない。回数だけ数える。
    const { out } = await record({ events: [pageView(), scrollDepth()] });
    expect(out.accepted).toBe(1);
    expect(out.droppedByConsent).toBe(1);
    expect(out.decision.allowBehaviour).toBe(false);
  });

  it("同意があれば、詳しい計測も通す", async () => {
    const { out } = await record({
      events: [pageView(), scrollDepth()],
      signals: { choice: "granted" },
    });
    expect(out.accepted).toBe(2);
    expect(out.droppedByConsent).toBe(0);
  });

  it("断られているときは、詳しい計測を落とす", async () => {
    const { out } = await record({
      events: [scrollDepth()],
      signals: { choice: "denied" },
    });
    expect(out.accepted).toBe(0);
    expect(out.droppedByConsent).toBe(1);
  });

  it("ブラウザの追跡拒否 (GPC) は、本人の許可より強い", async () => {
    // 表示だけして無視するなら最初から読まない方が誠実、という決めごと。
    const { out } = await record({
      events: [scrollDepth()],
      signals: { choice: "granted", globalPrivacyControl: true },
    });
    expect(out.droppedByConsent).toBe(1);
    expect(out.accepted).toBe(0);
  });

  it("自動巡回のアクセスは、同意の要らないイベントも含めて 1 件も残さない", async () => {
    const { out, written } = await record({
      events: [pageView(), scrollDepth()],
      signals: { choice: "granted", isBot: true },
    });
    expect(out.accepted).toBe(0);
    expect(out.droppedByConsent).toBe(2);
    expect(written).toHaveLength(0);
  });

  it("公開前のプレビュー表示も数字に混ぜない", async () => {
    const { out } = await record({
      events: [pageView()],
      signals: { choice: "granted", isPreview: true },
    });
    expect(out.accepted).toBe(0);
    expect(out.decision.suppressAll).toBe(true);
  });

  it("渡されなかった材料は既定のまま扱う（部分指定で他が消えない）", async () => {
    // `signals` を丸ごと差し替える形にすると、1 つ渡しただけで
    // bot 判定などが undefined になり、判定が静かに緩む。
    const partial: Partial<ConsentSignals> = { choice: "granted" };
    const { out } = await record({ events: [scrollDepth()], signals: partial });
    expect(out.decision.suppressAll).toBe(false);
    expect(out.accepted).toBe(1);
  });

  it("なぜそう決まったかを、必ず言葉で返す", async () => {
    const { out } = await record({ events: [pageView()] });
    expect(out.decision.reason.length).toBeGreaterThan(5);
  });
});

describe("使い捨ての目印", () => {
  it("同意があるときだけ、目印を付けて記録する", async () => {
    const { written } = await record({
      events: [pageView()],
      signals: { choice: "granted" },
      readerKey: "rk-1",
    });
    expect(written[0]?.readerKey).toBe("rk-1");
  });

  it("同意が無ければ、目印を渡されても付けない", async () => {
    // ここが素通りすると、同意していない読者に消せない目印が付く。
    const { written } = await record({
      events: [pageView()],
      signals: { choice: "denied" },
      readerKey: "rk-1",
    });
    expect(written).toHaveLength(1);
    expect(written[0]?.readerKey).toBeNull();
  });
});

describe("落としたものを黙って消さない", () => {
  it("知らないイベントは、理由を付けて返す", async () => {
    const { out } = await record({
      events: [{ key: "no_such_event", payload: {} }],
      signals: { choice: "granted" },
    });
    expect(out.accepted).toBe(0);
    expect(out.rejectedAsInvalid).toHaveLength(1);
    expect(out.rejectedAsInvalid[0]).toContain("no_such_event");
  });

  it("1 件おかしくても、残りは記録する", async () => {
    // まとめて送る作りなので、1 件で全部捨てると計測が丸ごと消える。
    const { out, written } = await record({
      events: [{ key: "no_such_event", payload: {} }, pageView()],
      signals: { choice: "granted" },
    });
    expect(out.accepted).toBe(1);
    expect(out.rejectedAsInvalid).toHaveLength(1);
    expect(written).toHaveLength(1);
  });

  it("同意で落ちたものと、形が違って落ちたものを混ぜない", async () => {
    const { out } = await record({
      events: [scrollDepth(), { key: "no_such_event", payload: {} }],
    });
    expect(out.droppedByConsent).toBe(1);
    expect(out.rejectedAsInvalid).toHaveLength(1);
  });

  it("送る中身が無ければ、記録先を呼ばない", async () => {
    const { out, callCount } = await record({ events: [] });
    expect(out.accepted).toBe(0);
    expect(callCount()).toBe(0);
  });
});

describe("記録の失敗を、読者の失敗にしない", () => {
  it("記録先が書けなくても、呼び出しは成功として返す", async () => {
    const sink = sinkOf({ fails: true });
    const r = await createRecordTelemetryUseCase({ sink: sink.port }).execute(reader, {
      events: [pageView()],
      signals: { choice: "granted" },
    });
    expect(r.ok).toBe(true);
  });

  it("書けなかったときは、受け付けた件数を 0 に戻して理由を添える", async () => {
    // 書けていないのに accepted=1 を返すと、送った側は成功したと思い込む。
    const { out } = await record(
      { events: [pageView(), pageView()], signals: { choice: "granted" } },
      { fails: true },
    );
    expect(out.accepted).toBe(0);
    expect(out.rejectedAsInvalid.some((m) => m.includes("記録先に書けません"))).toBe(true);
  });

  it("書けなかったときも、同意で落ちた件数は保つ", async () => {
    const { out } = await record(
      { events: [pageView(), scrollDepth()], signals: { choice: "unset" } },
      { fails: true },
    );
    expect(out.droppedByConsent).toBe(1);
  });
});

describe("発生時刻", () => {
  it("送られてきた時刻をそのまま使う", async () => {
    const at = "2026-08-01T10:00:00.000Z";
    const { written } = await record({
      events: [pageView({ occurredAt: at })],
      signals: { choice: "granted" },
    });
    expect(written[0]?.occurredAt.toISOString()).toBe(at);
  });

  it("時刻が無ければ、受け取った時刻で埋める", async () => {
    const before = Date.now();
    const { written } = await record({
      events: [pageView()],
      signals: { choice: "granted" },
    });
    const at = written[0]?.occurredAt.getTime() ?? 0;
    expect(at).toBeGreaterThanOrEqual(before);
    expect(at).toBeLessThanOrEqual(Date.now());
  });
});
