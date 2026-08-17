import { and, desc, eq } from "drizzle-orm";
import type { EditorialSiteDraftRepositoryPort } from "@/application/ports/authoring";
import type { SiteBlueprint, SiteDraft } from "@/domain/authoring";
import {
  type SiteDraftId,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  type SiteBlueprintRow,
  type SiteDraftRow,
  siteBlueprints,
  siteDrafts,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";

/**
 * ブログ作成ウィザードの下書きと、そこから作られたブログの保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約
 * （`SiteDraftRepositoryPort`）を満たす、実際に保存する実装。
 *
 * ここを本物にする順番を、他の保存先より先にした理由がある。
 * **入れる口（ウィザード）が既にあるから。** 入れる口が無いものを
 * 先に本物にすると、一生埋まらない空の画面ができる。
 * それは「まだ作っていない」より判断しにくい状態になる。
 *
 * 列の切り方は 2 つの決めごとに従う。
 *
 *   1. **一覧が絞り込みに使うものだけを列にする。** 下書きは作業場所と
 *      更新順、ブログは URL 名で引く。それ以外（13 段階ぶんの回答、
 *      カテゴリー、テーマ）は JSON 1 列にまとめる。ウィザードに質問を
 *      1 つ足すたびに保存先の作り直しが要る形にしない。
 *   2. **一意にするのは URL 名だけ。** 同じ URL 名のブログが 2 本あると
 *      読者がどちらを見ているか決められない。逆に下書きは重複しても
 *      困らないので縛らない。公開は上書き（既にあれば差し替え）なので、
 *      2 回目のやり直しが永久に通らない形にはならない。
 */

/** 行 → ドメイン。ID の作り方を知っているのはこの層だけ。 */
function toDraft(row: SiteDraftRow): SiteDraft {
  const stored = JSON.parse(row.draftJson) as Omit<SiteDraft, "id" | "workspaceId">;
  return {
    ...stored,
    id: taggedString<"SiteDraftId">(row.id) as SiteDraftId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
  };
}

function toBlueprint(row: SiteBlueprintRow): SiteBlueprint {
  return JSON.parse(row.blueprintJson) as SiteBlueprint;
}

/** 保存先が落ちたときの返し方。**握りつぶさない。** */
function storageFailure(what: string, cause: unknown) {
  return err(
    domainError("UPSTREAM_UNAVAILABLE", `${what}に失敗しました。時間をおいてもう一度お試しください。`, {
      retryable: true,
      suggestedAction: "何度も続く場合は、保存先の状態を確認してください。",
      details: { reason: cause instanceof Error ? cause.name : "unknown" },
    }),
  );
}

export function createD1SiteDraftRepository(db: DrizzleD1): EditorialSiteDraftRepositoryPort {
  return markEditorial({
    async find(workspaceId: WorkspaceId, id: SiteDraftId) {
      try {
        const rows = await db
          .select()
          .from(siteDrafts)
          .where(and(eq(siteDrafts.workspaceId, String(workspaceId)), eq(siteDrafts.id, String(id))))
          .limit(1);
        return ok(rows.length === 0 ? null : toDraft(rows[0]));
      } catch (cause) {
        return storageFailure("下書きの読み出し", cause);
      }
    },

    async list(workspaceId: WorkspaceId) {
      try {
        const rows = await db
          .select()
          .from(siteDrafts)
          .where(eq(siteDrafts.workspaceId, String(workspaceId)))
          // 新しい順。放置された下書きに気づけるようにするための一覧なので、
          // 並びが日によって変わると「増えたのか同じものなのか」が読めなくなる。
          .orderBy(desc(siteDrafts.updatedAt));
        return ok(rows.map(toDraft));
      } catch (cause) {
        return storageFailure("下書きの一覧の読み出し", cause);
      }
    },

    async save(draft: SiteDraft) {
      const { id, workspaceId, ...rest } = draft;
      try {
        await db
          .insert(siteDrafts)
          .values({
            id: String(id),
            workspaceId: String(workspaceId),
            name: draft.name,
            slug: draft.slug,
            createdSiteSlug: draft.createdSiteSlug,
            updatedAt: new Date(),
            draftJson: JSON.stringify(rest),
          })
          .onConflictDoUpdate({
            target: siteDrafts.id,
            set: {
              name: draft.name,
              slug: draft.slug,
              createdSiteSlug: draft.createdSiteSlug,
              updatedAt: new Date(),
              draftJson: JSON.stringify(rest),
            },
          });
        return ok(draft);
      } catch (cause) {
        return storageFailure("下書きの保存", cause);
      }
    },

    async publishBlueprint(slug: string, blueprint: SiteBlueprint) {
      try {
        await db
          .insert(siteBlueprints)
          .values({
            id: String(blueprint.id),
            workspaceId: String(blueprint.workspaceId),
            slug,
            name: blueprint.name,
            pattern: blueprint.pattern,
            publishedAt: new Date(),
            blueprintJson: JSON.stringify(blueprint),
          })
          // 同じ URL 名で作り直したら差し替える。**弾かない。**
          // 弾くと、名前を決め直す以外に先へ進めなくなる。
          .onConflictDoUpdate({
            target: siteBlueprints.slug,
            set: {
              id: String(blueprint.id),
              workspaceId: String(blueprint.workspaceId),
              name: blueprint.name,
              pattern: blueprint.pattern,
              publishedAt: new Date(),
              blueprintJson: JSON.stringify(blueprint),
            },
          });
        return ok(blueprint);
      } catch (cause) {
        return storageFailure("ブログの登録", cause);
      }
    },
  });
}

/**
 * 保存先にある、作られたブログの一覧。
 *
 * 読者向けの一覧（`site-repository.ts`）が見本の 3 本とこれを合わせる。
 * **読者側の画面は 2 種類を区別しない。**
 */
export async function listPublishedBlueprints(
  db: DrizzleD1,
): Promise<readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[]> {
  const rows = await db.select().from(siteBlueprints).orderBy(desc(siteBlueprints.publishedAt));
  return rows.map((row) => ({ slug: row.slug, blueprint: toBlueprint(row) }));
}
