import {
  type ConversationBlockId,
  type DomainError,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";

/**
 * 会話・吹き出しブロック (プラットフォーム層 §16.5 / ブログ層 §11)。
 *
 * 吹き出しは読みやすさを上げる一方で、根拠の所在をあいまいにしやすい。
 * ルールをコードで持ち、破れないようにする。
 */
export type SpeakerRole =
  | "reader_question" // 読者の疑問・不安・反論
  | "guide_answer" // 要約・安心・次の行動
  | "reviewer_note" // 実際に検証した人の感想
  | "expert_caution"; // 資格・専門性に基づく注意

export type ConversationBlock = {
  readonly id: ConversationBlockId;
  readonly workspaceId: WorkspaceId;
  readonly role: SpeakerRole;
  /** 話者名は必ず文字で表示する。色だけで役割を区別しない (§20 アクセシビリティ)。 */
  readonly speakerName: string;
  readonly text: string;
  /** この吹き出しの直前・直後の本文に、同じ事実が書かれているか。 */
  readonly factAlsoInBody: boolean;
};

/** 1 つの吹き出しの文字数。短すぎると意味がなく、長すぎると本文を食う。 */
export const CONVERSATION_MIN_LENGTH = 40;
export const CONVERSATION_MAX_LENGTH = 120;

/** 連続して置ける吹き出しの上限。 */
export const MAX_CONSECUTIVE_BLOCKS = 2;

export function createConversationBlock(input: {
  id: ConversationBlockId;
  workspaceId: WorkspaceId;
  role: SpeakerRole;
  speakerName: string;
  text: string;
  factAlsoInBody: boolean;
}): Result<ConversationBlock, DomainError> {
  if (input.speakerName.trim() === "") {
    return err(
      validationError("話者名が空です。誰の発言か文字で示す必要があります。", "speakerName"),
    );
  }
  const length = [...input.text].length;
  if (length < CONVERSATION_MIN_LENGTH || length > CONVERSATION_MAX_LENGTH) {
    return err(
      validationError(
        `吹き出しは ${CONVERSATION_MIN_LENGTH}〜${CONVERSATION_MAX_LENGTH} 文字にしてください (現在 ${length} 文字)。`,
        "text",
      ),
    );
  }
  return ok({ ...input });
}

export type ConversationIssue = {
  readonly index: number;
  readonly message: string;
};

/**
 * 吹き出しの並びを検査する。
 *
 * 検査する 3 点:
 *   1. 連続数が上限を超えていないか
 *   2. 重要な事実が吹き出しだけに置かれていないか
 *   3. 専門家の注意に、実在の監修者が割り当てられているか
 */
export function validateConversationFlow(
  blocks: readonly ConversationBlock[],
  options: { hasVerifiedExpert: boolean },
): readonly ConversationIssue[] {
  const issues: ConversationIssue[] = [];

  let run = 0;
  blocks.forEach((b, i) => {
    run += 1;
    if (run > MAX_CONSECUTIVE_BLOCKS) {
      issues.push({
        index: i,
        message: `吹き出しが ${run} 個続いています。${MAX_CONSECUTIVE_BLOCKS} 個までにして、間に本文を入れてください。`,
      });
    }
    if (!b.factAlsoInBody && (b.role === "reviewer_note" || b.role === "expert_caution")) {
      issues.push({
        index: i,
        message: `「${b.speakerName}」の発言にある事実が本文にありません。吹き出しだけに根拠を置かないでください。`,
      });
    }
    if (b.role === "expert_caution" && !options.hasVerifiedExpert) {
      issues.push({
        index: i,
        message: "専門家の注意を載せるには、実在の監修者を記事に割り当ててください。架空の専門家は作れません。",
      });
    }
  });

  return issues;
}

/**
 * 基本パターン (ブログ層 §11.3)。
 *
 *   本文(事実) → ReaderQuestion → 本文(根拠と説明) → GuideAnswer → 注意枠(例外)
 *
 * AI 生成のプロンプトが、この順序をそのまま指示に使う。
 */
export const CONVERSATION_BASE_PATTERN: readonly (SpeakerRole | "body" | "note")[] = [
  "body",
  "reader_question",
  "body",
  "guide_answer",
  "note",
];
