import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * Product Intelligence コンテキスト / 商品同一性。
 *
 * 「同じ商品か」を判定する順序を 1 箇所に閉じる (プラットフォーム層 §12.1)。
 * この順序を UI や取り込み処理へ散らすと、画面ごとに違う商品が同一扱いされる。
 */
export type IdentityKeyKind =
  | "gtin" // GTIN / JAN / EAN
  | "asin"
  | "model_number" // メーカー型番
  | "brand_and_name" // ブランド + 正式商品名
  | "merchant_sku"
  | "name_similarity"; // 商品名類似度 (最後の手段)

/** 優先順位。配列の先頭ほど強い。判定は必ずこの順で行う。 */
export const IDENTITY_KEY_PRIORITY: readonly IdentityKeyKind[] = [
  "gtin",
  "asin",
  "model_number",
  "brand_and_name",
  "merchant_sku",
  "name_similarity",
];

export type ProductIdentityKey = {
  readonly kind: IdentityKeyKind;
  readonly value: string;
};

export type IdentityMatch = {
  readonly matched: boolean;
  readonly by: IdentityKeyKind | null;
  /** 0.0〜1.0。name_similarity 以外は 1.0 (完全一致)。 */
  readonly confidence: number;
  /** 利用者へ表示する判定理由。 */
  readonly reason: string;
};

/** 商品名類似度で同一とみなす下限。これ未満は「候補」であって「同一」ではない。 */
export const NAME_SIMILARITY_THRESHOLD = 0.92;

/**
 * 2 つの商品の同一性を判定する。
 *
 * 強いキーが 1 つでも一致すれば同一。強いキーが両方にあって食い違う場合は、
 * それより弱いキーを見ない (別商品と確定する)。型番違いを名前類似で
 * 同一にすると、読者に別の商品を売ることになる。
 */
export function matchIdentity(
  a: readonly ProductIdentityKey[],
  b: readonly ProductIdentityKey[],
  nameSimilarity?: number,
): IdentityMatch {
  for (const kind of IDENTITY_KEY_PRIORITY) {
    if (kind === "name_similarity") continue;

    const av = a.filter((k) => k.kind === kind).map((k) => normalize(k.value));
    const bv = b.filter((k) => k.kind === kind).map((k) => normalize(k.value));
    if (av.length === 0 || bv.length === 0) continue;

    if (av.some((v) => bv.includes(v))) {
      return { matched: true, by: kind, confidence: 1, reason: `${labelOf(kind)}が一致しました。` };
    }
    return {
      matched: false,
      by: kind,
      confidence: 0,
      reason: `${labelOf(kind)}が異なるため別商品と判定しました。`,
    };
  }

  if (typeof nameSimilarity === "number") {
    const matched = nameSimilarity >= NAME_SIMILARITY_THRESHOLD;
    return {
      matched,
      by: "name_similarity",
      confidence: nameSimilarity,
      reason: matched
        ? `商品名がほぼ一致しました (類似度 ${nameSimilarity.toFixed(2)})。識別子が無いため確認を推奨します。`
        : `商品名の類似度が低いため別商品と判定しました (類似度 ${nameSimilarity.toFixed(2)})。`,
    };
  }

  return {
    matched: false,
    by: null,
    confidence: 0,
    reason: "比較できる識別子がありません。JANコードか型番を登録してください。",
  };
}

const LABELS: Record<IdentityKeyKind, string> = {
  gtin: "JAN/EANコード",
  asin: "ASIN",
  model_number: "メーカー型番",
  brand_and_name: "ブランドと商品名",
  merchant_sku: "販売店の商品コード",
  name_similarity: "商品名の類似度",
};

export function labelOf(kind: IdentityKeyKind): string {
  return LABELS[kind];
}

/** 表記ゆれを吸収する。全角英数・空白・ハイフンの違いで別商品にしないため。 */
function normalize(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s　]/g, "")
    .replace(/[-‐‑‒–—―ー]/g, "-");
}

export function createIdentityKey(
  kind: IdentityKeyKind,
  value: string,
): Result<ProductIdentityKey, DomainError> {
  const v = value.trim();
  if (v === "") return err(validationError(`${labelOf(kind)}が空です。`, "value"));
  if (kind === "gtin" && !/^\d{8}$|^\d{12,14}$/.test(v)) {
    return err(validationError("JAN/EANコードは8桁または12〜14桁の数字で入力してください。", "value"));
  }
  if (kind === "asin" && !/^[A-Z0-9]{10}$/i.test(v)) {
    return err(validationError("ASINは英数字10桁で入力してください。", "value"));
  }
  return ok({ kind, value: v });
}
