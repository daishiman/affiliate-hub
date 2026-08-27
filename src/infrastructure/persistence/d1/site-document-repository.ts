import { and, eq } from "drizzle-orm";
import type {
  EditorialSiteDocumentRepositoryPort,
  SiteDocument,
} from "@/application/ports/site";
import { type LegalPageRow, legalPages } from "@/db/schema";
import { SITE_DOCUMENT_KEYS, type SiteDocumentKey } from "@/domain/authoring";
import { markEditorial, ok } from "@/domain/shared";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * ブログの固定文書（D1 / `legal_page` 表）。
 *
 * 本文は段落の配列を改行 2 つでつないで 1 列に入れる。
 * **別表に段落を並べない。** 並べると、読者 1 人が 1 画面を開くたびに
 * 段落の数だけ問い合わせが増える割に、段落を単独で引く用が 1 つも無い。
 *
 * 見本へ落とさない。落とすと、まだ書いていない運営者情報の位置に
 * 見本の運営者情報が出て、読者にはそれが本物として読まれる。
 * 未整備は未整備のまま（行が無い＝返さない）にして、管理画面で目立たせる。
 */

/** 段落の区切り。空行 1 つ。書く人の打ち方（改行 1 つ）と同じにしない。 */
const PARAGRAPH_SEPARATOR = "\n\n";

function toDocument(row: LegalPageRow): SiteDocument {
  if (!(SITE_DOCUMENT_KEYS as readonly string[]).includes(row.kind)) {
    throw new Error(`Unknown site document key: ${row.kind}`);
  }
  return {
    key: row.kind as SiteDocumentKey,
    title: row.title,
    body: row.body.split(PARAGRAPH_SEPARATOR).filter((p) => p.trim() !== ""),
    updatedAt: row.updatedAt,
  };
}

export type SiteDocumentRepositoryDeps = {
  readonly db: DrizzleD1;
  readonly now: () => Date;
  /** 行の識別子を作る。保存先の自動採番に頼らない（表の作り方に縛られない）。 */
  readonly newId: () => string;
};

export function createD1SiteDocumentRepository(
  deps: SiteDocumentRepositoryDeps,
): EditorialSiteDocumentRepositoryPort {
  const { db, now, newId } = deps;

  // 編集の口として印を付ける。固定文書に報酬の欄は無いので、
  // ここを通って商用の値が読者面へ回ることはない。
  return markEditorial({
    async listBySite(workspaceId, siteSlug) {
      try {
        const rows = await db
          .select()
          .from(legalPages)
          .where(and(eq(legalPages.workspaceId, workspaceId), eq(legalPages.siteSlug, siteSlug)));
        return ok(rows.map(toDocument));
      } catch (cause) {
        return storageFailure("固定ページの取得", cause);
      }
    },

    async save(workspaceId, siteSlug, document) {
      try {
        // 1 ブログ 1 種 1 枚。すでに在れば書き換える。
        // 追記にすると、読者にどれが出るかが行の並び順しだいになる。
        const existing = await db
          .select({ id: legalPages.id })
          .from(legalPages)
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.siteSlug, siteSlug),
              eq(legalPages.kind, document.key),
            ),
          )
          .limit(1);

        const values = {
          workspaceId,
          siteSlug,
          kind: document.key,
          title: document.title,
          body: document.body.join(PARAGRAPH_SEPARATOR),
          updatedAt: now(),
        };

        const found = existing[0];
        if (found === undefined) {
          await db.insert(legalPages).values({ id: newId(), ...values });
        } else {
          await db.update(legalPages).set(values).where(eq(legalPages.id, found.id));
        }
        return ok(true as const);
      } catch (cause) {
        return storageFailure("固定ページの保存", cause);
      }
    },
  });
}

/**
 * 読者向けの 1 枚引き。`findPolicyDocument` の実体。
 *
 * 管理画面と**同じ表**を読む。読者向けだけ別の場所から読むと、
 * 直したのに読者に出ない（あるいはその逆）が起きる。
 */
export function findSiteDocument(deps: { readonly db: DrizzleD1 }) {
  return async (siteSlug: string, key: string) => {
    try {
      const rows = await deps.db
        .select()
        .from(legalPages)
        .where(and(eq(legalPages.siteSlug, siteSlug), eq(legalPages.kind, key)))
        .limit(1);
      const row = rows[0];
      if (row === undefined) return ok(null);
      const doc = toDocument(row);
      return ok({ title: doc.title, body: doc.body });
    } catch (cause) {
      return storageFailure("固定ページの取得", cause);
    }
  };
}
