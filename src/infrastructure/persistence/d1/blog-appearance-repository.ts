import { and, eq } from "drizzle-orm";
import type { BlogAppearancePort } from "@/application/ports/blog-appearance";
import {
  blogTemplateSelections,
  blogThemes,
  pageThemeOverrides,
  siteBlueprints,
} from "@/db/schema";
import {
  BLOG_TEMPLATE_IDS,
  type BlogTemplateId,
  type PageThemeOverride,
} from "@/domain/authoring/blog-template";
import { ok } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * ブログの見た目の保存先（D1）。ブログの見せ方の選択と配色 2 層。
 *
 * --- 作業場所（workspace）の絞り込みは 2 重にする ---
 * 4 表とも `workspace_id` を持つ（migration 0040 で 2 表へ足した。
 * 設計 `data-model.md` §8 は「最初の口を書くときに判断する」として
 * 先送りしており、その判断がこれである）。すべての問い合わせは
 * まず作業場所で絞る。
 *
 * その上で `site_blueprints` を経由した所有確認（`ownsSite`）も残す。
 * 列の絞りは**その問い合わせを書いた人が正しく書いた場合しか効かない**。
 * 所有確認は「そもそもこのブログはあなたのものか」を 1 か所で答える。
 *
 * 「slug が全体で一意だから素通しでよい」とはしない。素通しにすると、
 * 他所の作業場所のブログ名を当てた者が、その配色を読み書きできる。
 * 一意性は**同じ行を指す**ことの保証であって、**触ってよい**ことの保証ではない。
 */

export type BlogAppearanceRepositoryDeps = {
  readonly db: DrizzleD1;
  /** 行 ID の採番。テストから固定できるように外から渡す。 */
  readonly newId: () => string;
};

/** 語彙外の template_id を読んだときは「選んでいない」に倒す。 */
function toTemplateId(raw: string): BlogTemplateId | null {
  return (BLOG_TEMPLATE_IDS as readonly string[]).includes(raw) ? (raw as BlogTemplateId) : null;
}

/**
 * 上書き行を型へ戻す。
 *
 * 両列とも NULL の行は `null`（＝上書きなし）へ倒す。
 * そういう行は保存側が作らないが、古い行が残っていても
 * 「何も変えない上書き」として一覧に出さないほうがよい。
 */
function toOverride(row: {
  brandTheme: string | null;
  colorMode: "auto" | "light" | "dark" | null;
}): PageThemeOverride | null {
  const override: { brandTheme?: string; colorMode?: "auto" | "light" | "dark" } = {};
  if (row.brandTheme !== null) override.brandTheme = row.brandTheme;
  if (row.colorMode !== null) override.colorMode = row.colorMode;
  return Object.keys(override).length === 0 ? null : override;
}

/** 上書きが実質空か。空なら行を作らず消す（不変条件 I2）。 */
function isEmptyOverride(override: PageThemeOverride): boolean {
  return override.brandTheme === undefined && override.colorMode === undefined;
}

export function createD1BlogAppearanceRepository(
  deps: BlogAppearanceRepositoryDeps,
): BlogAppearancePort {
  const { db, newId } = deps;

  /**
   * その作業場所がその slug のブログを持っているか。
   *
   * 持っていなければ以降の読み書きを行わない。**「無い」を返す**のであって
   * 「権限が無い」とは返さない——存在の有無を答えると、
   * 総当たりで他所のブログ名を割り出せる。
   */
  async function ownsSite(workspaceId: string, siteSlug: string): Promise<boolean> {
    const rows = await db
      .select({ id: siteBlueprints.id })
      .from(siteBlueprints)
      .where(and(eq(siteBlueprints.workspaceId, workspaceId), eq(siteBlueprints.slug, siteSlug)))
      .limit(1);
    return rows.length > 0;
  }

  return {
    async templateOf({ workspaceId, siteSlug }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) return ok(null);
        const rows = await db
          .select()
          .from(blogTemplateSelections)
          .where(
            and(
              eq(blogTemplateSelections.workspaceId, workspaceId),
              eq(blogTemplateSelections.siteSlug, siteSlug),
            ),
          )
          .limit(1);
        const row = rows[0];
        return ok(row === undefined ? null : toTemplateId(row.templateId));
      } catch (cause) {
        return storageFailure("ブログの見せ方の取得", cause);
      }
    },

    async selectTemplate({ workspaceId, siteSlug, templateId }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) {
          return storageFailure("ブログの見せ方の選択", new Error(`ブログが見つからない: ${siteSlug}`));
        }
        /*
          `site_slug` に一意索引があるので upsert で足りる。
          読んでから分岐すると、同時に 2 人が選んだときに片方が落ちる。
        */
        await db
          .insert(blogTemplateSelections)
          .values({ id: newId(), workspaceId, siteSlug, templateId })
          .onConflictDoUpdate({
            target: blogTemplateSelections.siteSlug,
            set: { templateId, updatedAt: new Date() },
          });
        return ok(templateId);
      } catch (cause) {
        return storageFailure("ブログの見せ方の選択", cause);
      }
    },

    async themeOf({ workspaceId, siteSlug }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) return ok(null);
        const rows = await db
          .select()
          .from(blogThemes)
          .where(and(eq(blogThemes.workspaceId, workspaceId), eq(blogThemes.siteSlug, siteSlug)))
          .limit(1);
        const row = rows[0];
        if (row === undefined) return ok(null);
        return ok({ brandTheme: row.brandTheme, colorMode: row.colorMode });
      } catch (cause) {
        return storageFailure("ブログ既定配色の取得", cause);
      }
    },

    async saveTheme({ workspaceId, siteSlug, theme }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) {
          return storageFailure("配色の保存", new Error(`ブログが見つからない: ${siteSlug}`));
        }
        await db
          .insert(blogThemes)
          .values({
            id: newId(),
            workspaceId,
            siteSlug,
            brandTheme: theme.brandTheme,
            colorMode: theme.colorMode,
          })
          .onConflictDoUpdate({
            target: blogThemes.siteSlug,
            set: { brandTheme: theme.brandTheme, colorMode: theme.colorMode },
          });
        return ok(theme);
      } catch (cause) {
        return storageFailure("配色の保存", cause);
      }
    },

    async listOverrides({ workspaceId, siteSlug }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) return ok([]);
        const rows = await db
          .select()
          .from(pageThemeOverrides)
          .where(
            and(
              eq(pageThemeOverrides.workspaceId, workspaceId),
              eq(pageThemeOverrides.siteSlug, siteSlug),
            ),
          );
        const entries: { pagePath: string; override: PageThemeOverride }[] = [];
        for (const row of rows) {
          const override = toOverride(row);
          // 実質空の行は「上書きしていない」として出さない。
          if (override !== null) entries.push({ pagePath: row.pagePath, override });
        }
        return ok(entries);
      } catch (cause) {
        return storageFailure("ページ配色上書きの一覧取得", cause);
      }
    },

    async overrideOf({ workspaceId, siteSlug, pagePath }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) return ok(null);
        const rows = await db
          .select()
          .from(pageThemeOverrides)
          .where(
            and(
              eq(pageThemeOverrides.workspaceId, workspaceId),
              eq(pageThemeOverrides.siteSlug, siteSlug),
              eq(pageThemeOverrides.pagePath, pagePath),
            ),
          )
          .limit(1);
        const row = rows[0];
        return ok(row === undefined ? null : toOverride(row));
      } catch (cause) {
        return storageFailure("ページ配色上書きの取得", cause);
      }
    },

    async saveOverride({ workspaceId, siteSlug, pagePath, override }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) {
          return storageFailure("ページ配色上書きの保存", new Error(`ブログが見つからない: ${siteSlug}`));
        }
        /*
          両軸とも空なら、保存ではなく削除へ倒す（不変条件 I2）。
          「上書きしていない上書き行」を作らせない。
        */
        if (isEmptyOverride(override)) {
          await db
            .delete(pageThemeOverrides)
            .where(
              and(
                eq(pageThemeOverrides.workspaceId, workspaceId),
                eq(pageThemeOverrides.siteSlug, siteSlug),
                eq(pageThemeOverrides.pagePath, pagePath),
              ),
            );
          return ok(null);
        }
        await db
          .insert(pageThemeOverrides)
          .values({
            id: newId(),
            workspaceId,
            siteSlug,
            pagePath,
            brandTheme: override.brandTheme ?? null,
            colorMode: override.colorMode ?? null,
          })
          .onConflictDoUpdate({
            target: [pageThemeOverrides.siteSlug, pageThemeOverrides.pagePath],
            set: {
              brandTheme: override.brandTheme ?? null,
              colorMode: override.colorMode ?? null,
            },
          });
        return ok(override);
      } catch (cause) {
        return storageFailure("ページ配色上書きの保存", cause);
      }
    },

    async clearOverride({ workspaceId, siteSlug, pagePath }) {
      try {
        if (!(await ownsSite(workspaceId, siteSlug))) {
          return storageFailure("ページ配色上書きの解除", new Error(`ブログが見つからない: ${siteSlug}`));
        }
        // 解除は行の削除。NULL の行を残すと一覧から消えない。
        await db
          .delete(pageThemeOverrides)
          .where(
            and(
              eq(pageThemeOverrides.workspaceId, workspaceId),
              eq(pageThemeOverrides.siteSlug, siteSlug),
              eq(pageThemeOverrides.pagePath, pagePath),
            ),
          );
        return ok(undefined);
      } catch (cause) {
        return storageFailure("ページ配色上書きの解除", cause);
      }
    },
  };
}
