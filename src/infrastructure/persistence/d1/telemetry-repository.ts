import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { MetricsRepositoryPort } from "@/application/ports/analytics";
import type { TelemetrySinkPort } from "@/application/ports/telemetry";
import { RETENTION_DAYS } from "@/domain/analytics/consent";
import { TELEMETRY_EVENTS, TELEMETRY_EVENT_KEYS, type TelemetryEvent, type TelemetryEventKey } from "@/domain/analytics/telemetry-events";
import { deriveMetricSamples } from "@/domain/analytics/metrics-from-telemetry";
import { rollupAiUsage } from "@/domain/analytics/ai-usage";
import { type WorkspaceId, domainError, err, ok } from "@/domain/shared";
import { type TelemetryEventRow, telemetryEvents } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 計測の記録先（D1）と、そこから指標を導く読み口。
 *
 * **これはスタブではない。** 見本版（`telemetry-sample-sink.ts`）と同じ契約
 * （`TelemetrySinkPort` / `MetricsRepositoryPort`）を満たす、実際に保存する実装。
 *
 * --- 記録と集計を同じファイルに置いている理由 ---
 * どちらも `telemetry_events` という 1 つの表の形を知っている。
 * 別ファイルに分けると、列を 1 つ変えたときに片方だけ直る。
 * 「保存はできているのに数字が出ない」は、この形の食い違いで起きる。
 *
 * --- 集計済みの数字を保存しない ---
 * 指標は読むたびに計測から導く（`deriveMetricSamples`）。
 * 集計結果も貯めると、食い違ったときにどちらが正しいか決められない。
 * 件数が増えて重くなったら、そのとき初めて畳んだ表を足す。
 * **速さのために正しさを先に捨てない。**
 */

/** 1 回の書き込みで入れる上限。受け口（/api/telemetry）の上限と揃える。 */
const MAX_INSERT = 50;

/** 集計で 1 度に読む上限。ここを超える期間は、読めた分だけで数える。 */
const MAX_SCAN = 20_000;

/** 表に出ている項目から、列に出す値を取り出す。 */
function siteSlugOf(event: TelemetryEvent): string | null {
  const value = (event.payload as Record<string, unknown>).siteSlug;
  return typeof value === "string" && value !== "" ? value : null;
}

/** 行 → ドメイン。知らない種類の行は捨てる（型を偽らない）。 */
function toDomain(row: TelemetryEventRow): TelemetryEvent | null {
  if (!(TELEMETRY_EVENT_KEYS as readonly string[]).includes(row.key)) return null;
  return {
    key: row.key as TelemetryEventKey,
    occurredAt: row.occurredAt,
    readerKey: row.readerKey,
    payload: JSON.parse(row.payloadJson) as TelemetryEvent["payload"],
  };
}

/** 期間内のイベントを読む。集計側と AI 利用側で同じ読み方を使う。 */
async function loadEvents(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  input: {
    readonly keys?: readonly TelemetryEventKey[];
    readonly from: Date;
    readonly to: Date;
    readonly siteSlug?: string;
  },
): Promise<readonly TelemetryEvent[]> {
  const conditions = [
    eq(telemetryEvents.workspaceId, String(workspaceId)),
    gte(telemetryEvents.occurredAt, input.from),
    lte(telemetryEvents.occurredAt, input.to),
  ];
  if (input.keys !== undefined && input.keys.length > 0) {
    conditions.push(inArray(telemetryEvents.key, [...input.keys]));
  }
  if (input.siteSlug !== undefined) {
    conditions.push(eq(telemetryEvents.siteSlug, input.siteSlug));
  }
  const rows = await db
    .select()
    .from(telemetryEvents)
    .where(and(...conditions))
    .limit(MAX_SCAN);
  return rows.map(toDomain).filter((e): e is TelemetryEvent => e !== null);
}

export function createD1TelemetrySink(deps: {
  readonly db: DrizzleD1;
  readonly newId: () => string;
}): TelemetrySinkPort {
  const { db, newId } = deps;
  return {
    async recordBatch(workspaceId, events) {
      if (events.length === 0) return ok({ accepted: 0, rejected: 0 });
      const values = events.slice(0, MAX_INSERT).map((event) => ({
        id: newId(),
        workspaceId: String(workspaceId),
        key: event.key,
        occurredAt: event.occurredAt,
        siteSlug: siteSlugOf(event),
        readerKey: event.readerKey,
        payloadJson: JSON.stringify(event.payload),
      }));
      try {
        await db.insert(telemetryEvents).values(values);
      } catch (cause) {
        return storageFailure("計測の記録", cause);
      }
      // 上限を超えた分は捨てたことを数で返す。黙って落とさない。
      return ok({ accepted: values.length, rejected: events.length - values.length });
    },

    async aiUsage(workspaceId, input) {
      try {
        const events = await loadEvents(db, workspaceId, {
          keys: ["ai_model_usage"],
          from: input.from,
          to: input.to,
          siteSlug: input.siteSlug,
        });
        return ok(rollupAiUsage(events as readonly TelemetryEvent<"ai_model_usage">[]));
      } catch (cause) {
        return storageFailure("AI 利用の集計", cause);
      }
    },

    async purgeExpired(workspaceId, now) {
      // 期限は行に焼き込まず、**そのつど domain の決まりから計算する**。
      // 焼き込むと、保存期間を短くしたときに古い行だけ長く残る。
      // 同意の要否ごとに日数が違うので、その 2 群に分けて消す。
      const groups = new Map<number, TelemetryEventKey[]>();
      for (const key of TELEMETRY_EVENT_KEYS) {
        const days = RETENTION_DAYS[TELEMETRY_EVENTS[key].consent];
        const list = groups.get(days) ?? [];
        list.push(key);
        groups.set(days, list);
      }

      let deleted = 0;
      try {
        for (const [days, keys] of groups) {
          const deadline = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
          const result = await db
            .delete(telemetryEvents)
            .where(
              and(
                eq(telemetryEvents.workspaceId, String(workspaceId)),
                inArray(telemetryEvents.key, keys),
                lte(telemetryEvents.occurredAt, deadline),
              ),
            );
          deleted += changedRows(result);
        }
      } catch (cause) {
        return storageFailure("期限切れの削除", cause);
      }
      return ok({ deleted });
    },

    async forgetReader(workspaceId, readerKey) {
      // 目印を消すのではなく**行ごと消す**。目印だけ抜くと、
      // 同じ端末の記録が「誰のものでもない記録」として残り続ける。
      try {
        const result = await db
          .delete(telemetryEvents)
          .where(
            and(
              eq(telemetryEvents.workspaceId, String(workspaceId)),
              eq(telemetryEvents.readerKey, readerKey),
            ),
          );
        return ok({ deleted: changedRows(result) });
      } catch (cause) {
        return storageFailure("読者の記録の削除", cause);
      }
    },
  };
}

/**
 * 消した件数を取り出す。
 *
 * D1 が返す形は drizzle の版で変わりうるので、**数が読めなければ 0 にする**。
 * ここで例外にすると、実際には消えているのに失敗として報告される。
 */
function changedRows(result: unknown): number {
  const meta = (result as { meta?: { changes?: unknown } } | null)?.meta;
  return typeof meta?.changes === "number" ? meta.changes : 0;
}

/** 絞り込みが 1 つでも指定されているか。 */
function hasFilter(dimensions: Record<string, unknown> | undefined): boolean {
  if (dimensions === undefined) return false;
  return Object.values(dimensions).some((v) => v !== undefined && v !== null && v !== "");
}

const NO_AXIS_REASON =
  "計測から導いた数字なので、この切り口では分けられません。計測が持っているのはページの住所とブログの URL 名だけで、商品・書き手・出し先はまだ結び付けていません。";

/**
 * 計測から指標を導く読み口（D1）。
 *
 * **数字を別に貯めない。** `query` のたびに `telemetry_events` を読み、
 * `deriveMetricSamples`（domain）で畳む。畳み方はこの層に書かない。
 *
 * 絞り込みには**答えない**。計測に載っているのはページの住所と
 * ブログの URL 名だけで、商品や書き手とは結び付いていない。
 * ここで全体の数字を返すと、「この商品の表示回数」として
 * サイト全体の表示回数が出る。分けられないことは
 * `listSplittableKeys` が空を返すことで呼び出し側へ伝わり、
 * 画面は値ではなく理由を出す（`filter-metrics.ts`）。
 */
export function createD1TelemetryMetricsRepository(db: DrizzleD1): MetricsRepositoryPort {
  return {
    async query(workspaceId, input) {
      if (hasFilter(input.dimensions)) return ok([]);
      try {
        const wanted = new Set(input.keys);
        const events = await loadEvents(db, workspaceId, {
          from: input.from,
          to: input.to,
        });
        const samples = deriveMetricSamples(events, input.from, input.to).filter((s) =>
          wanted.has(s.key),
        );
        return ok(samples);
      } catch (cause) {
        return storageFailure("数字の集計", cause);
      }
    },

    async listAxisOptions(_workspaceId, axis) {
      // 空配列ではなく null を返す。空配列は「その軸に 1 件も無い」と読まれる。
      return ok({ axis, values: null, unavailableReason: NO_AXIS_REASON });
    },

    async listSplittableKeys() {
      return ok([]);
    },

    // 指標は計測から導くものなので、指標そのものを書き込む口は持たない。
    // 受け付けると、導いた数字と入れた数字の 2 通りができる。
    record: async () =>
      err(
        domainError(
          "VALIDATION_FAILED",
          "数字を直接記録することはできません。数字は計測の記録から導いています。",
          {
            suggestedAction:
              "数えたいことがあれば、計測イベントとして送ってください（domain/analytics/telemetry-events.ts が一覧の正本です）。",
          },
        ),
      ),
  };
}
