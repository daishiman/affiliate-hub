import type { AuthorPersona } from "./author-persona";
import { checkFactBoundary, checkProhibitedPhrases } from "./author-persona";
import type { ConversationSequenceItem } from "./conversation-block";
import { validateConversationFlow } from "./conversation-block";
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
  | "missing_citation" // 出典の欠落
  | "conversation_flow" // 会話・吹き出しの並び
  | "paragraph_shape" // 段落が長い (QC-02)
  | "sentence_length" // 1 文が長い (QC-03)
  | "vague_heading" // 見出しだけで結論が分からない (QC-04)
  | "unit_missing" // 数値に単位がない (QC-08)
  | "conclusion_mismatch" // 冒頭の結論と最終結論が食い違う (QC-09)
  | "relative_date"; // 相対的な日付表現 (QC-10)

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
  /**
   * 本文と吹き出しの並び。渡さないと会話の検査はしない (skipped に出る)。
   *
   * 吹き出しだけでは「間に本文が入ったか」が分からないため、
   * `"body"` も混ぜた並びで渡す。
   */
  readonly conversationSequence?: readonly ConversationSequenceItem[];
  /** 実在の監修者が記事に割り当てられているか。専門家の注意を載せてよいかの判定に使う。 */
  readonly hasVerifiedExpert?: boolean;
  /**
   * 冒頭の一文結論と最終結論。両方そろったときだけ食い違いを見る (QC-09)。
   *
   * 「読み進めた結果、冒頭と違う商品を薦められる」が最も信頼を落とす。
   */
  readonly openingConclusion?: string;
  readonly finalConclusion?: string;
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

/**
 * 1 文の上限 (QC-03)。
 *
 * スマートフォンの 1 画面に収まる長さ。超えると読点でつないだ長文になり、
 * 主語と述語が離れて読み違いが起きる。
 */
export const MAX_SENTENCE_LENGTH = 80;

/** 1 段落の文の数の上限 (QC-02)。STYLE_RULES の「1 段落は原則 1〜3 文」と同じ値。 */
export const MAX_SENTENCES_PER_PARAGRAPH = 3;

/**
 * 見出しだけでは結論が分からない書き方 (QC-04)。
 *
 * 拾い読みする読者は見出ししか見ない。
 * 「まとめ」「はじめに」だけでは、読む価値があるか判断できない。
 */
export const VAGUE_HEADING_PATTERNS: readonly RegExp[] = [
  /^まとめ$/,
  /^はじめに$/,
  /^おわりに$/,
  /^その他$/,
  /^ポイント$/,
  /^注意点$/,
  /^.{1,12}について$/,
  /^.{1,12}とは$/,
];

/**
 * 後から読む人に通じない日付の書き方 (QC-10)。
 *
 * 「先日」は書いた日を知らないと意味が定まらない。
 * 記事は 1 年後にも読まれる。
 */
export const RELATIVE_DATE_PATTERNS: readonly RegExp[] = [
  /先日/,
  /最近/,
  /今年/,
  /昨年/,
  /去年/,
  /来年/,
  /今月/,
  /先月/,
  /来月/,
  /今週/,
  /先週/,
];

/**
 * 単位を付けるべき数値の手前によく出る言葉 (QC-08)。
 *
 * 「重さは 1.2」では比べられない。数値には単位を必ず付ける。
 */
export const MEASURE_WORDS: readonly string[] = [
  "重さ",
  "重量",
  "容量",
  "時間",
  "速度",
  "サイズ",
  "幅",
  "高さ",
  "奥行",
  "厚さ",
  "価格",
  "解像度",
  "距離",
];

/** 数値の直後に来てよい単位。ここに無いものが続いたら単位なしとみなす。 */
const UNIT_PATTERN =
  /(時間|分|秒|ミリ秒|g|kg|mm|cm|m|km|W|Wh|mAh|V|A|円|%|倍|dB|Hz|kHz|GB|TB|MB|px|インチ|型|枚|人|件|台|個|回|日|年|ヶ月|か月)/;

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
  if (constraints.maxHashtags === null) {
    // 上限を知らないことと、上限に収まっていることは違う。
    // 黙って通すと、確認していない項目が画面上は合格として並ぶ。
    skipped.push({
      check: "hashtag_fit",
      reason: `${constraints.channel} のハッシュタグの上限を持っていないため、確認していません。`,
    });
  } else if (hashtags.length > constraints.maxHashtags) {
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

  // 18. 会話・吹き出しの並び (ブログ層 §11)
  if (ctx.conversationSequence === undefined) {
    skipped.push({
      check: "conversation_flow",
      reason: "本文と吹き出しの並びが渡されていないため検査できません。",
    });
  } else if (ctx.conversationSequence.every((i) => i === "body")) {
    skipped.push({ check: "conversation_flow", reason: "この記事に吹き出しがありません。" });
  } else {
    for (const issue of validateConversationFlow(ctx.conversationSequence, {
      hasVerifiedExpert: ctx.hasVerifiedExpert ?? false,
    })) {
      issues.push({ check: "conversation_flow", severity: "error", message: issue.message });
    }
  }

  // 19. 段落と文の長さ、見出し (QC-02〜QC-04)
  for (const p of paragraphsOf(body)) {
    const sentences = sentencesOf(p);
    if (sentences.length > MAX_SENTENCES_PER_PARAGRAPH) {
      issues.push({
        check: "paragraph_shape",
        severity: "warning",
        message: `1 段落に ${sentences.length} 文あります。${MAX_SENTENCES_PER_PARAGRAPH} 文までにして段落を分けてください。`,
        excerpt: p.slice(0, 30),
      });
    }
    for (const s of sentences) {
      if ([...s].length > MAX_SENTENCE_LENGTH) {
        issues.push({
          check: "sentence_length",
          severity: "warning",
          message: `1 文が ${[...s].length} 文字あります。${MAX_SENTENCE_LENGTH} 文字までを目安に切ってください。`,
          excerpt: s.slice(0, 30),
        });
      }
    }
  }

  const headings = headingsOf(body);
  if (headings.length === 0) {
    skipped.push({ check: "vague_heading", reason: "本文に見出しがありません。" });
  } else {
    for (const h of headings) {
      if (VAGUE_HEADING_PATTERNS.some((p) => p.test(h))) {
        issues.push({
          check: "vague_heading",
          severity: "warning",
          message: `見出し「${h}」だけでは、何が書いてあるか分かりません。結論を入れた見出しにしてください。`,
          excerpt: h,
        });
      }
    }
  }

  // 20. 数値の単位 (QC-08)
  for (const word of MEASURE_WORDS) {
    const re = new RegExp(`${word}[はがも]?\\s*(?:約)?(\\d+(?:\\.\\d+)?)(.{0,4})`, "g");
    for (const m of body.matchAll(re)) {
      if (!UNIT_PATTERN.test(m[2] ?? "")) {
        issues.push({
          check: "unit_missing",
          severity: "error",
          message: `「${word}${m[1]}」に単位がありません。単位が無い数字は比べられません。`,
          excerpt: m[0],
        });
      }
    }
  }

  // 21. 冒頭の結論と最終結論の食い違い (QC-09)
  if (ctx.openingConclusion === undefined || ctx.finalConclusion === undefined) {
    skipped.push({
      check: "conclusion_mismatch",
      reason: "冒頭の結論と最終結論のどちらかが渡されていないため照合できません。",
    });
  } else if (similarity(ctx.openingConclusion, ctx.finalConclusion) < 0.3) {
    issues.push({
      check: "conclusion_mismatch",
      severity: "error",
      message:
        "冒頭に書いた結論と最終結論が食い違っています。読み進めた読者が裏切られます。どちらかへ寄せてください。",
      excerpt: ctx.openingConclusion.slice(0, 30),
    });
  }

  // 22. 相対的な日付 (QC-10)
  for (const p of RELATIVE_DATE_PATTERNS) {
    const m = body.match(p);
    if (m) {
      issues.push({
        check: "relative_date",
        severity: "warning",
        message: `「${m[0]}」は、いつ読むかで意味が変わります。具体的な日付に置き換えてください。`,
        excerpt: m[0],
      });
    }
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

/** 段落に切る。空行または改行で区切る。見出し行は段落として数えない。 */
export function paragraphsOf(body: string): readonly string[] {
  return body
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

/** 文に切る。句点で切り、末尾の句点は残す (文字数に数えるため)。 */
export function sentencesOf(paragraph: string): readonly string[] {
  return paragraph
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
}

/** 見出し行を取り出す。`#` 記法だけを見る。 */
export function headingsOf(body: string): readonly string[] {
  return body
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("#"))
    .map((line) => line.replace(/^#+\s*/, ""));
}

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
