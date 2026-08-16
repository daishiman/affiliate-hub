import type { ClaimType } from "../evidence/claim";

/**
 * 文章仕様 (ブログ層 §10)。
 *
 * 「どう書くか」をコードで持つ理由:
 *   - AI 生成のプロンプトがここを参照する (指示文を 2 箇所に書かない)
 *   - 生成物の自動確認がここを参照する (書き方と検査を同じ定義から作る)
 *   - 人が書くときの手引き (docs/writing) もここから生成できる
 */

/** 段落の基本順序。プロンプトの骨格に使う。 */
export const PARAGRAPH_ORDER: readonly { step: string; description: string }[] = [
  { step: "結論", description: "先に答えを言う。読み進める価値があるか判断できるようにする" },
  { step: "理由", description: "なぜその結論になるかを 1 文で" },
  { step: "根拠", description: "測定値・公式情報・引用のいずれか。種類を明示する" },
  { step: "具体例", description: "読者の場面に置き換えられる形で" },
  { step: "例外", description: "当てはまらない条件。ここを省くと後で訂正になる" },
  { step: "読者にとっての意味", description: "その事実がこの読者の判断にどう効くか" },
  { step: "次の行動", description: "読み終えて何をすればよいか" },
];

/**
 * 事実の種類ごとの表示ラベル (ブログ層 §10.2)。
 *
 * 「メーカー公称値」と「当サイトの測定」を同じ見た目で並べると、
 * 読者は区別できない。ラベルを型に紐づけて、表示側で必ず出す。
 */
export const FACT_LABELS: Readonly<Record<ClaimType, string>> = {
  official: "メーカー公称値",
  measured: "当サイトの測定",
  experience: "テスターの主観",
  inference: "以上から当サイトでは〜と判断",
  external: "利用者レビュー",
  commercial: "販売店提供情報",
};

/** 事実の種類ごとの、書いてよい語尾・書いてはいけない語尾。 */
export const FACT_TONE_RULES: Readonly<
  Record<ClaimType, { allowed: readonly string[]; forbidden: readonly string[] }>
> = {
  official: { allowed: ["〜とされています", "〜と公表されています"], forbidden: ["〜でした（実測）"] },
  measured: { allowed: ["〜でした", "〜を記録しました"], forbidden: ["〜のはずです"] },
  experience: { allowed: ["〜と感じました", "〜という印象でした"], forbidden: ["〜です（断定）"] },
  inference: { allowed: ["〜と考えられます", "〜と判断しました"], forbidden: ["〜です（断定）"] },
  external: { allowed: ["〜という声があります"], forbidden: ["〜が定説です"] },
  commercial: { allowed: ["〜時点の価格です"], forbidden: ["最安です"] },
};

/** 文体ルール (ブログ層 §10.3)。生成プロンプトと編集チェックの共通の元。 */
export const STYLE_RULES: readonly { id: string; rule: string; why: string }[] = [
  { id: "one_point_per_paragraph", rule: "1 段落 1 論点", why: "読者が要点を拾える" },
  { id: "1to3_sentences", rule: "1 段落は原則 1〜3 文", why: "スマートフォンで読めるようにする" },
  { id: "heading_states_conclusion", rule: "見出しだけで結論が分かる", why: "拾い読みでも判断できる" },
  { id: "explain_jargon_first_use", rule: "専門用語は初回に説明する", why: "初心者を置き去りにしない" },
  { id: "units_and_conditions", rule: "数字には単位と測定条件を付ける", why: "比較できない数字を出さない" },
  { id: "absolute_dates", rule: "「先日」ではなく具体的な日付を書く", why: "後から読む人にも通じる" },
  { id: "no_unfounded_superlatives", rule: "「絶対」「完全」「最強」を根拠なく使わない", why: "景表法上の問題と信頼の低下" },
  { id: "drawback_with_workaround", rule: "デメリットには影響する人と回避策を付ける", why: "不安だけ残さない" },
  { id: "material_before_cta", rule: "CTA の前に判断材料を出す", why: "読者が納得してから行動できる" },
];

/**
 * 読者の理解度ごとの書き分け。
 *
 * 同じ事実でも、読者ペルソナの knowledge_level で説明の深さを変える。
 * ここを可変にしておくと、1 つの根拠から 3 種類の文章を作れる。
 */
export const KNOWLEDGE_LEVEL_GUIDE = {
  beginner: {
    jargon: "初出で必ず言い換える。カタカナ語は日本語の説明を添える",
    numbers: "数字は「つまり何ができるか」に翻訳して併記する",
    structure: "選び方 → 候補 → 結論 の順。仕様の羅列を先に置かない",
  },
  intermediate: {
    jargon: "一般的な用語は説明を省く。分野固有の用語だけ補う",
    numbers: "数値と条件をそのまま示す。比較対象を併記する",
    structure: "結論 → 差分 → 根拠 の順",
  },
  expert: {
    jargon: "説明しない。正確な用語を使う",
    numbers: "測定条件・機材・ばらつきまで示す",
    structure: "測定方法 → 生データ → 解釈 の順",
  },
} as const;

/** 記事タイプ別の書き出しの型。プロンプトの冒頭指示に使う。 */
export const OPENING_PATTERNS = {
  ranking: "「用途Xなら商品Aが最有力です」と 1 文で言い切り、続けて評価基準の要約を置く",
  review: "「誰に向くか / 向かないか」を 1 文ずつ置き、総合評価を示す",
  comparison: "「AとBの決定的な違いは○○です」と差分を 1 文で示す",
  guide: "「この記事を読み終えると○○ができます」と完了状態を示す",
  tool: "「このツールで○○が分かります」と出力を先に示す",
} as const;
