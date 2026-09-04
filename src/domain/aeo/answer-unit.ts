import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * 回答エンジン最適化 (AEO・改善層)。
 *
 * SEO が「検索結果の一覧で選ばれる」ための対策なのに対し、AEO は
 * **回答そのものとして引用される**ための対策である。読者が一覧を
 * 経由せず答えだけを受け取る経路が増えたため、記事の中に
 * 「そのまま引用できる単位」があるかどうかが結果を分ける。
 *
 * SEO と同じく、この層は公開面を直接書かない (AD-3)。出すのは
 * 検証可能な指摘と下書きまでで、既存の承認経路を通す。
 */

/**
 * 引用されうる単位の型。
 *
 * `definition` は語の意味、`direct-answer` は問いへの短い答え、
 * `step-list` は手順、`comparison` は比較、`fact` は数値や事実。
 *
 * 型を持つのは、同じ記事でも問いの形によって引用される部分が違うため
 * である。1 記事 = 1 回答として扱うと、どの部分が引かれたのかが
 * 分からず、直す場所を決められない。
 */
export const ANSWER_UNIT_KINDS = [
  "definition",
  "direct-answer",
  "step-list",
  "comparison",
  "fact",
] as const;
export type AnswerUnitKind = (typeof ANSWER_UNIT_KINDS)[number];

export const ANSWER_UNIT_KIND_LABEL: Readonly<Record<AnswerUnitKind, string>> = {
  definition: "語の意味",
  "direct-answer": "問いへの答え",
  "step-list": "手順",
  comparison: "比較",
  fact: "事実・数値",
};

/**
 * 引用されやすさを損なう典型。診断の観点になる。
 */
export const AEO_GAP_KINDS = [
  "no-direct-answer",
  "answer-too-long",
  "buried-answer",
  "unsourced-claim",
  "ambiguous-subject",
  "missing-qa-markup",
] as const;
export type AeoGapKind = (typeof AEO_GAP_KINDS)[number];

export const AEO_GAP_LABEL: Readonly<Record<AeoGapKind, string>> = {
  "no-direct-answer": "問いに直接答えている箇所がない",
  "answer-too-long": "答えが長すぎて引用できない",
  "buried-answer": "答えが記事の奥に埋もれている",
  "unsourced-claim": "出どころのない断定がある",
  "ambiguous-subject": "主語が曖昧で単体では意味が通らない",
  "missing-qa-markup": "問答の構造化データがない",
};

/**
 * 引用単位の長さの上限 (文字)。
 *
 * これを超えると、回答エンジンは要約し直すか、丸ごと使わない。
 * どちらの場合も、書き手が意図した言い回しは読者へ届かない。
 */
export const MAX_ANSWER_UNIT_LENGTH = 300;

/**
 * 答えがこの比率より奥にあると「埋もれている」と判定する。
 *
 * 記事の後半にある答えは、回答エンジンにとっても読者にとっても
 * 見つけにくい。
 */
export const BURIED_ANSWER_THRESHOLD = 0.5;

export type AnswerUnit = {
  readonly id: string;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly kind: AnswerUnitKind;
  /** この単位が答えている問い。 */
  readonly question: string;
  /** そのまま引用されうる本文。 */
  readonly answer: string;
  /** 記事全体に対する出現位置 (0..1)。埋もれの判定に使う。 */
  readonly positionRatio: number;
  /** 出どころ。断定に根拠が要るのは SEO 側と同じ理由。 */
  readonly sourceRef: string | null;
  readonly extractedAt: Date;
};

/**
 * ブログ全体の AEO の構え。
 *
 * 記事ごとの単位とは別に持つのは、「このブログは何に答える場所か」が
 * 記事をまたいで一貫していないと、どの記事も中途半端に引かれるだけで
 * 終わるためである。
 */
export type SiteAeoProfile = {
  readonly siteSlug: string;
  /** このブログが答えると宣言する領域。 */
  readonly topicScope: string;
  /** 誰の問いに答えるか。 */
  readonly audience: string;
  /** 出典として名乗る主体。構造化データの発行元になる。 */
  readonly publisherName: string;
  /** 回答エンジン向けの構造化データを出すか。 */
  readonly structuredDataEnabled: boolean;
  readonly updatedAt: Date;
};

/**
 * 引用単位として成立しているかを検査する。
 *
 * 問いと答えの両方を要求するのは、答えだけの断片は
 * **何に対する答えか**が分からず、単体で引用されると意味が変わるためである。
 */
export function validateAnswerUnit(
  unit: Pick<AnswerUnit, "question" | "answer">,
): Result<true, DomainError> {
  if (unit.question.trim() === "") {
    return err(validationError("この単位が答えている問いを入れてください。", "question"));
  }
  if (unit.answer.trim() === "") {
    return err(validationError("答えが空です。", "answer"));
  }
  if (unit.answer.length > MAX_ANSWER_UNIT_LENGTH) {
    return err(
      validationError(
        `答えは ${MAX_ANSWER_UNIT_LENGTH} 文字までにしてください。これより長いと、そのまま引用されません。`,
        "answer",
      ),
    );
  }
  return ok(true);
}

/**
 * 引用単位から、引用されやすさを損なっている点を挙げる。
 *
 * 機械が現物を見て真偽を判定できるものだけを返す。「もっと分かりやすく」
 * のような指摘は、直したかどうかを誰も確かめられないので出さない。
 */
export function detectGaps(unit: AnswerUnit): readonly AeoGapKind[] {
  const gaps: AeoGapKind[] = [];
  if (unit.answer.length > MAX_ANSWER_UNIT_LENGTH) gaps.push("answer-too-long");
  if (unit.positionRatio > BURIED_ANSWER_THRESHOLD) gaps.push("buried-answer");
  if (unit.kind === "fact" && unit.sourceRef === null) gaps.push("unsourced-claim");
  // 指示語で始まる答えは、前の文を伴わないと意味が通らない。
  if (/^(これ|それ|あれ|この|その|あの|こう|そう)/.test(unit.answer.trim())) {
    gaps.push("ambiguous-subject");
  }
  return gaps;
}
