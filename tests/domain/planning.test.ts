/** @tier 1 @req REQ-SEC07, REQ-E23 @types decision-table, equivalence */
import { describe, expect, it } from "vitest";
import {
  canStartGeneration,
  createContentPackage,
  selectRepresentativeCells,
} from "@/domain/authoring/content-package";
import {
  MIN_DIFFERENT_AXES,
  createSiteBlueprint,
  differentiationGap,
  missingTrustPages,
  type CategoryPlan,
  type DifferentiationAxes,
} from "@/domain/authoring/site-blueprint";
import { POLICY_DOMAIN_SCOPES, buildSeedPolicyRules, checkPolicies } from "@/domain/compliance";
import { taggedString } from "@/domain/shared";

/**
 * ブログの設計図と、記事の企画。
 *
 * どちらも「作る前に決まっていること」を持つ。
 * ここが緩むと、後段（生成・公開）でいくら止めても間に合わない。
 */

const WS = taggedString<"WorkspaceId">("ws_test");

const AXES: DifferentiationAxes = {
  targetReader: "動画編集をこれから始める人",
  searchIntent: "最初の 1 台を選びたい",
  articlePurpose: "選び方の基準を渡す",
  evaluationAxis: "書き出し時間",
  usageScene: "自宅の机",
  uniqueExperience: "同一素材での実測",
  comparisonScope: "10 万円以下",
  conclusionStance: "1 台を名指しする",
  internalLinkStrategy: "選び方から個別レビューへ",
  ctaStrategy: "価格の確認だけを促す",
};

const CATEGORY: CategoryPlan = {
  slug: "laptop",
  name: "ノートパソコン",
  oneLine: "動画編集に使えるノートパソコンを、書き出し時間で比べます。",
  initialArticleTypes: ["ranking"],
};

function blueprint(over: Partial<Parameters<typeof createSiteBlueprint>[0]> = {}) {
  return createSiteBlueprint({
    id: taggedString<"SiteBlueprintId">("sb_1"),
    workspaceId: WS,
    name: "動画編集PC比較",
    pattern: "specialist_review",
    purpose: "最初の 1 台を選べるようにする",
    genre: "パソコン",
    revenueModel: "affiliate",
    categories: [CATEGORY],
    differentiation: AXES,
    ...over,
  });
}

describe("ブログの設計図", () => {
  it("必要なものがそろえば作れて、信頼ページが最初から入っている", () => {
    const r = blueprint();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 運営者情報などは、あとから足すものではなく最初から入っている。
    expect(missingTrustPages(r.value)).toEqual([]);
    expect(r.value.emitLlmsTxt).toBe(false);
  });

  it("ブログ名が空だと作れない", () => {
    const r = blueprint({ name: "  " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("name");
  });

  it("カテゴリーが 1 つも無いと作れない（読者の入口が無い）", () => {
    const r = blueprint({ categories: [] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.field).toBe("categories");
  });

  it("差別化の軸が空だと、空いている軸を名指しして断る", () => {
    const r = blueprint({
      differentiation: { ...AXES, evaluationAxis: "", conclusionStance: "  " },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.field).toBe("differentiation");
      expect(r.error.message).toContain("evaluationAxis");
      expect(r.error.message).toContain("conclusionStance");
    }
  });

  it("カテゴリーのURL用の名前は半角英小文字・数字・ハイフンだけ", () => {
    expect(blueprint({ categories: [{ ...CATEGORY, slug: "ノートPC" }] }).ok).toBe(false);
    expect(blueprint({ categories: [{ ...CATEGORY, slug: "Laptop" }] }).ok).toBe(false);
    expect(blueprint({ categories: [{ ...CATEGORY, slug: "laptop-2in1" }] }).ok).toBe(true);
  });

  it("同じURL用の名前のカテゴリーを 2 つ置けない", () => {
    const r = blueprint({ categories: [CATEGORY, { ...CATEGORY, name: "別名" }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain("重複");
  });

  it("カテゴリーの 1 文説明が空だと断る", () => {
    const r = blueprint({ categories: [{ ...CATEGORY, oneLine: " " }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain(CATEGORY.name);
  });

  it("2 つのブログが似すぎているかを、違う軸の数で判断する", () => {
    const twoDifferent: DifferentiationAxes = {
      ...AXES,
      targetReader: "仕事で毎日使う人",
      usageScene: "客先",
    };
    const gapSmall = differentiationGap(AXES, twoDifferent);
    expect(gapSmall.differentAxes).toHaveLength(2);
    expect(gapSmall.sufficient).toBe(false);

    const threeDifferent: DifferentiationAxes = { ...twoDifferent, evaluationAxis: "静かさ" };
    const gapEnough = differentiationGap(AXES, threeDifferent);
    // ちょうど下限で足りるとする。ここを 1 つずらすと似たブログが量産される。
    expect(gapEnough.differentAxes).toHaveLength(MIN_DIFFERENT_AXES);
    expect(gapEnough.sufficient).toBe(true);
  });

  it("前後の空白だけの違いは「違う軸」と数えない", () => {
    const padded: DifferentiationAxes = { ...AXES, targetReader: ` ${AXES.targetReader} ` };
    expect(differentiationGap(AXES, padded).differentAxes).toEqual([]);
  });
});

describe("記事の企画", () => {
  function pkg(over: Partial<Parameters<typeof createContentPackage>[0]> = {}) {
    return createContentPackage({
      id: taggedString<"ContentPackageId">("cp_1"),
      workspaceId: WS,
      brandId: "br_1",
      primarySubjectId: taggedString<"ProductId">("pr_1"),
      domainScope: "general",
      claimIds: [taggedString<"ClaimId">("cl_1")],
      evidenceIds: [taggedString<"EvidenceId">("ev_1")],
      authorPersonaId: taggedString<"AuthorPersonaId">("ap_1"),
      audiencePersonaIds: [taggedString<"AudiencePersonaId">("aud_1")],
      objective: "最初の 1 台を選べるようにする",
      funnelStage: "consideration",
      contentAngles: ["beginner"],
      ...over,
    });
  }

  it("作った直後は下調べ中で、記事はまだ 1 本も無い", () => {
    const r = pkg();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.status).toBe("researching");
    expect(r.value.variantIds).toEqual([]);
    expect(r.value.masterBriefId).toBeNull();
    // 渡さなかったものは null になる（undefined を持ち回らない）。
    expect(r.value.campaignId).toBeNull();
    expect(r.value.comparisonSetId).toBeNull();
  });

  it("記事の分野が無いと作れない（分野が無い企画にはポリシーが当たらないため）", () => {
    // 型では防げない入口（保存先からの読み戻し・道具経由の JSON）を想定して、
    // 実行時にも断ることを固定する。既定値で general に倒すと、
    // 薬機法・金融のルールが一度も当たらないまま「違反 0 件」で通る。
    expect(pkg({ domainScope: undefined as never }).ok).toBe(false);
    expect(pkg({ domainScope: "健康食品" as never }).ok).toBe(false);
    expect(pkg({ domainScope: "health_food" }).ok).toBe(true);
  });

  /*
   * 分野は 8 つある。3 つだけ試すと、残り 5 つが弾かれるようになっても緑のままになる。
   * 一覧を実装から取らずに手で書き写し、全通り並べる。
   * ここが増えたときは、この配列を足すまで落ちる。
   */
  const DOMAIN_SCOPES = [
    "general",
    "health_food",
    "cosmetics",
    "medical",
    "finance",
    "gambling",
    "alcohol",
    "children",
  ] as const;

  it.each(DOMAIN_SCOPES)("分野「%s」は登録できる", (domainScope) => {
    expect(pkg({ domainScope }).ok).toBe(true);
  });

  it("分野の一覧は 8 つで、実装と同じ並びである", () => {
    expect(POLICY_DOMAIN_SCOPES).toEqual(DOMAIN_SCOPES);
  });

  it.each([
    [undefined, "未指定"],
    [null, "空"],
    ["", "空文字"],
    ["健康食品", "日本語の表記ゆれ"],
    ["HEALTH_FOOD", "大文字"],
    ["health-food", "区切り文字ちがい"],
    ["supplement", "一覧に無い分野"],
    [1, "数値"],
  ])("一覧に無い %s（%s）は断る", (bad, _why) => {
    expect(pkg({ domainScope: bad as never }).ok).toBe(false);
  });

  it("達成したいこと・読者・切り口のどれが欠けても作れない", () => {
    expect(pkg({ objective: "  " }).ok).toBe(false);
    expect(pkg({ audiencePersonaIds: [] }).ok).toBe(false);
    expect(pkg({ contentAngles: [] }).ok).toBe(false);
  });

  it("生成に進めない理由は、足りないものを全部並べて返す", () => {
    const r = pkg({ claimIds: [], evidenceIds: [] });
    if (!r.ok) throw new Error(r.error.message);

    const gate = canStartGeneration(r.value);
    expect(gate.ok).toBe(false);
    if (gate.ok) return;
    expect(gate.error.code).toBe("EVIDENCE_REQUIRED");
    // 1 つずつ直させない。まとめて出す。
    expect(gate.error.message).toContain("承認済みの主張");
    expect(gate.error.message).toContain("根拠");
  });

  it("そろっていれば生成に進める", () => {
    const r = pkg();
    if (!r.ok) throw new Error(r.error.message);
    expect(canStartGeneration(r.value).ok).toBe(true);
  });

  it("生成の候補は、読者を先に散らしてから切り口・媒体へ回る", () => {
    const r = pkg({
      audiencePersonaIds: [
        taggedString<"AudiencePersonaId">("aud_1"),
        taggedString<"AudiencePersonaId">("aud_2"),
      ],
      contentAngles: ["beginner", "expert"],
    });
    if (!r.ok) throw new Error(r.error.message);

    const cells = selectRepresentativeCells(r.value, ["blog", "note"], 4);
    expect(cells.ok).toBe(true);
    if (!cells.ok) return;
    // 先頭 2 件で読者が 2 人とも出る。同じ読者に 2 回当てるより先に、別の読者へ届かせる。
    expect(cells.value.slice(0, 2).map((c) => String(c.audiencePersonaId))).toEqual([
      "aud_1",
      "aud_2",
    ]);
    expect(cells.value).toHaveLength(4);
  });

  it("組み合わせの数より多い上限を渡しても、ある分しか返さない", () => {
    const r = pkg();
    if (!r.ok) throw new Error(r.error.message);
    // 読者 1 × 切り口 1 × 媒体 1 = 1 通りしかない。
    const cells = selectRepresentativeCells(r.value, ["blog"], 50);
    expect(cells.ok).toBe(true);
    if (cells.ok) expect(cells.value).toHaveLength(1);
  });

  it("上限が 0 以下、または媒体が空なら断る", () => {
    const r = pkg();
    if (!r.ok) throw new Error(r.error.message);
    expect(selectRepresentativeCells(r.value, ["blog"], 0).ok).toBe(false);
    expect(selectRepresentativeCells(r.value, ["blog"], -1).ok).toBe(false);
    expect(selectRepresentativeCells(r.value, [], 5).ok).toBe(false);
  });
});

/**
 * 企画の分野が、実際に表現ポリシーの選別へ届いていることを固定する。
 *
 * 欄を足しただけでは意味が無い。**その欄がルールの当たり外れを変える**ところまで
 * 見ていないと、あとで既定値に倒しても誰も気づかない。
 * ここは企画（authoring）と表現ポリシー（compliance）の継ぎ目を、
 * 呼び出し側の実装を待たずに domain の中で確かめる。
 *
 * 要件 REQ-SEC07 / REQ-E23、種別 decision-table。**印はファイル冒頭にある**
 * （機械が読むのは先頭 40 行だけなので、ここに `@` で書いても読まれない）。
 */
describe("企画の分野が、当たるルールを決める", () => {
  const RULES = (() => {
    const built = buildSeedPolicyRules(WS);
    if (!built.ok) throw new Error("初期ルールを組み立てられません");
    return built.value;
  })();

  /** 薬機法（健康食品）の block ルールに当たる文。 */
  const NG_TEXT = "飲み続ければ花粉症が治ります。";

  function checkFor(domainScope: Parameters<typeof pkgFactory>[0]) {
    const r = pkgFactory(domainScope);
    if (!r.ok) throw new Error(r.error.message);
    return checkPolicies(RULES, {
      text: NG_TEXT,
      domainScope: r.value.domainScope,
      channelScope: "own_site",
    });
  }

  function pkgFactory(domainScope: "general" | "health_food") {
    return createContentPackage({
      id: taggedString<"ContentPackageId">("cp_scope"),
      workspaceId: WS,
      brandId: "br_1",
      primarySubjectId: taggedString<"ProductId">("pr_1"),
      domainScope,
      claimIds: [],
      evidenceIds: [],
      authorPersonaId: taggedString<"AuthorPersonaId">("ap_1"),
      audiencePersonaIds: [taggedString<"AudiencePersonaId">("aud_1")],
      objective: "最初の 1 つを選べるようにする",
      funnelStage: "consideration",
      contentAngles: ["beginner"],
    });
  }

  it("健康食品の企画なら、薬機法のルールが当たって公開できない", () => {
    const result = checkFor("health_food");
    expect(result.violations.map((v) => v.ruleName)).toContain("薬機法: 治る・完治の断定");
    expect(result.publishable).toBe(false);
  });

  it("同じ文でも、分野ちがいの企画には当たらない", () => {
    // ここが「当たらない」ことは正しい挙動である。
    // 化粧品のルールが家電の記事を止めると、運用でポリシーごと切られる。
    expect(checkFor("general").violations).toEqual([]);
  });
});
