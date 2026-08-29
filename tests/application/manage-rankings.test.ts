/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 順位づけの基準と点の登録。
 *
 * ここで固定したいのは「順位が動く理由が、入れた人から見て追える」こと。
 * 画面は正常に見えるのに順位だけ変わらない／変わってはいけない理由で変わる、
 * という壊れ方を止める。
 */
import { describe, expect, it } from "vitest";
import type {
  EditorialEvidenceRepositoryPort,
  EditorialProductRepositoryPort,
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
} from "@/application/ports";
import {
  CRITERION_LABELS,
  type SaveRankingModelDeps,
  type SaveRankingModelInput,
  allowedCriteriaForForm,
  createListRankingModelsUseCase,
  createSaveRankingModelUseCase,
  createSaveScoreCardUseCase,
} from "@/application/usecases/ranking/manage-rankings";
import type { EditorialScoreCard, RankingModel } from "@/domain/ranking";
import { markEditorial, ok, taggedString } from "@/domain/shared";
import { createUnavailableAuditLog } from "@/infrastructure/persistence/sample/audit-log-sample-repository";
import { SAMPLE_RANKING_MODELS } from "@/infrastructure/persistence/sample/ranking-sample-repository";
import { OTHER_WORKSPACE, WORKSPACE, aNobody, anOwner, aWriter } from "../support/actors";
import { recordingAuditLog } from "../support/doubles";

const MODEL = SAMPLE_RANKING_MODELS[0];

/** 保存された基準と点を覚えておくだけの偽の保存先。 */
function fakes(
  owners: {
    readonly category?: string | null;
    readonly product?: string | null;
    readonly evidence?: string | null;
  } = {},
) {
  const savedModels: RankingModel[] = [];
  const savedCards: { modelId: string; card: EditorialScoreCard }[] = [];

  const rankingModels = markEditorial({
    findById: async (_ws: unknown, id: unknown) =>
      ok(String(id) === String(MODEL.id) ? MODEL : null),
    list: async () => ok({ items: [MODEL], nextCursor: null }),
    save: async (model: RankingModel) => {
      savedModels.push(model);
      return ok(model);
    },
  }) as unknown as EditorialRankingModelRepositoryPort;

  const scoreCards = markEditorial({
    listByModel: async () => ok([]),
    save: async (_ws: unknown, modelId: unknown, card: EditorialScoreCard) => {
      savedCards.push({ modelId: String(modelId), card });
      return ok(card);
    },
  }) as unknown as EditorialScoreCardRepositoryPort;

  const products = markEditorial({
    findById: async (_ws: unknown, id: unknown) =>
      ok(
        owners.product === null
          ? null
          : ({ id, workspaceId: owners.product ?? WORKSPACE } as never),
      ),
    findByIdentityKey: async () => ok(null),
    search: async (_ws: unknown, query: { categoryId?: string }) =>
      ok({
        items:
          owners.category === null
            ? []
            : [
                {
                  id: "p_category_basis",
                  workspaceId: owners.category ?? WORKSPACE,
                  categoryId: query.categoryId,
                },
              ],
        nextCursor: null,
      }),
    save: async (product: unknown) => ok(product),
    remove: async () => ok(true),
  }) as unknown as EditorialProductRepositoryPort;

  const evidence = markEditorial({
    findById: async (_ws: unknown, id: unknown) =>
      ok(
        owners.evidence === null
          ? null
          : ({ id, workspaceId: owners.evidence ?? WORKSPACE } as never),
      ),
    listByIds: async () => ok([]),
    search: async () => ok({ items: [], nextCursor: null }),
    save: async (item: unknown) => ok(item),
  }) as unknown as EditorialEvidenceRepositoryPort;

  const audit = recordingAuditLog();

  return { rankingModels, scoreCards, products, evidence, savedModels, savedCards, audit };
}

function deps(over: Partial<SaveRankingModelDeps> = {}): SaveRankingModelDeps {
  const f = fakes();
  return {
    rankingModels: f.rankingModels,
    scoreCards: f.scoreCards,
    products: f.products,
    evidence: f.evidence,
    ids: { newId: () => "generated" },
    auditLog: f.audit.port,
    now: () => new Date("2026-08-26T10:00:00Z"),
    ...over,
  };
}

/**
 * 点の登録は、保存先と記録先の両方を見たい検査が多い。
 * `deps()` は自前で `fakes()` を作ってしまうので、
 * **同じ f を使い回したいとき**はこちらから組み立てる。
 */
function scoreDeps(
  f: ReturnType<typeof fakes>,
  over: Partial<SaveRankingModelDeps> = {},
): SaveRankingModelDeps {
  return deps({
    rankingModels: f.rankingModels,
    scoreCards: f.scoreCards,
    products: f.products,
    evidence: f.evidence,
    auditLog: f.audit.port,
    ...over,
  });
}

const A_MODEL_INPUT: SaveRankingModelInput = {
  categoryId: "cat_laptop",
  version: "2026.09-1",
  audience: "動画を編集する人",
  effectiveFrom: "2026-09-01",
  reason: "測定手順を更新するため。",
  criteria: [
    {
      key: "measured_performance",
      weightPercent: 60,
      measurement: "書き出しにかかる時間を 3 回測る",
      passThresholdPercent: 30,
    },
    {
      key: "usability",
      weightPercent: 40,
      measurement: "初回の設定を最後まで通す",
      passThresholdPercent: 20,
    },
  ],
};

describe("評価基準の一覧", () => {
  it("ブランドとの対応を持たない評価基準を限定担当者へは出さない", async () => {
    const got = await createListRankingModelsUseCase(deps()).execute(
      anOwner({ scopedBrandIds: [taggedString<"BrandId">("brand-limited")] }),
      {},
    );

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("TENANT_MISMATCH");
  });

  it("重みは小数ではなく割合で返る", async () => {
    const uc = createListRankingModelsUseCase(deps());
    const got = await uc.execute(anOwner(), {});
    expect(got.ok).toBe(true);
    if (!got.ok) return;

    for (const criterion of got.value.items[0].criteria) {
      // 0.4 を並べると、合計が 1.0 かを読む人が暗算することになる。
      expect(Number.isInteger(criterion.weightPercent)).toBe(true);
      expect(criterion.weightPercent).toBeGreaterThan(0);
    }
  });

  it("指標は内部の名前ではなく読める言葉で返る", async () => {
    const uc = createListRankingModelsUseCase(deps());
    const got = await uc.execute(anOwner(), {});
    if (!got.ok) return;

    for (const criterion of got.value.items[0].criteria) {
      expect(criterion.label).not.toBe(String(criterion.key));
      expect(criterion.label).toBe(CRITERION_LABELS[criterion.key]);
    }
  });

  it("指標の key も返る（点を入れる画面が欄を絞れるように）", async () => {
    const uc = createListRankingModelsUseCase(deps());
    const got = await uc.execute(anOwner(), {});
    if (!got.ok) return;

    // 名前だけ返すと、画面が名前から指標を逆引きすることになり、
    // 名前を変えた日に点の欄が黙って消える。
    for (const criterion of got.value.items[0].criteria) {
      expect(allowedCriteriaForForm().map((c) => c.key)).toContain(criterion.key);
    }
  });

  it("件数があるときに空の理由は付かない", async () => {
    const uc = createListRankingModelsUseCase(deps());
    const got = await uc.execute(anOwner(), {});
    if (!got.ok) return;
    expect(got.value.emptyReason).toBeNull();
  });

  it("権限が無い人には理由が付いて断られる", async () => {
    const uc = createListRankingModelsUseCase(deps());
    const got = await uc.execute(aNobody(), {});
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message.trim()).not.toBe("");
  });
});

describe("評価基準の登録", () => {
  it("記事を書けても評価基準を管理できない人は登録できない", async () => {
    const uc = createSaveRankingModelUseCase(deps());
    const got = await uc.execute(aWriter(), A_MODEL_INPUT);
    expect(got.ok).toBe(false);
  });

  it("登録理由と ranking_model.changed を操作の記録へ残す", async () => {
    const f = fakes();
    const audit = recordingAuditLog();
    const uc = createSaveRankingModelUseCase({
      rankingModels: f.rankingModels,
      scoreCards: f.scoreCards,
      products: f.products,
      evidence: f.evidence,
      ids: { newId: () => "generated" },
      auditLog: audit.port,
      now: () => new Date("2026-08-26T10:00:00Z"),
    });

    const got = await uc.execute(anOwner(), {
      ...A_MODEL_INPUT,
      reason: "新しい測定手順へ切り替えるため。",
    });

    expect(got.ok).toBe(true);
    expect(audit.entries()).toHaveLength(1);
    expect(audit.entries()[0]).toMatchObject({
      action: "ranking_model.changed",
      targetType: "ranking_model",
      reason: "新しい測定手順へ切り替えるため。",
    });
  });

  it("理由が空なら基準を保存せず reason 欄を名指しで断る", async () => {
    const f = fakes();
    const uc = createSaveRankingModelUseCase({
      rankingModels: f.rankingModels,
      scoreCards: f.scoreCards,
      products: f.products,
      evidence: f.evidence,
      ids: { newId: () => "generated" },
      auditLog: f.audit.port,
      now: () => new Date("2026-08-26T10:00:00Z"),
    });

    const got = await uc.execute(anOwner(), { ...A_MODEL_INPUT, reason: "   " });

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(got.error.field).toBe("reason");
    expect(f.savedModels).toHaveLength(0);
  });

  it("割合で受けた重みは小数へ直して保存する", async () => {
    const f = fakes();
    const uc = createSaveRankingModelUseCase({
      rankingModels: f.rankingModels,
      scoreCards: f.scoreCards,
      products: f.products,
      evidence: f.evidence,
      ids: { newId: () => "generated" },
      auditLog: f.audit.port,
      now: () => new Date("2026-08-26T10:00:00Z"),
    });
    const got = await uc.execute(anOwner(), A_MODEL_INPUT);
    expect(got.ok).toBe(true);
    if (!got.ok) return;

    const weights = f.savedModels[0].criteria.map((c) => c.weight);
    expect(weights).toEqual([0.6, 0.4]);
    // domain は合計 1.0 を要求する。%で受けて中で割るのは、
    // 0.05 のずれが「なぜか保存できない」として返るのを避けるため。
    expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it("重み 0 の指標は保存しない", async () => {
    const f = fakes();
    const uc = createSaveRankingModelUseCase({
      rankingModels: f.rankingModels,
      scoreCards: f.scoreCards,
      products: f.products,
      evidence: f.evidence,
      ids: { newId: () => "generated" },
      auditLog: f.audit.port,
      now: () => new Date("2026-08-26T10:00:00Z"),
    });
    const got = await uc.execute(anOwner(), {
      ...A_MODEL_INPUT,
      criteria: [
        ...A_MODEL_INPUT.criteria,
        // 0 のまま残すと、順位に影響しない項目のために測る作業だけが毎回発生する。
        { key: "support", weightPercent: 0, measurement: "", passThresholdPercent: 0 },
      ],
    });
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(f.savedModels[0].criteria.map((c) => c.key)).not.toContain("support");
  });

  it("報酬を指標にしようとすると断られる", async () => {
    const uc = createSaveRankingModelUseCase(deps());
    const got = await uc.execute(anOwner(), {
      ...A_MODEL_INPUT,
      criteria: [
        {
          key: "affiliate_commission",
          weightPercent: 100,
          measurement: "報酬の高さ",
          passThresholdPercent: 0,
        },
      ],
    });
    // 断るのは domain。ここへ写すと写した側だけが古くなる。
    expect(got.ok).toBe(false);
  });

  it("いつからの評価かが読めない形なら、その欄を名指しで断る", async () => {
    const uc = createSaveRankingModelUseCase(deps());
    const got = await uc.execute(anOwner(), { ...A_MODEL_INPUT, effectiveFrom: "" });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("VALIDATION_FAILED");
  });

  it("ID の作り方を持たない組み方では、直せる案内を返す", async () => {
    const f = fakes();
    const uc = createSaveRankingModelUseCase({
      rankingModels: f.rankingModels,
      scoreCards: f.scoreCards,
      products: f.products,
      evidence: f.evidence,
      auditLog: f.audit.port,
      now: () => new Date("2026-08-26T10:00:00Z"),
    });
    const got = await uc.execute(anOwner(), A_MODEL_INPUT);
    expect(got.ok).toBe(false);
    if (got.ok) return;
    // 「保存できません」だけだと、開く場所を変えれば通ることが分からない。
    expect(got.error.code).toBe("NOT_IMPLEMENTED");
    expect(got.error.suggestedAction).toBeDefined();
  });

  it("書く権限が無い人には断られる", async () => {
    const uc = createSaveRankingModelUseCase(deps());
    const got = await uc.execute(aNobody(), A_MODEL_INPUT);
    expect(got.ok).toBe(false);
  });

  it.each([
    ["存在しないカテゴリー", null],
    ["別の作業場所だけにあるカテゴリー", OTHER_WORKSPACE],
  ] as const)("%sの評価基準は保存しない", async (_name, categoryOwner) => {
    const f = fakes({ category: categoryOwner });
    const got = await createSaveRankingModelUseCase({
      ...deps(),
      rankingModels: f.rankingModels,
      scoreCards: f.scoreCards,
      products: f.products,
      evidence: f.evidence,
    }).execute(anOwner(), A_MODEL_INPUT);

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(f.savedModels).toHaveLength(0);
  });
});

const A_CARD_INPUT = {
  modelId: String(MODEL.id),
  productId: "p_alpha_15",
  scorePercents: { measured_performance: 90, usability: 70 },
  evidenceRefs: ["ev_score"],
  testedAt: "2026-08-20",
};

describe("商品の点の登録", () => {
  it("0〜100 で受けた点は 0.0〜1.0 へ直して保存する", async () => {
    const f = fakes();
    const uc = createSaveScoreCardUseCase(scoreDeps(f));
    const got = await uc.execute(anOwner(), A_CARD_INPUT);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(f.savedCards[0].card.scores.measured_performance).toBeCloseTo(0.9);
  });

  it("どの評価基準で付けた点かを保存先へ渡す", async () => {
    const f = fakes();
    const uc = createSaveScoreCardUseCase(scoreDeps(f));
    await uc.execute(anOwner(), A_CARD_INPUT);
    // 渡さないと、版を上げて測り直した点が前の版を上書きする。
    expect(f.savedCards[0].modelId).toBe(String(MODEL.id));
  });

  it("根拠が空の点は受け取らない", async () => {
    const uc = createSaveScoreCardUseCase(deps());
    const got = await uc.execute(anOwner(), { ...A_CARD_INPUT, evidenceRefs: ["  "] });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    // 通すと「誰かがそう思った」だけの点が順位を動かす。
    expect(got.error.code).toBe("VALIDATION_FAILED");
  });

  it("範囲の外の点は、どの項目かを読める言葉で言って断る", async () => {
    const uc = createSaveScoreCardUseCase(deps());
    const got = await uc.execute(anOwner(), {
      ...A_CARD_INPUT,
      scorePercents: { measured_performance: 120 },
    });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.message).toContain(CRITERION_LABELS.measured_performance);
  });

  it("評価基準に無い指標は保存しない", async () => {
    const f = fakes();
    const uc = createSaveScoreCardUseCase(scoreDeps(f));
    await uc.execute(anOwner(), {
      ...A_CARD_INPUT,
      scorePercents: { ...A_CARD_INPUT.scorePercents, specification: 50 },
    });
    const keys = Object.keys(f.savedCards[0].card.scores);
    const allowed = MODEL.criteria.map((c) => String(c.key));
    for (const key of keys) expect(allowed).toContain(key);
  });

  it("点を 1 つも入れていなければ断る", async () => {
    const uc = createSaveScoreCardUseCase(deps());
    const got = await uc.execute(anOwner(), { ...A_CARD_INPUT, scorePercents: {} });
    expect(got.ok).toBe(false);
  });

  it("測った日が空なら「分からない」として保存する", async () => {
    const f = fakes();
    const uc = createSaveScoreCardUseCase(scoreDeps(f));
    await uc.execute(anOwner(), { ...A_CARD_INPUT, testedAt: "" });
    // 空を「今日」で埋めると、測っていない日が測った日として読者へ出る。
    expect(f.savedCards[0].card.testedAt).toBeNull();
  });

  it("無い評価基準を指したら、選び直せる案内を返す", async () => {
    const uc = createSaveScoreCardUseCase(deps());
    const got = await uc.execute(anOwner(), { ...A_CARD_INPUT, modelId: "rm_missing" });
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("NOT_FOUND");
    expect(got.error.suggestedAction).toBeDefined();
  });

  it("根拠を扱う権限が無い人には断られる", async () => {
    const uc = createSaveScoreCardUseCase(deps());
    const got = await uc.execute(aNobody(), A_CARD_INPUT);
    expect(got.ok).toBe(false);
  });

  it.each([
    ["存在しない商品", { product: null }],
    ["別の作業場所の商品", { product: OTHER_WORKSPACE }],
    ["存在しない根拠", { evidence: null }],
    ["別の作業場所の根拠", { evidence: OTHER_WORKSPACE }],
  ] as const)("%sを参照した点は保存しない", async (_name, owners) => {
    const f = fakes(owners);
    const got = await createSaveScoreCardUseCase(scoreDeps(f)).execute(anOwner(), A_CARD_INPUT);

    expect(got.ok).toBe(false);
    if (!got.ok) expect(got.error.code).toBe("VALIDATION_FAILED");
    expect(f.savedCards).toHaveLength(0);
  });

  it("誰がどの版へ点を入れたかを記録に残す", async () => {
    const f = fakes();
    await createSaveScoreCardUseCase(scoreDeps(f)).execute(anOwner(), A_CARD_INPUT);

    expect(f.audit.actions()).toEqual(["score_card.changed"]);
    const entry = f.audit.entries()[0];
    expect(entry?.targetType).toBe("score_card");
    // 版と商品の組で 1 行。商品だけだと、版を上げて測り直した点が同じ的に見える。
    expect(entry?.targetId).toBe(`${String(MODEL.id)}:p_alpha_15`);
  });

  it("記録が残せなくても、点そのものは巻き戻さない", async () => {
    const f = fakes();
    const got = await createSaveScoreCardUseCase(
      scoreDeps(f, { auditLog: createUnavailableAuditLog() }),
    ).execute(anOwner(), A_CARD_INPUT);

    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("UPSTREAM_UNAVAILABLE");
    expect(got.error.message).toContain("点の登録は済んでいます");
    // 消しに戻すと、順位だけが前の点のまま残り、画面と保存先が食い違う。
    expect(f.savedCards).toHaveLength(1);
  });
});
