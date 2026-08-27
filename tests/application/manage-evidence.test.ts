/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 根拠・言えること・検証記録の登録。
 *
 * ここで固定したいのは「記事に書けると画面が言ったなら、本当に裏付けがある」こと。
 * 見た目は根拠付きなのに開くと何も無い、という壊れ方を止める。
 *
 * 種類ごとに根拠が要る／要らないの判定そのものは domain（`createClaim`）の持ち物で、
 * ここでは**写していないこと**だけを確かめる。写すと写した側だけが古くなる。
 */
import { describe, expect, it } from "vitest";
import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialProductRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "@/application/ports";
import type { MembershipRepositoryPort } from "@/application/ports/identity";
import {
  CLAIM_TYPE_LABELS,
  EVIDENCE_TYPE_LABELS,
  type ManageEvidenceDeps,
  type SaveClaimInput,
  type SaveEvidenceInput,
  type SaveTestRunInput,
  createSaveClaimUseCase,
  createSaveEvidenceUseCase,
  createSaveTestRunUseCase,
  createSearchEvidenceUseCase,
} from "@/application/usecases/evidence/manage-evidence";
import type { Claim, Evidence, TestRun } from "@/domain/evidence";
import { markEditorial, ok, taggedString } from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner } from "../support/actors";

/** 保存されたものを覚えておくだけの偽の保存先。根拠は登録済みの番号だけを返す。 */
function fakes(
  registered: readonly string[] = ["ev_known"],
  owners: {
    readonly product?: string | null;
    readonly evidence?: string;
    readonly tester?: string | null;
  } = {},
) {
  const savedEvidence: Evidence[] = [];
  const savedClaims: { productId: string; claim: Claim }[] = [];
  const savedRuns: TestRun[] = [];

  const evidence = markEditorial({
    findById: async (_ws: unknown, id: unknown) =>
      ok(
        registered.includes(String(id))
          ? ({ id, workspaceId: owners.evidence ?? WORKSPACE } as Evidence)
          : null,
      ),
    listByIds: async (_ws: unknown, ids: readonly unknown[]) =>
      // 登録済みのものだけ返す。ここが「全部返す」になっていると、
      // 存在しない根拠を指した主張が通ってしまう。
      ok(ids.filter((id) => registered.includes(String(id))).map((id) => ({ id }))),
    search: async () => ok({ items: [], nextCursor: null }),
    save: async (e: Evidence) => {
      savedEvidence.push(e);
      return ok(e);
    },
  }) as unknown as EditorialEvidenceRepositoryPort;

  const claims = markEditorial({
    findById: async () => ok(null),
    listByProduct: async () => ok([]),
    listExpiringBefore: async () => ok([]),
    save: async (c: Claim) => ok(c),
    saveForProduct: async (_ws: unknown, productId: unknown, c: Claim) => {
      savedClaims.push({ productId: String(productId), claim: c });
      return ok(c);
    },
  }) as unknown as EditorialClaimRepositoryPort;

  const testRuns = markEditorial({
    findById: async () => ok(null),
    listByProduct: async () => ok([]),
    save: async (r: TestRun) => {
      savedRuns.push(r);
      return ok(r);
    },
  }) as unknown as EditorialTestRunRepositoryPort;

  const products = markEditorial({
    findById: async (_ws: unknown, id: unknown) =>
      ok(
        owners.product === null
          ? null
          : ({ id, workspaceId: owners.product ?? WORKSPACE } as never),
      ),
    findByIdentityKey: async () => ok(null),
    search: async () => ok({ items: [], nextCursor: null }),
    save: async (product: unknown) => ok(product),
    remove: async () => ok(true),
  }) as unknown as EditorialProductRepositoryPort;

  const memberships = {
    findById: async () => ok(null),
    findByUser: async (_ws: unknown, userId: unknown) =>
      ok(
        owners.tester === null
          ? null
          : ({ userId, workspaceId: owners.tester ?? WORKSPACE } as never),
      ),
    findByInvitedEmail: async () => ok(null),
    list: async () => ok({ items: [], nextCursor: null }),
    countCurrent: async () => ok(0),
    save: async (membership: unknown) => ok(membership),
    findOwner: async () => ok(null),
  } as unknown as MembershipRepositoryPort;

  return {
    evidence,
    claims,
    testRuns,
    products,
    memberships,
    savedEvidence,
    savedClaims,
    savedRuns,
  };
}

describe("根拠の参照範囲", () => {
  it("ブランドとの対応を持たない根拠一覧を限定担当者へ推測共有しない", async () => {
    const actor = anOwner({ scopedBrandIds: [taggedString<"BrandId">("brand-limited")] });
    const got = await createSearchEvidenceUseCase(fakes()).execute(actor, {});

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
  });
});

function deps(over: Partial<ManageEvidenceDeps> = {}): ManageEvidenceDeps {
  const f = fakes();
  return {
    evidence: f.evidence,
    claims: f.claims,
    testRuns: f.testRuns,
    products: f.products,
    memberships: f.memberships,
    ids: { newId: () => "generated" },
    ...over,
  };
}

const AN_EVIDENCE: SaveEvidenceInput = {
  type: "official_source",
  title: "書き出し時間の公式値",
  sourceOwner: "製造元",
  urlOrAssetId: "https://example.com/spec",
  excerptOrSummary: "4K10分の素材を6分12秒で書き出す",
  licenseOrPermission: "引用の範囲で使う",
  capturedAt: "2026-08-01",
};

const A_CLAIM: SaveClaimInput = {
  productId: "p_alpha_15",
  statement: "4K10分の素材を6分12秒で書き出せます。",
  type: "official",
  evidenceIds: ["ev_known"],
  confidencePercent: 90,
  validFrom: "2026-08-01",
  validUntil: "",
};

const A_TEST_RUN: SaveTestRunInput = {
  productId: "p_alpha_15",
  methodVersion: "2026.08-1",
  testerIds: ["u_owner"],
  equipment: ["ストップウォッチ"],
  environment: { 気温: "25度" },
  rawResults: { 書き出し: "6分12秒" },
  normalizedScorePercents: { measured_performance: 80 },
  evidenceIds: [],
  startedAt: "2026-08-01",
  completedAt: "2026-08-01",
};

describe("誰が登録できるか", () => {
  it("根拠を扱えない人からの登録は断る", async () => {
    const uc = createSaveEvidenceUseCase(deps());
    const got = await uc.execute(aNobody(), AN_EVIDENCE);
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("FORBIDDEN");
  });

  it("番号を作る道具が無いときは、保存を試みずに断る", async () => {
    const f = fakes();
    const uc = createSaveEvidenceUseCase({
      evidence: f.evidence,
      claims: f.claims,
      testRuns: f.testRuns,
      products: f.products,
      memberships: f.memberships,
    });
    const got = await uc.execute(anOwner(), AN_EVIDENCE);
    expect(got.ok).toBe(false);
    expect(f.savedEvidence).toHaveLength(0);
  });
});

describe("根拠の指紋", () => {
  it("中身から作るので、根拠ごとに違う値になる", async () => {
    const f = fakes();
    const uc = createSaveEvidenceUseCase({ ...deps(), evidence: f.evidence });

    await uc.execute(anOwner(), AN_EVIDENCE);
    await uc.execute(anOwner(), { ...AN_EVIDENCE, title: "別の資料" });

    expect(f.savedEvidence).toHaveLength(2);
    for (const e of f.savedEvidence) {
      expect(e.integrityHash.startsWith("sha256:")).toBe(true);
    }
    /*
     * ここが同じ値になると、**どの根拠も同じ確かめ方で「無傷」に見える。**
     * 指紋を決め打ちの文字列にしていた頃の壊れ方がこれで、
     * 確かめる仕組みがあるように見えて、何も確かめていなかった。
     */
    expect(f.savedEvidence[0].integrityHash).not.toBe(f.savedEvidence[1].integrityHash);
  });

  it("同じ中身なら同じ値になる（後から書き換わったかを比べられる）", async () => {
    const f = fakes();
    const uc = createSaveEvidenceUseCase({ ...deps(), evidence: f.evidence });

    await uc.execute(anOwner(), AN_EVIDENCE);
    await uc.execute(anOwner(), { ...AN_EVIDENCE });

    expect(f.savedEvidence[0].integrityHash).toBe(f.savedEvidence[1].integrityHash);
  });

  it("読めない日付は断る（今の日時で埋めない）", async () => {
    const f = fakes();
    const uc = createSaveEvidenceUseCase({ ...deps(), evidence: f.evidence });

    const got = await uc.execute(anOwner(), { ...AN_EVIDENCE, capturedAt: "きのう" });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(f.savedEvidence).toHaveLength(0);
  });
});

describe("言えることの登録", () => {
  it("登録されていない根拠を指した主張は入れない", async () => {
    const f = fakes(["ev_known"]);
    const uc = createSaveClaimUseCase({ ...deps(), evidence: f.evidence, claims: f.claims });

    const got = await uc.execute(anOwner(), { ...A_CLAIM, evidenceIds: ["ev_missing"] });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    // 画面上は根拠付きに見えて、開くと何も無い主張ができるのを止める。
    expect(f.savedClaims).toHaveLength(0);
  });

  it("事実として扱う種類で根拠が空なら入れない（判定は domain の持ち物）", async () => {
    const f = fakes();
    const uc = createSaveClaimUseCase({ ...deps(), evidence: f.evidence, claims: f.claims });

    const got = await uc.execute(anOwner(), { ...A_CLAIM, evidenceIds: [] });

    expect(got.ok).toBe(false);
    expect(f.savedClaims).toHaveLength(0);
  });

  it("どの商品についてかを保存先へ渡す", async () => {
    const f = fakes();
    const uc = createSaveClaimUseCase({ ...deps(), evidence: f.evidence, claims: f.claims });

    const got = await uc.execute(anOwner(), A_CLAIM);

    expect(got.ok).toBe(true);
    expect(f.savedClaims).toHaveLength(1);
    expect(f.savedClaims[0].productId).toBe("p_alpha_15");
  });

  it("確かさは 0〜100 で受け取り、0.0〜1.0 で保存する", async () => {
    const f = fakes();
    const uc = createSaveClaimUseCase({ ...deps(), evidence: f.evidence, claims: f.claims });

    await uc.execute(anOwner(), { ...A_CLAIM, confidencePercent: 90 });

    expect(f.savedClaims[0].claim.confidence).toBeCloseTo(0.9);
  });

  it("100 を超える確かさは断る", async () => {
    const f = fakes();
    const uc = createSaveClaimUseCase({ ...deps(), evidence: f.evidence, claims: f.claims });

    const got = await uc.execute(anOwner(), { ...A_CLAIM, confidencePercent: 120 });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
  });

  it("商品を選ばずに入れようとしたら断る", async () => {
    const f = fakes();
    const uc = createSaveClaimUseCase({ ...deps(), evidence: f.evidence, claims: f.claims });

    const got = await uc.execute(anOwner(), { ...A_CLAIM, productId: "  " });

    expect(got.ok).toBe(false);
    expect(f.savedClaims).toHaveLength(0);
  });

  it.each([
    ["存在しない商品", { product: null }],
    ["別の作業場所の商品", { product: OTHER_WORKSPACE }],
  ] as const)("%sについての主張は保存しない", async (_name, owners) => {
    const f = fakes(["ev_known"], owners);
    const got = await createSaveClaimUseCase({
      ...deps(),
      evidence: f.evidence,
      claims: f.claims,
      products: f.products,
      memberships: f.memberships,
    }).execute(anOwner(), A_CLAIM);

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(f.savedClaims).toHaveLength(0);
  });

  it("別の作業場所の根拠を指した主張は保存しない", async () => {
    const f = fakes(["ev_known"], { evidence: OTHER_WORKSPACE });
    const got = await createSaveClaimUseCase({
      ...deps(),
      evidence: f.evidence,
      claims: f.claims,
      products: f.products,
      memberships: f.memberships,
    }).execute(anOwner(), A_CLAIM);

    expect(got.ok).toBe(false);
    expect(f.savedClaims).toHaveLength(0);
  });
});

describe("検証記録の登録", () => {
  it("点は 0〜100 で受け取り、0.0〜1.0 で保存する", async () => {
    const f = fakes();
    const uc = createSaveTestRunUseCase({ ...deps(), testRuns: f.testRuns });

    const got = await uc.execute(anOwner(), A_TEST_RUN);

    expect(got.ok).toBe(true);
    expect(f.savedRuns[0].normalizedScores.measured_performance).toBeCloseTo(0.8);
  });

  it("測定方法の版を空にしたら入れない", async () => {
    const f = fakes();
    const uc = createSaveTestRunUseCase({ ...deps(), testRuns: f.testRuns });

    const got = await uc.execute(anOwner(), { ...A_TEST_RUN, methodVersion: "  " });

    expect(got.ok).toBe(false);
    // 版を据え置くと、違う方法で出た数字が同じ列に並ぶ。空はそれより悪い。
    expect(f.savedRuns).toHaveLength(0);
  });

  it("範囲の外の点は、どの観点の点かを添えて断る", async () => {
    const f = fakes();
    const uc = createSaveTestRunUseCase({ ...deps(), testRuns: f.testRuns });

    const got = await uc.execute(anOwner(), {
      ...A_TEST_RUN,
      normalizedScorePercents: { usability: 130 },
    });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(got.error.message).toContain("usability");
  });

  it.each([
    ["存在しない商品", { product: null }, A_TEST_RUN],
    ["別の作業場所の商品", { product: OTHER_WORKSPACE }, A_TEST_RUN],
    ["存在しない根拠", {}, { ...A_TEST_RUN, evidenceIds: ["ev_missing"] }],
    [
      "別の作業場所の根拠",
      { evidence: OTHER_WORKSPACE },
      { ...A_TEST_RUN, evidenceIds: ["ev_known"] },
    ],
    ["存在しない検証者", { tester: null }, A_TEST_RUN],
    ["別の作業場所の検証者", { tester: OTHER_WORKSPACE }, A_TEST_RUN],
  ] as const)("%sを参照した検証記録は保存しない", async (_name, owners, input) => {
    const f = fakes(["ev_known"], owners);
    const got = await createSaveTestRunUseCase({
      ...deps(),
      evidence: f.evidence,
      testRuns: f.testRuns,
      products: f.products,
      memberships: f.memberships,
    }).execute(anOwner(), input);

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(f.savedRuns).toHaveLength(0);
  });
});

describe("画面へ出す名前", () => {
  it("種類の名前は、選ぶ人の言葉で書かれている（英字のままにしない）", () => {
    for (const label of [
      ...Object.values(EVIDENCE_TYPE_LABELS),
      ...Object.values(CLAIM_TYPE_LABELS),
    ]) {
      expect(label.trim()).not.toBe("");
      expect(/^[a-z_]+$/u.test(label)).toBe(false);
    }
  });
});
