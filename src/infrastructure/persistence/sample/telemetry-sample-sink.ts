import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import {
  type TelemetryEvent,
  type TelemetryEventKey,
  isRetentionExpired,
  rollupAiUsage,
} from "@/domain/analytics";
import { ok } from "@/domain/shared";
import { registerStub, stubCall } from "../../stub-registry";

/**
 * ★ これは仮置きの記録先です（スタブ）。★
 *
 * **この実行中だけ覚えます。再起動すると消えます。**
 * できたふりではなく、本当に受け取って本当に数えているが、
 * 置き場所がメモリなので長くは残らない。
 * 画面で「計測が動いていること」を確かめるところまでを担う。
 *
 * --- 本物にするのに足りないもの（テーブルだけではない） ---
 *
 * 入れる口は既にある（`/api/telemetry` が受け取り、画面側の収集係が送っている）。
 * それでも仮置きのままにしているのは、**読む口が無い**ため。
 *   1. 出来事の件数 (`countByEvent`) を出す画面がまだ 1 つも無い
 *   2. 唯一の読み手である `/admin/ai-usage` が読むのは AI の利用実績で、
 *      その実績を作るのは LLM の呼び出し（提供元の鍵が要る = 外部資格）
 * いま D1 につなぐと、見本が消えて**中身の無い画面だけが残る**。
 * だから鍵が入り、実際の利用実績が溜まりはじめる日まで据え置く。
 *
 * 差し替えるのは composition.ts の 1 行だけで、
 * イベントの形も同意の判定も画面も変わらない。
 */
const stub = registerStub({
  id: "persistence:telemetry-memory",
  port: "計測の記録先",
  label: "計測の記録（この実行中だけ覚える仮置き）",
  blockedBy:
    "LLM 提供元の鍵（AI 利用実績の作り手）と、件数を見せる画面。加えて telemetry_events / ai_model_usage テーブルの追加",
});

export function telemetryStubNotice(): string {
  return `${stub.label}。${stub.blockedBy}が済むまでの仮です。`;
}

/**
 * 溜め場所。
 *
 * 上限を置くのは、長く動かしたときにメモリを食い潰さないため。
 * 溢れたら**古いものから捨てる**（新しいものを捨てると、
 * いま確かめたい操作が記録されない）。
 */
const MAX_EVENTS = 5_000;
const buffer: TelemetryEvent[] = [];

/** 見本の AI 利用。画面が空のままだと「出せていない」のか区別がつかない。 */
const SAMPLE_AI_USAGE: readonly TelemetryEvent<"ai_model_usage">[] = [
  {
    key: "ai_model_usage",
    occurredAt: new Date("2026-08-10T02:00:00Z"),
    readerKey: null,
    payload: {
      workspaceId: "ws_sample",
      brandId: "brand_sample",
      siteSlug: "video-editing-gear",
      actorId: "author_ai",
      modelId: "claude-sonnet-5",
      provider: "anthropic",
      usecase: "記事の下書き",
      promptTemplateId: "tpl_ranking_draft",
      promptTemplateVersion: 3,
      inputTokens: 42_000,
      outputTokens: 8_400,
      durationMs: 21_500,
      success: true,
      estimatedCostJpy: 0,
      artifactKind: "content_package",
      artifactId: "pkg_laptop_ranking",
    },
  },
  {
    key: "ai_model_usage",
    occurredAt: new Date("2026-08-11T03:10:00Z"),
    readerKey: null,
    payload: {
      workspaceId: "ws_sample",
      brandId: "brand_sample",
      siteSlug: "video-editing-gear",
      actorId: "author_ai",
      modelId: "claude-opus-5",
      provider: "anthropic",
      usecase: "構成の見直し",
      promptTemplateId: "tpl_structure_review",
      promptTemplateVersion: 1,
      inputTokens: 18_000,
      outputTokens: 3_200,
      durationMs: 14_200,
      success: true,
      estimatedCostJpy: 0,
      artifactKind: "content_variant",
      artifactId: "var_laptop_ranking_b",
    },
  },
  {
    // わざと失敗を 1 件混ぜる。失敗にも費用がかかることを画面で見せるため。
    key: "ai_model_usage",
    occurredAt: new Date("2026-08-12T04:00:00Z"),
    readerKey: null,
    payload: {
      workspaceId: "ws_sample",
      brandId: "brand_sample",
      siteSlug: "gear-for-small-kitchen",
      actorId: "author_ai",
      modelId: "claude-haiku-4-5",
      provider: "anthropic",
      usecase: "見出し案",
      promptTemplateId: "tpl_headline",
      promptTemplateVersion: 2,
      inputTokens: 3_100,
      outputTokens: 0,
      durationMs: 2_900,
      success: false,
      estimatedCostJpy: 0,
      artifactKind: undefined,
      artifactId: undefined,
    },
  },
  {
    // わざと価格表に無いモデルを 1 件混ぜる。
    // 「費用が少なく見えている」の注意書きが出ることを確かめるため。
    key: "ai_model_usage",
    occurredAt: new Date("2026-08-13T05:00:00Z"),
    readerKey: null,
    payload: {
      workspaceId: "ws_sample",
      brandId: "brand_sample",
      siteSlug: "gear-for-small-kitchen",
      actorId: "author_human",
      modelId: "some-experimental-model",
      provider: "other",
      usecase: "要約",
      promptTemplateId: undefined,
      promptTemplateVersion: undefined,
      inputTokens: 9_000,
      outputTokens: 1_100,
      durationMs: 6_400,
      success: true,
      estimatedCostJpy: 0,
      artifactKind: undefined,
      artifactId: undefined,
    },
  },
];

/** いま溜まっているもの。管理画面と試験が読む。 */
export function recentTelemetry(limit = 50): readonly TelemetryEvent[] {
  return buffer.slice(-limit).reverse();
}

export function clearTelemetryBuffer(): void {
  buffer.length = 0;
}

export function createSampleTelemetrySink(): TelemetrySinkPort {
  return {
    async recordBatch(_workspaceId, events) {
      for (const ev of events) {
        buffer.push(ev);
        if (buffer.length > MAX_EVENTS) buffer.shift();
      }
      return ok({ accepted: events.length, rejected: 0 });
    },

    async aiUsage(_workspaceId, input) {
      const fromBuffer = buffer.filter(
        (e): e is TelemetryEvent<"ai_model_usage"> => e.key === "ai_model_usage",
      );
      const all = [...SAMPLE_AI_USAGE, ...fromBuffer].filter(
        (e) =>
          e.occurredAt >= input.from &&
          e.occurredAt <= input.to &&
          (input.siteSlug === undefined || e.payload.siteSlug === input.siteSlug),
      );
      return ok(rollupAiUsage(all));
    },

    async purgeExpired(_workspaceId, now) {
      const before = buffer.length;
      const kept = buffer.filter((e) => !isRetentionExpired(e.key as TelemetryEventKey, e.occurredAt, now));
      buffer.length = 0;
      buffer.push(...kept);
      return ok({ deleted: before - kept.length });
    },

    async forgetReader(_workspaceId, readerKey) {
      const before = buffer.length;
      const kept = buffer.filter((e) => e.readerKey !== readerKey);
      buffer.length = 0;
      buffer.push(...kept);
      return ok({ deleted: before - kept.length });
    },
  };
}

/** 保存先が本物になるまで、ここだけは失敗を返す差し込み口の見本。 */
export function createUnavailableTelemetrySink(): TelemetrySinkPort {
  return {
    recordBatch: () => stubCall(stub, "計測の記録"),
    aiUsage: () => stubCall(stub, "AI 利用の集計"),
    purgeExpired: () => stubCall(stub, "期限切れの削除"),
    forgetReader: () => stubCall(stub, "読者の記録の削除"),
  };
}
