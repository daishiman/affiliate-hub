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

function toReference(row: GuidelineReferenceRow): GuidelineReference {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    publisher: row.publisher,
    region: row.region as GuidelineRegion,
    checkedAt: row.checkedAt,
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
  };
}
