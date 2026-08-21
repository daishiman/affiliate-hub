import {
  type DomainError,
  type Result,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";
import { COMPARISON_VERDICTS } from "./improvement";
import { UNIVERSAL_GUARDRAILS, findLoopKind, type LoopKind } from "./loop-kinds";
import type { LoopRun } from "./loop-run";
import { METRIC_DEFINITIONS } from "./metrics";
import { NON_OPTIMIZABLE, assertRegistrable, findOptimizationDimension } from "./optimization";
import { MAX_SIMULTANEOUS_DIMENSIONS, type VariantSpec } from "./variant-spec";

/**
 * Analytics コンテキスト / **記録として残してよいか**の判定。
 *
 * --- なぜ入口の判定と別に要るのか ---
 *
 * `createVariantSpec` / `createLoopRun` は「作るとき」に一覧を突き当てる。
 * だが保存先は、作られた値ではなく**渡された値**を受け取る。
 * 入口を通っていない値をそのまま `save〜` へ渡せるので、
 * 入口の判定だけでは「広告であることの表示」を軸にした記録が
 * **保存先に書けてしまう**。一覧が入口でしか守っていない状態である。
 *
 * だから同じ一覧を保存側でも突き当てる。ここは「念のため」ではなく、
 * **保存先に置いてよいものの定義**であり、保存する実装（D1・見本・将来の別の先）
 * すべてがこの 1 ファイルを通る。通らない実装があれば、それは新しい抜け道になる。
 *
 * --- 一覧をここに書き写さない ---
 *
 * 判定に使う一覧（調整してはいけないもの 6 / 外せない約束 5 / 改善の軸 20 /
 * ループの種類 6）は、どれも正本を直接参照する。写すと、正本から 1 件消えた日に
 * ここだけが古いまま「守っているつもり」で残る。
 *
 * ただし**一覧を回して一覧由来の禁止を確かめる検査は空回りする**（REQ-IM12 で
 * 一度そうなった）。一覧そのものが縮んでいないことは、検査の側が
 * 文字列で固定して見る（`tests/domain/loop-record.test.ts`）。
 *
 * 規範: docs/spec/03-分析・解析基盤仕様.md §14.2 / §14.3 / §14.4 / §14.5、REQ-IM13
 */

/** 保存先に置いてよい設定か。**軸の一覧をここで突き当てる。** */
export function assertRecordableVariantSpec(spec: VariantSpec): Result<VariantSpec, DomainError> {
  if (spec.id.trim() === "") {
    return err(validationError("設定に id が必要です。", "id"));
  }
  if (spec.label.trim() === "") {
    return err(validationError("見せ方の設定に名前が必要です。", "label"));
  }
  if (spec.settings.length === 0) {
    return err(
      validationError(
        "設定が 1 つもありません。既定と同じものは、比べる対象になりません。",
        "settings",
      ),
    );
  }

  const seen = new Set<string>();
  for (const setting of spec.settings) {
    if (seen.has(setting.dimensionKey)) {
      return err(
        validationError(`同じ軸が 2 回入っています: ${setting.dimensionKey}`, "settings"),
      );
    }
    seen.add(setting.dimensionKey);
    const allowed = assertRecordableDimension(setting.dimensionKey);
    if (!allowed.ok) return err(allowed.error);
  }

  // 承認は 2 つの欄に分かれている。片方だけ入った行は「誰が承認したか分からない
  // 承認済み」または「日時の無い承認済み」になり、どちらも承認の記録にならない。
  const hasApprover = spec.approvedBy !== null && spec.approvedBy.trim() !== "";
  const hasApprovedAt = spec.approvedAt !== null;
  if (hasApprover !== hasApprovedAt) {
    return err(
      validationError(
        "承認した人と承認した日時は、両方そろっていないと記録できません。",
        "approvedBy",
      ),
    );
  }
  return ok(spec);
}

/**
 * その軸を記録に書いてよいか。
 *
 * **`NON_OPTIMIZABLE` を先に見る。** 登録表に無いことを理由に断つと、
 * 登録表へ書き足した日に通ってしまう。禁じられている理由は
 * 「表に載っていないから」ではなく「調整の対象にしないと決めたから」である。
 */
export function assertRecordableDimension(dimensionKey: string): Result<true, DomainError> {
  const banned = NON_OPTIMIZABLE.find((n) => n.key === dimensionKey);
  if (banned !== undefined) {
    return err(
      domainError("INVARIANT_VIOLATED", `${banned.label} は改善の軸にできません。`, {
        suggestedAction: banned.reason,
      }),
    );
  }
  const dimension = findOptimizationDimension(dimensionKey);
  if (dimension === null) {
    return err(
      domainError("VALIDATION_FAILED", `登録されていない軸です: ${dimensionKey}`, {
        suggestedAction:
          "変えられるものは domain/analytics/optimization.ts の登録表が正本です。表に足してから使ってください。",
      }),
    );
  }
  const registrable = assertRegistrable(dimension);
  if (!registrable.ok) return err(registrable.error);
  return ok(true);
}

/**
 * 外せない約束が 1 つも欠けていないループの種類か。
 *
 * 約束は `registerLoopKind` が自動で付けるので、**登録の経路を通った種類なら
 * 必ず 5 件そろっている**。逆に言えば、そろっていない種類は登録を通っていない。
 * 一覧の値をそのまま書いた `LoopKind` の形は誰でも作れるので、
 * 記録として残す直前にもう一度突き当てる。
 *
 * 記録が先に残ると、**約束が外れていたことが後から分からなくなる**。
 * 記録には「どのループか」しか入らないため、後で読む人は
 * そのときの登録表を見て「約束は付いていたはず」と読む。
 */
export function assertGuardrailsIntact(kind: LoopKind): Result<true, DomainError> {
  const attached = new Set(kind.guardrails.map((g) => g.label));
  const missing = UNIVERSAL_GUARDRAILS.filter((g) => !attached.has(g.label));
  if (missing.length > 0) {
    return err(
      domainError(
        "INVARIANT_VIOLATED",
        `${kind.label} から外せない約束が欠けています: ${missing.map((g) => g.label).join("・")}`,
        {
          suggestedAction:
            "外せない約束は registerLoopKind が自動で付けます。付いていないものは登録の経路を通っていません。",
        },
      ),
    );
  }
  return ok(true);
}

/**
 * 保存先に置いてよい 1 周の記録か。
 *
 * 比べている 2 つの設定を**呼び出し側が読み出して渡す**。
 * id だけで判定できる形にすると、保存先に存在しない設定や
 * 未承認の設定を指した記録が書けてしまう。
 */
export function assertRecordableLoopRun(
  run: LoopRun,
  refs: { readonly baseline: VariantSpec | null; readonly candidate: VariantSpec | null },
): Result<LoopRun, DomainError> {
  const kind = findLoopKind(run.loopKindKey);
  if (kind === null) {
    return err(
      domainError("VALIDATION_FAILED", `登録されていないループです: ${run.loopKindKey}`, {
        suggestedAction: "ループの種類は domain/analytics/loop-kinds.ts が正本です。",
      }),
    );
  }
  if (kind.decisionBasis !== "comparison") {
    return err(
      domainError("INVARIANT_VIOLATED", `${kind.label} は比べて決めるループではありません。`, {
        suggestedAction:
          "このループは 1 件ずつ扱います。件数がそろうのを待つ仕組みには乗せられません。",
      }),
    );
  }
  if (kind.readiness !== "implemented") {
    return err(
      domainError("NOT_IMPLEMENTED", `${kind.label} はまだ動かせません。`, {
        suggestedAction: kind.blockedBy ?? undefined,
      }),
    );
  }

  const intact = assertGuardrailsIntact(kind);
  if (!intact.ok) return err(intact.error);

  if (run.baselineSpecId === run.candidateSpecId) {
    return err(validationError("同じ設定どうしは比べられません。", "candidateSpecId"));
  }
  if (run.changedDimensions.length === 0) {
    return err(validationError("2 つの設定に違いがありません。", "changedDimensions"));
  }
  if (run.changedDimensions.length > MAX_SIMULTANEOUS_DIMENSIONS) {
    return err(
      domainError(
        "INVARIANT_VIOLATED",
        `一度に変えている軸が多すぎます（${run.changedDimensions.length} 個 / 上限 ${MAX_SIMULTANEOUS_DIMENSIONS} 個）。`,
      ),
    );
  }
  for (const key of run.changedDimensions) {
    const allowed = assertRecordableDimension(key);
    if (!allowed.ok) return err(allowed.error);
  }

  if (!METRIC_DEFINITIONS.some((d) => d.key === run.primaryMetric)) {
    return err(validationError("その指標は定義されていません。", "primaryMetric"));
  }
  if (!Number.isInteger(run.minimumSamples) || run.minimumSamples < 1) {
    return err(
      validationError("判定に必要な件数を 1 以上の整数で決めてください。", "minimumSamples"),
    );
  }

  for (const [field, spec] of [
    ["baselineSpecId", refs.baseline],
    ["candidateSpecId", refs.candidate],
  ] as const) {
    if (spec === null) {
      return err(
        validationError(
          "比べる設定が保存先にありません。設定を先に保存してください。",
          field,
        ),
      );
    }
    // 適用には必ず人の承認が要る（仕様 §14.5）。見た目だけの変更も同じ。
    if (spec.approvedBy === null || spec.approvedAt === null) {
      return err(
        domainError("INVARIANT_VIOLATED", `${spec.label} はまだ承認されていません。`, {
          suggestedAction:
            "見た目だけの変更でも人の承認を通します。承認前の設定で比較を始めると、何がいつ変わったのかを誰も把握していない状態になります。",
        }),
      );
    }
  }

  return assertRunStateShape(run);
}

/**
 * 進み具合と、そこに付いていてよい欄の対応。
 *
 * **「判定済みなのに判定が無い」行を書けなくする。** 書けると、
 * 判定保留のまま終わったものが、一覧では終わったものとして並ぶ。
 */
function assertRunStateShape(run: LoopRun): Result<LoopRun, DomainError> {
  switch (run.status) {
    case "draft":
      if (run.startedAt !== null) {
        return err(validationError("準備中のものに開始日時は入りません。", "startedAt"));
      }
      if (run.verdict !== null) {
        return err(validationError("準備中のものに判定は入りません。", "verdict"));
      }
      return ok(run);
    case "running":
      if (run.startedAt === null) {
        return err(validationError("実施中のものには開始日時が要ります。", "startedAt"));
      }
      if (run.verdict !== null) {
        return err(validationError("実施中のものに判定は入りません。", "verdict"));
      }
      return ok(run);
    case "concluded":
      if (run.concludedAt === null) {
        return err(validationError("判定済みのものには判定日時が要ります。", "concludedAt"));
      }
      if (run.verdict === null || !COMPARISON_VERDICTS.includes(run.verdict)) {
        return err(validationError("判定済みのものには判定が要ります。", "verdict"));
      }
      if (run.verdict === "pending") {
        return err(
          domainError("INVARIANT_VIOLATED", "判定保留のまま終わらせられません。", {
            suggestedAction:
              "件数が足りるまで実施中のままにしてください。途中で終わらせても判断はできません。",
          }),
        );
      }
      return ok(run);
    case "stopped":
      if (run.concludedAt === null) {
        return err(validationError("打ち切ったものには日時が要ります。", "concludedAt"));
      }
      if (run.stoppedReason === null || run.stoppedReason.trim() === "") {
        return err(validationError("打ち切る理由が必要です。", "stoppedReason"));
      }
      return ok(run);
  }
}

/** 保存先に置いてよい観測値か。 */
export function assertRecordableObservation(input: {
  readonly runId: string;
  readonly baselineValue: number;
  readonly baselineSamples: number;
  readonly candidateValue: number;
  readonly candidateSamples: number;
  readonly run: LoopRun | null;
}): Result<true, DomainError> {
  if (input.run === null) {
    return err(
      validationError(
        "その 1 周が保存先にありません。観測値だけを先に置くことはできません。",
        "runId",
      ),
    );
  }
  if (input.run.status === "draft") {
    return err(
      domainError("INVARIANT_VIOLATED", "まだ始まっていない比較に観測値は入りません。", {
        suggestedAction:
          "始める前の数字を入れると、比較の期間が後から決まることになります。先に開始してください。",
      }),
    );
  }
  for (const [field, value] of [
    ["baselineValue", input.baselineValue],
    ["candidateValue", input.candidateValue],
  ] as const) {
    if (!Number.isFinite(value)) {
      return err(validationError("観測値が数字になっていません。", field));
    }
  }
  for (const [field, value] of [
    ["baselineSamples", input.baselineSamples],
    ["candidateSamples", input.candidateSamples],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) {
      return err(validationError("件数は 0 以上の整数です。", field));
    }
  }
  return ok(true);
}
