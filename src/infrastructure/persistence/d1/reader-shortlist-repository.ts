import { and, eq } from "drizzle-orm";
import type { EditorialShortlistPort, ShortlistItem } from "@/application/ports/reader-interaction";
import { markEditorial, ok } from "@/domain/shared";
import { readerShortlistItems, type ReaderShortlistItemRow } from "@/db/schema";
import type { DrizzleD1 } from "./link-inbox-repository";
import { storageFailure } from "./storage-failure";

/**
 * 読者の「気になる商品」の保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約を満たす、実際に保存する実装。
 *
 * --- なぜ KV を待たずに D1 で作ったか ---
 * 見本版は処理中のメモリに置いていたので、読者から見ると
 * 「保存できたのに翌日消えている」。押した側には壊れているようにしか見えず、
 * しかも何も知らせずに消える。KV の名前空間の用意は利用者の手が要るが、
 * D1 はもう繋がっている。**先に消えないようにするほうが、待つより早い。**
 *
 * --- 見本と重ねない ---
 * ほかの保存先と違い、ここは見本を混ぜない。読者が自分で押して保存したものの
 * 一覧に、押していない商品が最初から並んでいたら、それは読者の一覧ではない。
 * **1 件も無いときは、空のまま返すのが正しい。**
 *
 * --- 読者を特定しない ---
 * 受け取るのは `readerKey`（ブラウザごとの意味の無い合言葉）だけ。
 * 名前も連絡先も受け取らないし、列としても持たない。
 */

function toItem(row: ReaderShortlistItemRow): ShortlistItem {
  return {
    productId: row.productId,
    productName: row.productName,
    // 列名は `saved_at`（migration が要るため据え置き）。型の側は意味で名前を分ける。
    shortlistedAt: row.savedAt,
    ...(row.fromArticleHref === null ? {} : { fromArticleHref: row.fromArticleHref }),
    ...(row.oneLine === null ? {} : { oneLine: row.oneLine }),
  };
}

export function createD1ShortlistRepository(db: DrizzleD1): EditorialShortlistPort {
  return markEditorial({
    async list(siteSlug: string, readerKey: string) {
      try {
        const rows = (await db
          .select()
          .from(readerShortlistItems)
          .where(
            and(
              eq(readerShortlistItems.siteSlug, siteSlug),
              eq(readerShortlistItems.readerKey, readerKey),
            ),
          )) as ReaderShortlistItemRow[];
        // 新しく保存したものが上。押した直後の 1 件を探させない。
        return ok(
          [...rows]
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
            .map(toItem),
        );
      } catch (cause) {
        return storageFailure("気になる商品の読み出し", cause);
      }
    },

    async add(siteSlug: string, readerKey: string, item: ShortlistItem) {
      try {
        await db
          .insert(readerShortlistItems)
          .values({
            siteSlug,
            readerKey,
            productId: item.productId,
            productName: item.productName,
            // 左が列名（`saved_at`。migration が要るため据え置き）、右が型の欄名。
            savedAt: item.shortlistedAt,
            fromArticleHref: item.fromArticleHref ?? null,
            oneLine: item.oneLine ?? null,
          })
          // 同じ商品を 2 回押しても増やさない。押せてしまうだけの操作にしない。
          // **保存した日時は上書きしない。** 上書きすると、間違って押し直した
          // だけで「いつ気になったか」が今日へ動き、並び順が入れ替わる。
          .onConflictDoUpdate({
            target: [
              readerShortlistItems.siteSlug,
              readerShortlistItems.readerKey,
              readerShortlistItems.productId,
            ],
            set: {
              productName: item.productName,
              fromArticleHref: item.fromArticleHref ?? null,
              oneLine: item.oneLine ?? null,
            },
          });
        return ok(true as const);
      } catch (cause) {
        return storageFailure("気になる商品の保存", cause);
      }
    },

    async remove(siteSlug: string, readerKey: string, productId: string) {
      try {
        // 外すのは本当に消す。読者が自分で外したものに印だけ付けて残すと、
        // 消したつもりのものをこちらが持ち続けることになる。
        await db
          .delete(readerShortlistItems)
          .where(
            and(
              eq(readerShortlistItems.siteSlug, siteSlug),
              eq(readerShortlistItems.readerKey, readerKey),
              eq(readerShortlistItems.productId, productId),
            ),
          );
        return ok(true as const);
      } catch (cause) {
        return storageFailure("気になる商品の取り外し", cause);
      }
    },
  });
}
