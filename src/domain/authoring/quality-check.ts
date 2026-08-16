import type { AuthorPersona } from "./author-persona";
import { checkFactBoundary, checkProhibitedPhrases } from "./author-persona";
import type { ContentVariant } from "./content-variant";

/**
 * 自動品質確認 (プラットフォーム層 §15.6)。
 *
 * 仕様が挙げる 17 項目を 1 箇所にまとめる。
 * このモジュールは純粋関数だけで構成する。理由:
 *   - 生成直後 / 編集後 / 公開直前 / SNS投稿前 の 4 箇所で同じ判定を使う
 *   - 判定結果を eval セット (50件) で回帰させる
 *
 * 検査できないものは「検査しない」と明示する。空の合格を返さない。
 */
export type QualityIssueSeverity = "error" | "warning" | "info";

export type QualityIssue = {
  readonly check: QualityCheckId;
  readonly severity: QualityIssueSeverity;
  /** 編集者がそのまま読んで直せる説明。 */
  readonly message: string;
  readonly excerpt?: string;
};

export type QualityCheckId =
  | "unsourced_number" // 根拠のない数値
  | "stale_price" // 古い価格
  | "fabricated_experience" // 架空の体験
  | "nonexistent_feature" // 存在しない機能
  | "exaggeration" // 誇大表現
  | "prohibited_phrase" // 禁止語
  | "disclosure_present" // 広告表記
  | "link_present" // リンクの欠落
  | "length_fit" // 文字数
  | "hashtag_fit" // ハッシュタグ
  | "channel_fit" // 媒体不適合
  | "duplicate_text" // 重複文章
  | "brand_fit" // ブランドとの不一致
  | "audience_fit" // 読者との不一致
  | "cta_overuse" // CTAの過剰
  | "missing_drawback" // デメリットの欠落
  | "missing_citation"; // 出典の欠落

export type ChannelConstraints = {
  readonly channel: string;
  readonly maxBodyLength: number | null;
  readonly maxHashtags: number | null;
  /** この媒体でアフィリエイトリンクを直接貼れるか。 */
  readonly allowsAffiliateLink: boolean;
  /** 広告表記を本文に含める必要があるか。 */
  readonly requiresInlineDisclosure: boolean;
};

export type QualityCheckContext = {
  readonly variant: ContentVariant;
  readonly persona: AuthorPersona;
  readonly constraints: ChannelConstraints;
  /** この書き手にこの商品の検証記録があるか。事実境界の判定に使う。 */
  readonly hasVerifiedTestRun: boolean;
  /** 商品が実際に持つ機能名の一覧。ここに無い機能名を本文が名乗ったら疑う。 */
  readonly knownFeatureNames: readonly string[];
  /** 既存の公開済み本文。重複検出に使う。空なら重複検査をしない。 */
  readonly existingBodies: readonly string[];
  /** 価格に言及しているか、その価格の確認日時。 */
  readonly priceCheckedAt: Date | null;
  readonly now: Date;
};

export type QualityReport = {
  readonly issues: readonly QualityIssue[];
  /** 実行しなかった検査と理由。「検査した」と誤認させないため。 */
  readonly skipped: readonly { check: QualityCheckId; reason: string }[];
  readonly status: "pass" | "warning" | "fail";
};

/** 根拠なしに使ってはいけない断定表現 (§20.3 / ブログ層 §10.3)。 */
export const EXAGGERATION_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /最強/, label: "最強" },
  { pattern: /最安/, label: "最安" },
  { pattern: /絶対(に)?/, label: "絶対" },
  { pattern: /完全に/, label: "完全" },
  { pattern: /日本一/, label: "日本一" },
  { pattern: /世界一/, label: "世界一" },
  { pattern: /No\.?1|ナンバー(ワン|1)/i, label: "No.1" },
  { pattern: /必ず(痩せ|治|儲か|稼げ)/, label: "効果の断定" },
];

/** 価格の鮮度。これを超えた価格を「現在価格」として書けない。 */
export const PRICE_STALE_HOURS = 72;

/** CTA が本文に何回まで出てよいか。多すぎると読者が判断材料を得る前に押される。 */
export const MAX_CTA_OCCURRENCES = 3;

export function runQualityChecks(ctx: QualityCheckContext): QualityReport {
  const issues: QualityIssue[] = [];
  const skipped: { check: QualityCheckId; reason: string }[] = [];
  const { variant, constraints, persona } = ctx;
  const body = variant.body;

  // 1. 根拠のない数値: 数値を含むのに主張が紐づいていない
  const numbers = body.match(/\d+(\.\d+)?\s*(時間|分|秒|g|kg|mm|cm|m|W|Wh|mAh|円|%|倍|dB|Hz|GB|TB)/g);
  if (numbers && numbers.length > 0 && variant.claimIds.length === 0) {
    issues.push({
      check: "unsourced_number",
      severity: "error",
      message: `数値 (${numbers.slice(0, 3).join(" / ")}) が書かれていますが、根拠となる主張が紐づいていません。`,
      excerpt: numbers.slice(0, 3).join(" / "),
    });
  }

  // 2. 古い価格
  if (/\d+\s*円/.test(body)) {
    if (ctx.priceCheckedAt === null) {
      issues.push({
        check: "stale_price",
        severity: "error",
        message: "価格が書かれていますが、いつ確認した価格か記録がありません。",
      });
    } else {
      const ageHours = (ctx.now.getTime() - ctx.priceCheckedAt.getTime()) / 3_600_000;
      if (ageHours > PRICE_STALE_HOURS) {
        issues.push({
          check: "stale_price",
          severity: "warning",
          message: `価格の確認から ${Math.floor(ageHours / 24)} 日経っています。確認日時を併記するか、取り直してください。`,
        });
      }
    }
  } else {
    skipped.push({ check: "stale_price", reason: "本文に価格の記載がありません。" });
  }

  // 3. 架空の体験
  for (const v of checkFactBoundary(persona, body, {
    hasVerifiedTestRun: ctx.hasVerifiedTestRun,
  })) {
    issues.push({
      check: "fabricated_experience",
      severity: "error",
      message: v.message,
      excerpt: v.excerpt,
    });
  }

  // 4. 存在しない機能
  if (ctx.knownFeatureNames.length === 0) {
    skipped.push({
      check: "nonexistent_feature",
      reason: "商品の機能一覧が登録されていないため照合できません。",
    });
  } else {
    const quoted = [...body.matchAll(/「([^」]{2,20})」/g)].map((m) => m[1]);
    for (const q of quoted) {
      const looksLikeFeature = /機能|モード|対応|搭載/.test(body.slice(Math.max(0, body.indexOf(q) - 10), body.indexOf(q) + q.length + 10));
      if (looksLikeFeature && !ctx.knownFeatureNames.includes(q)) {
        issues.push({
          check: "nonexistent_feature",
          severity: "warning",
          message: `「${q}」は登録済みの機能一覧にありません。名称が正しいか確認してください。`,
          excerpt: q,
        });
      }
    }
  }

  // 5. 誇大表現
  for (const { pattern, label } of EXAGGERATION_PATTERNS) {
    if (pattern.test(body)) {
      issues.push({
        check: "exaggeration",
        severity: "error",
        message: `「${label}」は根拠なしに使えない表現です。測定結果か公式情報に基づく言い換えへ直してください。`,
        excerpt: label,
      });
    }
  }

  // 6. 禁止語 (ペルソナ個別)
  for (const p of checkProhibitedPhrases(persona, body)) {
    issues.push({
      check: "prohibited_phrase",
      severity: "error",
      message: `この書き手では「${p}」を使わない設定です。`,
      excerpt: p,
    });
  }

  // 7. 広告表記
  if (variant.affiliateLinkIds.length > 0) {
    if (variant.disclosure.trim() === "") {
      issues.push({
        check: "disclosure_present",
        severity: "error",
        message: "アフィリエイトリンクがあるのに広告表記がありません。ステマ規制の対象になります。",
      });
    } else if (constraints.requiresInlineDisclosure && !body.includes(variant.disclosure)) {
      issues.push({
        check: "disclosure_present",
        severity: "error",
        message: `${constraints.channel} では広告表記を本文に含める必要があります。`,
      });
    }
  } else {
    skipped.push({ check: "disclosure_present", reason: "アフィリエイトリンクがありません。" });
  }

  // 8. リンクの欠落
  if (
    (variant.cta === "check_price_at_merchant" || variant.cta === "read_detail") &&
    variant.affiliateLinkIds.length === 0 &&
    !/https?:\/\//.test(body)
  ) {
    issues.push({
      check: "link_present",
      severity: "error",
      message: `CTA が「${variant.cta}」ですが、遷移先のリンクがありません。`,
    });
  }

  // 9. 文字数
  if (constraints.maxBodyLength !== null && [...body].length > constraints.maxBodyLength) {
    issues.push({
      check: "length_fit",
      severity: "error",
      message: `${constraints.channel} の上限 ${constraints.maxBodyLength} 文字を超えています (現在 ${[...body].length} 文字)。`,
    });
  }

  // 10. ハッシュタグ
  const hashtags = body.match(/#[^\s#]+/g) ?? [];
  if (constraints.maxHashtags !== null && hashtags.length > constraints.maxHashtags) {
    issues.push({
      check: "hashtag_fit",
      severity: "warning",
      message: `ハッシュタグが ${hashtags.length} 個あります。${constraints.channel} では ${constraints.maxHashtags} 個までを推奨します。`,
    });
  }

  // 11. 媒体不適合 (リンク不可の媒体にリンクを置いた)
  if (!constraints.allowsAffiliateLink && variant.affiliateLinkIds.length > 0) {
    issues.push({
      check: "channel_fit",
      severity: "error",
      message: `${constraints.channel} ではアフィリエイトリンクを掲載できません。プロフィール誘導などへ変更してください。`,
    });
  }

  // 12. 重複文章
  if (ctx.existingBodies.length === 0) {
    skipped.push({ check: "duplicate_text", reason: "比較対象の既存本文がありません。" });
  } else {
    const dup = ctx.existingBodies.find((b) => similarity(b, body) >= 0.85);
    if (dup) {
      issues.push({
        check: "duplicate_text",
        severity: "error",
        message:
          "既存の文章とほぼ同じ内容です。対象読者・評価軸・結論のいずれかを変えてください (言い換え記事の量産を避けます)。",
      });
    }
  }

  // 13. ブランドとの不一致 / 14. 読者との不一致
  // 判定モデルが必要なため、スコアが低い場合のみ警告する。
  if (variant.personaFitScore < 0.6) {
    issues.push({
      check: "brand_fit",
      severity: "warning",
      message: `書き手らしさの一致度が低めです (${variant.personaFitScore.toFixed(2)})。口調と一人称を確認してください。`,
    });
  }
  if (variant.channelFitScore < 0.6) {
    issues.push({
      check: "audience_fit",
      severity: "warning",
      message: `媒体との一致度が低めです (${variant.channelFitScore.toFixed(2)})。`,
    });
  }

  // 15. CTA の過剰
  const ctaHits = countCtaPhrases(body);
  if (ctaHits > MAX_CTA_OCCURRENCES) {
    issues.push({
      check: "cta_overuse",
      severity: "warning",
      message: `行動を促す文が ${ctaHits} 箇所あります。判断材料を先に示し、${MAX_CTA_OCCURRENCES} 箇所程度に抑えてください。`,
    });
  }

  // 16. デメリットの欠落
  if (!/デメリット|弱点|向いていない|注意点|短所/.test(body)) {
    issues.push({
      check: "missing_drawback",
      severity: "error",
      message: "デメリットや向いていない人への言及がありません。長所だけの記事は公開できません。",
    });
  }

  // 17. 出典の欠落
  if (variant.claimIds.length > 0 && variant.evidenceIds.length === 0) {
    issues.push({
      check: "missing_citation",
      severity: "error",
      message: "主張はありますが根拠が紐づいていません。出典を付けてください。",
    });
  }

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");
  return {
    issues,
    skipped,
    status: hasError ? "fail" : hasWarning ? "warning" : "pass",
  };
}

/** 行動を促す定型表現。CTA の過剰を数えるために使う。 */
export const CTA_PHRASE_PATTERNS: readonly RegExp[] = [
  /はこちら/g,
  /してください/g,
  /チェック/g,
  /確認する/g,
  /申し込/g,
  /購入/g,
];

function countCtaPhrases(body: string): number {
  return CTA_PHRASE_PATTERNS.reduce((sum, p) => sum + (body.match(p)?.length ?? 0), 0);
}

/**
 * 2 つの文章の近さを 0.0〜1.0 で返す。
 *
 * 3-gram の重なり率。形態素解析なしで日本語の言い換えをそこそこ拾える。
 * 精度より「依存を増やさないこと」を優先している (domain 層は外部依存ゼロ)。
 */
export function similarity(a: string, b: string): number {
  const ga = ngrams(a, 3);
  const gb = ngrams(b, 3);
  if (ga.size === 0 || gb.size === 0) return 0;
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit += 1;
  return hit / Math.min(ga.size, gb.size);
}

function ngrams(text: string, n: number): Set<string> {
  const cleaned = text.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i + n <= cleaned.length; i += 1) out.add(cleaned.slice(i, i + n));
  return out;
}
