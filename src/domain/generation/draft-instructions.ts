import type { GenerationInput } from "./generation-input";
import { PROMPT_BLOCKS, type PromptBlockId } from "./prompt-blocks";
import { OUTPUT_REQUIRED_FIELDS, SELF_REPORTED_FIELDS } from "./output-contract";

/**
 * 指示文そのものを組み立てる（生成基盤設計 §1-1・§1-3）。
 *
 * `prompt-blocks.ts` は「7 つの塊があること」という決まりを持つ。
 * ここはその決まりに従って**実際の文面を作る**。
 *
 * ここに置いた理由:
 *   指示文の中身は業務の決めごと（何を書かせ、何を書かせないか）であって、
 *   提供元の都合ではない。提供元ごとのアダプタへ置くと、
 *   提供元を替えたときに「書かせない決まり」まで一緒に入れ替わってしまう。
 *
 * ここに入れてはならないもの:
 *   - 外部から取り込んだ文章（`untrustedContext` の側へ入れる）
 *   - 報酬に関する数字（`GenerationInput` の型に入れられないので構造的に不可能）
 */

export type DraftInstructionBlock = {
  readonly id: PromptBlockId;
  readonly label: string;
  readonly text: string;
};

function joinLines(lines: readonly (string | null)[]): string {
  return lines.filter((l): l is string => l !== null).join("\n");
}

const RENDERERS: Readonly<Record<PromptBlockId, (i: GenerationInput) => string>> = {
  role: (i) =>
    joinLines([
      `あなたは「${i.authorPersona.role}」の立場で書きます。`,
      "素材に無い数値・仕様・体験を書かないでください。",
      "分からないことは埋めずに、決めきれなかったこととして書き出してください。",
    ]),

  absolute_rules: (i) =>
    joinLines([
      "次のことは、どんな場合でも守ってください。例外はありません。",
      "1. 渡された素材に無い事実を書かない。",
      "2. 自分で試していないことを、試したように書かない。",
      i.forbiddenExpressions.length === 0
        ? "3. 禁止する言い回しの指定はありません。"
        : `3. 次の言い回しは使わない: ${i.forbiddenExpressions.join("・")}`,
      "4. 決めた形（下の「出力の形」）以外では返さない。",
    ]),

  materials: (i) =>
    joinLines([
      "使ってよい素材は次のとおりです。ここに無いことは書けません。",
      `主題: ${i.subject}`,
      `商品（承認済み ${i.products.length} 件）: ${i.products.map((p) => p.label).join("・") || "なし"}`,
      `主張（承認済み ${i.claims.length} 件）:`,
      ...i.claims.map((c) => `  - [${c.id}] ${c.statement}`),
      `根拠 ${i.evidence.length} 件・実測の記録 ${i.testRuns.length} 件を別途参照します。`,
      i.testRuns.length === 0
        ? "実測はしていません。「試した」と書けません。"
        : "実測の記録があるものだけ、実際に試した書き方ができます。",
    ]),

  audience_and_channel: (i) =>
    joinLines([
      `読者: ${i.audiencePersona.knowledgeLevel}`,
      `購買段階: ${i.purchaseStage}`,
      `出し先: ${i.channel}`,
      `長さ: ${i.length.kind}（${i.length.minChars}〜${i.length.maxChars} 文字）`,
      `切り口: ${i.angle}`,
      `この記事の目的: ${i.contentPurpose}`,
      i.cta === null
        ? "行動の呼びかけは置きません。"
        : `行動の呼びかけ: ${i.cta.kind}「${i.cta.phrase}」`,
    ]),

  structure: (i) =>
    joinLines([
      `記事の型: ${i.articleTemplate.type}`,
      `節をこの並びで書いてください: ${i.articleTemplate.sectionIds.join(" → ")}`,
      "節を足したり、まとめたり、順番を変えたりしないでください。",
      i.rankingModel === null
        ? "順位は扱いません。順位づけの記述を入れないでください。"
        : `順位は「${i.rankingModel.id}」の決め方に従い、何をどう重みづけたかを本文に書いてください。`,
    ]),

  style: (i) =>
    joinLines([
      `このブログ（${i.siteBlueprint.slug}）の書き方に従ってください。`,
      "事実は「実測」「出典あり」「推測」を書き分け、推測にはそう分かる書き方をしてください。",
      `広告表示は次の文言をそのまま使ってください: ${i.disclosure}`,
    ]),

  output_contract: () =>
    joinLines([
      `次の ${OUTPUT_REQUIRED_FIELDS.length} 個の欄をすべて含む JSON だけを返してください。`,
      `欄: ${OUTPUT_REQUIRED_FIELDS.join("・")}`,
      `このうち ${SELF_REPORTED_FIELDS.join("・")} は自己申告です。`,
      "点をつけても合否には使いません。良く見せるために数字を上げないでください。",
    ]),
};

/**
 * 7 つの塊を順番どおりに組み立てる。
 *
 * 塊を落とさないことは `PROMPT_BLOCKS` の並びをそのまま使うことで保証する。
 * ここで手書きの配列を持つと、塊を足したときに片方だけ古くなる。
 */
export function renderInstructionBlocks(input: GenerationInput): readonly DraftInstructionBlock[] {
  return [...PROMPT_BLOCKS]
    .sort((a, b) => a.order - b.order)
    .map((block) => ({
      id: block.id,
      label: block.label,
      text: `## ${block.order}. ${block.label}\n${RENDERERS[block.id](input)}`,
    }));
}

/** 組み立てた指示文を 1 本にする。 */
export function renderInstructions(input: GenerationInput): string {
  return renderInstructionBlocks(input)
    .map((b) => b.text)
    .join("\n\n");
}

/**
 * 出力の上限をどれだけ取るかを、頼んだ長さから決める。
 *
 * 固定値にすると、短い記事でも長い記事と同じ費用を見積もることになる。
 * 日本語はおおよそ 1 トークン = 1.5 文字として数え、
 * 決めた形（20 個の欄）の分を足す。
 */
export function maxOutputTokensFor(input: GenerationInput): number {
  const bodyTokens = Math.ceil(input.length.maxChars / 1.5);
  return Math.min(16_000, bodyTokens + 2_000);
}
