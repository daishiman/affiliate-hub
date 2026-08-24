import { and, asc, desc, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type {
  FeedbackFilter,
  FeedbackRepositoryPort,
  IntegrationKeyPort,
} from "@/application/ports/feedback";
import type { PortResult } from "@/application/ports/common";
import {
  type DispositionRecord,
  type FeedbackHistoryEntry,
  type FeedbackOrigin,
  type FeedbackReport,
  type HandoffState,
  type IntegrationKey,
  type KeyScope,
  type KeyUsageRecord,
  type TechnicalContext,
  diagnosticsPurgeCutoff,
  isDiagnosticsPurged,
  purgeDiagnostics,
} from "@/domain/feedback";
import {
  type IntegrationKeyId,
  type WorkspaceId,
  asBrandId,
  asFeedbackCaptureId,
  asFeedbackReportId,
  asIntegrationKeyId,
  asSiteId,
  asUserId,
  asWorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";
import {
  type FeedbackReportRow,
  type IntegrationKeyRow,
  feedbackReports,
  integrationKeyUsages,
  integrationKeys,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 改善要望と、取りに来るときの鍵の保存先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約
 * （`FeedbackRepositoryPort` / `IntegrationKeyPort`）を満たす、実際に保存する実装。
 *
 * 受信箱（`link-inbox-repository.ts`）で決めた 3 つの作法をここでも守る。
 * 加えて、この文脈だけの決めごとが 3 つある。
 *
 *   1. **絞り込みは必ず `workspaceId` から始める。** 画像に他社の画面が
 *      写り得る以上、絞り忘れた 1 か所が他社の画面を見せることになる。
 *      ポートの全メソッドが `workspaceId` を第一引数に取るのはそのためで、
 *      ここではそれを `where` の先頭に必ず置くことで受ける。
 *   2. **平文の鍵は行の形にも現れない。** `IntegrationKeyRow` に平文の列が
 *      無いので、この実装をどう間違えても平文は保存されない。
 *      「気をつける」ではなく「書けない」にしてある。
 *   3. **履歴と払い出しは JSON の 1 列にまとめて上書きする。**
 *      積み上げは domain（`recordHandoff` / `history`）が済ませた形で渡ってくる。
 *      ここで行を足す作りにすると、積み方の規則が保存先にも生まれ、
 *      2 か所が食い違ったときにどちらが正しいか決められなくなる。
 *
 * 画面の写し（R2）はここに含めない。置き場そのものは用意できるが、
 * 見るための期限つき URL を配る口がまだ無く、そこだけ仮のままである
 * （`feedback-sample-repository.ts` の `storage:feedback-capture-memory`）。
 * 中途半端に保存だけ本物にすると、「保存できているのに開けない」という
 * 最も切り分けにくい形になる。
 */

/**
 * 1 回の削除で見る件数の上限。
 *
 * 定期実行には実行時間の上限がある。途中で終わっても消し残るだけで、
 * 消しすぎることはない（次の回が古い側から続きを拾う）。
 * 画像の掃除（`SWEEP_LIMIT`）より小さいのは、こちらが 1 件ごとに
 * 書き込みを伴うためである。
 */
const DIAGNOSTICS_PURGE_LIMIT = 500;

/**
 * 日付を含む JSON の読み戻し。
 *
 * `JSON.stringify` は `Date` を文字列にするので、読むときに戻す必要がある。
 * 戻し忘れると、画面では日付として扱われるのに中身は文字列という状態になり、
 * 並べ替えだけが静かに壊れる（文字列の大小で並ぶ）。
 */
function reviveDates<T>(json: string, dateKeys: readonly string[]): T {
  return JSON.parse(json, (key, value) =>
    dateKeys.includes(key) && typeof value === "string" ? new Date(value) : value,
  ) as T;
}

/** 行 → ドメイン。ID の作り方を知っているのはこの層だけ。 */
function toDomain(row: FeedbackReportRow): FeedbackReport {
  return {
    id: asFeedbackReportId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    brandId: row.brandId === null ? null : asBrandId(row.brandId),
    siteId: row.siteId === null ? null : asSiteId(row.siteId),
    kind: row.kind,
    body: row.body,
    wish: row.wish,
    origin: JSON.parse(row.originJson) as FeedbackOrigin,
    // 消した時刻も日付である。戻し忘れると、消してあるかどうかの判定は
    // 動く（null かどうかしか見ない）のに、いつ消えたかだけが文字列に化ける。
    technical: reviveDates<TechnicalContext>(row.technicalJson, ["purgedAt"]),
    captureId: row.captureId === null ? null : asFeedbackCaptureId(row.captureId),
    submittedBy: asUserId(row.submittedBy),
    submittedAt: row.submittedAt,
    status: row.status,
    disposition:
      row.dispositionJson === null
        ? null
        : reviveDates<DispositionRecord>(row.dispositionJson, ["decidedAt"]),
    handoff: reviveDates<HandoffState>(row.handoffJson, ["at", "lastAt"]),
    beadsIssueId: row.beadsIssueId,
    history: reviveDates<readonly FeedbackHistoryEntry[]>(row.historyJson, ["at"]),
  };
}

/** ドメイン → 行。 */
function toRow(item: FeedbackReport): FeedbackReportRow {
  return {
    id: String(item.id),
    workspaceId: String(item.workspaceId),
    brandId: item.brandId === null ? null : String(item.brandId),
    siteId: item.siteId === null ? null : String(item.siteId),
    kind: item.kind,
    body: item.body,
    wish: item.wish,
    // 絞り込みに使う分だけを列へ出し、残りは origin の中に置いたままにする。
    route: item.origin.route,
    originJson: JSON.stringify(item.origin),
    technicalJson: JSON.stringify(item.technical),
    captureId: item.captureId === null ? null : String(item.captureId),
    submittedBy: String(item.submittedBy),
    submittedAt: item.submittedAt,
    status: item.status,
    dispositionKind: item.disposition?.kind ?? null,
    dispositionJson: item.disposition === null ? null : JSON.stringify(item.disposition),
    handoffCount: item.handoff.count,
    handoffJson: JSON.stringify(item.handoff),
    beadsIssueId: item.beadsIssueId,
    historyJson: JSON.stringify(item.history),
  };
}

/**
 * 改善要望を 1 件でも持っている作業場所の一覧。
 *
 * **定期実行のためだけにある。** 呼び出し元に身元が無いので、
 * 「誰の分を消すか」をこちらで数え上げるしかない。ポート
 * （`FeedbackRepositoryPort`）に載せていないのは、載せると画面や道具の側から
 * 全作業場所を舐める入口ができるためである。使う場所は
 * `platform/feedback-diagnostics-purge.ts` 1 か所に限る。
 */
export async function listFeedbackWorkspaceIds(db: DrizzleD1): Promise<readonly string[]> {
  const rows = await db
    .selectDistinct({ workspaceId: feedbackReports.workspaceId })
    .from(feedbackReports);
  return rows.map((r) => r.workspaceId);
}

export function createD1FeedbackRepository(
  db: DrizzleD1,
  options: { readonly diagnosticsPurgeLimit?: number } = {},
): FeedbackRepositoryPort {
  const diagnosticsPurgeLimit =
    options.diagnosticsPurgeLimit ?? DIAGNOSTICS_PURGE_LIMIT;
  return {
    async save(workspaceId: WorkspaceId, report: FeedbackReport): PortResult<true> {
      if (report.workspaceId !== workspaceId) {
        // 別の作業場所のものを書き込ませない。ここを通すと、
        // 取り違えた 1 件が他社の一覧に出る。
        return err(
          domainError("FORBIDDEN", "別の作業場所の要望は保存できません。", {
            field: "workspaceId",
          }),
        );
      }
      try {
        const row = toRow(report);
        // 同じ id で入れ直したときは上書きする（状態が変わるたびに呼ばれる）。
        await db.insert(feedbackReports).values(row).onConflictDoUpdate({
          target: feedbackReports.id,
          set: row,
        });
        return ok(true);
      } catch (cause) {
        return storageFailure("改善要望の保存", cause);
      }
    },

    async findById(workspaceId: WorkspaceId, id: string): PortResult<FeedbackReport | null> {
      try {
        const rows = await db
          .select()
          .from(feedbackReports)
          .where(
            and(
              eq(feedbackReports.workspaceId, String(workspaceId)),
              eq(feedbackReports.id, id),
            ),
          )
          .limit(1);
        // 他の作業場所のものは「無い」と答える。存在の有無も漏らさない。
        return ok(rows.length === 0 ? null : toDomain(rows[0]));
      } catch (cause) {
        return storageFailure("改善要望の読み出し", cause);
      }
    },

    async list(
      workspaceId: WorkspaceId,
      filter?: FeedbackFilter,
    ): PortResult<readonly FeedbackReport[]> {
      try {
        const conditions = [eq(feedbackReports.workspaceId, String(workspaceId))];
        if (filter?.statuses !== undefined) {
          conditions.push(inArray(feedbackReports.status, [...filter.statuses]));
        }
        if (filter?.kinds !== undefined) {
          conditions.push(
            inArray(feedbackReports.kind, [
              ...filter.kinds,
            ] as FeedbackReportRow["kind"][]),
          );
        }
        if (filter?.route !== undefined) {
          conditions.push(eq(feedbackReports.route, filter.route));
        }
        if (filter?.handedOff !== undefined) {
          // 「渡したか」は回数で判定する。履歴を開かずに絞れるのが列に出した理由。
          conditions.push(
            filter.handedOff
              ? gt(feedbackReports.handoffCount, 0)
              : eq(feedbackReports.handoffCount, 0),
          );
        }
        const rows = await db
          .select()
          .from(feedbackReports)
          .where(and(...conditions))
          .orderBy(desc(feedbackReports.submittedAt));

        // 廃棄の除外だけは読み出したあとで行う。列で `!= 'discarded'` と書くと
        // NULL（まだ何も決めていないもの）が落ちる。SQLite では NULL との
        // 比較が真にならないためで、既定の一覧から新着が消えるという
        // **最も気づきにくい形**になる。
        const includeDiscarded = filter?.includeDiscarded === true;
        const kept = includeDiscarded
          ? rows
          : rows.filter((r) => r.dispositionKind !== "discarded");
        return ok(kept.map(toDomain));
      } catch (cause) {
        return storageFailure("改善要望の一覧取得", cause);
      }
    },

    async purgeExpiredDiagnostics(workspaceId: WorkspaceId, now: Date) {
      try {
        const cutoff = diagnosticsPurgeCutoff(now);
        /*
         * 候補は JSON の構造を読んで「まだ消していない行」だけにする。
         * 文字列の並びや空白に依存する LIKE は使わない。すでに消した行を
         * 毎回先頭から拾うと、上限を超えたときに残りへ永久に進めないためである。
         * 最終判定は domain の `isDiagnosticsPurged` にも通し、保存先の抽出と
         * 業務ルールの二重防御にする。古い行に項目が無い場合も SQL の NULL と
         * なり、未削除として一度だけ安全に処理される。
         *
         * 期限の判定だけは SQL で絞る。ここを絞らないと、
         * 期限内の要望まで毎晩読み出すことになる。
         */
        const rows = await db
          .select()
          .from(feedbackReports)
          .where(
            and(
              eq(feedbackReports.workspaceId, String(workspaceId)),
              lte(feedbackReports.submittedAt, cutoff),
              sql`json_extract(${feedbackReports.technicalJson}, '$.purgedAt') IS NULL`,
            ),
          )
          // 同じ時刻は id で決める。上限の境界を実行ごとに揺らさない。
          .orderBy(asc(feedbackReports.submittedAt), asc(feedbackReports.id))
          .limit(diagnosticsPurgeLimit + 1);

        const finished = rows.length <= diagnosticsPurgeLimit;
        const batch = finished ? rows : rows.slice(0, diagnosticsPurgeLimit);
        let purged = 0;
        for (const row of batch) {
          const technical = reviveDates<TechnicalContext>(row.technicalJson, ["purgedAt"]);
          if (isDiagnosticsPurged(technical)) continue;
          const emptied = purgeDiagnostics(technical, now);
          await db
            .update(feedbackReports)
            .set({ technicalJson: JSON.stringify(emptied) })
            .where(
              and(
                // 作業場所は更新のときも必ず置く。id だけで更新すると、
                // 読み出しの絞りを外した日にそのまま他社の行を書き換える。
                eq(feedbackReports.workspaceId, String(workspaceId)),
                eq(feedbackReports.id, row.id),
              ),
            );
          purged += 1;
        }
        return ok({ purged, finished });
      } catch (cause) {
        return storageFailure("技術情報の削除", cause);
      }
    },
  };
}

/** 行 → ドメイン（鍵）。 */
function toKeyDomain(row: IntegrationKeyRow): IntegrationKey {
  return {
    id: asIntegrationKeyId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    label: row.label,
    hashedValue: row.hashedValue,
    scopes: JSON.parse(row.scopesJson) as readonly KeyScope[],
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    rateLimitPerMinute: row.rateLimitPerMinute,
  };
}

export function createD1IntegrationKeyStore(options: {
  readonly db: DrizzleD1;
  /** 平文を潰す。作り方は platform 側が持つ。 */
  readonly hash: (plainValue: string) => Promise<string>;
  /** 利用の記録に付ける ID。 */
  readonly newId: () => string;
}): IntegrationKeyPort {
  const { db, hash, newId } = options;
  return {
    async issue(workspaceId: WorkspaceId, key: IntegrationKey): PortResult<true> {
      if (key.workspaceId !== workspaceId) {
        return err(
          domainError("FORBIDDEN", "別の作業場所の鍵は発行できません。", {
            field: "workspaceId",
          }),
        );
      }
      try {
        await db.insert(integrationKeys).values({
          id: String(key.id),
          workspaceId: String(key.workspaceId),
          label: key.label,
          hashedValue: key.hashedValue,
          scopesJson: JSON.stringify(key.scopes),
          createdBy: key.createdBy,
          createdAt: key.createdAt,
          lastUsedAt: key.lastUsedAt,
          revokedAt: key.revokedAt,
          rateLimitPerMinute: key.rateLimitPerMinute,
        });
        return ok(true);
      } catch (cause) {
        return storageFailure("鍵の発行", cause);
      }
    },

    async list(workspaceId: WorkspaceId): PortResult<readonly IntegrationKey[]> {
      try {
        const rows = await db
          .select()
          .from(integrationKeys)
          .where(eq(integrationKeys.workspaceId, String(workspaceId)))
          .orderBy(desc(integrationKeys.createdAt));
        return ok(rows.map(toKeyDomain));
      } catch (cause) {
        return storageFailure("鍵の一覧取得", cause);
      }
    },

    async revoke(workspaceId: WorkspaceId, id: IntegrationKeyId, at: Date): PortResult<true> {
      try {
        // 行は消さない。消すと「いつ誰が止めたか」が残らない。
        const updated = await db
          .update(integrationKeys)
          .set({ revokedAt: at })
          .where(
            and(
              eq(integrationKeys.workspaceId, String(workspaceId)),
              eq(integrationKeys.id, String(id)),
            ),
          )
          .returning({ id: integrationKeys.id });
        if (updated.length === 0) {
          return err(
            domainError("NOT_FOUND", "その鍵は見つかりませんでした。", {
              suggestedAction: "すでに削除されているか、別の作業場所の鍵です。",
            }),
          );
        }
        return ok(true);
      } catch (cause) {
        return storageFailure("鍵の失効", cause);
      }
    },

    async authenticate(plainValue: string): PortResult<IntegrationKey | null> {
      try {
        const hashed = await hash(plainValue);
        // 潰した値だけで引く。**平文は問い合わせにも現れない。**
        const rows = await db
          .select()
          .from(integrationKeys)
          .where(eq(integrationKeys.hashedValue, hashed))
          .limit(1);
        // 見つからない場合も同じ形で返す。どの鍵が存在するかを漏らさない。
        return ok(rows.length === 0 ? null : toKeyDomain(rows[0]));
      } catch (cause) {
        return storageFailure("鍵の確認", cause);
      }
    },

    async withinRateLimit(id: IntegrationKeyId, now: Date): PortResult<boolean> {
      try {
        const keyRows = await db
          .select()
          .from(integrationKeys)
          .where(eq(integrationKeys.id, String(id)))
          .limit(1);
        if (keyRows.length === 0) return ok(false);
        const oneMinuteAgo = new Date(now.getTime() - 60_000);
        // 直近 1 分の記録を**保存先から数える**。実行中だけ覚える形にすると、
        // 別のリクエストで作り直された瞬間に数が 0 に戻り、上限が効かなくなる。
        const recent = await db
          .select({ id: integrationKeyUsages.id })
          .from(integrationKeyUsages)
          .where(
            and(
              eq(integrationKeyUsages.keyId, String(id)),
              gt(integrationKeyUsages.usedAt, oneMinuteAgo),
            ),
          );
        return ok(recent.length < keyRows[0].rateLimitPerMinute);
      } catch (cause) {
        return storageFailure("回数の確認", cause);
      }
    },

    async recordUsage(workspaceId: WorkspaceId, usage: KeyUsageRecord): PortResult<true> {
      try {
        const updated = await db
          .update(integrationKeys)
          .set({ lastUsedAt: usage.at })
          .where(
            and(
              eq(integrationKeys.workspaceId, String(workspaceId)),
              eq(integrationKeys.id, String(usage.keyId)),
            ),
          )
          .returning({ id: integrationKeys.id });
        if (updated.length === 0) {
          return err(
            domainError("NOT_FOUND", "その鍵は見つかりませんでした。", {
              suggestedAction: "すでに削除されているか、別の作業場所の鍵です。",
            }),
          );
        }
        await db.insert(integrationKeyUsages).values({
          id: newId(),
          workspaceId: String(workspaceId),
          keyId: String(usage.keyId),
          usedAt: usage.at,
          keyLabel: usage.keyLabel,
          fetchedCount: usage.fetchedCount,
        });
        return ok(true);
      } catch (cause) {
        return storageFailure("鍵の利用の記録", cause);
      }
    },
  };
}
