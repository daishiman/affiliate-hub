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
 *
 * **たたき台で実装するのは負のループ 1 つだけ。** 残りは
 * 「入る隙間がある」ことだけ示し、動くものは作らない。
 * 使われない抽象を先回りで作ると、2 件目が来たときに
 * 必ず形が合わず、作った分がまるごと無駄になる。
 *
 * --- 種類が違っても書き方は同じ ---
 *
 * どの種類も同じ 7 項目で書く。書けないものはループにしない。
 *   1. 何を見るか（signal）
 *   2. 何と比べるか（baseline）
 *   3. どうなったら動くか（decisionRule）
 *   4. 何を直すか（interventionTarget）
 *   5. 向き（polarity）
 *   6. **歯止めと止め方（guardrails / stopConditions）**
 *   7. 誰が承認するか（approver）
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
  const { extraGuardrails, ...rest } = input;
  return ok({
    ...rest,
    guardrails: [
      ...UNIVERSAL_GUARDRAILS,
      ...POLARITY_GUARDRAILS[input.polarity],
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
 * **動くのは 1 件目だけ。** 2 件目以降は形だけを置いてある。
 * 形だけを置く意味は「入る隙間があること」を示すことで、
 * 中身を先に作ることではない。
 */
export const LOOP_KINDS: readonly LoopKind[] = [
  must({
    key: "content_improvement",
    label: "記事を良くするループ",
    polarity: "negative",
    readiness: "implemented",
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
    signal: "用途ごとの概算費用と、品質チェックの通過率",
    baseline: "同じ用途の前の期間",
    decisionRule: "品質が落ちない範囲で、安いモデルに寄せる",
    interventionTarget: "用途ごとのモデル選択",
    approver: "運営の責任者",
    stopConditions: ["品質チェックの通過率が下がったとき", "訂正件数が増えたとき"],
    blockedBy: "価格表を全モデル分そろえること。未登録のモデルがあると比較できない。",
    watchedMetrics: ["publish_gate_failure_rate", "correction_count"],
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
