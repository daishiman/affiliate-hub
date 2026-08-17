import {
  type DomainError,
  type Provenance,
  type Result,
  domainError,
  err,
  ok,
  validationError,
} from "../shared";
import {
  type OptimizationDimension,
  assertRegistrable,
  findOptimizationDimension,
} from "./optimization";

/**
 * Analytics コンテキスト / 見せ方の設定（Variant Spec）。
 *
 * **配色も、見出しの並びも、比較表の列順も、同じ 1 つの形で表す。**
 * 「色の実験」と「構成の実験」を別の仕組みで持つと、
 * 比較・記録・承認・巻き戻しがそれぞれ 2 通りになり、
 * 3 つ目の種類が出た時点で破綻する。
 *
 * 中身はただの `軸 → 値` の集まりで、ループ本体は値の意味を知らない。
 * 意味を知っているのは、その軸を効かせる側（生成の指示・画面の組み方）だけ。
 *
 * --- 記録の仕組みを二重に作らない ---
 *
 * 「なぜこの記事はこの構成なのか」を後から辿れる必要があるが、
 * そのために新しい履歴の仕組みを作らない。
 * 既にある**由来 (`Provenance`)** をそのまま持たせる。
 * 出どころが「AI の提案」なのか「人が決めた」のかも、
 * 由来の `sourceType` で区別できる。
 */

/** 設定の値。文字・数値・真偽のいずれか。構造を持つ値は入れない。 */
export type VariantValue = string | number | boolean;

export type VariantSetting = {
  readonly dimensionKey: string;
  readonly value: VariantValue;
};

export type VariantSpec = {
  readonly id: string;
  /** 人が見分けるための名前。 */
  readonly label: string;
  readonly settings: readonly VariantSetting[];
  /** この設定がどこから来たか。AI の提案か、人が決めたか。 */
  readonly provenance: Provenance;
  /** 人が承認したか。**見た目の変更も承認を通す。** */
  readonly approvedBy: string | null;
  readonly approvedAt: Date | null;
};

/**
 * 同時に変えてよい軸の数。
 *
 * 3 つ以上を一度に変えると、良くなっても何が効いたか分からない。
 * 分からないまま「この組み合わせが良い」を積み上げると、
 * 次に 1 つ戻したいときに戻せなくなる。
 *
 * 2 という数字に強い根拠は無い。**根拠が無いことを承知で上限を置く**方が、
 * 上限を置かずに「気をつける」より確実に効く。
 */
export const MAX_SIMULTANEOUS_DIMENSIONS = 2;

export function createVariantSpec(input: {
  id: string;
  label: string;
  settings: readonly VariantSetting[];
  provenance: Provenance;
}): Result<VariantSpec, DomainError> {
  if (input.label.trim() === "") {
    return err(validationError("見せ方の設定に名前が必要です。", "label"));
  }
  if (input.settings.length === 0) {
    return err(
      validationError(
        "設定が 1 つもありません。既定と同じものは、比べる対象になりません。",
        "settings",
      ),
    );
  }
  const seen = new Set<string>();
  for (const s of input.settings) {
    if (seen.has(s.dimensionKey)) {
      return err(validationError(`同じ軸が 2 回指定されています: ${s.dimensionKey}`, "settings"));
    }
    seen.add(s.dimensionKey);

    const dimension = findOptimizationDimension(s.dimensionKey);
    if (dimension === null) {
      return err(
        domainError("VALIDATION_FAILED", `登録されていない軸です: ${s.dimensionKey}`, {
          suggestedAction:
            "変えられるものは domain/analytics/optimization.ts の登録表が正本です。表に足してから使ってください。",
        }),
      );
    }
    // 表に載っていても、通ってよい軸かをその都度突き当てる。
    // 表への追記だけで抜け道ができないようにするため。
    const registrable = assertRegistrable(dimension);
    if (!registrable.ok) return err(registrable.error);

    const typeCheck = checkValueShape(dimension, s.value);
    if (!typeCheck.ok) return err(typeCheck.error);
  }
  return ok({
    id: input.id,
    label: input.label.trim(),
    settings: input.settings,
    provenance: input.provenance,
    approvedBy: null,
    approvedAt: null,
  });
}

function checkValueShape(
  dimension: OptimizationDimension,
  value: VariantValue,
): Result<true, DomainError> {
  if (dimension.candidateSource === "numeric" && typeof value !== "number") {
    return err(validationError(`${dimension.label} は数値で指定します。`, dimension.key));
  }
  if (dimension.candidateSource !== "numeric" && typeof value === "number") {
    return err(
      validationError(`${dimension.label} は選択肢から選びます。`, dimension.key),
    );
  }
  return ok(true);
}

/**
 * 人が承認する。
 *
 * **見た目だけの変更でも承認を通す。** 「色を変えるくらいは自動で」を許すと、
 * 何がいつ変わったのかを誰も把握していない状態になり、
 * 読者からの指摘に答えられなくなる。
 */
export function approveVariantSpec(
  spec: VariantSpec,
  input: { approvedBy: string; at: Date },
): Result<VariantSpec, DomainError> {
  if (input.approvedBy.trim() === "") {
    return err(validationError("承認した人が必要です。", "approvedBy"));
  }
  if (spec.approvedBy !== null) {
    return err(domainError("CONFLICT", "この設定は既に承認されています。"));
  }
  return ok({ ...spec, approvedBy: input.approvedBy.trim(), approvedAt: input.at });
}

/** 2 つの設定の差。何を変えた比較なのかは、常にこの差で表す。 */
export type VariantDiff = {
  readonly dimensionKey: string;
  readonly label: string;
  readonly baseline: VariantValue | null;
  readonly candidate: VariantValue | null;
};

export function diffVariantSpecs(
  baseline: VariantSpec,
  candidate: VariantSpec,
): readonly VariantDiff[] {
  const keys = [
    ...new Set([
      ...baseline.settings.map((s) => s.dimensionKey),
      ...candidate.settings.map((s) => s.dimensionKey),
    ]),
  ];
  const diffs: VariantDiff[] = [];
  for (const key of keys) {
    const b = baseline.settings.find((s) => s.dimensionKey === key)?.value ?? null;
    const c = candidate.settings.find((s) => s.dimensionKey === key)?.value ?? null;
    if (b === c) continue;
    diffs.push({
      dimensionKey: key,
      label: findOptimizationDimension(key)?.label ?? key,
      baseline: b,
      candidate: c,
    });
  }
  return diffs;
}

/**
 * 比べてよい組み合わせか。
 *
 * 一度に変えた軸が多すぎる比較は、始める前に止める。
 * 終わってから「これは何が効いたか分からない実験でした」と書いても、
 * その頃には結果が独り歩きしている。
 */
export function assertComparable(
  baseline: VariantSpec,
  candidate: VariantSpec,
): Result<readonly VariantDiff[], DomainError> {
  const diffs = diffVariantSpecs(baseline, candidate);
  if (diffs.length === 0) {
    return err(
      validationError("2 つの設定に違いがありません。比べる意味がありません。", "settings"),
    );
  }
  if (diffs.length > MAX_SIMULTANEOUS_DIMENSIONS) {
    return err(
      domainError(
        "INVARIANT_VIOLATED",
        `一度に変えている軸が多すぎます（${diffs.length} 個 / 上限 ${MAX_SIMULTANEOUS_DIMENSIONS} 個）。`,
        {
          suggestedAction: `変えているのは ${diffs
            .map((d) => d.label)
            .join("・")} です。どれが効いたか分からなくなるため、${MAX_SIMULTANEOUS_DIMENSIONS} 個までに絞ってください。`,
        },
      ),
    );
  }
  return ok(diffs);
}

/**
 * この設定になった経緯を 1 文で言う。
 *
 * 「なぜこの記事はこの構成なのか」に答えるための文であり、
 * 管理画面にも読者向けにもそのまま出せる書き方にしておく。
 */
export function explainVariantSpec(spec: VariantSpec): string {
  const items = spec.settings
    .map((s) => `${findOptimizationDimension(s.dimensionKey)?.label ?? s.dimensionKey}=${s.value}`)
    .join("・");
  const approved =
    spec.approvedBy === null ? "未承認（まだ適用できません）" : `${spec.approvedBy} が承認`;
  return `${spec.label}（${items}）。出どころ: ${spec.provenance.sourceName}、${approved}。`;
}
