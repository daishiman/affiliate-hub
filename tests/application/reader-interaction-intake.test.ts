/**
 * @tier 1
 * @req REQ-BOPC02
 * @req feat-reader-behavior-analytics
 * @types boundary, equivalence, decision-table, tenant-isolation
 *
 * 読者行動の受け口（観測層の入口）。
 *
 * ここは**誰でも叩ける口**なので、守るのは送り主の資格ではなく
 * 「何を受け取るか」になる。見るのは次の 3 つだけ:
 *   1. 同意が無いときに 1 件も積まないこと
 *   2. 壊れた 1 件で束ごと落とさず、落とした数を隠さないこと
 *   3. 端末が名乗る発生時刻を信じきらないこと
 *
 * SQL は `tests/integration/d1-reader-metrics.test.ts` が、
 * 定期実行の組み立ては `tests/architecture/worker-entry-weight.test.ts` が見る。
 */
import { describe, expect, it } from "vitest";
import type { ReaderInteractionIntakePort } from "@/application/ports/blog-observability";
import {
  type RawReaderInteraction,
  createRecordReaderInteractionsUseCase,
} from "@/application/usecases/blog-ops/record-reader-interactions";
import {
  type ConsentSignals,
  DEFAULT_CONSENT_SIGNALS,
  MAX_DWELL_SECONDS,
  MAX_EVENT_BACKDATE_DAYS,
  MAX_SESSION_KEY_LENGTH,
  type ReaderInteractionWireEvent,
} from "@/domain/analytics";
import { ok } from "@/domain/shared";
import { anOwner } from "../support/actors";

const SITE = "metrics-blog";
/** 受信時刻。テストの中で「今」を動かさないため、固定して注入する。 */
const NOW = new Date("2026-09-04T12:00:00Z");

/** 同意済みの読者。ここを既定にして、各テストは外したい信号だけ上書きする。 */
const GRANTED: ConsentSignals = { ...DEFAULT_CONSENT_SIGNALS, choice: "granted" };

/** producer が送る実際の最小形。共有型を変えたら、この fixture も同時に壊れる。 */
const WIRE_EVENT_FIXTURE = {
  eventId: "evt-fixture",
  articleSlug: "article-a",
  kind: "view",
  segment: "search",
  viewportBand: "wide",
  sessionKey: "sess-1",
  occurredAt: "2026-09-04T11:59:00Z",
} satisfies ReaderInteractionWireEvent;

type Recorded = Parameters<ReaderInteractionIntakePort["record"]>[1];

/** 渡された引数を控えるだけの受け口。**呼ばれなかったこと**も確かめたいので配列で持つ。 */
function spyIntake() {
  const calls: { workspaceId: string; events: Recorded }[] = [];
  const port: ReaderInteractionIntakePort = {
    async record(workspaceId, events) {
      calls.push({ workspaceId: workspaceId as string, events });
      return ok({ accepted: events.length });
    },
  };
  return { port, calls };
}

function intakeUseCase(intake: ReaderInteractionIntakePort) {
  return createRecordReaderInteractionsUseCase({ intake, now: () => NOW });
}

let eventSequence = 0;

/** 既定は producer と同じく、位置を省いた view。壊したい項目だけ上書きする。 */
function event(over: Partial<Record<keyof RawReaderInteraction, unknown>> = {}) {
  return {
    ...WIRE_EVENT_FIXTURE,
    eventId: `evt-${++eventSequence}`,
    ...over,
  } as RawReaderInteraction;
}

async function run(
  events: readonly RawReaderInteraction[],
  signals: ConsentSignals = GRANTED,
) {
  const { port, calls } = spyIntake();
  const result = await intakeUseCase(port).execute(anOwner(), {
    siteSlug: SITE,
    events,
    signals,
  });
  if (!result.ok) throw new Error(`受け取りに失敗: ${result.error.message}`);
  return { value: result.value, calls };
}

describe("同意が無ければ 1 件も積まない", () => {
  it("未回答のままでは受け取らず、理由を返す", async () => {
    const { value, calls } = await run([event()], DEFAULT_CONSENT_SIGNALS);

    expect(value.accepted).toBe(0);
    expect(value.suppressedReason).not.toBeNull();
    // **保存先が呼ばれていないこと**まで見る。呼んでから捨てるのでは、
    // 保存側の記録や課金には残ってしまう。
    expect(calls).toHaveLength(0);
  });

  it("ブラウザの追跡拒否 (GPC) は本人の許可より強い", async () => {
    const { value, calls } = await run([event()], {
      ...GRANTED,
      globalPrivacyControl: true,
    });

    expect(value.accepted).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("自動巡回は数字に混ぜない", async () => {
    const { value, calls } = await run([event()], { ...GRANTED, isBot: true });

    expect(value.accepted).toBe(0);
    expect(calls).toHaveLength(0);
  });

  it("同意が無いときの rejected は 0（落としたのではなく、そもそも見ていない）", async () => {
    const { value } = await run([event({ kind: "壊れた種別" })], DEFAULT_CONSENT_SIGNALS);

    expect(value.rejected).toBe(0);
  });
});

describe("壊れた 1 件で束を落とさない", () => {
  it("不正な件だけ落とし、同じ束の正しい件は積む", async () => {
    const { value, calls } = await run([
      event({ sessionKey: "s1" }),
      event({ kind: "存在しない種別" }),
      event({ sessionKey: "s2" }),
    ]);

    expect(value.accepted).toBe(2);
    expect(value.rejected).toBe(1);
    expect(calls[0]?.events.map((e) => e.sessionKey)).toEqual(["s1", "s2"]);
  });

  it.each([
    ["種別が列挙にない", { kind: "hover" }],
    ["読者の区分が列挙にない", { segment: "unknown-source" }],
    ["画面幅の区分が列挙にない", { viewportBand: "huge" }],
    ["読み進みの比率が 1 を超える", { positionRatio: 1.5 }],
    ["読み進みの比率が負", { positionRatio: -0.1 }],
    ["読み進みの比率が数値でない", { positionRatio: "0.5" }],
    ["滞在が負", { dwellSeconds: -1 }],
    ["event ID が無い", { eventId: null }],
    ["session の鍵が無い", { sessionKey: null }],
    ["session の鍵が空白だけ", { sessionKey: "   " }],
    ["session の鍵が長すぎる", { sessionKey: "x".repeat(MAX_SESSION_KEY_LENGTH + 1) }],
  ])("%s 件は落とす", async (_label, over) => {
    const { value, calls } = await run([event(over)]);

    expect(value.rejected).toBe(1);
    // 1 件も残らなければ保存先は呼ばない。空の書き込みを撃たない。
    expect(calls).toHaveLength(0);
  });

  it("producer の view 形状を受理し、envelope のブログ名と位置 0 を補う", async () => {
    const input = event();
    const { value, calls } = await run([input]);

    expect(value).toMatchObject({ accepted: 1, rejected: 0 });
    expect(calls[0]?.events[0]).toMatchObject({
      eventId: input.eventId,
      siteSlug: SITE,
      positionRatio: 0,
    });
  });

  it("押下でない件に要素の鍵が付いていても、記録には残さない", async () => {
    const { calls } = await run([event({ kind: "view", elementKey: "cta-main" })]);

    // 表示に要素の鍵が付くと、クリック率の分母と分子が同じ列から作れなくなる。
    expect(calls[0]?.events[0]?.elementKey).toBeNull();
  });
});

describe("端末が名乗る値を信じきらない", () => {
  it("長すぎる滞在は落とさず頭打ちにする", async () => {
    const { value, calls } = await run([
      event({ kind: "dwell", dwellSeconds: MAX_DWELL_SECONDS + 5_000 }),
    ]);

    // 落とすと、放置された窓と一緒にその読者の他の観測まで消える。
    expect(value.rejected).toBe(0);
    expect(calls[0]?.events[0]?.dwellSeconds).toBe(MAX_DWELL_SECONDS);
  });

  it("未来の発生時刻は受信時刻へ寄せる", async () => {
    const { calls } = await run([event({ occurredAt: "2026-09-05T00:00:00Z" })]);

    expect(calls[0]?.events[0]?.occurredAt).toEqual(NOW);
  });

  it("許した日数より古い発生時刻も受信時刻へ寄せる（捨てない）", async () => {
    const tooOld = new Date(
      NOW.getTime() - (MAX_EVENT_BACKDATE_DAYS + 1) * 24 * 60 * 60 * 1000,
    );
    const { value, calls } = await run([event({ occurredAt: tooOld.toISOString() })]);

    // 捨てると、時計がずれた端末を使う層だけが数字から消える。
    expect(value.rejected).toBe(0);
    expect(calls[0]?.events[0]?.occurredAt).toEqual(NOW);
  });

  it("読めない発生時刻は受信時刻へ寄せる", async () => {
    const { calls } = await run([event({ occurredAt: "きのう" })]);

    expect(calls[0]?.events[0]?.occurredAt).toEqual(NOW);
  });

  it("範囲内の発生時刻はそのまま使う", async () => {
    const { calls } = await run([event({ occurredAt: "2026-09-03T09:00:00Z" })]);

    expect(calls[0]?.events[0]?.occurredAt).toEqual(new Date("2026-09-03T09:00:00Z"));
  });
});

describe("作業場所は実行主体から決まる", () => {
  it("件の中身ではなく actor の作業場所へ積む", async () => {
    const { port, calls } = spyIntake();
    const actor = anOwner();
    await intakeUseCase(port).execute(actor, {
      siteSlug: SITE,
      events: [event()],
      signals: GRANTED,
    });

    expect(calls[0]?.workspaceId).toBe(actor.workspaceId);
  });

  it("空の束では保存先を呼ばない", async () => {
    const { value, calls } = await run([]);

    expect(value.accepted).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
