import type { ArticleType, SectionId } from "../authoring/article-structure";
import { missingSections } from "../authoring/article-structure";
import type { RelationshipType } from "./disclosure";
import { requiresDisclosure } from "./disclosure";

/**
 * 公開ゲート (ブログ層 §21)。
 *
 * 「次のいずれかが欠ける場合は公開しない」を仕組みで担保する。
 * 目視レビューに任せると、急いでいるときに必ず抜ける。
 *
 * このモジュールは Publication 集約の不変条件そのもの。
 * 記事公開・ブログ配信・SNS投稿の 3 経路すべてがここを通る。
 *
 * 検査できない項目は「検査していない」と結果に残す。
 * 空の合格を返すと、通っていない検査が通ったことになる。
 */
export type GateRequirement =
  | "author" // 著者
  | "disclosure" // 広告表記
  | "evidence" // 根拠
  | "update_owner" // 更新責任者
  | "cta_merchant_info" // CTAの販売店情報
  | "image_rights" // 必須画像の権利
  | "structured_data" // 構造化データ検証
  | "mobile_check" // モバイル確認
  | "link_check" // リンク確認
  | "ai_answer_eval" // AI回答評価
  | "webmcp_schema_eval" // WebMCPスキーマ評価
  | "required_sections" // 記事タイプの必須セクション
  | "next_review_date"; // 次回確認日 (§28 運用)

/**
 * 検査項目の表示名。**ここが唯一の正本**。
 *
 * 画面には識別子を出さない。「image_rights が未実施」では、
 * 何を用意すればよいのかが読んだ人に伝わらない。
 */
export const GATE_REQUIREMENT_LABEL: Readonly<Record<GateRequirement, string>> = {
  author: "著者",
  disclosure: "広告・アフィリエイト表記",
  evidence: "根拠",
  update_owner: "更新責任者",
  cta_merchant_info: "販売店の選択肢",
  image_rights: "画像の利用許諾",
  structured_data: "構造化データの検証",
  mobile_check: "スマートフォン表示の確認",
  link_check: "リンク切れの確認",
  ai_answer_eval: "AI 回答の評価",
  webmcp_schema_eval: "AI 向け操作の定義の検証",
  required_sections: "記事の必須項目",
  next_review_date: "次回確認日",
};

export type GateFailure = {
  readonly requirement: GateRequirement;
  /** 編集者がそのまま読んで直せる説明。「invalid」では直せない。 */
  readonly message: string;
};

export type GateSkip = {
  readonly requirement: GateRequirement;
  /** なぜ検査できなかったか。「未実装」もここに正直に書く。 */
  readonly reason: string;
};

export type GateResult = {
  readonly ok: boolean;
  readonly failures: readonly GateFailure[];
  readonly skipped: readonly GateSkip[];
};

export type PublishCandidate = {
  readonly articleType: ArticleType;
  readonly presentSections: readonly SectionId[];
  readonly authorIds: readonly string[];
  readonly updateOwnerId: string | null;
  readonly relationshipType: RelationshipType | null;
  readonly disclosureVisibleMessage: string | null;
  readonly claimCount: number;
  readonly evidenceCount: number;
  readonly hasAffiliateCta: boolean;
  readonly merchantOptionCount: number;
  /** 画像の利用許諾が全て確認済みか。null は未確認 (検査できない)。 */
  readonly imageRightsConfirmed: boolean | null;
  /** 構造化データの検証結果。null は未実施。 */
  readonly structuredDataValid: boolean | null;
  /** モバイル表示の確認。null は未実施。 */
  readonly mobileChecked: boolean | null;
  /** リンク切れ確認。null は未実施。 */
  readonly linksChecked: boolean | null;
  /** AI 回答の評価。null は未実施。 */
  readonly aiAnswerEvalPassed: boolean | null;
  /** WebMCP スキーマ評価。null は未実施。この記事が WebMCP を使わないなら false ではなく "not_applicable"。 */
  readonly webmcpSchemaEval: boolean | "not_applicable" | null;
  readonly nextReviewAt: Date | null;
  readonly now: Date;
};

/**
 * 公開してよいか判定する。
 *
 * 判定の方針:
 *   - 「読者が誤認しうるもの」は必ず失敗にする (著者・広告表記・根拠・販売店情報)
 *   - 「まだ仕組みが無いもの」は skipped に記録し、失敗にしない
 *     (失敗にすると全記事が公開できず、ゲート自体が無効化される)
 */
export function evaluatePublishGate(c: PublishCandidate): GateResult {
  const failures: GateFailure[] = [];
  const skipped: GateSkip[] = [];

  // 著者
  if (c.authorIds.length === 0) {
    failures.push({
      requirement: "author",
      message: "著者が割り当てられていません。誰が書いたか示さない記事は公開できません。",
    });
  }

  // 更新責任者
  if (!c.updateOwnerId) {
    failures.push({
      requirement: "update_owner",
      message: "更新責任者が決まっていません。公開後に情報が古くなったとき、直す人がいなくなります。",
    });
  }

  // 広告表記
  if (c.relationshipType === null) {
    failures.push({
      requirement: "disclosure",
      message: "広告との関係が未設定です。自費購入の場合もその旨を設定してください。",
    });
  } else if (requiresDisclosure(c.relationshipType)) {
    if (!c.disclosureVisibleMessage || c.disclosureVisibleMessage.trim() === "") {
      failures.push({
        requirement: "disclosure",
        message: "広告関係があるのに、読者へ見せる表示文がありません。ステマ規制の対象になります。",
      });
    }
  }

  // 根拠
  if (c.claimCount > 0 && c.evidenceCount === 0) {
    failures.push({
      requirement: "evidence",
      message: `主張が ${c.claimCount} 件ありますが、根拠が 1 つも登録されていません。`,
    });
  }
  if (c.claimCount === 0) {
    failures.push({
      requirement: "evidence",
      message: "確認済みの主張が 1 つもありません。根拠に紐づかない記事は公開できません。",
    });
  }

  // CTA の販売店情報
  if (c.hasAffiliateCta && c.merchantOptionCount === 0) {
    failures.push({
      requirement: "cta_merchant_info",
      message: "販売店へ誘導する CTA がありますが、販売店の選択肢が登録されていません。",
    });
  }

  // 必須セクション
  const missing = missingSections(c.articleType, c.presentSections);
  if (missing.length > 0) {
    failures.push({
      requirement: "required_sections",
      message: `この記事タイプに必要な項目が足りません: ${missing.map((s) => s.label).join(" / ")}`,
    });
  }

  // 次回確認日
  if (c.nextReviewAt === null) {
    failures.push({
      requirement: "next_review_date",
      message: "次回確認日が設定されていません。放置された記事を見つけられなくなります。",
    });
  } else if (c.nextReviewAt <= c.now) {
    failures.push({
      requirement: "next_review_date",
      message: "次回確認日が過去の日付になっています。",
    });
  }

  // 以下は外部の仕組みに依存する検査。未実施は skipped に落とす。
  checkTriState(c.imageRightsConfirmed, "image_rights", "画像の利用許諾が確認されていません。", "画像権利の確認機能が未実装です。", failures, skipped);
  checkTriState(c.structuredDataValid, "structured_data", "構造化データの検証に失敗しています。", "構造化データの検証が未実施です。", failures, skipped);
  checkTriState(c.mobileChecked, "mobile_check", "モバイル表示の確認が完了していません。", "モバイル確認の記録がありません。", failures, skipped);
  checkTriState(c.linksChecked, "link_check", "リンク切れが見つかっています。", "リンク確認が未実施です。", failures, skipped);
  checkTriState(c.aiAnswerEvalPassed, "ai_answer_eval", "AI回答の評価が基準を満たしていません。", "AI回答の評価が未実施です。", failures, skipped);

  if (c.webmcpSchemaEval === "not_applicable") {
    skipped.push({
      requirement: "webmcp_schema_eval",
      reason: "この記事は WebMCP のツールを公開しないため対象外です。",
    });
  } else {
    checkTriState(c.webmcpSchemaEval, "webmcp_schema_eval", "WebMCP のツール定義が検証を通っていません。", "WebMCP スキーマ評価が未実施です。", failures, skipped);
  }

  return { ok: failures.length === 0, failures, skipped };
}

function checkTriState(
  value: boolean | null,
  requirement: GateRequirement,
  failMessage: string,
  skipReason: string,
  failures: GateFailure[],
  skipped: GateSkip[],
): void {
  if (value === null) {
    skipped.push({ requirement, reason: skipReason });
    return;
  }
  if (!value) {
    failures.push({ requirement, message: failMessage });
  }
}
