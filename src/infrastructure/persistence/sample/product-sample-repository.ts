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
import {
  SAMPLE_CATEGORY_ID,
  SAMPLE_PRODUCTS,
  SAMPLE_WORKSPACE_ID,
} from "./sample-identity";

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
  port: "商品の保存先",
  label: "商品（見本データ）",
  // 主張・根拠・検証記録は 2026-08-26 に本物へ差し替えた（claims / evidence_records /
  // test_runs と `/admin/evidence/**` の登録の口）。ここに残っているのは商品だけ。
  // 先に来るのは表ではなく入口、という順は変えない。
  blockedBy: "products テーブルの追加とマイグレーション",
});

export function sampleProductNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

const WS = SAMPLE_WORKSPACE_ID as WorkspaceId;
const RETRIEVED_AT = new Date("2026-07-01T00:00:00Z");

/** 仕様の項目名は 4 商品で必ず揃える。揃わない項目は比較表の列にならない。 */
const SPEC_BY_PRODUCT: Readonly<Record<string, Readonly<Record<string, string | number>>>> = {
  p_alpha_15: {
    座面の高さ: "42〜54cm",
    座面の奥行き: "43〜48cm",
    肘掛けの調整: "上下・前後・左右・角度",
    "8時間後の腰部圧力": "38kPa",
    保証期間: "5年",
  },
  p_beta_14: {
    座面の高さ: "39〜51cm",
    座面の奥行き: "42〜47cm",
    肘掛けの調整: "上下・前後",
    "8時間後の腰部圧力": "44kPa",
    保証期間: "3年",
  },
  p_gamma_16: {
    座面の高さ: "43〜52cm",
    座面の奥行き: "45cm",
    肘掛けの調整: "なし（固定）",
    "8時間後の腰部圧力": "52kPa",
    保証期間: "1年",
    // この 1 つだけ他に無い項目。比較表では「揃っていない項目」として別枠に出る。
    張地: "メッシュ",
  },
  p_delta_13: {
    座面の高さ: "44cm（固定）",
    座面の奥行き: "39cm",
    肘掛けの調整: "なし",
    "8時間後の腰部圧力": "68kPa",
    保証期間: "1年",
  },
};

const DESCRIPTION_BY_PRODUCT: Readonly<Record<string, string>> = {
  p_alpha_15: "腰の負担が最も小さく、肘掛けを細かく合わせられる椅子。",
  p_beta_14: "座面がやわらかく、小柄な人でも足を床につけやすい椅子。",
  p_gamma_16: "価格を抑えたメッシュ椅子。肘掛けと座面の奥行きは調整できない。",
  p_delta_13: "背もたれと肘掛けのない木製スツール。長時間の作業には向かない。",
};

function build(id: ProductId, name: string): Product {
  const key = String(id);
  const built = createProduct({
    id,
    workspaceId: WS,
    brand: name.split(" ")[0] ?? name,
    name,
    manufacturer: null,
    categoryId: SAMPLE_CATEGORY_ID,
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

/**
 * 見本の 4 商品。**保存先が本物（D1）のときも、これを重ねて返す。**
 *
 * 順位表と比較表の見本が同じ 4 商品を指しているため、ここだけ消すと
 * 「順位表には出るのに商品ページが無い」というちぐはぐが起きる。
 * 重ね方は `d1/storage-failure.ts` の `mergeWithSamples`（保存分が勝つ）。
 */
export function sampleProducts(): readonly Product[] {
  return PRODUCTS;
}

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

/**
 * 見本の根拠。保存先（D1）が見本を消さずに重ねるために読む。
 *
 * 消さないのは、まだ 1 件も登録していない状態で一覧が空になると、
 * 「まだ登録していない」のか「壊れている」のかを画面から見分けられないため。
 */
export const SAMPLE_EVIDENCE: readonly Evidence[] = [
  evidenceOf(
    "ev_lumbar_pressure",
    "8時間着座後の腰部圧力",
    "編集部",
    "同じ被験者が同じ机で8時間座り、腰部の圧力を10分ごとに記録した見本の値です。",
  ),
  evidenceOf(
    "ev_seat_height",
    "座面高の実測",
    "編集部",
    "無荷重の状態で、床から座面中央までの高さを測った見本の値です。",
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
/** 同上。商品との紐付けは保存先の関心事なので、見本でも表の形で持つ。 */
export const CLAIMS_BY_PRODUCT: Readonly<Record<string, readonly Claim[]>> = {
  p_alpha_15: [
    claimOf(
      "cl_alpha_pressure",
      "8時間着座後の腰部圧力は平均38kPaでした。",
      "measured",
      ["ev_lumbar_pressure"],
      0.9,
    ),
    claimOf(
      "cl_alpha_fit",
      "身長160〜185cmの人は座面と肘掛けを作業姿勢に合わせやすいと考えられます。",
      "inference",
      [],
      0.6,
    ),
  ],
  p_beta_14: [
    claimOf("cl_beta_height", "座面の高さは39〜51cmです。", "measured", ["ev_seat_height"], 0.95),
  ],
  p_gamma_16: [
    claimOf(
      "cl_gamma_pressure",
      "8時間着座後の腰部圧力は平均52kPaでした。",
      "measured",
      ["ev_lumbar_pressure"],
      0.9,
    ),
  ],
  p_delta_13: [
    claimOf("cl_delta_height", "座面の高さは44cmです。", "measured", ["ev_seat_height"], 0.95),
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
    /**
     * 削除も同じ理由で断る。
     *
     * **成功したふりをしない。** 見本はコードの中にあるので、消えたと返しても
     * 次に開けばまた居る。保存できない保管庫は消すこともできない、が正しい。
     */
    async remove() {
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
    async saveForProduct() {
      return saveRejected("主張");
    },
  });
}

export function createSampleEvidenceRepository(): EditorialEvidenceRepositoryPort {
  return markEditorial({
    async findById(_ws: WorkspaceId, id: EvidenceId) {
      return ok(SAMPLE_EVIDENCE.find((e) => e.id === id) ?? null);
    },
    async listByIds(_ws: WorkspaceId, ids: readonly EvidenceId[]) {
      const wanted = new Set(ids.map(String));
      return ok(SAMPLE_EVIDENCE.filter((e) => wanted.has(String(e.id))));
    },
    async search(_ws: WorkspaceId, query: { text?: string }, page: PageRequest) {
      const text = query.text?.trim().toLowerCase() ?? "";
      const items = SAMPLE_EVIDENCE.filter(
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
