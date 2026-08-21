import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialProductRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "@/application/ports";
import type { PageRequest } from "@/application/ports/common";
import { type Claim, type Evidence, type TestRun, createClaim, createEvidence } from "@/domain/evidence";
import { type Product, createProduct } from "@/domain/product";
import {
  type ClaimId,
  type EvidenceId,
  type ProductId,
  type TestRunId,
  type WorkspaceId,
  domainError,
  err,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { registerStub } from "../../stub-registry";
import { SAMPLE_PRODUCTS, SAMPLE_WORKSPACE_ID } from "./ranking-sample-repository";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * ランキングの見本と**同じ 4 商品**を扱う。別々の見本を持つと、
 * 「順位表には出るのに商品ページが無い」というちぐはぐが起きる。
 *
 * 保存 (`save`) は成功したふりをせず必ず失敗する。
 * 差し替えは `src/infrastructure/composition.ts` の 4 行だけ。
 */
const stub = registerStub({
  id: "persistence:product-sample",
  port: "商品・主張・根拠・検証記録の保存先",
  label: "商品と根拠（見本データ）",
  // 先に来るのは表ではなく入口。商品・主張・根拠を登録する画面と操作がまだ無く、
  // どのユースケースからも `save` が呼ばれていない。ここで保存先だけ本物にしても、
  // 中身を作る手段が無いので、開いた人には常に空の一覧が出るだけになる。
  blockedBy:
    "商品・主張・根拠を登録する入口（画面と操作）の追加。そのうえで products / claims / evidence / test_runs テーブルの追加とマイグレーション",
});

export function sampleProductNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const CATEGORY = taggedString<"CategoryId">("cat_laptop");
const RETRIEVED_AT = new Date("2026-07-01T00:00:00Z");

/** 仕様の項目名は 4 商品で必ず揃える。揃わない項目は比較表の列にならない。 */
const SPEC_BY_PRODUCT: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  p_alpha_15: {
    画面の大きさ: "15.3インチ",
    重さ: "1.68kg",
    書き出し時間: "6分12秒",
    連続稼働時間: "7.5時間",
    メモリ: "32GB",
  },
  p_beta_14: {
    画面の大きさ: "14.0インチ",
    重さ: "1.29kg",
    書き出し時間: "8分40秒",
    連続稼働時間: "9.0時間",
    メモリ: "16GB",
  },
  p_gamma_16: {
    画面の大きさ: "16.2インチ",
    重さ: "2.14kg",
    書き出し時間: "5分05秒",
    連続稼働時間: "5.5時間",
    メモリ: "64GB",
    // この 1 つだけ他に無い項目。比較表では「揃っていない項目」として別枠に出る。
    冷却方式: "デュアルファン",
  },
  p_delta_13: {
    画面の大きさ: "13.4インチ",
    重さ: "1.05kg",
    書き出し時間: "12分30秒",
    連続稼働時間: "11.0時間",
    メモリ: "16GB",
  },
};

const DESCRIPTION_BY_PRODUCT: Readonly<Record<string, string>> = {
  p_alpha_15: "書き出しの速さと持ち運びやすさの釣り合いが取れた機種。",
  p_beta_14: "軽さを優先しつつ、日常の編集に足りる性能を持つ機種。",
  p_gamma_16: "最も速いが重い。据え置きで使う人向け。",
  p_delta_13: "最も軽く電池が長持ちする。書き出しは時間がかかる。",
};

function build(id: ProductId, name: string): Product {
  const key = String(id);
  const built = createProduct({
    id,
    workspaceId: WS,
    brand: name.split(" ")[0] ?? name,
    name,
    manufacturer: null,
    categoryId: CATEGORY,
    identityKeys: [{ kind: "model_number", value: key.toUpperCase() }],
    description: DESCRIPTION_BY_PRODUCT[key] ?? null,
    specifications: SPEC_BY_PRODUCT[key] ?? {},
    provenance: {
      sourceType: "manual",
      sourceName: "見本データ（編集部が手で入れたもの）",
      sourceUrl: null,
      retrievedAt: RETRIEVED_AT,
      validUntil: null,
      confidence: 0.5,
      permittedUsage: "見本表示のみ。実データではありません",
    },
  });
  if (!built.ok) {
    // 見本が不変条件を満たさないのは欠陥。黙って動かさない。
    throw new Error(`見本の商品が不正です (${key}): ${built.error.message}`);
  }
  return built.value;
}

const PRODUCTS: readonly Product[] = SAMPLE_PRODUCTS.map((p) => build(p.id, p.name));

// --- 根拠と主張 ------------------------------------------------------------

function evidenceOf(id: string, title: string, owner: string, summary: string): Evidence {
  const built = createEvidence({
    id: taggedString<"EvidenceId">(id) as EvidenceId,
    workspaceId: WS,
    type: "test_result",
    title,
    sourceOwner: owner,
    capturedAt: RETRIEVED_AT,
    urlOrAssetId: `sample://${id}`,
    excerptOrSummary: summary,
    licenseOrPermission: "自社検証のため利用可",
    integrityHash: `sample-${id}`,
  });
  if (!built.ok) throw new Error(`見本の根拠が不正です (${id}): ${built.error.message}`);
  return built.value;
}

const EVIDENCE: readonly Evidence[] = [
  evidenceOf(
    "ev_export_time",
    "同一素材の書き出し時間（3回の中央値）",
    "編集部",
    "4K・10分の素材を同じ設定で3回書き出し、中央値を記録した見本の値です。",
  ),
  evidenceOf(
    "ev_weight",
    "本体重量の実測",
    "編集部",
    "電源アダプタを含まない本体のみを台ばかりで測った見本の値です。",
  ),
];

function claimOf(
  id: string,
  statement: string,
  type: Claim["type"],
  evidenceIds: readonly string[],
  confidence: number,
): Claim {
  const built = createClaim({
    id: taggedString<"ClaimId">(id) as ClaimId,
    workspaceId: WS,
    statement,
    type,
    evidenceIds: evidenceIds.map((e) => taggedString<"EvidenceId">(e) as EvidenceId),
    confidence,
    validFrom: RETRIEVED_AT,
    validUntil: null,
    verifiedBy: null,
  });
  if (!built.ok) throw new Error(`見本の主張が不正です (${id}): ${built.error.message}`);
  return built.value;
}

/**
 * 商品ごとの主張。
 *
 * **事実（measured）と推測（inference）を必ず混ぜてある。**
 * 画面が両者を同じ見た目で出してしまう不具合を、見本の時点で見つけるため。
 */
const CLAIMS_BY_PRODUCT: Readonly<Record<string, readonly Claim[]>> = {
  p_alpha_15: [
    claimOf("cl_alpha_export", "4K10分の素材を6分12秒で書き出せます。", "measured", ["ev_export_time"], 0.9),
    claimOf("cl_alpha_fit", "1日中持ち歩く用途にも耐えると考えられます。", "inference", [], 0.6),
  ],
  p_beta_14: [
    claimOf("cl_beta_weight", "本体の重さは1.29kgです。", "measured", ["ev_weight"], 0.95),
  ],
  p_gamma_16: [
    claimOf("cl_gamma_export", "4K10分の素材を5分05秒で書き出せます。", "measured", ["ev_export_time"], 0.9),
  ],
  p_delta_13: [
    claimOf("cl_delta_weight", "本体の重さは1.05kgです。", "measured", ["ev_weight"], 0.95),
  ],
};

// --- ポートの実装 ----------------------------------------------------------

function saveRejected(what: string) {
  return err(
    domainError("NOT_IMPLEMENTED", `${what}の保存はまだできません。`, {
      suggestedAction: "保存先の用意（テーブルの追加）が済むまでお待ちください。",
      details: { blockedBy: stub.blockedBy },
    }),
  );
}

export function createSampleProductRepository(): EditorialProductRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: ProductId) {
      return ok(PRODUCTS.find((p) => p.id === id) ?? null);
    },
    async findByIdentityKey(_ws: WorkspaceId, keyType: string, value: string) {
      return ok(
        PRODUCTS.find((p) => p.identityKeys.some((k) => k.kind === keyType && k.value === value)) ??
          null,
      );
    },
    async search(
      _ws: WorkspaceId,
      query: { text?: string; categoryId?: string },
      page: PageRequest,
    ) {
      const text = query.text?.trim().toLowerCase() ?? "";
      const items = PRODUCTS.filter((p) => {
        if (query.categoryId !== undefined && String(p.categoryId) !== query.categoryId) {
          return false;
        }
        if (text === "") return true;
        return `${p.brand} ${p.name} ${p.description ?? ""}`.toLowerCase().includes(text);
      }).slice(0, page.limit);
      return ok({ items, nextCursor: null });
    },
    async save() {
      return saveRejected("商品");
    },
  });
}

export function createSampleClaimRepository(): EditorialClaimRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: ClaimId) {
      const all = Object.values(CLAIMS_BY_PRODUCT).flat();
      return ok(all.find((c) => c.id === id) ?? null);
    },
    async listByProduct(_ws: WorkspaceId, productId: ProductId) {
      return ok(CLAIMS_BY_PRODUCT[String(productId)] ?? []);
    },
    async listExpiringBefore() {
      // 見本には期限切れを入れていない。0 件は「無い」であって未実装ではない。
      return ok([]);
    },
    async save() {
      return saveRejected("主張");
    },
  });
}

export function createSampleEvidenceRepository(): EditorialEvidenceRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: EvidenceId) {
      return ok(EVIDENCE.find((e) => e.id === id) ?? null);
    },
    async listByIds(_ws: WorkspaceId, ids: readonly EvidenceId[]) {
      const wanted = new Set(ids.map(String));
      return ok(EVIDENCE.filter((e) => wanted.has(String(e.id))));
    },
    async search(_ws: WorkspaceId, query: { text?: string }, page: PageRequest) {
      const text = query.text?.trim().toLowerCase() ?? "";
      const items = EVIDENCE.filter(
        (e) => text === "" || `${e.title} ${e.excerptOrSummary}`.toLowerCase().includes(text),
      ).slice(0, page.limit);
      return ok({ items, nextCursor: null });
    },
    async save() {
      return saveRejected("根拠");
    },
  });
}

/**
 * 検証記録。**あえて 1 件も入れていない。**
 *
 * 「実際に使ってみた」と書けるかどうかは、この記録の有無で決まる。
 * 見本を入れてしまうと、記録が無い状態の画面（＝実運用の初期状態）を
 * 一度も見ないまま進むことになる。
 */
export function createSampleTestRunRepository(): EditorialTestRunRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, _id: TestRunId) {
      return ok(null as TestRun | null);
    },
    async listByProduct() {
      return ok([] as readonly TestRun[]);
    },
    async save() {
      return saveRejected("検証記録");
    },
  });
}
