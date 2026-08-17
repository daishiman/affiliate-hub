import { type DomainError, type Result, domainError, err, ok } from "../shared";
import type { MetricKey } from "./metrics";

/**
 * Analytics コンテキスト / ループの種類の登録表。
 *
 * 「測って、比べて、直す」の形は 1 種類ではない。
 *   - ずれを打ち消す向き（負のループ）… いまの改善ループ
 *   - 伸びているものを伸ばす向き（正のループ）… 放っておくと暴走する
 *   - まだ分からないものを試す（探索）
 *   - 悪化に気づく（劣化検知）
 *   - 同じ結果を安く出す（費用の最適化）
 *   - 使う人からの声で直す（改善要望）
 *
 * **いま動くのは記事を良くするループ 1 つだけ。** 残りは
 * 「入る隙間がある」ことだけ示し、中身は作らない。使われない抽象を
 * 先回りで作ると、2 件目が来たときに必ず形が合わず、作った分が無駄になる。
 *
 * 2 件目（改善要望）を入れるときに**この登録表の形はほぼ変えずに済んだ**。
 * 足したのは「何をもって決めるか」（`decisionBasis`）1 つで、
 * これは 1 件目の形が間違っていなかったことの確認になる。
 *
 * --- 種類が違っても書き方は同じ ---
 *
 * どの種類も同じ 8 項目で書く。書けないものはループにしない。
 *   1. 何を見るか（signal）
 *   2. 何と比べるか（baseline）
 *   3. どうなったら動くか（decisionRule）
 *   4. 何を直すか（interventionTarget）
 *   5. 向き（polarity）
 *   6. **歯止めと止め方（guardrails / stopConditions）**
 *   7. 誰が承認するか（approver）
 *   8. **何をもって決めるか（decisionBasis）**
 *
 * 6 は種類ごとに書かせない。**登録した時点で自動的に付く**（`registerLoopKind`）。
 * 歯止めを「書き忘れる」余地を残さないため。
 */

export const LOOP_POLARITIES = ["negative", "positive", "exploratory", "watch", "cost"] as const;
export type LoopPolarity = (typeof LOOP_POLARITIES)[number];

export const LOOP_POLARITY_LABELS: Readonly<Record<LoopPolarity, string>> = {
  negative: "ずれを打ち消す",
  positive: "伸びているものを伸ばす",
  exploratory: "分からないものを試す",
  watch: "悪化に気づく",
  cost: "同じ結果を安く出す",
};

/** 実装の状態。**「まだ無い」ことを画面に出すために型で持つ。** */
export const LOOP_READINESS = ["implemented", "planned"] as const;
export type LoopReadiness = (typeof LOOP_READINESS)[number];

/**
 * 何をもって決めるか。
 *
 * - `comparison` … A と B を比べ、**必要件数に届いてから**決める。
 *   1 件 1 件は標本であり、単体では何も言えない。
 * - `single_case` … **1 件届いた時点で扱いを決める。**
 *   届いた声は標本ではなく、それ自体が対象である。
 *
 * ここを型で分ける理由は、改善要望のような「1 件で 1 件」のものが
 * 比較と件数の仕組み（`loop-run.ts`）へ流れ込むのを**機械で止める**ため。
 * 注意書きで分けると、必ずどこかで混ざる。
 */
export const LOOP_DECISION_BASES = ["comparison", "single_case"] as const;
export type LoopDecisionBasis = (typeof LOOP_DECISION_BASES)[number];

export const LOOP_DECISION_BASIS_LABELS: Readonly<Record<LoopDecisionBasis, string>> = {
  comparison: "件数がそろってから比べて決める",
  single_case: "1 件届いた時点で決める",
};

export type Guardrail = {
  readonly label: string;
  /** 破れない歯止めか、運用で緩められる目安か。 */
  readonly hard: boolean;
};

export type LoopKind = {
  readonly key: string;
  readonly label: string;
  readonly polarity: LoopPolarity;
  readonly readiness: LoopReadiness;
  /** 何をもって決めるか。`single_case` は比較と件数の仕組みに乗らない。 */
  readonly decisionBasis: LoopDecisionBasis;
  /** 何を見るか。 */
  readonly signal: string;
  /** 何と比べるか。 */
  readonly baseline: string;
  /** どうなったら動くか。 */
  readonly decisionRule: string;
  /** 何を直すか。 */
  readonly interventionTarget: string;
  /** 承認する人の役割。**自動適用にはしない。** */
  readonly approver: string;
  /** 止める条件。ここが空のループは登録できない。 */
  readonly stopConditions: readonly string[];
  /** 自動で付く歯止め + この種類に固有の歯止め。 */
  readonly guardrails: readonly Guardrail[];
  /** 動かせるようになる条件（`planned` のときだけ意味がある）。 */
  readonly blockedBy: string | null;
  readonly watchedMetrics: readonly MetricKey[];
};

/**
 * どのループにも必ず付く歯止め。
 *
 * 種類を足す人が書き忘れても付く。ここが「自動で付く」ことが要点で、
 * 各ループの定義に転記させると、必ずどれかで抜ける。
 */
export const UNIVERSAL_GUARDRAILS: readonly Guardrail[] = [
  { label: "適用は人の承認を通す（見た目だけの変更も含む）", hard: true },
  { label: "根拠・広告表示・アクセシビリティは調整対象にしない", hard: true },
  { label: "順位づけの入力に成果や報酬を入れない", hard: true },
  { label: "必要件数に届くまで差があると言わない", hard: true },
  { label: "元の設定へいつでも戻せる状態を保つ", hard: true },
];

/** 向きごとに足す歯止め。正のループだけが特別に重い。 */
const POLARITY_GUARDRAILS: Readonly<Record<LoopPolarity, readonly Guardrail[]>> = {
  negative: [{ label: "同じ軸を続けて直し続けない（3 回で一度止めて見直す）", hard: false }],
  positive: [
    // 正のループは放っておくと必ず行き着くところまで行く。
    // 「伸びているから、もっと」を止める条件を先に決めておく。
    { label: "上限値を先に決める（際限なく強めない）", hard: true },
    { label: "打ち切りの回数を決める（連続適用は 3 回まで）", hard: true },
    { label: "読者体験の下限を割ったら即停止する", hard: true },
  ],
  exploratory: [
    { label: "試す割合の上限を決める（既定は全体の 10%）", hard: true },
    { label: "試験中であることを社内に分かる形で出す", hard: false },
  ],
  watch: [{ label: "検知しても自動では直さない。知らせるところまで", hard: true }],
  cost: [
    { label: "安くする代わりに品質を落とさない（品質指標を同時に見る）", hard: true },
    { label: "費用の判断に読者向けの表示を巻き込まない", hard: true },
  ],
};

/**
 * 決め方ごとに足す歯止め。
 *
 * `single_case` は件数を持たないため、**「1 件を全体の話にしない」**が要る。
 * これが無いと「1 件来たから全画面を直す」が通ってしまう。
 */
const BASIS_GUARDRAILS: Readonly<Record<LoopDecisionBasis, readonly Guardrail[]>> = {
  comparison: [],
  single_case: [
    { label: "1 件を全体の傾向として語らない（件数で語るなら別に数える）", hard: true },
    { label: "届いた文章をそのまま指示として実行しない", hard: true },
  ],
};

/**
 * ループの種類を登録する。
 *
 * 歯止めはここで足す。**定義側に書かせない。**
 */
export function registerLoopKind(
  input: Omit<LoopKind, "guardrails"> & { readonly extraGuardrails?: readonly Guardrail[] },
): Result<LoopKind, DomainError> {
  if (input.stopConditions.length === 0) {
    return err(
      domainError("INVARIANT_VIOLATED", `${input.label} に止める条件がありません。`, {
        suggestedAction:
          "「どうなったら止めるか」を決めずに回し始めると、止めどきを判断する人がいなくなります。",
      }),
    );
  }
  if (input.readiness === "planned" && (input.blockedBy === null || input.blockedBy === "")) {
    return err(
      domainError("VALIDATION_FAILED", `${input.label} が動かせない理由が書かれていません。`, {
        suggestedAction: "「まだ作っていない」で止めず、何が揃えば動かせるかを書いてください。",
      }),
    );
  }
  if (input.decisionBasis === "comparison" && input.watchedMetrics.length === 0) {
    return err(
      domainError("VALIDATION_FAILED", `${input.label} が何の数字を見るのか決まっていません。`, {
        suggestedAction:
          "比べて決めるループは、見る指標を先に決めてください。後から選ぶと、都合のよい指標が選ばれます。",
      }),
    );
  }
  if (input.decisionBasis === "single_case" && input.watchedMetrics.length > 0) {
    return err(
      domainError("INVARIANT_VIOLATED", `${input.label} は 1 件ずつ扱うループです。`, {
        suggestedAction:
          "見る指標を持たせると件数の話になり、1 件で決めるという前提と食い違います。件数で見たいなら別のループとして登録してください。",
      }),
    );
  }
  const { extraGuardrails, ...rest } = input;
  return ok({
    ...rest,
    guardrails: [
      ...UNIVERSAL_GUARDRAILS,
      ...POLARITY_GUARDRAILS[input.polarity],
      ...BASIS_GUARDRAILS[input.decisionBasis],
      ...(extraGuardrails ?? []),
    ],
  });
}

function must(input: Parameters<typeof registerLoopKind>[0]): LoopKind {
  const r = registerLoopKind(input);
  // 下の一覧は固定値であり、条件を満たさないものは書けない。
  if (!r.ok) throw new Error(`ループの登録に失敗しています: ${r.error.message}`);
  return r.value;
}

/**
 * 登録済みのループ。
 *
 * **動くのは `content_improvement` だけ。** 残りは形だけを置いてある。
 * 形だけを置く意味は「入る隙間があること」を示すことで、
 * 中身を先に作ることではない。`product_improvement` は受け取る画面が
 * できた時点で `implemented` に変える（`blockedBy` に条件を書いてある）。
 */
export const LOOP_KINDS: readonly LoopKind[] = [
  must({
    key: "content_improvement",
    label: "記事を良くするループ",
    polarity: "negative",
    readiness: "implemented",
    decisionBasis: "comparison",
    signal: "読了率・スクロール到達・節ごとの滞在時間",
    baseline: "同じ記事の直前の設定、または同じ型の記事の平均",
    decisionRule: "必要件数に届いたうえで、主指標が最小検出差を超えて動いたとき",
    interventionTarget: "記事の構成・見せ方（改善の軸の登録表にあるもの）",
    approver: "編集の責任者",
    stopConditions: [
      "同じ軸で 3 回続けて差が出なかったとき",
      "読者からの指摘が出たとき",
      "品質の指標が下がったとき",
    ],
    blockedBy: null,
    watchedMetrics: ["read_completion_rate", "scroll_depth_p50", "time_on_page_seconds"],
  }),
  must({
    key: "topic_expansion",
    label: "伸びている題材を広げるループ",
    polarity: "positive",
    readiness: "planned",
    decisionBasis: "comparison",
    signal: "題材ごとの表示回数の伸び",
    baseline: "前の期間の同じ題材",
    decisionRule: "伸びが続いていて、品質の指標が下がっていないとき",
    interventionTarget: "次に書く題材の選定",
    approver: "編集の責任者",
    stopConditions: [
      "同じ題材の記事が上限本数に達したとき",
      "読了率が下がり始めたとき",
      "連続 3 回の適用に達したとき",
    ],
    blockedBy: "題材ごとの本数の上限を決めること。上限が無いと同じ題材で埋まる。",
    watchedMetrics: ["page_views", "read_completion_rate"],
  }),
  must({
    key: "angle_exploration",
    label: "まだ試していない切り口を試すループ",
    polarity: "exploratory",
    readiness: "planned",
    decisionBasis: "comparison",
    signal: "切り口ごとの読まれ方（実績が少ない切り口を優先）",
    baseline: "全体の平均",
    decisionRule: "実績の少ない切り口へ、決めた割合だけ配分する",
    interventionTarget: "記事の切り口",
    approver: "編集の責任者",
    stopConditions: ["割り当ての上限に達したとき", "主指標が下限を割ったとき"],
    blockedBy: "配分の仕組み（どの読者にどちらを見せるか）を決めること。",
    watchedMetrics: ["page_views", "read_completion_rate"],
  }),
  must({
    key: "decay_watch",
    label: "古くなった記事に気づくループ",
    polarity: "watch",
    readiness: "planned",
    decisionBasis: "comparison",
    signal: "価格の鮮度・確認期限切れ・訂正件数",
    baseline: "公開直後の同じ記事",
    decisionRule: "下がり幅が閾値を超えたら知らせる（直しはしない）",
    interventionTarget: "確認待ちの一覧への追加",
    approver: "編集の責任者",
    stopConditions: ["知らせたら終わり。自動では直さない"],
    blockedBy: "公開後の指標が貯まること。記録先がスタブのため、まだ推移が取れない。",
    watchedMetrics: ["stale_price_ratio", "correction_count", "review_overdue_count"],
  }),
  must({
    key: "generation_cost",
    label: "AI の費用を下げるループ",
    polarity: "cost",
    readiness: "planned",
    decisionBasis: "comparison",
    signal: "用途ごとの概算費用と、品質チェックの通過率",
    baseline: "同じ用途の前の期間",
    decisionRule: "品質が落ちない範囲で、安いモデルに寄せる",
    interventionTarget: "用途ごとのモデル選択",
    approver: "運営の責任者",
    stopConditions: ["品質チェックの通過率が下がったとき", "訂正件数が増えたとき"],
    blockedBy: "価格表を全モデル分そろえること。未登録のモデルがあると比較できない。",
    watchedMetrics: ["publish_gate_failure_rate", "correction_count"],
  }),
  must({
    // ループの 2 件目。**1 件目の仕組みを流用し、別立てのものを作らない。**
    // 流用するのは状態の持ち方・承認・履歴・可視化で、
    // 統計の仕組み（必要件数・最小検出差・比較）は流用しない。
    // 改善要望は 1 件で 1 件であり、標本ではないため。
    key: "product_improvement",
    label: "使い勝手を直すループ",
    polarity: "negative",
    // 受け取る画面がまだ無いので「動く」とは書かない。
    // 画面ができた時点でここを implemented に変える。
    readiness: "planned",
    decisionBasis: "single_case",
    signal: "管理者から届いた改善要望（うまく動かない / 使いにくい / ほしい機能）",
    baseline: "いまの画面の振る舞い（要望を書いた人が実際に見たもの）",
    decisionRule: "1 件届いた時点で扱いを決める（対応する / 重複 / 対応しない）",
    interventionTarget: "画面・操作・文言（要望の対象になった箇所）",
    approver: "システム管理者",
    stopConditions: [
      "扱いを決めて記録したとき（対応しない・重複・廃棄も終わり）",
      "同じ要望が既にあるとき（重複としてまとめる）",
    ],
    blockedBy: "受け取る画面と一覧・払い出しの仕組み。登録表だけでは要望を受け取れない。",
    // 指標を持たない。件数で判断しないことを型で示す。
    watchedMetrics: [],
  }),
];

const BY_KEY: ReadonlyMap<string, LoopKind> = new Map(LOOP_KINDS.map((l) => [l.key, l]));

export function findLoopKind(key: string): LoopKind | null {
  return BY_KEY.get(key) ?? null;
}

export function implementedLoopKinds(): readonly LoopKind[] {
  return LOOP_KINDS.filter((l) => l.readiness === "implemented");
}

export function plannedLoopKinds(): readonly LoopKind[] {
  return LOOP_KINDS.filter((l) => l.readiness === "planned");
}
