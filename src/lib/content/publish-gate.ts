import "server-only";

import type { Article, ArticlePerson, Disclosure } from "@/db/schema";

/**
 * 公開ゲート (仕様書 §21)。
 *
 * 「次のいずれかが欠ける場合は公開しない」を仕組みで担保する。
 * レビューの目視に頼ると、急いでいるときに必ず抜ける。
 *
 * Phase 1 の時点で検査できるのは記事メタデータに関する項目だけ。
 * 根拠 (Claim/Evidence)・構造化データ検証・リンク確認・AI 回答評価・
 * WebMCP スキーマ評価は、対象データが存在する Phase 2 以降で追加する。
 */

/** 公開ゲートで検査する項目。仕様書 §21 の公開ゲート一覧に対応する。 */
export type GateRequirement =
  | "author" // 著者
  | "disclosure" // 広告表記
  | "owner" // 更新責任者
  | "summary" // 一文の結論 (§8)
  | "category" // 所属カテゴリー
  | "next_review"; // 次回確認日 (§28 運用 C3)

export type GateFailure = {
  requirement: GateRequirement;
  /** 編集者がそのまま読んで直せる説明にする。「invalid」では直せない。 */
  message: string;
};

export type GateResult = {
  ok: boolean;
  failures: GateFailure[];
};

export type PublishGateInput = {
  article: Article;
  /** 記事に紐づく人物の割り当て。role で著者・編集者・監修者を判別する。 */
  people: ArticlePerson[];
  /** article.disclosureId が指す行。未設定なら null。 */
  disclosure: Disclosure | null;
  /** 判定の基準時刻。省略時は現在時刻。テストから固定するために受け取る。 */
  now?: Date;
};

/**
 * カテゴリーを必須とする記事タイプ。
 *
 * ranking / review / comparison は商品を扱うため、カテゴリー無しでは
 * §7 のカテゴリーページに載らず、読者が到達できない。
 * guide / tool は §7 で /guides/{topic} /tools/{tool} として
 * カテゴリー配下に置かれないため任意とする。
 */
const CATEGORY_REQUIRED_TYPES: ReadonlySet<Article["type"]> = new Set([
  "ranking",
  "review",
  "comparison",
]);

/**
 * 記事を公開してよいか判定する。
 *
 * 呼び出し側は ok が false のとき status を published にしてはならない。
 * failures は「何を足せば公開できるか」を編集者へそのまま提示する。
 */
export function evaluatePublishGate(input: PublishGateInput): GateResult {
  const { article, people, disclosure } = input;
  const now = input.now ?? new Date();
  const failures: GateFailure[] = [];

  // 著者: 最低 1 人。§19「誰が作成したか」は必須項目。
  // 監修者 (expert) は必須にしない。全記事に専門家を要求すると、
  // §2 が禁じる「架空の専門家を作る」動機を生むため。
  // ただし ExpertCaution の吹き出しを含む記事には監修者を要求すべきで、
  // これは conversationBlocks を参照できる Phase 2 で追加する。
  if (!people.some((p) => p.role === "author")) {
    failures.push({
      requirement: "author",
      message: "著者が割り当てられていません。role が author の人物を 1 人以上追加してください。",
    });
  }

  // 広告表記: 行の存在だけでは足りない。§17.1 が求めるのは
  // 「利用者が認識できる位置と表現」であり、文言が空なら表示できない。
  if (!article.disclosureId || !disclosure) {
    failures.push({
      requirement: "disclosure",
      message:
        "広告・アフィリエイト表記が設定されていません。関係の種類 (affiliate / sponsored / supplied / loaned / purchased) を選んで表記を作成してください。",
    });
  } else if (disclosure.visibleMessage.trim() === "") {
    failures.push({
      requirement: "disclosure",
      message:
        "広告表示の文言が空です。読者が広告関係を判別できる文章が必要です（文言の正本は src/presentation/ui/copy.ts の UI_COPY.disclosure）。",
    });
  }

  // 更新責任者: §28 運用 C1。不在だと誰も更新せず放置される。
  if (!article.ownerId) {
    failures.push({
      requirement: "owner",
      message: "更新責任者が未設定です。公開後にこの記事を保守する人物を指定してください。",
    });
  }

  // 一文の結論: §8 の記事共通構成。要約ではなく結論を書く欄。
  if (!article.summary || article.summary.trim() === "") {
    failures.push({
      requirement: "summary",
      message: "一文の結論がありません。読者が最初に受け取るべき結論を 1 文で書いてください。",
    });
  }

  // カテゴリー: 商品を扱う記事タイプのみ必須。
  if (CATEGORY_REQUIRED_TYPES.has(article.type) && !article.categoryId) {
    failures.push({
      requirement: "category",
      message: `${article.type} 記事にはカテゴリーが必要です。未設定だとカテゴリーページから読者が到達できません。`,
    });
  }

  // 次回確認日: 未設定も過去日も拒否する。
  // 過去日を許すと「公開時点で既に期限切れ」の記事が生まれ、
  // §28 運用 C3 のチェックが初日から意味を失う。
  if (!article.nextReviewAt) {
    failures.push({
      requirement: "next_review",
      message: "次回確認日が未設定です。この記事の内容を再確認する期日を入れてください。",
    });
  } else if (article.nextReviewAt.getTime() <= now.getTime()) {
    failures.push({
      requirement: "next_review",
      message:
        "次回確認日が過去または現在の日時です。公開時点で期限切れの記事は作れません。内容を再確認し、将来の日付に更新してください。",
    });
  }

  return { ok: failures.length === 0, failures };
}
