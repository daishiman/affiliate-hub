/**
 * @tier 1
 * @req REQ-S06, REQ-W10
 * @types equivalence, boundary
 *
 * 運営者側のブログ管理（`manage-sites.ts`）。
 *
 * 追跡表は REQ-S06 の判定欄に `tests/application/build-site.test.ts` を挙げていたが、
 * あれは作成ウィザードの側で、**このファイルは 1 度も動いていなかった**
 * （2026-08-17 の実測で生き残り 83 変異、テストファイル 0 件）。
 *
 * ここで固定したいこと。
 *   1. **他社のブログが見えない。** 運営側の読み取りは設計図と公開できない理由まで見える。
 *      絞り忘れると、同じ役割の別会社の人が他社の構成をそのまま読める。
 *   2. **「他社のもの」と「無い」を同じ顔で断る。** 種類を分けると名前の実在が漏れる。
 *   3. **公開できない理由を、画面ではなくここが作る。** 画面ごとに書くと片方だけ古くなる。
 *   4. **ブログどうしが近すぎることを、増やす前に見つける。**
 */
import { describe, expect, it } from "vitest";
import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import {
  DIFFERENTIATION_AXIS_LABEL,
  createCheckSiteDifferentiationUseCase,
  createGetManagedSiteUseCase,
  createListManagedSitesUseCase,
} from "@/application/usecases/site/manage-sites";
import {
  REVENUE_MODEL_LABEL,
  SITE_PATTERN_LABEL,
  type DifferentiationAxes,
  type SiteBlueprint,
  type StandardPage,
  createSiteBlueprint,
  routesFor,
} from "@/domain/authoring";
import {
  type SiteBlueprintId,
  type WorkspaceId,
  type BrandId,
  domainError,
  err,
  markCommercial,
  markEditorial,
  ok,
  taggedString,
} from "@/domain/shared";
import { OTHER_WORKSPACE, WORKSPACE, anOwner } from "../support/actors";

const owner = anOwner({ workspaceId: WORKSPACE });

const BASE_AXES: DifferentiationAxes = {
  targetReader: "動画編集を仕事にしている人",
  searchIntent: "書き出し時間を短くしたい",
  articlePurpose: "買う前の絞り込み",
  evaluationAxis: "実測の書き出し時間",
  usageScene: "撮影の合間に編集する",
  uniqueExperience: "同じ素材で全機を実測している",
  comparisonScope: "20 万円以下のノートに絞る",
  conclusionStance: "1 台だけ薦める",
  internalLinkStrategy: "実測記事から比較表へ返す",
  ctaStrategy: "在庫のある店だけ出す",
};

function blueprint(
  slug: string,
  over: {
    workspaceId?: WorkspaceId;
    name?: string;
    axes?: Partial<DifferentiationAxes>;
    pages?: readonly StandardPage[];
  } = {},
): SiteBlueprint {
  const built = createSiteBlueprint({
    id: taggedString<"SiteBlueprintId">(`sb_${slug}`) as SiteBlueprintId,
    workspaceId: over.workspaceId ?? WORKSPACE,
    name: over.name ?? "動画編集の道具",
    pattern: "specialist_review",
    purpose: "道具選びで時間を失わないようにする",
    genre: "動画編集向けパソコン",
    revenueModel: "affiliate",
    categories: [
      {
        slug: "laptops",
        name: "ノートパソコン",
        oneLine: "書き出し時間を実測して選んだ編集機。",
        initialArticleTypes: ["review"],
      },
    ],
    differentiation: { ...BASE_AXES, ...over.axes },
  });
  if (!built.ok) throw new Error(built.error.message);
  // 信頼ページは組み立て時に必ず入る。**揃っていない状態**を作るには
  // ここで欠けさせるしかない（欠けた設計図が世に出る道は保存先からの読み出し）。
  return over.pages ? { ...built.value, pages: over.pages } : built.value;
}

function sitesOf(
  sites: readonly { slug: string; blueprint: SiteBlueprint }[],
  options: { fails?: boolean } = {},
): EditorialSiteRepositoryPort {
  return markEditorial({
    async findBySlug(slug: string) {
      if (options.fails) return err(domainError("UPSTREAM_UNAVAILABLE", "保存先に接続できません。"));
      return ok(sites.find((s) => s.slug === slug)?.blueprint ?? null);
    },
    async list() {
      if (options.fails) return err(domainError("UPSTREAM_UNAVAILABLE", "保存先に接続できません。"));
      return ok(sites);
    },
  }) as unknown as EditorialSiteRepositoryPort;
}

async function listSites(sites: readonly { slug: string; blueprint: SiteBlueprint }[], actor = owner) {
  const r = await createListManagedSitesUseCase({ sites: sitesOf(sites) }).execute(actor, {});
  if (!r.ok) throw new Error(r.error.message);
  return r.value;
}

describe("組み立てのときに、商業データを断る", () => {
  it("報酬側のつなぎ目が混ざっていたら、組み立てで落とす", () => {
    // 誤った設計図を運営者へ見せるより、動かない方がよい。
    const deps = {
      sites: sitesOf([]),
      reward: markCommercial({}),
    } as unknown as Parameters<typeof createListManagedSitesUseCase>[0];
    expect(() => createListManagedSitesUseCase(deps)).toThrow(/商業データ/);
    expect(() => createGetManagedSiteUseCase(deps)).toThrow(/商業データ/);
    expect(() => createCheckSiteDifferentiationUseCase(deps)).toThrow(/商業データ/);
  });
});

describe("運用中のブログ一覧", () => {
  it("ブランド限定担当者には、所属workspaceのサイトも列挙しない", async () => {
    const scoped = anOwner({
      workspaceId: WORKSPACE,
      scopedBrandIds: [taggedString<"BrandId">("brand-a") as BrandId],
    });
    const result = await createListManagedSitesUseCase({
      sites: sitesOf([{ slug: "mine", blueprint: blueprint("mine") }]),
    }).execute(scoped, {});

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("TENANT_MISMATCH");
  });

  it("自分の会社のブログだけを並べる", async () => {
    const view = await listSites([
      { slug: "mine", blueprint: blueprint("mine") },
      { slug: "theirs", blueprint: blueprint("theirs", { workspaceId: OTHER_WORKSPACE }) },
    ]);
    expect(view.items.map((i) => i.slug)).toEqual(["mine"]);
    expect(view.total).toBe(1);
  });

  it("1 本も無いときだけ、その理由を返す", async () => {
    const view = await listSites([]);
    expect(view.items).toHaveLength(0);
    expect(view.emptyReason).not.toBeNull();
  });

  it("1 本でもあれば、理由は付けない", async () => {
    const view = await listSites([{ slug: "mine", blueprint: blueprint("mine") }]);
    expect(view.emptyReason).toBeNull();
  });

  it("他社のブログしか無いときは、0 本として扱う", async () => {
    // ここで絞り忘れると、他社の設計図が一覧にそのまま並ぶ。
    const view = await listSites([
      { slug: "theirs", blueprint: blueprint("theirs", { workspaceId: OTHER_WORKSPACE }) },
    ]);
    expect(view.total).toBe(0);
    expect(view.emptyReason).not.toBeNull();
  });

  it("保存先が答えられないときは、その失敗をそのまま上げる", async () => {
    const r = await createListManagedSitesUseCase({ sites: sitesOf([], { fails: true }) }).execute(
      owner,
      {},
    );
    expect(r.ok).toBe(false);
  });

  it("表示名は domain の表から取る（画面ごとに言い換えない）", async () => {
    const bp = blueprint("mine");
    const view = await listSites([{ slug: "mine", blueprint: bp }]);
    const item = view.items[0];
    expect(item?.patternLabel).toBe(SITE_PATTERN_LABEL[bp.pattern]);
    expect(item?.revenueModelLabel).toBe(REVENUE_MODEL_LABEL[bp.revenueModel]);
  });

  it("数え上げは設計図から取る（カテゴリー数と経路の数）", async () => {
    const bp = blueprint("mine");
    const view = await listSites([{ slug: "mine", blueprint: bp }]);
    expect(view.items[0]?.categoryCount).toBe(bp.categories.length);
    expect(view.items[0]?.routeCount).toBe(routesFor(bp).length);
  });

  it("書き分けの判断に要る 3 軸だけを一覧に載せる", async () => {
    // 10 軸すべてを載せると、選ぶ画面が設計図の画面になる。
    const view = await listSites([{ slug: "mine", blueprint: blueprint("mine") }]);
    expect(Object.keys(view.items[0]?.differentiation ?? {}).sort()).toEqual([
      "conclusionStance",
      "searchIntent",
      "targetReader",
    ]);
    expect(view.items[0]?.differentiation.targetReader).toBe(BASE_AXES.targetReader);
  });
});

describe("公開できない理由", () => {
  it("信頼ページが揃っていれば、止める理由は無い", async () => {
    const view = await listSites([{ slug: "mine", blueprint: blueprint("mine") }]);
    expect(view.items[0]?.missingTrustPages).toHaveLength(0);
    expect(view.items[0]?.launchBlockedReason).toBeNull();
  });

  it("信頼ページが 1 枚でも欠けていれば、欠けている名前を挙げて止める", async () => {
    // 「後で作る」で公開すると、広告表記の説明先が無い記事が世に出る。
    const bp = blueprint("mine", { pages: ["home", "category"] });
    const view = await listSites([{ slug: "mine", blueprint: bp }]);
    const item = view.items[0];
    expect(item?.missingTrustPages.length).toBeGreaterThan(0);
    expect(item?.launchBlockedReason).toContain("advertising_policy");
  });
});

describe("ブログ 1 本の設計図", () => {
  async function get(
    slug: string,
    sites: readonly { slug: string; blueprint: SiteBlueprint }[],
    actor = owner,
  ) {
    return createGetManagedSiteUseCase({ sites: sitesOf(sites) }).execute(actor, {
      siteSlug: slug,
    });
  }

  it("自分のブログなら、設計図と経路をそのまま返す", async () => {
    const bp = blueprint("mine");
    const r = await get("mine", [{ slug: "mine", blueprint: bp }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.blueprint).toBe(bp);
    expect(r.value.routes).toEqual(routesFor(bp));
    expect(r.value.summary.slug).toBe("mine");
  });

  it("無いブログは「見つかりません」で断る", async () => {
    const r = await get("nope", []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("他社のブログも、無いのと同じ顔で断る", async () => {
    // 種類を分けると、返る `code` の違いだけで「その名前は実在する」と分かる。
    const theirs = blueprint("theirs", { workspaceId: OTHER_WORKSPACE });
    const r = await get("theirs", [{ slug: "theirs", blueprint: theirs }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("保存先が答えられないときは、無いことにしない", async () => {
    const r = await createGetManagedSiteUseCase({
      sites: sitesOf([], { fails: true }),
    }).execute(owner, { siteSlug: "mine" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("UPSTREAM_UNAVAILABLE");
  });

  it("差別化は 10 軸すべてを、表示名つきで返す", async () => {
    const r = await get("mine", [{ slug: "mine", blueprint: blueprint("mine") }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.axes).toHaveLength(10);
    for (const axis of r.value.axes) {
      expect(axis.label, axis.key).toBe(DIFFERENTIATION_AXIS_LABEL[axis.key]);
      expect(axis.value.length, axis.key).toBeGreaterThan(0);
    }
  });
});

describe("ブログどうしが十分に違うか", () => {
  async function check(sites: readonly { slug: string; blueprint: SiteBlueprint }[], actor = owner) {
    const r = await createCheckSiteDifferentiationUseCase({ sites: sitesOf(sites) }).execute(
      actor,
      {},
    );
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
  }

  it("1 本しかないときは、比べる相手がいないと返す", async () => {
    const view = await check([{ slug: "a", blueprint: blueprint("a") }]);
    expect(view.pairs).toHaveLength(0);
    expect(view.emptyReason).not.toBeNull();
  });

  it("同じ軸のままのブログ 2 本は「不足」として数える", async () => {
    // 言い換え記事の量産になる形。増やす前に画面で気づけるようにする。
    const view = await check([
      { slug: "a", blueprint: blueprint("a", { name: "A" }) },
      { slug: "b", blueprint: blueprint("b", { name: "B" }) },
    ]);
    expect(view.pairs).toHaveLength(1);
    expect(view.pairs[0]?.sufficient).toBe(false);
    expect(view.insufficientCount).toBe(1);
    expect(view.emptyReason).toBeNull();
  });

  it("3 軸以上が違えば足りている", async () => {
    const view = await check([
      { slug: "a", blueprint: blueprint("a") },
      {
        slug: "b",
        blueprint: blueprint("b", {
          axes: {
            targetReader: "料理を始めたばかりの人",
            searchIntent: "狭い台所に置ける道具を探している",
            conclusionStance: "用途ごとに 3 つ挙げる",
          },
        }),
      },
    ]);
    expect(view.pairs[0]?.sufficient).toBe(true);
    expect(view.insufficientCount).toBe(0);
  });

  it("違っている軸は、表示名で返す", async () => {
    const view = await check([
      { slug: "a", blueprint: blueprint("a") },
      { slug: "b", blueprint: blueprint("b", { axes: { targetReader: "料理を始めたばかりの人" } }) },
    ]);
    expect(view.pairs[0]?.differentAxisLabels).toContain(DIFFERENTIATION_AXIS_LABEL.targetReader);
  });

  it("3 本あれば 3 対を総当たりで見る", async () => {
    const view = await check([
      { slug: "a", blueprint: blueprint("a") },
      { slug: "b", blueprint: blueprint("b") },
      { slug: "c", blueprint: blueprint("c") },
    ]);
    expect(view.pairs.map((p) => `${p.a}-${p.b}`)).toEqual(["a-b", "a-c", "b-c"]);
  });

  it("比べる相手も自分の会社のブログだけ", async () => {
    // 他社と比べて「似ている」と言われても直せない。
    const view = await check([
      { slug: "mine", blueprint: blueprint("mine") },
      { slug: "theirs", blueprint: blueprint("theirs", { workspaceId: OTHER_WORKSPACE }) },
    ]);
    expect(view.pairs).toHaveLength(0);
  });

  it("対には、両方のブログ名を添える", async () => {
    const view = await check([
      { slug: "a", blueprint: blueprint("a", { name: "動画編集の道具" }) },
      { slug: "b", blueprint: blueprint("b", { name: "小さな台所の道具" }) },
    ]);
    expect(view.pairs[0]?.aName).toBe("動画編集の道具");
    expect(view.pairs[0]?.bName).toBe("小さな台所の道具");
  });
});
