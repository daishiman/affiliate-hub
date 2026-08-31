import { and, eq, isNull } from "drizzle-orm";
import type {
  EditorialSiteDocumentRepositoryPort,
  SiteDocument,
} from "@/application/ports/site";
import { type LegalPageRow, legalPages } from "@/db/schema";
import {
  SITE_DOCUMENT_KIND_BY_KEY,
  type SiteDocumentStorageKind,
} from "@/domain/authoring";
import { domainError, err, markEditorial, ok } from "@/domain/shared";
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

/**
 * 編集画面のルート鍵 → 表の名札。
 *
 * **この 2 つは別物である。** ルート鍵は URL のための名前で、表の名札
 * （`FIXED_PAGE_KINDS`）は公開ページの語彙。同じ 1 枚を指すのに綴りが違う。
 * 写さずに書くと、`/blog/pages` から作った「運営者プロフィール」と
 * `/admin/sites/[site]/documents` から作った「運営者情報」が**別の行**になり、
 * 読者にはどちらか片方しか出ない（しかも、どちらが出るかは URL しだい）。
 *
 * 公開語彙に相手が無い方針は、`SITE_DOCUMENT_KIND_BY_KEY` の
 * 独立した保存名へ写す。近い名札へ寄せないのは、2つの鍵が
 * 同じ行へ落ち、後から書いたほうが前を消すのを防ぐため。
 */
const KEY_TO_KIND = SITE_DOCUMENT_KIND_BY_KEY;

type MappedKey = keyof typeof KEY_TO_KIND;

const KIND_TO_KEY = Object.fromEntries(
  Object.entries(KEY_TO_KIND).map(([key, kind]) => [kind, key]),
) as Readonly<Record<string, MappedKey | undefined>>;

/** 写せない鍵は、黙って別名で保存せずに断る。 */
function unmappedKey(key: string) {
  return err(
    domainError(
      "NOT_IMPLEMENTED",
      `「${key}」は、まだ公開ページの置き場がありません。`,
      {
        suggestedAction:
          "公開ルートと保存名の対応表を追加してから保存してください。",
        field: "key",
      },
    ),
  );
}

function toDocument(row: LegalPageRow): SiteDocument | null {
  const key = KIND_TO_KEY[row.kind];
  // 公開ページにしか居ない名札（`sitemap` など）は、この画面の担当ではない。
  // 例外で止めると、1 枚のせいで一覧が丸ごと開かなくなる。
  if (key === undefined) return null;
  return {
    key,
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
          .where(
            and(
              eq(legalPages.workspaceId, workspaceId),
              eq(legalPages.siteSlug, siteSlug),
              eq(legalPages.status, "published"),
              isNull(legalPages.deletedAt),
            ),
          );
        // 写せない名札は落とす（この画面が扱えないだけで、行としては正しい）。
        return ok(rows.map(toDocument).filter((doc): doc is SiteDocument => doc !== null));
      } catch (cause) {
        return storageFailure("固定ページの取得", cause);
      }
    },

    async save(workspaceId, siteSlug, document) {
      const kind = KEY_TO_KIND[document.key as MappedKey] as
        | SiteDocumentStorageKind
        | undefined;
      if (kind === undefined) return unmappedKey(document.key);
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
              eq(legalPages.kind, kind),
            ),
          )
          .limit(1);

        const values = {
          workspaceId,
          siteSlug,
          kind,
          title: document.title,
          body: document.body.join(PARAGRAPH_SEPARATOR),
          status: "published" as const,
          deletedAt: null,
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
    const kind = KEY_TO_KIND[key as MappedKey] as SiteDocumentStorageKind | undefined;
    // 知らない鍵で 1 枚も無いのは正しい状態。断りにすると読者面が 500 になる。
    if (kind === undefined) return ok(null);
    try {
      const rows = await deps.db
        .select()
        .from(legalPages)
        .where(
          and(
            eq(legalPages.siteSlug, siteSlug),
            eq(legalPages.kind, kind),
            eq(legalPages.status, "published"),
            isNull(legalPages.deletedAt),
          ),
        )
        .limit(1);
      const row = rows[0];
      if (row === undefined) return ok(null);
      const doc = toDocument(row);
      if (doc === null) return ok(null);
      return ok({ title: doc.title, body: doc.body });
    } catch (cause) {
      return storageFailure("固定ページの取得", cause);
    }
  };
}
