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
  type RecordedEvidenceDeps,
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
import { createUnavailableAuditLog } from "@/infrastructure/persistence/sample/audit-log-sample-repository";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";

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

function deps(over: Partial<RecordedEvidenceDeps> = {}): RecordedEvidenceDeps {
  const f = fakes();
  return {
    evidence: f.evidence,
    claims: f.claims,
    testRuns: f.testRuns,
    products: f.products,
    memberships: f.memberships,
    ids: { newId: () => "generated" },
    auditLog: recordingAuditLog().port,
    now: () => new Date("2026-08-27T00:00:00.000Z"),
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
    const uc = createSaveEvidenceUseCase({ ...deps(), evidence: f.evidence, ids: undefined });
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

/**
 * 根拠をさがす側。
 *
 * 登録の口にはテストがあったが、**探す口は空の一覧しか通っていなかった**。
 * この画面は「言えることを書くときに、指せる根拠を選ぶ」ための唯一の入口で、
 * ここが崩れると、開いても何も出ないリンクや、探し方の分からない空欄が出る。
 */
describe("根拠をさがす", () => {
  const AN_EVIDENCE_ROW = {
    id: "ev_known",
    type: "official_source",
    title: "書き出し時間の公式値",
    sourceOwner: "製造元",
    capturedAt: new Date("2026-08-01T09:00:00.000Z"),
    urlOrAssetId: "https://example.com/spec",
    excerptOrSummary: "4K10分の素材を6分12秒で書き出す",
  };

  /** 探した結果を差し替えられる保存先。呼ばれた引数もそのまま覚えておく。 */
  function searching(items: readonly Record<string, unknown>[]) {
    const calls: { filter: unknown; page: unknown }[] = [];
    const evidence = markEditorial({
      findById: async () => ok(null),
      listByIds: async () => ok([]),
      search: async (_ws: unknown, filter: unknown, page: unknown) => {
        calls.push({ filter, page });
        return ok({ items, nextCursor: null });
      },
      save: async (e: Evidence) => ok(e),
    }) as unknown as EditorialEvidenceRepositoryPort;
    return { evidence, calls };
  }

  it("見る権限が無ければ、保存先を読みにも行かない", async () => {
    const s = searching([]);
    const got = await createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence }).execute(
      aNobody(),
      {},
    );

    expect(got.ok).toBe(false);
    expect(s.calls).toHaveLength(0);
  });

  it("日付は年月日の日本語にして返す", async () => {
    const s = searching([AN_EVIDENCE_ROW]);
    const got = await createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence }).execute(
      anOwner(),
      {},
    );

    expect(got.ok && got.value.items[0].capturedAt).toBe("2026年8月1日");
    expect(got.ok && got.value.items[0].typeLabel).toBe(EVIDENCE_TYPE_LABELS.official_source);
  });

  it("開けない置き場所の番号は、リンクにしない", async () => {
    const s = searching([{ ...AN_EVIDENCE_ROW, urlOrAssetId: "asset_01H9" }]);
    const got = await createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence }).execute(
      anOwner(),
      {},
    );

    // 押しても何も起きない箇所を一覧に混ぜない。
    expect(got.ok && got.value.items[0].url).toBeNull();
  });

  it("一度に取る件数は 100 件までに抑える", async () => {
    const s = searching([]);
    await createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence }).execute(anOwner(), {
      limit: 500,
    });

    expect(s.calls[0].page).toEqual({ limit: 100, cursor: null });
  });

  it("件数を書かなければ 50 件で探す", async () => {
    const s = searching([]);
    await createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence }).execute(anOwner(), {});

    expect(s.calls[0].page).toEqual({ limit: 50, cursor: null });
  });

  it("探して 0 件のときと、まだ 1 件も無いときで、言うことを変える", async () => {
    const s = searching([]);
    const uc = createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence });

    const searched = await uc.execute(anOwner(), { text: "書き出し" });
    const empty = await uc.execute(anOwner(), { text: "   " });

    // 「探し方を変える」と「先に登録する」では、次にやることがまるで違う。
    expect(searched.ok && searched.value.emptyReason).toContain("探し直して");
    expect(empty.ok && empty.value.emptyReason).toContain("先に根拠を登録");
  });

  it("1 件でも見つかれば、空の理由は出さない", async () => {
    const s = searching([AN_EVIDENCE_ROW]);
    const got = await createSearchEvidenceUseCase({ ...deps(), evidence: s.evidence }).execute(
      anOwner(),
      { text: "書き出し" },
    );

    expect(got.ok && got.value.emptyReason).toBeNull();
  });
});

describe("読めない値は入口で断る", () => {
  it("根拠の種類が登録表に無ければ断る", async () => {
    const f = fakes();
    const got = await createSaveEvidenceUseCase({ ...deps(), evidence: f.evidence }).execute(
      anOwner(),
      { ...AN_EVIDENCE, type: "hearsay" },
    );

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.field).toBe("type");
    expect(f.savedEvidence).toHaveLength(0);
  });

  it("資料を取った日が空欄なら、今の日時で埋める", async () => {
    const f = fakes();
    await createSaveEvidenceUseCase({ ...deps(), evidence: f.evidence }).execute(anOwner(), {
      ...AN_EVIDENCE,
      capturedAt: "",
    });

    expect(f.savedEvidence[0].capturedAt.getTime()).toBeGreaterThan(0);
  });

  it("言えることの種類が登録表に無ければ断る", async () => {
    const f = fakes();
    const got = await createSaveClaimUseCase({ ...deps(), claims: f.claims }).execute(anOwner(), {
      ...A_CLAIM,
      type: "たぶんそう",
    });

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.field).toBe("type");
    expect(f.savedClaims).toHaveLength(0);
  });

  it.each([
    ["いつから言えるか", "validFrom"],
    ["いつまで言えるか", "validUntil"],
  ] as const)("%sの日付が読めなければ断る", async (_name, field) => {
    const f = fakes();
    const got = await createSaveClaimUseCase({
      ...deps(),
      evidence: f.evidence,
      claims: f.claims,
      products: f.products,
    }).execute(anOwner(), { ...A_CLAIM, [field]: "きのう" });

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.field).toBe(field);
    expect(f.savedClaims).toHaveLength(0);
  });

  it("いつまで言えるかが空欄なら、期限なしとして保存する", async () => {
    const f = fakes();
    await createSaveClaimUseCase({
      ...deps(),
      evidence: f.evidence,
      claims: f.claims,
      products: f.products,
    }).execute(anOwner(), { ...A_CLAIM, validUntil: "" });

    expect(f.savedClaims[0].claim.validUntil).toBeNull();
  });

  it("空文字だけの根拠の指定は、指していないものとして落とす", async () => {
    const f = fakes();
    await createSaveClaimUseCase({
      ...deps(),
      evidence: f.evidence,
      claims: f.claims,
      products: f.products,
    }).execute(anOwner(), { ...A_CLAIM, evidenceIds: ["ev_known", "  ", ""] });

    expect(f.savedClaims[0].claim.evidenceIds).toEqual(["ev_known"]);
  });

  it.each([
    ["測り始めた日", "startedAt"],
    ["測り終えた日", "completedAt"],
  ] as const)("%sの形が読めなければ断る", async (_name, field) => {
    const f = fakes();
    const got = await createSaveTestRunUseCase({
      ...deps(),
      evidence: f.evidence,
      testRuns: f.testRuns,
      products: f.products,
      memberships: f.memberships,
    }).execute(anOwner(), { ...A_TEST_RUN, [field]: "このまえ" });

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.field).toBe(field);
    expect(f.savedRuns).toHaveLength(0);
  });

  it("測り終えた日が空欄なら、まだ終わっていない記録として保存する", async () => {
    const f = fakes();
    await createSaveTestRunUseCase({
      ...deps(),
      evidence: f.evidence,
      testRuns: f.testRuns,
      products: f.products,
      memberships: f.memberships,
    }).execute(anOwner(), { ...A_TEST_RUN, completedAt: "", startedAt: "" });

    expect(f.savedRuns[0].completedAt).toBeNull();
    expect(f.savedRuns[0].startedAt.getTime()).toBeGreaterThan(0);
  });

  it("空欄の道具と検証者は、書かれていないものとして落とす", async () => {
    const f = fakes();
    await createSaveTestRunUseCase({
      ...deps(),
      evidence: f.evidence,
      testRuns: f.testRuns,
      products: f.products,
      memberships: f.memberships,
    }).execute(anOwner(), {
      ...A_TEST_RUN,
      equipment: ["ストップウォッチ", "  ", ""],
      testerIds: ["u_owner", "  "],
    });

    expect(f.savedRuns[0].equipment).toEqual(["ストップウォッチ"]);
    expect(f.savedRuns[0].testerIds).toEqual(["u_owner"]);
  });

  it.each([
    ["言えること", () => createSaveClaimUseCase, A_CLAIM],
    ["検証記録", () => createSaveTestRunUseCase, A_TEST_RUN],
  ] as const)("%sも、番号を作る道具が無ければ保存を試みない", async (_name, make, input) => {
    const f = fakes();
    const got = await make()({
      ...deps({ evidence: f.evidence, claims: f.claims, testRuns: f.testRuns }),
      ids: undefined,
    }).execute(anOwner(), input as never);

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("NOT_IMPLEMENTED");
    expect(f.savedClaims).toHaveLength(0);
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

/*
 * 根拠・言えること・検証記録は、どれも「登録した」で 1 語にまとめたくなる。
 * まとめないのは、後から追いたい問いが違うから。
 *   根拠     — その出典は、いつ時点のものか
 *   言えること — 誰が「これは書いてよい」と判断したか
 *   検証記録 — 誰が測ったか
 * 1 語にすると、この 3 つの問いが同じ一覧の中で混ざる。
 */
describe("登録したことを記録に残す", () => {
  it.each([
    [
      "根拠",
      "evidence.registered",
      "evidence",
      (d: RecordedEvidenceDeps) => createSaveEvidenceUseCase(d).execute(anOwner(), AN_EVIDENCE),
    ],
    [
      "言えること",
      "claim.registered",
      "claim",
      (d: RecordedEvidenceDeps) => createSaveClaimUseCase(d).execute(anOwner(), A_CLAIM),
    ],
    [
      "検証記録",
      "test_run.registered",
      "test_run",
      (d: RecordedEvidenceDeps) => createSaveTestRunUseCase(d).execute(anOwner(), A_TEST_RUN),
    ],
  ] as const)("%sは %s として残る", async (_name, action, targetType, run) => {
    const audit = recordingAuditLog();
    const got = await run(deps({ auditLog: audit.port }));

    expect(got.ok).toBe(true);
    expect(audit.actions()).toEqual([action]);
    expect(audit.entries()[0]?.targetType).toBe(targetType);
  });

  it.each([
    [
      "根拠",
      "根拠の登録は済んでいます",
      (d: RecordedEvidenceDeps) => createSaveEvidenceUseCase(d).execute(anOwner(), AN_EVIDENCE),
      (f: ReturnType<typeof fakes>) => f.savedEvidence,
    ],
    [
      "言えること",
      "言えることの登録は済んでいます",
      (d: RecordedEvidenceDeps) => createSaveClaimUseCase(d).execute(anOwner(), A_CLAIM),
      (f: ReturnType<typeof fakes>) => f.savedClaims,
    ],
    [
      "検証記録",
      "検証記録の登録は済んでいます",
      (d: RecordedEvidenceDeps) => createSaveTestRunUseCase(d).execute(anOwner(), A_TEST_RUN),
      (f: ReturnType<typeof fakes>) => f.savedRuns,
    ],
  ] as const)("記録が残せなくても、%sそのものは巻き戻さない", async (_name, message, run, saved) => {
    const f = fakes();
    const got = await run(
      deps({
        evidence: f.evidence,
        claims: f.claims,
        testRuns: f.testRuns,
        auditLog: createUnavailableAuditLog(),
      }),
    );

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(got.error.retryable).toBe(true);
    // 断りは返すが、登録は残る。消しに戻すと、断りを見た人が同じ資料を二度登録する。
    expect(got.error.message).toContain(message);
    expect(saved(f)).toHaveLength(1);
  });
});
