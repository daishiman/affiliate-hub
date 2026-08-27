import { and, eq, sql } from "drizzle-orm";
import type { PortResult } from "@/application/ports/common";
import type {
  AffiliateLinkWithSnapshot,
  CommercialAffiliateLinkRepositoryPort,
} from "@/application/ports/monetization";
import { type AffiliateLink, type ProductSnapshot, isLinkUsable } from "@/domain/monetization";
import {
  type AffiliateLinkId,
  type AffiliateProgramId,
  type ProductId,
  type WorkspaceId,
  domainError,
  err,
  markCommercial,
  ok,
  taggedString,
} from "@/domain/shared";
import { type AffiliateLinkRow, affiliateLinks } from "@/db/schema";
import { sampleAffiliateLinks } from "../sample/affiliate-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 成果リンクの保存先（D1）。**書ける側**。
 *
 * **これはスタブではない。** 受信箱で商品まで決めたリンクが、実際にここへ入る。
 *
 * --- 読む口（`affiliate-link-repository.ts`）と別のファイルにしてある理由 ---
 * あちらは記事の組み立てが読む口で、Editorial の印が付いている。
 * 同じ口に書き込みを足すと、**記事の組み立て側から転送先を書き換えられる経路**が
 * 型の上で作れてしまう。作れないようにするには、口ごと分けるしかない。
 * こちらは Commercial の印。順位づけへは型として渡せない。
 *
 * --- 商品名をここで作らない ---
 * 行は `product_name` を必須にする。呼ぶ側が写し（`ProductSnapshot`）を
 * 渡すまで保存できない形にしてあるので、この層が名前を埋める分岐は存在しない。
 * 空欄を「—」で埋めるような創作が起きる場所を、最初から作らない。
 *
 * --- 見本を重ねる ---
 * 見本のリンク（`lnk_amazon_pc` / `lnk_direct_soft`）は消さない。
 * 1 件も登録していない状態で一覧が空になると、「まだ登録していない」のか
 * 「壊れている」のかを画面から見分けられなくなる。同じ id なら保存されたほうが勝つ。
 *
 * 規範: docs/product/design-decisions.md §2、tasks/task-publish-article-affiliate-links.md
 */

/** 行 → 業務の形。写し（商品名など）はこの型に無いので落ちる（読む口が別に持つ）。 */
function toDomain(row: AffiliateLinkRow): AffiliateLink {
  return {
    id: taggedString<"AffiliateLinkId">(row.id) as AffiliateLinkId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    programId: taggedString<"AffiliateProgramId">(row.programId) as AffiliateProgramId,
    productId:
      row.productId === null ? null : (taggedString<"ProductId">(row.productId) as ProductId),
    merchantId: null,
    originalUrl: row.originalUrl,
    alterationProhibited: row.alterationProhibited,
    trackingRef: row.trackingRef,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    disabledAt: row.disabledAt,
  };
}
/** 業務の形 + 写し → 行。**URL は 1 文字も変えない。** */
function toRow(link: AffiliateLink, snapshot: ProductSnapshot): AffiliateLinkRow {
  return {
    id: String(link.id),
    workspaceId: String(link.workspaceId),
    programId: String(link.programId),
    productId: link.productId === null ? null : String(link.productId),
    productName: snapshot.productName,
    brand: snapshot.brand,
    oneLine: snapshot.oneLine,
    originalUrl: link.originalUrl,
    alterationProhibited: link.alterationProhibited,
    trackingRef: link.trackingRef,
    createdAt: link.createdAt,
    expiresAt: link.expiresAt,
    disabledAt: link.disabledAt,
  };
}

export function createD1AffiliateLinkRepository(
  db: DrizzleD1,
): CommercialAffiliateLinkRepositoryPort {
  async function inWorkspace(workspaceId: WorkspaceId): Promise<readonly AffiliateLink[]> {
    // **作業場所で必ず絞る。** 絞らないと、ID を知っているだけで
    // 他の作業場所のリンクを引ける。
    const rows = await db
      .select()
      .from(affiliateLinks)
      .where(eq(affiliateLinks.workspaceId, String(workspaceId)));
    return mergeWithSamples(
      rows.map(toDomain),
      sampleAffiliateLinks().filter((l) => l.workspaceId === workspaceId),
    );
  }

  return markCommercial({
    async findById(workspaceId: WorkspaceId, id: AffiliateLinkId): PortResult<AffiliateLink | null> {
      try {
        return ok((await inWorkspace(workspaceId)).find((l) => l.id === id) ?? null);
      } catch (cause) {
        return storageFailure("成果リンクの読み出し", cause);
      }
    },

    /**
     * 同じ URL の、いま使える成果リンクを探す。
     *
     * 受信箱の重複判定（`claimNormalizedUrl`）とは別物。あちらは
     * **受け取った URL** の取り合いで、こちらは**登録済みの成果リンク**を見る。
     * 同じ URL を 2 回登録すると、記事に同じ商品が 2 枚並び、
     * クリックも 2 つの合言葉へ割れて、どちらの数字も本当の数にならない。
     */
    async findUsableByOriginalUrl(
      workspaceId: WorkspaceId,
      originalUrl: string,
      at: Date,
    ): PortResult<AffiliateLink | null> {
      try {
        return ok(
          (await inWorkspace(workspaceId)).find(
            (l) => l.originalUrl === originalUrl && isLinkUsable(l, at),
          ) ?? null,
        );
      } catch (cause) {
        return storageFailure("同じ成果リンクがあるかの確認", cause);
      }
    },

    async listByProduct(
      workspaceId: WorkspaceId,
      productId: ProductId,
    ): PortResult<readonly AffiliateLink[]> {
      try {
        return ok((await inWorkspace(workspaceId)).filter((l) => l.productId === productId));
      } catch (cause) {
        return storageFailure("商品に結びついた成果リンクの一覧取得", cause);
      }
    },

    /**
     * 手当てが要るリンク（停止済み・期限切れ）。
     *
     * 判定はここが持つ。呼び出し側で絞ると、リンクが増えた時点で
     * 全件を持ってくることになり、件数が伸びたときに先に破綻する。
     */
    async listNeedingAttention(
      workspaceId: WorkspaceId,
      at: Date,
      limit: number,
    ): PortResult<readonly AffiliateLink[]> {
      try {
        const items = (await inWorkspace(workspaceId))
          .filter(
            (l) =>
              (l.disabledAt !== null && l.disabledAt.getTime() <= at.getTime()) ||
              (l.expiresAt !== null && l.expiresAt.getTime() <= at.getTime()),
          )
          .slice(0, limit);
        return ok(items);
      } catch (cause) {
        return storageFailure("手当てが要る成果リンクの一覧取得", cause);
      }
    },

    async save(link: AffiliateLink, snapshot: ProductSnapshot): PortResult<AffiliateLink> {
      try {
        const row = toRow(link, snapshot);
        /*
         * 同じ id で入れ直したときだけ上書きする。
         *
         * **差し替えのために使う道ではない。** 商品名や URL を直すときは
         * 新しい id で登録し直す（旧行は `disabled_at` で止める）。
         * ここで上書きを許してあるのは、保存が途中で切れた操作をもう一度
         * 押したときに、同じ内容で通るようにするため（やり直しで失敗にしない）。
         */
        await db.insert(affiliateLinks).values(row).onConflictDoUpdate({
          target: affiliateLinks.id,
          set: row,
        });
        return ok(link);
      } catch (cause) {
        return storageFailure("成果リンクの保存", cause);
      }
    },

    async createIfNoUsableUrl(link, snapshot, at) {
      try {
        const row = toRow(link, snapshot);
        const createdAt = Math.floor(row.createdAt.getTime() / 1000);
        const expiresAt = row.expiresAt === null ? null : Math.floor(row.expiresAt.getTime() / 1000);
        const disabledAt = row.disabledAt === null ? null : Math.floor(row.disabledAt.getTime() / 1000);
        const cutoff = Math.floor(at.getTime() / 1000);
        const inserted = await db.run(sql`
          INSERT INTO affiliate_links (
            id, workspace_id, program_id, product_id, product_name, brand, one_line,
            original_url, alteration_prohibited, tracking_ref, created_at, expires_at, disabled_at
          )
          SELECT
            ${row.id}, ${row.workspaceId}, ${row.programId}, ${row.productId},
            ${row.productName}, ${row.brand}, ${row.oneLine}, ${row.originalUrl},
            ${row.alterationProhibited ? 1 : 0}, ${row.trackingRef}, ${createdAt},
            ${expiresAt}, ${disabledAt}
          WHERE NOT EXISTS (
            SELECT 1 FROM affiliate_links
            WHERE workspace_id = ${row.workspaceId}
              AND original_url = ${row.originalUrl}
              AND disabled_at IS NULL
              AND (expires_at IS NULL OR expires_at > ${cutoff})
          )
        `);
        if ((inserted.meta.changes ?? 0) > 0) return ok({ link, created: true });
        const existing = await db
          .select()
          .from(affiliateLinks)
          .where(and(
            eq(affiliateLinks.workspaceId, row.workspaceId),
            eq(affiliateLinks.originalUrl, row.originalUrl),
          ));
        const canonical = existing.map(toDomain).find((candidate) => isLinkUsable(candidate, at));
        if (canonical === undefined) {
          return err(
            domainError("CONFLICT", "同じ成果リンクの登録状態が変わりました。", {
              retryable: true,
              suggestedAction: "一覧を開き直して、もう一度登録してください。",
            }),
          );
        }
        return ok({ link: canonical, created: false });
      } catch (cause) {
        return storageFailure("成果リンクの重複しない保存", cause);
      }
    },

    /**
     * 登録済みのリンクを、読者に出ている表記ごと並べる。
     *
     * **見本は重ねない。** ほかの読み出しは見本を重ねてあるが、この一覧は
     * 「止める」の押し先になる。見本は行として存在しないので押しても止まらず、
     * 押せる形で並べた時点で、押した人に嘘をつくことになる。
     * 1 件も無いことは、この画面では「まだ登録していない」として正しく出る。
     */
    async listWithSnapshot(
      workspaceId: WorkspaceId,
    ): PortResult<readonly AffiliateLinkWithSnapshot[]> {
      try {
        const rows = await db
          .select()
          .from(affiliateLinks)
          .where(eq(affiliateLinks.workspaceId, String(workspaceId)));
        return ok(
          rows.map((row) => ({
            link: toDomain(row),
            snapshot: {
              productName: row.productName,
              brand: row.brand,
              oneLine: row.oneLine,
            },
          })),
        );
      } catch (cause) {
        return storageFailure("成果リンクの一覧取得", cause);
      }
    },

    /**
     * 止める。**行は書き換えず `disabled_at` を立てるだけ。**
     *
     * 1 行も動かなかったときに成功を返さない。押した人は止まったと思い、
     * リンクは記事に出続ける。**黙って何もしないのがいちばん悪い。**
     * 見本のリンクがここに来るのは、ほかの読み出しが見本を重ねているため。
     * 見本はコードの中にあるので、行を消しても次の読み出しでまた出てくる。
     */
    async disable(
      workspaceId: WorkspaceId,
      id: AffiliateLinkId,
      at: Date,
    ): PortResult<AffiliateLink> {
      try {
        const updated = await db
          .update(affiliateLinks)
          .set({ disabledAt: at })
          .where(
            and(
              eq(affiliateLinks.workspaceId, String(workspaceId)),
              eq(affiliateLinks.id, String(id)),
            ),
          )
          .returning();
        const row = updated[0];
        if (row === undefined) {
          const isSample = sampleAffiliateLinks().some((l) => l.id === id);
          return err(
            domainError(
              "CONFLICT",
              isSample
                ? "これは見本として最初から入っているリンクなので止められません。自分で登録したリンクを選び直してください。"
                : "このリンクが見つかりませんでした。すでに消されているか、別の作業場所のものです。",
              { field: "affiliateLinkId" },
            ),
          );
        }
        return ok(toDomain(row));
      } catch (cause) {
        return storageFailure("成果リンクを止める", cause);
      }
    },
  });
}
