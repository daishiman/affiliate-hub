import { and, desc, eq, sql } from "drizzle-orm";
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
  blogTemplateSelections,
  blogThemes,
  siteBlueprints,
  siteRetirements,
  siteDrafts,
} from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 0034旧版がretired_at列を追加した途中状態も、独立墓標へ一度だけ救出する。
 * 新規DBには列が無いので、その「列が無い」だけは互換状態として扱う。
 */
async function preserveLegacyRetirements(db: DrizzleD1): Promise<void> {
  try {
    await db.run(sql`
      INSERT OR IGNORE INTO ${siteRetirements} (slug, workspace_id, retired_at)
      SELECT slug, workspace_id, retired_at
      FROM site_blueprints
      WHERE retired_at IS NOT NULL
    `);
  } catch (cause) {
    if (!String(cause).toLowerCase().includes("retired_at")) throw cause;
  }
}

async function clearLegacyRetirement(
  db: DrizzleD1,
  workspaceId: WorkspaceId,
  slug: string,
): Promise<void> {
  try {
    await db.run(sql`
      UPDATE site_blueprints SET retired_at = NULL
      WHERE workspace_id = ${String(workspaceId)} AND slug = ${slug}
    `);
  } catch (cause) {
    if (!String(cause).toLowerCase().includes("retired_at")) throw cause;
  }
}

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
 *      困らないので縛らない。同じ workspace からの作り直しだけを上書きとし、
 *      別 workspace への URL 名の移管は読者データを守るため許可しない。
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

    async publishBlueprint(slug: string, blueprint: SiteBlueprint, appearance) {
      try {
        const blueprintMutation = db
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
          // 同じ workspace が同じ URL 名で作り直す場合だけ差し替える。
          // URL 名は問い合わせなど読者データの所属境界なので、別 workspace へ
          // 所有権を移すと、過去の読者データまで新所有者へ渡ってしまう。
          .onConflictDoUpdate({
            target: siteBlueprints.slug,
            set: {
              id: String(blueprint.id),
              name: blueprint.name,
              pattern: blueprint.pattern,
              publishedAt: new Date(),
              blueprintJson: JSON.stringify(blueprint),
            },
            setWhere: eq(siteBlueprints.workspaceId, String(blueprint.workspaceId)),
          })
          .returning({ workspaceId: siteBlueprints.workspaceId });
        const saved =
          appearance === undefined
            ? await blueprintMutation
            : (
                await db.batch([
                  blueprintMutation,
                  db
                    .insert(blogTemplateSelections)
                    // appearanceは「同じworkspaceの設計図が保存できた」場合だけ作る。
                    // values()で無条件に入れると、slug競合でblueprintが0行でも
                    // batchの後続だけが残り、正規ownerの保存を妨害できてしまう。
                    .select(sql`
                      SELECT
                        ${`bt_${String(blueprint.id)}`},
                        ${String(blueprint.workspaceId)},
                        ${slug},
                        ${appearance.templateId},
                        unixepoch()
                      FROM ${siteBlueprints}
                      WHERE ${siteBlueprints.slug} = ${slug}
                        AND ${siteBlueprints.workspaceId} = ${String(blueprint.workspaceId)}
                    `)
                    .onConflictDoUpdate({
                      target: blogTemplateSelections.siteSlug,
                      set: { templateId: appearance.templateId, updatedAt: new Date() },
                      setWhere: eq(
                        blogTemplateSelections.workspaceId,
                        String(blueprint.workspaceId),
                      ),
                    }),
                  db
                    .insert(blogThemes)
                    .select(sql`
                      SELECT
                        ${`bth_${String(blueprint.id)}`},
                        ${String(blueprint.workspaceId)},
                        ${slug},
                        ${appearance.theme.brandTheme},
                        ${appearance.theme.colorMode}
                      FROM ${siteBlueprints}
                      WHERE ${siteBlueprints.slug} = ${slug}
                        AND ${siteBlueprints.workspaceId} = ${String(blueprint.workspaceId)}
                    `)
                    .onConflictDoUpdate({
                      target: blogThemes.siteSlug,
                      set: {
                        brandTheme: appearance.theme.brandTheme,
                        colorMode: appearance.theme.colorMode,
                      },
                      setWhere: eq(blogThemes.workspaceId, String(blueprint.workspaceId)),
                    }),
                ] as const)
              )[0];
        if (saved.length === 0) {
          return err(
            domainError("CONFLICT", "この URL の名前は使えません。", {
              suggestedAction: "別の URL の名前を付けて、もう一度登録してください。",
            }),
          );
        }
        await clearLegacyRetirement(db, blueprint.workspaceId, slug);
        await db
          .delete(siteRetirements)
          .where(
            and(
              eq(siteRetirements.workspaceId, String(blueprint.workspaceId)),
              eq(siteRetirements.slug, slug),
            ),
          );
        return ok(blueprint);
      } catch (cause) {
        return storageFailure("ブログの登録", cause);
      }
    },

    /**
     * 登録済みのブログを取り下げる（所有権は保持する）。
     *
     * **会社の絞り込みを消す条件にも入れる。** URL 名だけで消すと、
     * 同じ名前を別の会社が使っていたときに他社のブログが落ちる。
     * 見本の 3 本は行として存在しないので、消そうとしても 0 件になる。
     * 0 件を成功と返さないのは、次に開いたときにまだ居るからである。
     */
    async removeBlueprint(workspaceId: WorkspaceId, slug: string) {
      try {
        /*
         * 物理削除しない。URL 名は問い合わせ・公開記事などの所属境界で、
         * 行を消すと別 workspace が同じ名前を取得でき、旧データが移管された形になる。
         * retired_at を付けて読者一覧からだけ外し、所有権は墓標として残す。
         */
        await preserveLegacyRetirements(db);
        const owned = await db
          .select({ slug: siteBlueprints.slug })
          .from(siteBlueprints)
          .where(
            and(
              eq(siteBlueprints.workspaceId, String(workspaceId)),
              eq(siteBlueprints.slug, slug),
            ),
          )
          .limit(1);
        if (owned.length === 0) {
          return err(
            domainError("NOT_FOUND", "このブログは取り下げられませんでした。", {
              suggestedAction:
                "見本として最初から入っているブログは消せません。自分で作ったブログを選び直してください。",
            }),
          );
        }
        const retired = await db
          .insert(siteRetirements)
          .values({ slug, workspaceId: String(workspaceId), retiredAt: new Date() })
          .onConflictDoNothing({ target: siteRetirements.slug })
          .returning({ slug: siteRetirements.slug });
        if (retired.length === 0) {
          return err(
            domainError("NOT_FOUND", "このブログは取り下げられませんでした。", {
              suggestedAction: "ブログの一覧を開き直してください。すでに取り下げ済みです。",
            }),
          );
        }
        return ok(true as const);
      } catch (cause) {
        return storageFailure("ブログの取り下げ", cause);
      }
    },
  });
}

/**
 * 保存先にある、作られたブログの一覧。
 *
 * 読者向けの一覧（`site-repository.ts`）が見本とこれを合わせる。
 * **読者側の画面は 2 種類を区別しない。**
 */
export async function listPublishedBlueprints(
  db: DrizzleD1,
): Promise<{
  readonly published: readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[];
  readonly reservedSlugs: ReadonlySet<string>;
}> {
  await preserveLegacyRetirements(db);
  const rows = await db
    .select()
    .from(siteBlueprints)
    .orderBy(desc(siteBlueprints.publishedAt));
  const retired = await db.select({ slug: siteRetirements.slug }).from(siteRetirements);
  const reserved = new Set(retired.map((row) => row.slug));
  return {
    published: rows
      .filter((row) => !reserved.has(row.slug))
      .map((row) => ({ slug: row.slug, blueprint: toBlueprint(row) })),
    // retired も予約済み。見本と同名の行を取り下げたあと、見本を再露出させない。
    reservedSlugs: new Set(rows.map((row) => row.slug)),
  };
}
