import {
  type DomainError,
  type ExperimentId,
  type Result,
  type WorkspaceId,
  err,
  ok,
  validationError,
} from "../shared";
import { METRIC_DEFINITIONS, type MetricKey } from "./metrics";

/**
 * Analytics コンテキスト / Experiment (§21 E30)。
 *
 * A/B 比較。「どちらの見せ方がよかったか」を後から言い張らないための型。
 *
 * 決めごとは 2 つで、どちらも**始める前に**決まっている必要がある。
 *   1. 何を見て判断するか（主指標）を 1 つだけ決める
 *   2. 何件たまるまで判断しないかを決める
 *
 * どちらも「終わってから都合のよい数字を選ぶ」ことを防ぐためにある。
 * 指標を後から選べると、必ずうまくいった方の数字が選ばれる。
 *
 * 主指標に収益系（commercial 区分）を選べないようにはしていない。
 * 収益の実験は正当な業務であるため。ただし**その結果を順位に戻す経路は無い**
 * （Ranking は Commercial を入力に取らない。型で禁じている）。
 */
export const EXPERIMENT_STATUSES = ["draft", "running", "concluded", "abandoned"] as const;
export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export const EXPERIMENT_STATUS_LABELS: Readonly<Record<ExperimentStatus, string>> = {
  draft: "準備中",
  running: "実施中",
  concluded: "判定済み",
  abandoned: "取りやめ",
};

export type ExperimentArm = {
  /** 見分けるための名前（例: 「現行」「比較表を上に」）。 */
  readonly name: string;
  /** 何を変えたか。1 文で書く。 */
  readonly change: string;
};

export type Experiment = {
  readonly id: ExperimentId;
  readonly workspaceId: WorkspaceId;
  readonly name: string;
  /** 確かめたいこと。「〜すると〜が増えるはず」の形で書く。 */
  readonly hypothesis: string;
  readonly arms: readonly ExperimentArm[];
  /** 判断に使う指標。1 つだけ。 */
  readonly primaryMetric: MetricKey;
  /** これだけたまるまで判断しない件数。 */
  readonly minimumSamples: number;
  readonly status: ExperimentStatus;
  readonly startedAt: Date | null;
  readonly concludedAt: Date | null;
  /** 判定の結果。勝ちが無かった（差が出なかった）ことも結果として残す。 */
  readonly winningArm: string | null;
};

export function createExperiment(input: {
  id: ExperimentId;
  workspaceId: WorkspaceId;
  name: string;
  hypothesis: string;
  arms: readonly ExperimentArm[];
  primaryMetric: MetricKey;
  minimumSamples: number;
}): Result<Experiment, DomainError> {
  const name = input.name.trim();
  if (name === "") {
    return err(validationError("実験の名前が必要です。", "name"));
  }
  if (input.hypothesis.trim() === "") {
    return err(
      validationError(
        "確かめたいことを書いてください。書けない実験は、終わっても判断できません。",
        "hypothesis",
      ),
    );
  }
  if (input.arms.length < 2) {
    return err(
      validationError("比べる案が 2 つ以上必要です。", "arms"),
    );
  }
  if (new Set(input.arms.map((a) => a.name.trim())).size !== input.arms.length) {
    return err(validationError("案の名前が重複しています。", "arms"));
  }
  // 型が合っていても、画面や外部から来た値は定義表に無いことがある。
  if (!METRIC_DEFINITIONS.some((d) => d.key === input.primaryMetric)) {
    return err(
      validationError(
        "その指標は定義されていません。数え方の決まっている指標だけ選べます。",
        "primaryMetric",
      ),
    );
  }
  if (!Number.isInteger(input.minimumSamples) || input.minimumSamples < 1) {
    return err(
      validationError(
        "判断に必要な件数を 1 以上の整数で入れてください。",
        "minimumSamples",
      ),
    );
  }
  return ok({
    id: input.id,
    workspaceId: input.workspaceId,
    name,
    hypothesis: input.hypothesis.trim(),
    arms: input.arms,
    primaryMetric: input.primaryMetric,
    minimumSamples: input.minimumSamples,
    status: "draft",
    startedAt: null,
    concludedAt: null,
    winningArm: null,
  });
}

export function startExperiment(
  experiment: Experiment,
  at: Date,
): Result<Experiment, DomainError> {
  if (experiment.status !== "draft") {
    return err(
      validationError("準備中の実験だけ開始できます。", "status"),
    );
  }
  return ok({ ...experiment, status: "running", startedAt: at });
}

/**
 * 判定する。
 *
 * **件数が足りないうちは判定させない。** ここが実験の要。
 * 数件の差で「効果があった」と決めてしまうと、
 * その判断が記事の作り方の基準として残り、あとから覆せなくなる。
 */
export function concludeExperiment(
  experiment: Experiment,
  input: { samples: number; winningArm: string | null; at: Date },
): Result<Experiment, DomainError> {
  if (experiment.status !== "running") {
    return err(validationError("実施中の実験だけ判定できます。", "status"));
  }
  if (input.samples < experiment.minimumSamples) {
    return err(
      validationError(
        `まだ判定できません（${input.samples} 件 / 必要 ${experiment.minimumSamples} 件）。`,
        "samples",
      ),
    );
  }
  if (
    input.winningArm !== null &&
    !experiment.arms.some((a) => a.name === input.winningArm)
  ) {
    return err(
      validationError("その案は、この実験の中にありません。", "winningArm"),
    );
  }
  return ok({
    ...experiment,
    status: "concluded",
    concludedAt: input.at,
    winningArm: input.winningArm,
  });
}
