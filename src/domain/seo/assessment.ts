import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * SEO の診断と反映 (改善層)。
 *
 * 「対策する」を型にすると、何をもって対策済みと言えるのかが決まらない。
 * そこでこの層が扱うのは**検証可能な指摘**だけに絞る — 見出しの階層が
 * 飛んでいる、説明文が長すぎる、といった、機械が現物を見て真偽を
 * 判定できるものである。「もっと魅力的に」のような指摘は出さない。
 *
 * この層は公開面を直接書かない (AD-3)。指摘から作るのは**下書き**で、
 * 既存の記事編集・承認経路を必ず通す。自動反映は速いが、誤った指摘が
 * そのまま読者へ出る。
 */

/**
 * 診断の観点。
 *
 * 観測層の集計 (`title`/`description` の掲載順位や CTR) と、公開面の
 * 出力 (見出し・内部リンク・構造化データ) の両方を見る。
 */
export const SEO_CHECK_KINDS = [
  "title",
  "description",
  "heading-structure",
  "internal-link",
  "image-alt",
  "structured-data",
  "canonical",
  "thin-content",
] as const;
export type SeoCheckKind = (typeof SEO_CHECK_KINDS)[number];

export const SEO_CHECK_LABEL: Readonly<Record<SeoCheckKind, string>> = {
  title: "タイトル",
  description: "説明文",
  "heading-structure": "見出しの階層",
  "internal-link": "サイト内リンク",
  "image-alt": "画像の代替文",
  "structured-data": "構造化データ",
  canonical: "正規 URL",
  "thin-content": "内容の薄さ",
};

/**
 * 指摘の重さ。
 *
 * 出す順は**頻度 × 失敗コスト**で決める (提示層の契約)。重さだけで
 * 並べると、めったに起きない致命的な指摘が、毎日起きる中程度の指摘を
 * 覆い隠す。
 */
export const SEO_SEVERITIES = ["critical", "warning", "info"] as const;
export type SeoSeverity = (typeof SEO_SEVERITIES)[number];

export const SEO_SEVERITY_LABEL: Readonly<Record<SeoSeverity, string>> = {
  critical: "直したほうがよい",
  warning: "気になる",
  info: "参考",
};

export const SEO_SEVERITY_WEIGHT: Readonly<Record<SeoSeverity, number>> = {
  critical: 3,
  warning: 2,
  info: 1,
};

/**
 * 診断結果の扱い。
 *
 * `open` は出したまま、`drafted` は下書きを作った、`applied` は承認を経て
 * 公開面へ入った、`dismissed` は運用者が「これは直さない」と判断した。
 *
 * `dismissed` を持つのは、同じ指摘が毎回上位に出続けるのを止めるためで、
 * 単に消すと次の診断でまた現れる。
 */
export const ASSESSMENT_STATES = ["open", "drafted", "applied", "dismissed"] as const;
export type AssessmentState = (typeof ASSESSMENT_STATES)[number];

export const ASSESSMENT_STATE_LABEL: Readonly<Record<AssessmentState, string>> = {
  open: "未対応",
  drafted: "下書きあり",
  applied: "反映済み",
  dismissed: "対応しない",
};

export type SeoFinding = {
  readonly id: string;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly checkKind: SeoCheckKind;
  readonly severity: SeoSeverity;
  readonly state: AssessmentState;
  /** 指摘の中身。何がどうなっているかを、現物の値で書く。 */
  readonly detail: string;
  /**
   * この指摘が真であることを機械が確かめた根拠。
   * 空の指摘は出さない (`validateFinding` が拒否する)。
   */
  readonly evidence: string;
  /** 提案する直し方。下書きの元になる。 */
  readonly suggestion: string | null;
  readonly assessedAt: Date;
};

/**
 * 検証可能な指摘だけを通す門。
 *
 * 根拠が空の指摘を弾くのは、この層の存在理由そのものである。
 * 根拠を任意にすると、「なんとなく良くなりそう」な指摘が混ざり、
 * 運用者はどれを信じてよいか分からなくなって、全体を見なくなる。
 */
export function validateFinding(
  finding: Pick<SeoFinding, "detail" | "evidence">,
): Result<true, DomainError> {
  if (finding.detail.trim() === "") {
    return err(validationError("指摘の中身が空です。", "detail"));
  }
  if (finding.evidence.trim() === "") {
    return err(
      validationError(
        "根拠のない指摘は登録できません。現物のどこを見てそう言えるのかを入れてください。",
        "evidence",
      ),
    );
  }
  return ok(true);
}

/**
 * 指摘を出す順を決める。
 *
 * 重さ × 出現件数で並べ、同点なら記事の URL 名で安定させる。
 * 安定させるのは、同じデータで開き直すたびに順が変わると、
 * 運用者が「昨日の続き」を再開できないためである。
 */
export function rankFindings(findings: readonly SeoFinding[]): readonly SeoFinding[] {
  const countByKind = new Map<SeoCheckKind, number>();
  for (const f of findings) {
    countByKind.set(f.checkKind, (countByKind.get(f.checkKind) ?? 0) + 1);
  }
  const score = (f: SeoFinding): number =>
    SEO_SEVERITY_WEIGHT[f.severity] * (countByKind.get(f.checkKind) ?? 1);
  return [...findings].sort(
    (a, b) =>
      score(b) - score(a) ||
      a.articleSlug.localeCompare(b.articleSlug) ||
      a.checkKind.localeCompare(b.checkKind),
  );
}

/**
 * 根拠の件数がこれに満たない観点は提示層へ出さない。
 *
 * 1 件だけの観測から「傾向」を語ると、たまたま起きた 1 回に
 * 運用者を振り回すことになる。
 */
export const MIN_EVIDENCE_COUNT = 3;
