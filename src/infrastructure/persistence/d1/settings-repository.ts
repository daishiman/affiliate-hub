import { and, asc, count, eq, gte, isNull, sql } from "drizzle-orm";
import type { BrandRepositoryPort, WorkspaceRepositoryPort } from "@/application/ports/identity";
import type { PageRequest } from "@/application/ports/common";
import type { Brand, Workspace } from "@/domain/identity";
import {
  type BrandId,
  type UserId,
  type WorkspaceId,
  ok,
  taggedString,
} from "@/domain/shared";
import {
  type BrandRow,
  type WorkspaceRow,
  brands,
  llmUsages,
  siteBlueprints,
  siteRetirements,
  workspaces,
} from "@/db/schema";
import { SAMPLE_BRANDS, SAMPLE_WORKSPACE } from "../sample/settings-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";
import { pageById } from "../page-by-id";

/**
 * 作業場所とブランドの保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約を満たす、実際に保存する実装。
 *
 * --- なぜ 2 つを 1 つのファイルに置くか ---
 *
 * 作業場所の上限（`PLAN_LIMITS`）は「ブランドをいくつ持てるか」を含む。
 * 数える側と数えられる側が別ファイルにあると、片方だけ本物にした状態が作れる。
 * そうなると、上限は見本の 1 件を数え続けたまま、本物のブランドがいくつでも増える。
 *
 * --- 数えるものが 3 つとも別の表にある ---
 *
 * ブランドは `brands`、ブログは `site_blueprints`、AI の生成回数は `llm_usages`。
 * どれも作業場所の中には持たない。持つと、増やすたびに 2 か所へ書くことになり、
 * 落ちた回だけ数字がずれる。**数字は数えて出す。持ち回らない。**
 */

function toWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: taggedString<"WorkspaceId">(row.id) as WorkspaceId,
    name: row.name,
    plan: row.plan,
    ownerUserId: taggedString<"UserId">(row.ownerUserId) as UserId,
    timezone: row.timezone,
    currency: row.currency,
    createdAt: row.createdAt,
    suspendedAt: row.suspendedAt,
  };
}

function toBrand(row: BrandRow): Brand {
  const stored = JSON.parse(row.brandJson) as Omit<
    Brand,
    "id" | "workspaceId" | "displayName" | "legalName" | "contactEmail" | "createdAt"
  >;
  return {
    ...stored,
    id: taggedString<"BrandId">(row.id) as BrandId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    displayName: row.displayName,
    legalName: row.legalName,
    contactEmail: row.contactEmail,
    createdAt: row.createdAt,
  };
}

/** その月の 1 日 0 時。月の途中で数え直しても同じ区切りになるよう、ここで作る。 */
function startOfMonth(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** D1 の timestamp 列は Unix 秒。ミリ秒のまま渡すと期限が約1000倍先になる。 */
function unixSeconds(value: Date): number {
  return Math.floor(value.getTime() / 1_000);
}

export function createD1WorkspaceRepository(db: DrizzleD1): WorkspaceRepositoryPort {
  return {
    async findById(id: WorkspaceId) {
      try {
        const rows = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.id, String(id)))
          .limit(1);
        const found = (rows as WorkspaceRow[])[0];
        if (found !== undefined) return ok(toWorkspace(found));
        /*
         * 保存先へつないだ日に、まだ 1 行も入っていないことがある。
         * ここで `null` を返すと、ログインできているのに
         * **どの作業場所にも属していない人**として全画面が断りになる。
         * 見本の作業場所を返して、設定画面から本物を作れる状態を保つ。
         */
        return ok(String(id) === String(SAMPLE_WORKSPACE.id) ? SAMPLE_WORKSPACE : null);
      } catch (cause) {
        return storageFailure("作業場所の読み出し", cause);
      }
    },

    async findByOwner(userId: UserId) {
      try {
        const rows = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.ownerUserId, String(userId)));
        const stored = (rows as WorkspaceRow[]).map(toWorkspace);
        const samples =
          String(userId) === String(SAMPLE_WORKSPACE.ownerUserId) ? [SAMPLE_WORKSPACE] : [];
        return ok(mergeWithSamples(stored, samples));
      } catch (cause) {
        return storageFailure("作業場所の読み出し", cause);
      }
    },

    async save(workspace: Workspace) {
      const columns = {
        name: workspace.name,
        plan: workspace.plan,
        ownerUserId: String(workspace.ownerUserId),
        timezone: workspace.timezone,
        currency: workspace.currency,
        createdAt: workspace.createdAt,
        suspendedAt: workspace.suspendedAt,
      };
      try {
        await db
          .insert(workspaces)
          .values({ id: String(workspace.id), ...columns })
          .onConflictDoUpdate({
            target: workspaces.id,
            // 作った日は上書きしない。直すたびに「今日できた作業場所」になる。
            set: {
              name: columns.name,
              plan: columns.plan,
              ownerUserId: columns.ownerUserId,
              timezone: columns.timezone,
              currency: columns.currency,
              suspendedAt: columns.suspendedAt,
            },
          });
        return ok(workspace);
      } catch (cause) {
        return storageFailure("作業場所の保存", cause);
      }
    },

    async countBrands(id: WorkspaceId) {
      try {
        const rows = await db
          .select({ value: count() })
          .from(brands)
          .where(eq(brands.workspaceId, String(id)));
        return ok(rows[0]?.value ?? 0);
      } catch (cause) {
        return storageFailure("ブランド数の取得", cause);
      }
    },

    async countSites(id: WorkspaceId) {
      try {
        const rows = await db
          .select({ value: count() })
          .from(siteBlueprints)
          .leftJoin(
            siteRetirements,
            and(
              eq(siteRetirements.slug, siteBlueprints.slug),
              eq(siteRetirements.workspaceId, siteBlueprints.workspaceId),
            ),
          )
          .where(
            and(
              eq(siteBlueprints.workspaceId, String(id)),
              isNull(siteRetirements.slug),
            ),
          );
        return ok(rows[0]?.value ?? 0);
      } catch (cause) {
        return storageFailure("ブログ数の取得", cause);
      }
    },

    async countGenerationsThisMonth(id: WorkspaceId, now: Date) {
      try {
        const rows = await db
          .select({ value: count() })
          .from(llmUsages)
          .where(
            and(
              eq(llmUsages.workspaceId, String(id)),
              eq(llmUsages.purpose, "draft"),
              eq(llmUsages.capacityConsumed, true),
              // 直近 30 日ではなく**その月の 1 日から**。上限は月ごとの契約で、
              // 30 日で数えると、月が替わった日に上限が戻らない。
              gte(llmUsages.occurredAt, startOfMonth(now)),
            ),
          );
        return ok(rows[0]?.value ?? 0);
      } catch (cause) {
        return storageFailure("今月の生成回数の取得", cause);
      }
    },

    async acquireCapacityLease(workspaceId, input) {
      try {
        /*
         * read → insert に分けない。この 1 statement が書き込み順に直列化されることで、
         * 同じ空きを見た並行リクエストの片方だけが lease を取る。
         *
         * 上限値は application/domain から bind する。SQL にプラン別の数を複製しない。
         */
        const rows = await db.all<{ id: string }>(sql`
          INSERT INTO capacity_leases
            (id, workspace_id, kind, acquired_at, expires_at)
          SELECT
            ${input.id},
            ${String(workspaceId)},
            ${input.kind},
            ${unixSeconds(input.now)},
            ${unixSeconds(input.expiresAt)}
          WHERE
            (
              CASE ${input.kind}
                WHEN 'brand' THEN (
                  SELECT COUNT(*) FROM brands
                  WHERE workspace_id = ${String(workspaceId)}
                )
                WHEN 'site' THEN (
                  SELECT COUNT(*)
                  FROM site_blueprints AS blueprint
                  LEFT JOIN site_retirements AS retirement
                    ON retirement.slug = blueprint.slug
                   AND retirement.workspace_id = blueprint.workspace_id
                  WHERE blueprint.workspace_id = ${String(workspaceId)}
                    AND retirement.slug IS NULL
                )
                WHEN 'member' THEN (
                  SELECT COUNT(*) FROM memberships
                  WHERE workspace_id = ${String(workspaceId)}
                    AND revoked_at IS NULL
                )
                WHEN 'generation' THEN (
                  SELECT COUNT(*) FROM llm_usages
                  WHERE workspace_id = ${String(workspaceId)}
                    AND purpose = 'draft'
                    AND capacity_consumed = 1
                    AND occurred_at >= ${unixSeconds(startOfMonth(input.now))}
                )
              END
              + (
                SELECT COUNT(*) FROM capacity_leases
                WHERE workspace_id = ${String(workspaceId)}
                  AND kind = ${input.kind}
                  AND expires_at > ${unixSeconds(input.now)}
              )
            ) < ${input.limit}
          RETURNING id
        `);
        return ok(rows.some((row) => row.id === input.id));
      } catch (cause) {
        return storageFailure("容量の確保", cause);
      }
    },

    async releaseCapacityLease(workspaceId, id, now) {
      try {
        await db.run(sql`
          DELETE FROM capacity_leases
          WHERE workspace_id = ${String(workspaceId)}
            AND (id = ${id} OR expires_at <= ${unixSeconds(now)})
        `);
        return ok(undefined);
      } catch (cause) {
        return storageFailure("容量の解放", cause);
      }
    },
  };
}

export function createD1BrandRepository(db: DrizzleD1): BrandRepositoryPort {
  return {
    async findById(workspaceId: WorkspaceId, id: BrandId) {
      try {
        const rows = await db
          .select()
          .from(brands)
          .where(and(eq(brands.workspaceId, String(workspaceId)), eq(brands.id, String(id))))
          .limit(1);
        const found = (rows as BrandRow[])[0];
        if (found !== undefined) return ok(toBrand(found));
        return ok(SAMPLE_BRANDS.find((b) => String(b.id) === String(id)) ?? null);
      } catch (cause) {
        return storageFailure("ブランドの読み出し", cause);
      }
    },

    async list(workspaceId: WorkspaceId, page: PageRequest) {
      try {
        const rows = await db
          .select()
          .from(brands)
          .where(eq(brands.workspaceId, String(workspaceId)))
          // 作った順。**新しい順にしない。** 最初に作ったブランドが
          // 本体であることが多く、そこが下に沈むと毎回さがすことになる。
          .orderBy(asc(brands.createdAt), asc(brands.id));
        const stored = (rows as BrandRow[]).map(toBrand);
        const items = [...mergeWithSamples(stored, SAMPLE_BRANDS)].sort(
          (left, right) =>
            left.createdAt.getTime() - right.createdAt.getTime() ||
            String(left.id).localeCompare(String(right.id)),
        );
        return ok(pageById(items, page, (brand) => String(brand.id)));
      } catch (cause) {
        return storageFailure("ブランドの一覧取得", cause);
      }
    },

    async save(brand: Brand) {
      const { id, workspaceId, displayName, legalName, contactEmail, createdAt, ...rest } = brand;
      const columns = {
        displayName,
        legalName,
        contactEmail,
        brandJson: JSON.stringify(rest),
      };
      try {
        await db
          .insert(brands)
          .values({ id: String(id), workspaceId: String(workspaceId), createdAt, ...columns })
          // 作った日は上書きしない（作業場所と同じ理由）。
          .onConflictDoUpdate({ target: brands.id, set: columns });
        return ok(brand);
      } catch (cause) {
        return storageFailure("ブランドの保存", cause);
      }
    },
  };
}
