import { and, desc, eq, inArray } from "drizzle-orm";
import type {
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports";
import type { PageRequest } from "@/application/ports/common";
import type { EditorialScoreCard, RankingModel } from "@/domain/ranking";
import {
  type CategoryId,
  type ProductId,
  type RankingModelId,
  type WorkspaceId,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { type RankingModelRow, type ScoreCardRow, rankingModels, scoreCards } from "@/db/schema";
import {
  SAMPLE_RANKING_MODELS,
  SAMPLE_SCORE_CARDS,
} from "../sample/ranking-sample-repository";
import type { DrizzleD1 } from "./link-inbox-repository";
import { mergeWithSamples, storageFailure } from "./storage-failure";

/**
 * 順位づけの基準と採点表の保存先（D1）。
 *
 * **これはスタブではない。** 見本版と同じ契約を満たす、実際に保存する実装。
 *
 * --- なぜ 2 つを 1 つのファイルに置くか ---
 *
 * 契約（ポート）は 2 つに分かれているが、**片方だけあっても順位は出ない**。
 * 基準だけあれば「測り方は決まっているが、どの商品も測っていない」空の順位に、
 * 採点表だけあれば「点はあるが、何点なら上位かを誰も決めていない」状態になる。
 * 同じ変更で両方をつなぐことが決まっているものを別ファイルに離すと、
 * 片方だけつないだ中途の状態が作れてしまう。
 *
 * --- なぜ今これを本物にしたか ---
 *
 * 順番の決めごとは企画（`content-package-repository.ts`）と同じ。
 * **入れる口が無いものを先に本物にすると、一生埋まらない空の画面ができる。**
 * だからここでは、同じ変更のなかで `/admin/rankings/models/new`（基準を作る）と
 * `/admin/rankings/scores`（点を入れる）を用意している。
 *
 * それまで順位の画面は見本の評価方法 1 つと見本の商品 4 つを決め打ちで見ており、
 * **どの商品を追加しても順位に現れない**——しかも画面上は正常に見える状態だった。
 *
 * --- 報酬を入力にしないことをどう守るか ---
 *
 * 表に報酬の列を置いていない（`schema.ts` の `ranking_models` を参照）。
 * さらにこの実装は `markEditorial` を通しており、Commercial 印の依存を
 * 受け取れない。列・型・値の 3 段で同じことを守っている。
 */

/** 行 → 業務の型。ID の作り方を知っているのはこの層だけ。 */
function toModel(row: RankingModelRow): RankingModel {
  const stored = JSON.parse(row.modelJson) as Omit<
    RankingModel,
    "id" | "workspaceId" | "categoryId" | "version" | "audience" | "effectiveFrom"
  >;
  return {
    ...stored,
    id: taggedString<"RankingModelId">(row.id) as RankingModelId,
    workspaceId: taggedString<"WorkspaceId">(row.workspaceId) as WorkspaceId,
    categoryId: taggedString<"CategoryId">(row.categoryId) as CategoryId,
    version: row.version,
    audience: row.audience,
    effectiveFrom: row.effectiveFrom,
    // 型が `false` に固定されているので、保存された値が何であれここは false。
    // JSON の中身を信じて true が入り込む道を作らない。
    affiliateCompensationIsInput: false,
  };
}

function toCard(row: ScoreCardRow): EditorialScoreCard {
  const stored = JSON.parse(row.cardJson) as Omit<
    EditorialScoreCard,
    "productId" | "testedAt"
  >;
  return {
    ...stored,
    productId: taggedString<"ProductId">(row.productId) as ProductId,
    testedAt: row.testedAt,
  };
}

export function createD1RankingModelRepository(db: DrizzleD1): EditorialRankingModelRepositoryPort {
  return markEditorial({
    async findById(workspaceId: WorkspaceId, id: RankingModelId) {
      try {
        const rows = await db
          .select()
          .from(rankingModels)
          .where(
            and(eq(rankingModels.workspaceId, String(workspaceId)), eq(rankingModels.id, String(id))),
          )
          .limit(1);
        const found = (rows as RankingModelRow[])[0];
        if (found !== undefined) return ok(toModel(found));
        // 見本の評価方法で作った記事が、保存先をつないだ日に
        // 「評価方法が見つかりません」で開けなくなるのを防ぐ。
        return ok(SAMPLE_RANKING_MODELS.find((m) => String(m.id) === String(id)) ?? null);
      } catch (cause) {
        return storageFailure("評価基準の読み出し", cause);
      }
    },

    async list(workspaceId: WorkspaceId, page: PageRequest) {
      try {
        const rows = await db
          .select()
          .from(rankingModels)
          .where(eq(rankingModels.workspaceId, String(workspaceId)))
          // 新しい版を上に。版を上げた直後に古い版が上へ来ると、
          // 一覧の先頭を選んだ人が知らないうちに古い測り方で順位を出す。
          .orderBy(desc(rankingModels.effectiveFrom));
        const stored = (rows as RankingModelRow[]).map(toModel);
        const items = mergeWithSamples(stored, SAMPLE_RANKING_MODELS);
        return ok({ items: items.slice(0, page.limit), nextCursor: null });
      } catch (cause) {
        return storageFailure("評価基準の一覧の読み出し", cause);
      }
    },

    async save(model: RankingModel) {
      const { id, workspaceId, categoryId, version, audience, effectiveFrom, ...rest } = model;
      const columns = {
        categoryId: String(categoryId),
        version,
        audience,
        effectiveFrom,
        modelJson: JSON.stringify(rest),
      };
      try {
        await db
          .insert(rankingModels)
          .values({ id: String(id), workspaceId: String(workspaceId), ...columns })
          .onConflictDoUpdate({ target: rankingModels.id, set: columns });
        return ok(model);
      } catch (cause) {
        return storageFailure("評価基準の保存", cause);
      }
    },
  });
}

export function createD1ScoreCardRepository(db: DrizzleD1): EditorialScoreCardRepositoryPort {
  return markEditorial({
    async listByModel(
      workspaceId: WorkspaceId,
      modelId: RankingModelId,
      productIds: readonly ProductId[],
    ) {
      // 頼まれた商品が 0 件のときに問い合わせない。`inArray` に空を渡すと
      // 保存先によっては全件が返る。順位に無関係な商品まで並ぶことになる。
      if (productIds.length === 0) return ok([]);
      try {
        const rows = await db
          .select()
          .from(scoreCards)
          .where(
            and(
              eq(scoreCards.workspaceId, String(workspaceId)),
              eq(scoreCards.modelId, String(modelId)),
              inArray(scoreCards.productId, productIds.map(String)),
            ),
          );
        const stored = (rows as ScoreCardRow[]).map(toCard);
        const wanted = new Set(productIds.map(String));
        const taken = new Set(stored.map((c) => String(c.productId)));
        /*
         * 見本を後ろから埋める。ここで見本を先にすると、
         * 測り直して入れた点が保存されているのに古い見本の点で順位が出る。
         * **順位は変わらないのに「直した」と思い込む**のが最悪の壊れ方で、
         * 直った証拠が画面のどこにも出ない。
         */
        const samples = SAMPLE_SCORE_CARDS.filter(
          (c) => wanted.has(String(c.productId)) && !taken.has(String(c.productId)),
        );
        return ok([...stored, ...samples]);
      } catch (cause) {
        return storageFailure("商品の評価の読み出し", cause);
      }
    },

    async save(workspaceId: WorkspaceId, modelId: RankingModelId, card: EditorialScoreCard) {
      const { productId, testedAt, ...rest } = card;
      const columns = {
        productId: String(productId),
        testedAt,
        cardJson: JSON.stringify(rest),
      };
      try {
        /*
         * 主キーが 3 列なので `target` も 3 列を並べる。
         * ここを `productId` だけにすると、**別の評価方法で付けた点が
         * 上書きされる**。版を上げて測り直した瞬間に、古い版の順位が
         * 再現できなくなり、版を上げる決まりごと意味を失う。
         */
        await db
          .insert(scoreCards)
          .values({ workspaceId: String(workspaceId), modelId: String(modelId), ...columns })
          .onConflictDoUpdate({
            target: [scoreCards.workspaceId, scoreCards.modelId, scoreCards.productId],
            set: { testedAt: columns.testedAt, cardJson: columns.cardJson },
          });
        return ok(card);
      } catch (cause) {
        return storageFailure("商品の評価の保存", cause);
      }
    },
  });
}
