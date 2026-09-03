/**
 * @tier 1
 * @req REQ-P05, REQ-B01
 * @types equivalence, boundary
 *
 * 順位づけの基準と点の保存先（D1）。
 *
 * 企画の保存先（`d1-content-package-repository.test.ts`）と同じ 4 つに加えて、
 * **順位だけの決めごと**を 3 つ見る。
 *   5. 報酬を入力にしない印が、保存された JSON の中身に関わらず立たないこと
 *   6. 点の保存が 3 列すべてで衝突を見ること
 *      （商品だけで見ると、版を上げて測り直した点が前の版を上書きする）
 *   7. 頼まれた商品が 0 件のときに問い合わせないこと
 *      （空の `inArray` は保存先によっては全件を返す）
 *
 * 本物の D1 は動かせないので、問い合わせの組み立てだけを受け取る偽の接続を使う。
 */
import { describe, expect, it } from "vitest";
import type { RankingModelRow, ScoreCardRow } from "@/db/schema";
import { asWorkspaceId, taggedString } from "@/domain/shared";
import type { ProductId, RankingModelId, WorkspaceId } from "@/domain/shared";
import {
  createD1RankingModelRepository,
  createD1ScoreCardRepository,
} from "@/infrastructure/persistence/d1/ranking-repository";
import type { DrizzleD1 } from "@/infrastructure/persistence/d1/link-inbox-repository";
import {
  SAMPLE_MODEL_ID,
  SAMPLE_RANKING_MODELS,
  SAMPLE_SCORE_CARDS,
} from "@/infrastructure/persistence/sample/ranking-sample-repository";

const WS = asWorkspaceId("ws_sample") as WorkspaceId;
const PAGE = { limit: 50, cursor: null };

function modelId(value: string): RankingModelId {
  return taggedString<"RankingModelId">(value) as RankingModelId;
}

function productId(value: string): ProductId {
  return taggedString<"ProductId">(value) as ProductId;
}

/** どの問い合わせも落ちる接続。表が無い・形がずれている状態。 */
function brokenDb(): DrizzleD1 {
  const boom = () => {
    throw new Error("D1_ERROR: no such table: ranking_models");
  };
  return { select: boom, insert: boom } as unknown as DrizzleD1;
}

/** 問い合わせの形だけ受け取って、決めた行を返す偽の接続。 */
function fakeDb(rows: readonly unknown[]): DrizzleD1 {
  const chain = {
    from: () => chain,
    where: () => chain,
    limit: () => Promise.resolve(rows),
    orderBy: () => Promise.resolve(rows),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(rows).then(resolve),
  };
  return { select: () => chain } as unknown as DrizzleD1;
}

/** 保存の問い合わせだけを受け取って、何を渡されたかを覚えておく接続。 */
function recordingDb(): {
  db: DrizzleD1;
  saved: Record<string, unknown>[];
  conflicts: unknown[];
} {
  const saved: Record<string, unknown>[] = [];
  const conflicts: unknown[] = [];
  const chain = {
    values: (v: Record<string, unknown>) => {
      saved.push(v);
      return chain;
    },
    onConflictDoUpdate: (arg: unknown) => {
      conflicts.push(arg);
      return Promise.resolve(undefined);
    },
  };
  return { db: { insert: () => chain } as unknown as DrizzleD1, saved, conflicts };
}

/**
 * 見本の基準を 1 行にした形。
 *
 * JSON 列には「列に無い分」だけが入る。本物の `save` と同じ切り方にしないと、
 * 往復のテストが本番と違うものを見ることになる。
 */
function modelJsonOf(): string {
  const {
    id: _id,
    workspaceId: _workspaceId,
    categoryId: _categoryId,
    version: _version,
    audience: _audience,
    effectiveFrom: _effectiveFrom,
    ...rest
  } = SAMPLE_RANKING_MODELS[0];
  return JSON.stringify(rest);
}

function modelRow(over: Partial<RankingModelRow> = {}): RankingModelRow {
  return {
    id: "rm_stored",
    workspaceId: "ws_sample",
    categoryId: "cat_laptop",
    version: "2026.09-1",
    audience: "保存された読者",
    effectiveFrom: new Date("2026-09-01T00:00:00.000Z"),
    modelJson: modelJsonOf(),
    ...over,
  };
}

function cardRow(over: Partial<ScoreCardRow> = {}): ScoreCardRow {
  const { productId, testedAt, ...rest } = SAMPLE_SCORE_CARDS[0];
  return {
    workspaceId: "ws_sample",
    modelId: "rm_stored",
    productId: String(productId),
    testedAt,
    cardJson: JSON.stringify(rest),
    ...over,
  };
}

describe("順位の保存先（D1）が落ちたとき", () => {
  it("一覧は投げずに断りを返す", async () => {
    const repo = createD1RankingModelRepository(brokenDb());
    const got = await repo.list(WS, PAGE);
    expect(got.ok).toBe(false);
    if (got.ok) return;
    expect(got.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("1 件の読み出しも投げずに断りを返す", async () => {
    const repo = createD1RankingModelRepository(brokenDb());
    const got = await repo.findById(WS, modelId("rm_stored"));
    expect(got.ok).toBe(false);
  });

  it("点の保存も投げずに断りを返す", async () => {
    const repo = createD1ScoreCardRepository(brokenDb());
    const got = await repo.save(WS, modelId("rm_stored"), {
      productId: productId("p_alpha_15"),
      scores: { usability: 0.5 },
      evidenceRefs: ["testrun_x"],
      testedAt: null,
    });
    expect(got.ok).toBe(false);
  });

  it("表の名前を画面へ出す言葉に混ぜない", async () => {
    const repo = createD1RankingModelRepository(brokenDb());
    const got = await repo.list(WS, PAGE);
    if (got.ok) return;
    // 「no such table: ranking_models」をそのまま出すと、
    // 直せない情報だけが利用者に届き、直せる情報が届かない。
    expect(got.error.message).not.toContain("ranking_models");
    expect(got.error.message).not.toContain("D1_ERROR");
  });
});

describe("見本を消さずに重ねる", () => {
  it("保存された基準が見本より先に並ぶ", async () => {
    const repo = createD1RankingModelRepository(fakeDb([modelRow()]));
    const got = await repo.list(WS, PAGE);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(String(got.value.items[0].id)).toBe("rm_stored");
    // 見本が消えていない。0 件のときに「まだ作っていない」のか
    // 「壊れている」のかを画面から見分けられなくなるため。
    expect(got.value.items.map((m) => String(m.id))).toContain(String(SAMPLE_MODEL_ID));
  });

  it("保存先に無い ID は見本を見に行く", async () => {
    const repo = createD1RankingModelRepository(fakeDb([]));
    const got = await repo.findById(WS, SAMPLE_MODEL_ID as RankingModelId);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value).not.toBeNull();
  });

  it("JSON 列に入れた指標が往復して戻る", async () => {
    const repo = createD1RankingModelRepository(fakeDb([modelRow()]));
    const got = await repo.list(WS, PAGE);
    if (!got.ok) return;
    const stored = got.value.items[0];
    expect(stored.criteria.length).toBe(SAMPLE_RANKING_MODELS[0].criteria.length);
    expect(stored.version).toBe("2026.09-1");
  });

  it("保存された JSON が何であれ、報酬を入力にしない印は立たない", async () => {
    // 列に報酬が無くても、JSON の中身を信じると true が入り込む道ができる。
    const tampered = modelRow({
      modelJson: JSON.stringify({
        ...(JSON.parse(modelJsonOf()) as Record<string, unknown>),
        affiliateCompensationIsInput: true,
      }),
    });
    const repo = createD1RankingModelRepository(fakeDb([tampered]));
    const got = await repo.list(WS, PAGE);
    if (!got.ok) return;
    expect(got.value.items[0].affiliateCompensationIsInput).toBe(false);
  });

  it("点は、保存された商品の分だけ見本を置き換える", async () => {
    const repo = createD1ScoreCardRepository(fakeDb([cardRow()]));
    const got = await repo.listByModel(WS, modelId("rm_stored"), [
      productId("p_alpha_15"),
      productId("p_beta_14"),
    ]);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    // 保存された p_alpha_15 は 1 件だけ。見本と二重に並ぶと、
    // 同じ商品が順位に 2 回出る。
    expect(got.value.filter((c) => String(c.productId) === "p_alpha_15")).toHaveLength(1);
    expect(got.value.map((c) => String(c.productId))).toContain("p_beta_14");
  });

  it("頼まれた商品が 0 件なら保存先に聞かない", async () => {
    // 聞くと、空の `inArray` から全件が返る保存先がある。
    // 順位に無関係な商品が並ぶうえ、それが「点が付いている」ように見える。
    const repo = createD1ScoreCardRepository(brokenDb());
    const got = await repo.listByModel(WS, modelId("rm_stored"), []);
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.value).toEqual([]);
  });
});

describe("保存するときの列の切り方", () => {
  it("基準の列には報酬の欄が 1 つも無い", async () => {
    const { db, saved } = recordingDb();
    const repo = createD1RankingModelRepository(db);
    await repo.save(SAMPLE_RANKING_MODELS[0]);
    const row = saved[0];
    for (const key of Object.keys(row)) {
      expect(key).not.toContain("affiliate");
      expect(key).not.toContain("revenue");
      expect(key).not.toContain("compensation");
    }
  });

  it("点の保存は作業場所・基準・商品の 3 列で衝突を見る", async () => {
    const { db, conflicts } = recordingDb();
    const repo = createD1ScoreCardRepository(db);
    await repo.save(WS, modelId("rm_stored"), {
      productId: productId("p_alpha_15"),
      scores: { usability: 0.5 },
      evidenceRefs: ["testrun_x"],
      testedAt: null,
    });
    const target = (conflicts[0] as { target: readonly unknown[] }).target;
    // 商品だけで見ると、版を上げて測り直した点が前の版を上書きする。
    // 版を上げる決まりは過去の順位を再現するためにあるので、そこで意味を失う。
    expect(Array.isArray(target)).toBe(true);
    expect(target).toHaveLength(3);
  });

  it("点の列には基準の ID が入る", async () => {
    const { db, saved } = recordingDb();
    const repo = createD1ScoreCardRepository(db);
    await repo.save(WS, modelId("rm_stored"), {
      productId: productId("p_alpha_15"),
      scores: { usability: 0.5 },
      evidenceRefs: ["testrun_x"],
      testedAt: null,
    });
    expect(saved[0].modelId).toBe("rm_stored");
    expect(saved[0].workspaceId).toBe("ws_sample");
  });
});
