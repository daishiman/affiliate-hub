import { and, eq, isNull } from "drizzle-orm";
import type {
  EditorialSiteDocumentRepositoryPort,
  EditorialSiteRepositoryPort,
  SiteDocument,
} from "@/application/ports/site";
import { type LegalPageRow, legalPages } from "@/db/schema";
import {
  SITE_DOCUMENT_KEYS,
  SITE_DOCUMENT_KIND_BY_KEY,
  type SiteDocumentKey,
  type SiteDocumentStorageKind,
} from "@/domain/authoring";
import { err, markEditorial, ok } from "@/domain/shared";
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
 * ルート鍵 → 表の名札。正本は `SITE_DOCUMENT_KIND_BY_KEY`（8 鍵すべてを持つ）。
 *
 * **ここで写す理由。** ルート鍵は URL のための名前、表の名札は保存のための名前で、
 * 同じ 1 枚を指すのに綴りが違う。写さずに書くと、既に `legal_page` に入っている
 * 旧名札の行（`profile` / `privacy_policy` など）が読めなくなる。
 * 表の側を書き換えて揃える案もあったが、**すでに配ってある行を触らずに済むほう**を採った。
 */
const KIND_BY_KEY = SITE_DOCUMENT_KIND_BY_KEY;

const KEY_BY_KIND = Object.fromEntries(
  Object.entries(KIND_BY_KEY).map(([key, kind]) => [kind, key]),
) as Readonly<Record<string, SiteDocumentKey | undefined>>;

function toDocument(row: LegalPageRow): SiteDocument | null {
  const key = KEY_BY_KIND[row.kind];
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
          .where(and(eq(legalPages.workspaceId, workspaceId), eq(legalPages.siteSlug, siteSlug)));
        // 写せない名札は落とす（この画面が扱えないだけで、行としては正しい）。
        return ok(rows.map(toDocument).filter((doc): doc is SiteDocument => doc !== null));
      } catch (cause) {
        return storageFailure("固定ページの取得", cause);
      }
    },

    async save(workspaceId, siteSlug, document) {
      const kind: SiteDocumentStorageKind = KIND_BY_KEY[document.key];
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
          // この編集口の既存契約は「保存後に読者面へ反映」。
          // 読み取り側で draft を閉じても操作を行き止まりにしない。
          status: "published" as const,
          // 同じ文書を保存し直す操作は、削除済み行も公開状態へ戻す。
          // status だけ戻すと deleted_at が残り、保存成功なのに 404 のままになる。
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
export function findSiteDocument(deps: {
  readonly db: DrizzleD1;
  readonly sites: EditorialSiteRepositoryPort;
}) {
  return async (siteSlug: string, key: string) => {
    if (!(SITE_DOCUMENT_KEYS as readonly string[]).includes(key)) return ok(null);
    const kind = KIND_BY_KEY[key as SiteDocumentKey];
    const site = await deps.sites.findBySlug(siteSlug);
    if (!site.ok) return err(site.error);
    if (site.value === null) return ok(null);

    try {
      /*
       * 固定文書の公開資格は、通常の create-site が作る公開済み設計図で決まる。
       * site network はサイト同士の構造であり、単独サイトの公開条件にはしない。
       * workspace は設計図から解決し、行側でも同じ値を必須にする。
       */
      const rows = await deps.db
        .select({ title: legalPages.title, body: legalPages.body })
        .from(legalPages)
        .where(
          and(
            eq(legalPages.workspaceId, site.value.workspaceId),
            eq(legalPages.siteSlug, siteSlug),
            eq(legalPages.kind, kind),
            eq(legalPages.status, "published"),
            isNull(legalPages.deletedAt),
          ),
        )
        .limit(1);
      const page = rows[0];
      if (page === undefined) return ok(null);
      return ok({
        title: page.title,
        body: page.body
          .split(PARAGRAPH_SEPARATOR)
          .filter((paragraph) => paragraph.trim() !== ""),
      });
    } catch (cause) {
      return storageFailure("固定ページの公開読み取り", cause);
    }
  };
}
