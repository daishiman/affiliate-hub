import { eq } from "drizzle-orm";
import type { PortResult } from "@/application/ports/common";
import type { CommercialAffiliateLinkRepositoryPort } from "@/application/ports/monetization";
import { type AffiliateLink, type ProductSnapshot, isLinkUsable } from "@/domain/monetization";
import {
  type AffiliateLinkId,
  type AffiliateProgramId,
  type ProductId,
  type WorkspaceId,
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
  });
}
