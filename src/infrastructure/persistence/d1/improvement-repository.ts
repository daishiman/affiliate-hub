import { and, desc, eq } from "drizzle-orm";
import type { ImprovementRepositoryPort, LoopObservation } from "@/application/ports/improvement";
import {
  type LoopRun,
  type VariantSpec,
  assertRecordableLoopRun,
  assertRecordableObservation,
  assertRecordableVariantSpec,
} from "@/domain/analytics";
import {
  type Provenance,
  type WorkspaceId,
  asExperimentId,
  asWorkspaceId,
  domainError,
  err,
  ok,
  validationError,
} from "@/domain/shared";
import {
  type LoopObservationRow,
  type LoopRunRow,
  type VariantSpecRow,
  loopObservations,
  loopRuns,
  variantSpecs,
} from "@/db/schema";
import { storageFailure } from "./storage-failure";
import type { DrizzleD1 } from "./link-inbox-repository";

/**
 * 改善ループの記録先（D1）。
 *
 * **これはスタブではない。** 見本データ版と同じ契約（`ImprovementRepositoryPort`）を
 * 満たす、実際に保存する実装。仕様 docs/spec/03-分析・解析基盤仕様.md §14 が
 * 「まだ実装していないところ」として挙げていた 3 つの表がここで埋まる。
 *
 * この文脈だけの決めごとが 3 つある。
 *
 *   1. **絞り込みは必ず `workspaceId` から始める。** ほかの D1 実装と同じ作法。
 *      改善ループの記録は「どの見せ方が効いたか」であり、他社の記録が見えると
 *      そのまま他社の運用が読める。
 *
 *   2. **一覧（調整してはいけないもの 6 / 外せない約束 5 / 改善の軸 20 /
 *      ループの種類 6）を、保存のたびに突き当てる。** 判定そのものは
 *      `domain/analytics/loop-record.ts` にあり、ここはそれを通す役に徹する。
 *      入口（`createVariantSpec` / `createLoopRun`）だけで守っていると、
 *      入口を通さずに組み立てた値を `save〜` へ渡せば
 *      「広告であることの表示」を軸にした記録が書けてしまう。
 *
 *   3. **見本を消さずに重ねる**（`mergeWithSamples` は使わず、呼び出し側の
 *      合成に任せる形にはしていない）。ここでは保存された分だけを返し、
 *      見本と混ぜない。改善ループの記録は**数字を伴う**ので、
 *      見本の数字と実測が同じ一覧に並ぶと、どちらを見て判断したのか
 *      後から区別できなくなる。空なら空と出す。
 */

/** 由来は `Date` を 2 つ含む。文字列のまま返すと、日付の比較が静かに壊れる。 */
function reviveProvenance(json: string): Provenance {
  return JSON.parse(json, (key, value) =>
    (key === "retrievedAt" || key === "validUntil") && typeof value === "string"
      ? new Date(value)
      : value,
  ) as Provenance;
}

function toSpec(row: VariantSpecRow): VariantSpec {
  return {
    id: row.id,
    label: row.label,
    settings: row.settings,
    provenance: reviveProvenance(row.provenanceJson),
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt,
  };
}

function toSpecRow(
  workspaceId: WorkspaceId,
  siteSlug: string,
  spec: VariantSpec,
): VariantSpecRow {
  return {
    id: spec.id,
    workspaceId: String(workspaceId),
    siteSlug,
    label: spec.label,
    settings: [...spec.settings],
    provenanceJson: JSON.stringify(spec.provenance),
    approvedBy: spec.approvedBy,
    approvedAt: spec.approvedAt,
  };
}

function toRun(row: LoopRunRow): LoopRun {
  return {
    id: asExperimentId(row.id),
    workspaceId: asWorkspaceId(row.workspaceId),
    loopKindKey: row.loopKindKey,
    siteSlug: row.siteSlug,
    baselineSpecId: row.baselineSpecId,
    candidateSpecId: row.candidateSpecId,
    changedDimensions: row.changedDimensions,
    // 指標の綴りは列に文字で入っている。定義済みかは保存のたびに突き当てているので、
    // ここは読み戻すだけ。定義から消えた指標が残っていれば、次の保存で断られる。
    primaryMetric: row.primaryMetric as LoopRun["primaryMetric"],
    minimumSamples: row.minimumSamples,
    status: row.status,
    startedAt: row.startedAt,
    concludedAt: row.concludedAt,
    verdict: row.verdict,
    stoppedReason: row.stoppedReason,
  };
}

function toRunRow(run: LoopRun): LoopRunRow {
  return {
    id: String(run.id),
    workspaceId: String(run.workspaceId),
    loopKindKey: run.loopKindKey,
    siteSlug: run.siteSlug,
    baselineSpecId: run.baselineSpecId,
    candidateSpecId: run.candidateSpecId,
    changedDimensions: [...run.changedDimensions],
    primaryMetric: run.primaryMetric,
    minimumSamples: run.minimumSamples,
    status: run.status,
    startedAt: run.startedAt,
    concludedAt: run.concludedAt,
    verdict: run.verdict,
    stoppedReason: run.stoppedReason,
  };
}

function toObservation(row: LoopObservationRow): LoopObservation {
  return {
    runId: row.runId,
    baselineValue: row.baselineValue,
    baselineSamples: row.baselineSamples,
    candidateValue: row.candidateValue,
    candidateSamples: row.candidateSamples,
  };
}

export function createD1ImprovementRepository(db: DrizzleD1): ImprovementRepositoryPort {
  /** 1 件読む。無ければ null。保存前の突き当てで使う。 */
  async function findSpec(workspaceId: WorkspaceId, id: string): Promise<VariantSpec | null> {
    const rows = await db
      .select()
      .from(variantSpecs)
      .where(and(eq(variantSpecs.workspaceId, String(workspaceId)), eq(variantSpecs.id, id)));
    const row = rows[0];
    return row === undefined ? null : toSpec(row);
  }

  async function findRun(workspaceId: WorkspaceId, id: string): Promise<LoopRun | null> {
    const rows = await db
      .select()
      .from(loopRuns)
      .where(and(eq(loopRuns.workspaceId, String(workspaceId)), eq(loopRuns.id, id)));
    const row = rows[0];
    return row === undefined ? null : toRun(row);
  }

  return {
    async listVariantSpecs(workspaceId, input) {
      try {
        const where =
          input?.siteSlug === undefined
            ? eq(variantSpecs.workspaceId, String(workspaceId))
            : and(
                eq(variantSpecs.workspaceId, String(workspaceId)),
                eq(variantSpecs.siteSlug, input.siteSlug),
              );
        const rows = await db.select().from(variantSpecs).where(where);
        return ok(rows.map(toSpec));
      } catch (cause) {
        return storageFailure("見せ方の設定の読み出し", cause);
      }
    },

    async saveVariantSpec(workspaceId, input) {
      // 一覧を突き当てるのは保存の前。書いてから直すのでは、
      // 「一度は書けた」という事実が残る。
      const recordable = assertRecordableVariantSpec(input.spec);
      if (!recordable.ok) return err(recordable.error);
      if (input.siteSlug.trim() === "") {
        return err(recordableSiteSlugError());
      }
      try {
        const row = toSpecRow(workspaceId, input.siteSlug, input.spec);
        await db.insert(variantSpecs).values(row).onConflictDoUpdate({
          target: variantSpecs.id,
          set: row,
        });
        return ok(true);
      } catch (cause) {
        return storageFailure("見せ方の設定の保存", cause);
      }
    },

    async listRuns(workspaceId, input) {
      try {
        const where =
          input?.siteSlug === undefined
            ? eq(loopRuns.workspaceId, String(workspaceId))
            : and(
                eq(loopRuns.workspaceId, String(workspaceId)),
                eq(loopRuns.siteSlug, input.siteSlug),
              );
        const rows = await db
          .select()
          .from(loopRuns)
          .where(where)
          .orderBy(desc(loopRuns.startedAt));
        return ok(rows.map(toRun));
      } catch (cause) {
        return storageFailure("改善ループの記録の読み出し", cause);
      }
    },

    async saveRun(workspaceId, run) {
      // 記録は自分の作業場所のものだけ。別の作業場所の id を持つ記録を
      // 自分の作業場所へ書き込めると、どちらの一覧にも出る行ができる。
      if (String(run.workspaceId) !== String(workspaceId)) {
        return err(otherWorkspaceError());
      }
      let baseline: VariantSpec | null;
      let candidate: VariantSpec | null;
      try {
        baseline = await findSpec(workspaceId, run.baselineSpecId);
        candidate = await findSpec(workspaceId, run.candidateSpecId);
      } catch (cause) {
        return storageFailure("比べる設定の読み出し", cause);
      }
      const recordable = assertRecordableLoopRun(run, { baseline, candidate });
      if (!recordable.ok) return err(recordable.error);
      try {
        const row = toRunRow(run);
        await db.insert(loopRuns).values(row).onConflictDoUpdate({
          target: loopRuns.id,
          set: row,
        });
        return ok(true);
      } catch (cause) {
        return storageFailure("改善ループの記録の保存", cause);
      }
    },

    async observationsOf(workspaceId, runId) {
      try {
        const rows = await db
          .select()
          .from(loopObservations)
          .where(
            and(
              eq(loopObservations.workspaceId, String(workspaceId)),
              eq(loopObservations.runId, runId),
            ),
          );
        const row = rows[0];
        return ok(row === undefined ? null : toObservation(row));
      } catch (cause) {
        return storageFailure("観測値の読み出し", cause);
      }
    },

    async saveObservation(workspaceId, input) {
      let run: LoopRun | null;
      try {
        run = await findRun(workspaceId, input.runId);
      } catch (cause) {
        return storageFailure("観測対象の読み出し", cause);
      }
      const recordable = assertRecordableObservation({ ...input, run });
      if (!recordable.ok) return err(recordable.error);
      try {
        const row: LoopObservationRow = {
          workspaceId: String(workspaceId),
          runId: input.runId,
          baselineValue: input.baselineValue,
          baselineSamples: input.baselineSamples,
          candidateValue: input.candidateValue,
          candidateSamples: input.candidateSamples,
          observedAt: input.observedAt,
        };
        await db.insert(loopObservations).values(row).onConflictDoUpdate({
          target: [loopObservations.workspaceId, loopObservations.runId],
          set: row,
        });
        return ok(true);
      } catch (cause) {
        return storageFailure("観測値の保存", cause);
      }
    },
  };
}

function recordableSiteSlugError() {
  return validationError("どのブログの設定かが決まっていません。", "siteSlug");
}

function otherWorkspaceError() {
  return domainError("FORBIDDEN", "ほかの作業場所の記録は保存できません。");
}
