import { type DomainError, type Result, domainError, err, ok } from "../shared";
import { assertFeedbackAllowed, type FeedbackTarget } from "./feedback-policy";
import type { MetricKey } from "./metrics";

/**
 * Analytics コンテキスト / 改善の軸の登録表。
 *
 * **「何を変えて試せるか」の一覧は、このファイルだけが持つ。**
 *
 * --- なぜ登録表にするか ---
 *
 * 改善したい対象は、文章の構成・見出しの言い回し・配色・比較表の列順・
 * CTA の置き場所…と際限なく増える。これを 1 つずつ
 * 「この場合はこう分析して、こう直す」と書き足していくと、
 * 3 つ目あたりで分析・比較・承認の処理が枝分かれし、
 * 4 つ目からは足すたびにループ本体を触ることになる。
 *
 * そこで**軸を足す側が 3 つのことを宣言し、ループ本体は無変更**とする。
 *   1. 候補の値をどうやって作るか (`candidateSource`)
 *   2. どこに効かせるか (`appliedAt`)
 *   3. どの指標で良し悪しを見るか (`evaluatedBy`)
 *
 * この 3 つが揃っていれば、「見せる → 測る → 比べる → 提案する」は
 * 軸の中身を知らないまま同じ手順で回せる。
 * 実際に軸を 1 つ足すと何ファイル触るかは
 * `docs/architecture/changeability-scenarios.md` ⑭ に実測して書いてある。
 *
 * --- 調整してはいけないもの ---
 *
 * 数字が良くなるなら何を変えてもよい、とはしない。
 * 根拠を示すこと・広告であることの表示・アクセシビリティ・
 * 順位づけの入力は、**軸として登録できない**（`NON_OPTIMIZABLE`）。
 * 「同意ボタンの目立ち方」も同様で、これを軸にした瞬間に
 * 同意率を上げるダークパターンが「改善」として通ってしまう。
 */

/** 軸のまとまり。画面の並べ方と、同時に変えてよい数の数え方に使う。 */
export const OPTIMIZATION_GROUPS = ["text", "visual", "navigation"] as const;
export type OptimizationGroup = (typeof OPTIMIZATION_GROUPS)[number];

export const OPTIMIZATION_GROUP_LABELS: Readonly<Record<OptimizationGroup, string>> = {
  text: "文章・内容",
  visual: "見た目・配置",
  navigation: "導線・構造",
};

/**
 * 候補の値をどうやって作るか。
 *
 * `preset` : あらかじめ決めた選択肢から選ぶ（配色・表示形式など）
 * `numeric`: 範囲の中の数値（文字数・節の数など）
 * `llm`    : AI に案を作らせる（見出しの言い回し・導入文など）
 *
 * `llm` の軸は、生成物が必ず人の承認を通る。
 */
export const CANDIDATE_SOURCES = ["preset", "numeric", "llm"] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/**
 * どこに効かせるか。
 *
 * `prompt`   : 記事を作るときの指示に混ぜる
 * `structure`: 記事の構成（節の並び・数）として効く
 * `layout`   : 画面の組み方として効く
 * `theme`    : デザイントークンの選択として効く
 * `linking`  : 内部リンク・関連記事の出し方として効く
 */
export const APPLY_POINTS = ["prompt", "structure", "layout", "theme", "linking"] as const;
export type ApplyPoint = (typeof APPLY_POINTS)[number];

export type OptimizationDimension = {
  readonly key: string;
  readonly label: string;
  readonly group: OptimizationGroup;
  /** 何のために変えるのか。1 文で書けない軸は登録しない。 */
  readonly why: string;
  readonly candidateSource: CandidateSource;
  readonly appliedAt: ApplyPoint;
  /** 良し悪しを見る指標。1 つ以上。 */
  readonly evaluatedBy: readonly MetricKey[];
  /**
   * 何を直す軸か。記事の書き直しか、次の題材選びか。
   * **順位づけ・推奨・品質の合格ラインは選べない**（下の `assertRegistrable`）。
   */
  readonly feedbackTarget: FeedbackTarget;
  /** 元に戻せるか。戻せない軸は登録しない（試して駄目なら戻すのが前提）。 */
  readonly reversible: true;
};

/**
 * 軸にしてはいけないもの。
 *
 * ここに書いたものは「効果が出るなら変えてよい」の対象外とする。
 * 数字を理由に緩められる余地を残さないため、一覧を型ではなく
 * **値として持ち、登録時に必ず突き当てる**。
 */
export const NON_OPTIMIZABLE: readonly {
  readonly key: string;
  readonly label: string;
  readonly reason: string;
}[] = [
  {
    key: "evidence_requirement",
    label: "根拠を示すこと",
    reason:
      "根拠を減らすと文章は短く読みやすくなり、数字は良くなりやすい。良くなるからこそ調整対象にしない。",
  },
  {
    key: "disclosure_presence",
    label: "広告であることの表示",
    reason: "景品表示法（ステマ告示）に関わる。表示の有無・目立ち方を試験の対象にしない。",
  },
  {
    key: "accessibility_level",
    label: "アクセシビリティ (WCAG 2.2 AA)",
    reason: "コントラストや操作性を落とすと見た目の印象は上がることがある。下限は動かさない。",
  },
  {
    key: "ranking_inputs",
    label: "順位づけの入力",
    reason: "報酬を順位に入れないという決まりを、改善ループを迂回路にして破らないため。",
  },
  {
    key: "consent_prominence",
    label: "同意の選択肢の目立ち方",
    reason: "許可の側を目立たせれば同意率は上がる。それは改善ではなくダークパターン。",
  },
  {
    key: "factuality_labeling",
    label: "事実と推測の書き分け",
    reason: "推測を断定に変えると説得力は上がる。上がるが、嘘に近づく。",
  },
];

const NON_OPTIMIZABLE_KEYS: ReadonlySet<string> = new Set(NON_OPTIMIZABLE.map((n) => n.key));

/** 改善ループが触ってよい直し先。順位・推奨・合格ラインは入っていない。 */
const ALLOWED_FEEDBACK_TARGETS: ReadonlySet<FeedbackTarget> = new Set<FeedbackTarget>([
  "article_revision",
  "topic_selection",
]);

/**
 * 軸として登録してよいか。
 *
 * 登録表への追記は人が書くが、**通ってよいかは機械が決める**。
 * 見張り役を人のレビューに置くと、急いでいる日に通る。
 */
export function assertRegistrable(
  dimension: OptimizationDimension,
): Result<OptimizationDimension, DomainError> {
  if (NON_OPTIMIZABLE_KEYS.has(dimension.key)) {
    const banned = NON_OPTIMIZABLE.find((n) => n.key === dimension.key);
    return err(
      domainError("INVARIANT_VIOLATED", `${banned?.label} は改善の軸にできません。`, {
        suggestedAction: banned?.reason,
      }),
    );
  }
  if (dimension.evaluatedBy.length === 0) {
    return err(
      domainError("VALIDATION_FAILED", `${dimension.label} を見る指標が決まっていません。`, {
        suggestedAction:
          "何を見て良くなったと言うかを先に決めてください。決めずに始めると、後から都合のよい数字が選ばれます。",
      }),
    );
  }
  if (dimension.why.trim() === "") {
    return err(
      domainError("VALIDATION_FAILED", `${dimension.label} を変える理由が書かれていません。`),
    );
  }
  if (!ALLOWED_FEEDBACK_TARGETS.has(dimension.feedbackTarget)) {
    return err(
      domainError(
        "COMMERCIAL_INPUT_REJECTED",
        `${dimension.label} の直し先が改善ループの範囲を超えています。`,
        {
          suggestedAction:
            "改善ループが直せるのは記事の書き直しと題材選びまでです。順位づけ・推奨商品・品質の合格ラインは、数字の結果で動かしません。",
        },
      ),
    );
  }
  // 収益の指標を編集判断へ戻す経路が無いことは feedback-policy が既に持っている。
  // ここで同じ判定を書き直さず、そのまま突き当てる（1 つの決まりを 2 か所に書かない）。
  for (const metric of dimension.evaluatedBy) {
    const allowed = assertFeedbackAllowed(metric, dimension.feedbackTarget);
    if (!allowed.ok) return err(allowed.error);
  }
  return ok(dimension);
}

const D = (d: OptimizationDimension): OptimizationDimension => d;

/**
 * 登録済みの改善の軸。
 *
 * 3 つのまとまりに分かれているが、**ループ本体はまとまりを見ない**。
 * まとまりは画面の並べ方と、同時に変えてよい数の数え方だけに使う。
 */
export const OPTIMIZATION_DIMENSIONS: readonly OptimizationDimension[] = [
  // --- 文章・内容 ---
  D({
    key: "section_order",
    label: "節の並び",
    group: "text",
    why: "先に結論を出すか、比較を先に見せるかで、読み進められる位置が変わる。",
    candidateSource: "preset",
    appliedAt: "structure",
    evaluatedBy: ["read_completion_rate", "scroll_depth_p50"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "lead_length",
    label: "導入文の長さ",
    group: "text",
    why: "長い導入は本題まで届かない。短すぎると何の記事か分からない。",
    candidateSource: "numeric",
    appliedAt: "prompt",
    evaluatedBy: ["scroll_depth_p50", "time_on_page_seconds"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "heading_wording",
    label: "見出しの言い回し",
    group: "text",
    why: "同じ内容でも、見出しが具体的だと目的の節にたどり着ける。",
    candidateSource: "llm",
    appliedAt: "prompt",
    evaluatedBy: ["read_completion_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "sentence_length",
    label: "一文の長さ",
    group: "text",
    why: "長い文は読み飛ばされる。短すぎると説明が足りない。",
    candidateSource: "numeric",
    appliedAt: "prompt",
    evaluatedBy: ["read_completion_rate", "time_on_page_seconds"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "content_angle",
    label: "記事の切り口",
    group: "text",
    why: "同じ商品でも、用途から入るか価格から入るかで届く読者が変わる。",
    candidateSource: "preset",
    appliedAt: "prompt",
    evaluatedBy: ["page_views", "read_completion_rate"],
    feedbackTarget: "topic_selection",
    reversible: true,
  }),
  D({
    key: "comparison_columns",
    label: "比較表の列と並び",
    group: "text",
    why: "読者が気にしている項目が右端にあると、比較の役に立たない。",
    candidateSource: "preset",
    appliedAt: "structure",
    evaluatedBy: ["time_on_page_seconds", "read_completion_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "claim_placement",
    label: "主張と根拠の見せ方",
    group: "text",
    why: "根拠を畳むか並べて出すかで、読みやすさと納得しやすさが変わる。根拠を減らす方向には動かせない。",
    candidateSource: "preset",
    appliedAt: "structure",
    evaluatedBy: ["read_completion_rate", "evidence_coverage_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "cta_wording",
    label: "CTA の文言",
    group: "text",
    why: "何が起きるか分かる文言かどうかで、押した後の離脱が変わる。煽り表現は文体規則が別で禁じる。",
    candidateSource: "llm",
    appliedAt: "prompt",
    evaluatedBy: ["read_completion_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "article_length",
    label: "記事全体の長さ",
    group: "text",
    why: "網羅すると長くなり、長いと読まれない。どこで折り合うかを測る。",
    candidateSource: "numeric",
    appliedAt: "prompt",
    evaluatedBy: ["read_completion_rate", "time_on_page_seconds"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "image_placement",
    label: "画像の入れどころ",
    group: "text",
    why: "文章だけが続くと読む気が落ちる。入れすぎると本題が遠のく。",
    candidateSource: "preset",
    appliedAt: "structure",
    evaluatedBy: ["scroll_depth_p50"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),

  // --- 見た目・配置 ---
  D({
    key: "brand_theme",
    label: "配色",
    group: "visual",
    why: "読み物として落ち着いて読めるかは配色で変わる。下限（コントラスト）は別で守る。",
    candidateSource: "preset",
    appliedAt: "theme",
    evaluatedBy: ["read_completion_rate", "time_on_page_seconds"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "typography_scale",
    label: "文字の大きさと行間",
    group: "visual",
    why: "本文が小さい・行間が詰まっていると、長い記事は読み切れない。",
    candidateSource: "preset",
    appliedAt: "theme",
    evaluatedBy: ["read_completion_rate", "scroll_depth_p50"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "content_density",
    label: "余白の詰め方",
    group: "visual",
    why: "詰めると一画面に多く入るが、まとまりが見えにくくなる。",
    candidateSource: "preset",
    appliedAt: "layout",
    evaluatedBy: ["scroll_depth_p50"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "body_max_width",
    label: "本文の横幅",
    group: "visual",
    why: "1 行が長すぎると次の行の頭を見失う。",
    candidateSource: "numeric",
    appliedAt: "layout",
    evaluatedBy: ["read_completion_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "ranking_card_form",
    label: "順位の見せ方",
    group: "visual",
    why: "縦に積むか、表にするか、カードにするかで、比べやすさが変わる。",
    candidateSource: "preset",
    appliedAt: "layout",
    evaluatedBy: ["time_on_page_seconds", "read_completion_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "first_view_composition",
    label: "最初の画面に何を置くか",
    group: "visual",
    why: "開いた瞬間に「何の記事か」が分からないと、そのまま戻られる。",
    candidateSource: "preset",
    appliedAt: "layout",
    evaluatedBy: ["scroll_depth_p50", "page_views"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),

  // --- 導線・構造 ---
  D({
    key: "internal_link_placement",
    label: "内部リンクの置き場所",
    group: "navigation",
    why: "本文の途中に挟むか、節の終わりにまとめるかで、読み終える前に離れるかが変わる。",
    candidateSource: "preset",
    appliedAt: "linking",
    evaluatedBy: ["read_completion_rate", "return_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "related_articles_form",
    label: "関連記事の出し方",
    group: "navigation",
    why: "並べる数と選び方で、次に読まれるかが変わる。",
    candidateSource: "preset",
    appliedAt: "linking",
    evaluatedBy: ["return_rate", "page_views"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "toc_form",
    label: "目次の出し方",
    group: "navigation",
    why: "長い記事では目次の有無で、目的の節に着けるかが変わる。",
    candidateSource: "preset",
    appliedAt: "layout",
    evaluatedBy: ["read_completion_rate", "scroll_depth_p50"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
  D({
    key: "template_by_article_type",
    label: "記事種別ごとの型",
    group: "navigation",
    why: "比較記事とレビュー記事で同じ型を使うと、どちらも中途半端になる。",
    candidateSource: "preset",
    appliedAt: "structure",
    evaluatedBy: ["read_completion_rate"],
    feedbackTarget: "article_revision",
    reversible: true,
  }),
];

export const OPTIMIZATION_DIMENSION_KEYS: readonly string[] = OPTIMIZATION_DIMENSIONS.map(
  (d) => d.key,
);

const BY_KEY: ReadonlyMap<string, OptimizationDimension> = new Map(
  OPTIMIZATION_DIMENSIONS.map((d) => [d.key, d]),
);

export function findOptimizationDimension(key: string): OptimizationDimension | null {
  return BY_KEY.get(key) ?? null;
}

export function optimizationDimensionsOf(
  group: OptimizationGroup,
): readonly OptimizationDimension[] {
  return OPTIMIZATION_DIMENSIONS.filter((d) => d.group === group);
}

/** その軸を見る指標の一覧。重複は畳む。 */
export function metricsWatchedBy(
  dimensions: readonly OptimizationDimension[],
): readonly MetricKey[] {
  return [...new Set(dimensions.flatMap((d) => d.evaluatedBy))];
}
