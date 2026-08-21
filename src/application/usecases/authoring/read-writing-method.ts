import {
  ARTICLE_TYPE_LABEL,
  ARTICLE_TYPES,
  type ArticleType,
  CONVERSATION_BASE_PATTERN,
  CONVERSATION_MAX_LENGTH,
  CONVERSATION_MIN_LENGTH,
  FACT_LABELS,
  FACT_TONE_RULES,
  KNOWLEDGE_LEVEL_GUIDE,
  MAX_CONSECUTIVE_BLOCKS,
  OPENING_PATTERNS,
  PARAGRAPH_ORDER,
  STYLE_RULES,
  sectionsFor,
} from "@/domain/authoring";
import { requireCapability } from "@/domain/identity";
import { err, ok } from "@/domain/shared";
import type { UseCase } from "../usecase";

/**
 * 書き方の決めごとを読むユースケース。
 *
 * 人が書くときも AI に書かせるときも、同じ 1 つの決めごとを見る。
 * 手引きを別に書くと、どちらかが必ず古くなり、
 * 「手引きどおりに書いたのに検査で落ちる」が起きる。
 *
 * 外部に問い合わせない。決めごとそのものを返す。
 */

// 記事タイプの表示名は domain（`@/domain/authoring`）が持つ。
// ここと作成ウィザードで別々に持っていたため、
// 同じ記事タイプが「順位をつける記事」と「順位づけ」の 2 通りに見えていた。

export const KNOWLEDGE_LEVEL_LABEL: Readonly<Record<string, string>> = {
  beginner: "はじめての人",
  intermediate: "ある程度知っている人",
  expert: "詳しい人",
};

export type SectionView = {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly purpose: string;
};

export type WritingMethod = {
  readonly articleType: ArticleType;
  readonly articleTypeLabel: string;
  readonly types: readonly { readonly key: ArticleType; readonly label: string }[];
  /** 選んだ記事の型の節の並び。 */
  readonly sections: readonly SectionView[];
  readonly requiredCount: number;
  /** 書き出しの型。 */
  readonly opening: string;
  /** 段落の並べ方。 */
  readonly paragraphOrder: readonly { readonly step: string; readonly description: string }[];
  readonly styleRules: readonly { readonly id: string; readonly rule: string; readonly why: string }[];
  /** 事実の種類ごとの見せ方と語尾。 */
  readonly factRules: readonly {
    readonly kind: string;
    readonly label: string;
    readonly allowed: readonly string[];
    readonly forbidden: readonly string[];
  }[];
  /** 読者の知識量ごとの書き分け。 */
  readonly knowledgeGuide: readonly {
    readonly level: string;
    readonly levelLabel: string;
    readonly jargon: string;
    readonly numbers: string;
    readonly structure: string;
  }[];
  /** 会話の決まり。 */
  readonly conversation: {
    readonly minLength: number;
    readonly maxLength: number;
    readonly maxConsecutive: number;
    readonly basePattern: readonly string[];
    readonly rule: string;
  };
};

const CONVERSATION_PART_LABEL: Readonly<Record<string, string>> = {
  body: "本文",
  reader_question: "読者の疑問",
  guide_answer: "案内役の答え",
  reviewer_note: "検証者の補足",
  expert_caution: "専門家の注意",
  note: "注意書き",
};

export function createReadWritingMethodUseCase(): UseCase<
  { readonly articleType?: string },
  WritingMethod
> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.read", "書き方の決めごとの確認");
      if (!allowed.ok) return err(allowed.error);

      const requested = input.articleType as ArticleType | undefined;
      const articleType: ArticleType =
        requested && ARTICLE_TYPES.includes(requested) ? requested : "ranking";
      const sections = sectionsFor(articleType);

      return ok({
        articleType,
        articleTypeLabel: ARTICLE_TYPE_LABEL[articleType],
        types: ARTICLE_TYPES.map((t) => ({ key: t, label: ARTICLE_TYPE_LABEL[t] })),
        sections: sections.map((s) => ({
          id: s.id,
          label: s.label,
          required: s.required,
          purpose: s.purpose,
        })),
        requiredCount: sections.filter((s) => s.required).length,
        opening: OPENING_PATTERNS[articleType],
        paragraphOrder: PARAGRAPH_ORDER,
        styleRules: STYLE_RULES,
        factRules: Object.entries(FACT_LABELS).map(([kind, label]) => ({
          kind,
          label,
          allowed: FACT_TONE_RULES[kind as keyof typeof FACT_TONE_RULES].allowed,
          forbidden: FACT_TONE_RULES[kind as keyof typeof FACT_TONE_RULES].forbidden,
        })),
        knowledgeGuide: Object.entries(KNOWLEDGE_LEVEL_GUIDE).map(([level, guide]) => ({
          level,
          levelLabel: KNOWLEDGE_LEVEL_LABEL[level] ?? level,
          jargon: guide.jargon,
          numbers: guide.numbers,
          structure: guide.structure,
        })),
        conversation: {
          minLength: CONVERSATION_MIN_LENGTH,
          maxLength: CONVERSATION_MAX_LENGTH,
          maxConsecutive: MAX_CONSECUTIVE_BLOCKS,
          basePattern: CONVERSATION_BASE_PATTERN.map((p) => CONVERSATION_PART_LABEL[p] ?? p),
          rule: "会話だけに根拠を置きません。会話で触れた事実は本文にも書きます。読み飛ばした人に伝わらなくなるためです。",
        },
      });
    },
  };
}
