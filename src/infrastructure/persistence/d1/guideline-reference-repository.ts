import { and, eq } from "drizzle-orm";
import type { GuidelineReferencePort } from "@/application/ports/guideline-reference";
import { type GuidelineReferenceRow, guidelineReferences } from "@/db/schema";
import type { GuidelineRegion, GuidelineReference } from "@/domain/seo/guideline-reference";
import { domainError, err, ok } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * SEO/AI 検索ガイドラインの参照レジストリ（D1）。
 *
 * 問い合わせはすべて workspace_id を where に置く。
 * 出典の URL 自体は公開情報だが、「どの作業場所が何をいつ確認したか」は
 * その作業場所の運用記録であり、越境して見せる理由が無い。
 */

/**
 * 取得の記録を型へ戻す。
 *
 * 時刻と指紋が**両方**揃っているときだけ `source_fetched` を名乗る。
 * 片方だけの行は取得記録として成立していないので、未取得へ倒す。
 * 「半端に残った列」を取得済みとして読むと、確かめていないものが確かに見える。
 */
function toVerification(row: GuidelineReferenceRow): GuidelineReference["verification"] {
  if (row.sourceFetchedAt === null || row.sourceSha256 === null) return { kind: "summary_only" };
  return {
    kind: "source_fetched",
    fetchedAt: row.sourceFetchedAt,
    contentSha256: row.sourceSha256,
    ...(row.previousSourceSha256 === null ? {} : { previousSha256: row.previousSourceSha256 }),
    ...(row.reEvaluatedSha256 === null ? {} : { reEvaluatedSha256: row.reEvaluatedSha256 }),
    ...(row.reEvaluatedAt === null ? {} : { reEvaluatedAt: row.reEvaluatedAt }),
  };
}

function toReference(row: GuidelineReferenceRow): GuidelineReference {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    region: row.region as GuidelineRegion,
    checkedAt: row.checkedAt,
    verification: toVerification(row),
    ...(row.note === null ? {} : { note: row.note }),
  };
}

export type GuidelineReferenceRepositoryDeps = {
  readonly db: DrizzleD1;
  readonly now: () => Date;
};

export function createD1GuidelineReferenceRepository(
  deps: GuidelineReferenceRepositoryDeps,
): GuidelineReferencePort {
  const { db, now } = deps;

  const whereOne = (workspaceId: string, id: string) =>
    and(eq(guidelineReferences.workspaceId, workspaceId), eq(guidelineReferences.id, id));

  return {
    async list(workspaceId) {
      try {
        const rows = await db
          .select()
          .from(guidelineReferences)
          .where(eq(guidelineReferences.workspaceId, workspaceId));
        return ok(rows.map(toReference));
      } catch (cause) {
        return storageFailure("指針の出典一覧の取得", cause);
      }
    },

    async add(input) {
      try {
        await db.insert(guidelineReferences).values({
          id: input.reference.id,
          workspaceId: input.workspaceId,
          title: input.reference.title,
          url: input.reference.url,
          publisher: input.reference.publisher,
          region: input.reference.region,
          checkedAt: input.reference.checkedAt,
          sourceFetchedAt:
            input.reference.verification.kind === "source_fetched"
              ? input.reference.verification.fetchedAt
              : null,
          sourceSha256:
            input.reference.verification.kind === "source_fetched"
              ? input.reference.verification.contentSha256
              : null,
          previousSourceSha256: null,
          reEvaluatedSha256:
            input.reference.verification.kind === "source_fetched"
              ? (input.reference.verification.reEvaluatedSha256 ?? null)
              : null,
          reEvaluatedAt:
            input.reference.verification.kind === "source_fetched"
              ? (input.reference.verification.reEvaluatedAt ?? null)
              : null,
          note: input.reference.note ?? null,
          createdAt: now(),
        });
        return ok(input.reference);
      } catch (cause) {
        return storageFailure("指針の出典の登録", cause);
      }
    },

    async updateCheckedAt(input) {
      try {
        // 先に実在を見る。update の件数だけでは「無かった」と「変わらなかった」が
        // 区別できず、消えた出典への再確認が成功に見える。
        const rows = await db
          .select()
          .from(guidelineReferences)
          .where(whereOne(input.workspaceId, input.id))
          .limit(1);
        const row = rows[0];
        if (row === undefined) {
          return err(
            domainError("NOT_FOUND", "その出典は登録されていません。", {
              details: { id: input.id },
            }),
          );
        }
        await db
          .update(guidelineReferences)
          .set({ checkedAt: input.checkedAt })
          .where(whereOne(input.workspaceId, input.id));
        return ok({ ...toReference(row), checkedAt: input.checkedAt });
      } catch (cause) {
        return storageFailure("指針の確認日の更新", cause);
      }
    },

    async recordSourceFetch(input) {
      try {
        const rows = await db
          .select()
          .from(guidelineReferences)
          .where(whereOne(input.workspaceId, input.id))
          .limit(1);
        const row = rows[0];
        if (row === undefined) {
          return err(
            domainError("NOT_FOUND", "その出典は登録されていません。", {
              details: { id: input.id },
            }),
          );
        }

        // いま入っている指紋を「前回」へ繰り上げる。取得のたびに 1 世代だけ残す。
        // 全世代を残さないのは、必要なのが「前回と違うか」だけだからである。
        // 初回だけは比較対象が無いので今回版を再評価済みの基準値にする。2 回目以降は
        // 再取得だけで警告を消さないよう、再評価済みの指紋を絶対に動かさない。
        const firstFetch = row.sourceSha256 === null;
        const reEvaluatedSha256 = firstFetch ? input.contentSha256 : row.reEvaluatedSha256;
        const reEvaluatedAt = firstFetch ? input.fetchedAt : row.reEvaluatedAt;
        await db
          .update(guidelineReferences)
          .set({
            sourceFetchedAt: input.fetchedAt,
            sourceSha256: input.contentSha256,
            previousSourceSha256: row.sourceSha256,
            reEvaluatedSha256,
            reEvaluatedAt,
            checkedAt: input.checkedAt,
          })
          .where(whereOne(input.workspaceId, input.id));

        return ok(
          toReference({
            ...row,
            sourceFetchedAt: input.fetchedAt,
            sourceSha256: input.contentSha256,
            previousSourceSha256: row.sourceSha256,
            reEvaluatedSha256,
            reEvaluatedAt,
            checkedAt: input.checkedAt,
          }),
        );
      } catch (cause) {
        return storageFailure("原典取得の記録", cause);
      }
    },

    async acknowledgeReevaluation(input) {
      try {
        const rows = await db
          .select()
          .from(guidelineReferences)
          .where(whereOne(input.workspaceId, input.id))
          .limit(1);
        const row = rows[0];
        if (row === undefined) {
          return err(
            domainError("NOT_FOUND", "その出典は登録されていません。", {
              details: { id: input.id },
            }),
          );
        }
        if (row.sourceSha256 === null) {
          return err(
            domainError("CONFLICT", "原典の本文を取り込んでから、仕様を評価し直してください。"),
          );
        }
        if (row.sourceSha256 !== input.expectedContentSha256) {
          return err(
            domainError(
              "CONFLICT",
              "画面を開いた後に原典の本文が更新されました。最新版を確認してから、もう一度完了してください。",
            ),
          );
        }

        // 読み取り後に新しい版が取得される競合も、SHA を where に含めて閉じる。
        const updated = await db
          .update(guidelineReferences)
          .set({
            reEvaluatedSha256: input.expectedContentSha256,
            reEvaluatedAt: input.reEvaluatedAt,
          })
          .where(
            and(
              whereOne(input.workspaceId, input.id),
              eq(guidelineReferences.sourceSha256, input.expectedContentSha256),
            ),
          )
          .returning();
        const acknowledged = updated[0];
        if (acknowledged === undefined) {
          return err(
            domainError(
              "CONFLICT",
              "原典の本文が同時に更新されました。最新版を確認してから、もう一度完了してください。",
            ),
          );
        }
        return ok(toReference(acknowledged));
      } catch (cause) {
        return storageFailure("仕様の再評価完了の記録", cause);
      }
    },
  };
}
