import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import { type SiteBlueprint, createSiteBlueprint } from "@/domain/authoring";
import { type WorkspaceId, markEditorial, ok, taggedString } from "@/domain/shared";
import { registerStub } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./ranking-sample-repository";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * ここには**ブログを 2 本**置いている。1 本では
 * 「ブログごとに分岐するコードを書いていない」ことを示せないため。
 *
 * 2 本目 (`gear-for-small-kitchen`) は 1 本目と
 *   - ブログパターン (specialist_review → comparison_lab)
 *   - ブランドテーマの名前 (graphite-amber → teal-clay)
 *   - カテゴリー構成と差別化の 10 軸
 * だけが違う。**画面のコードは 1 行も分岐していない。**
 * このことは `tests/domain/site-routes.test.ts` と
 * `tests/ui/blueprint-theme.test.ts` が機械的に確認する。
 */
const stub = registerStub({
  id: "persistence:site-sample",
  port: "SiteRepositoryPort",
  label: "ブログの設計図（見本データ）",
  blockedBy: "site_blueprints テーブルの追加とマイグレーション",
});

export const SAMPLE_SITE_SLUG = "video-editing-gear";
export const SECOND_SITE_SLUG = "gear-for-small-kitchen";

function build(
  slug: string,
  input: Omit<Parameters<typeof createSiteBlueprint>[0], "id" | "workspaceId">,
): SiteBlueprint {
  const built = createSiteBlueprint({
    id: taggedString<"SiteBlueprintId">(`sb_${slug.replace(/-/g, "_")}`),
    workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId,
    ...input,
  });
  if (!built.ok) {
    // 見本が不変条件を満たさないのは欠陥。黙って動かさない。
    throw new Error(`見本のブログ設計図が不正です (${slug}): ${built.error.message}`);
  }
  return built.value;
}

const VIDEO_EDITING = build(SAMPLE_SITE_SLUG, {
  name: "動画編集の道具",
  pattern: "specialist_review",
  purpose: "動画編集を仕事にしている人が、道具選びで時間を失わないようにする",
  genre: "動画編集向けパソコン・周辺機器",
  revenueModel: "affiliate",
  extraPages: ["search", "shortlist", "faq", "glossary", "how_to_choose"],
  categories: [
    {
      slug: "laptops",
      name: "ノートパソコン",
      oneLine: "書き出し時間を実測して選んだ、持ち運べる編集機。",
      initialArticleTypes: ["ranking", "review", "comparison"],
    },
    {
      slug: "monitors",
      name: "モニター",
      oneLine: "色の正確さを測って比べた、編集用の画面。",
      initialArticleTypes: ["comparison", "review"],
    },
    {
      slug: "storage",
      name: "保存装置",
      oneLine: "素材を失わないための保存先の選び方。",
      initialArticleTypes: ["guide", "comparison"],
    },
  ],
  theme: { brandTheme: "graphite-amber" },
  differentiation: {
    targetReader: "受注制作をしている個人の動画編集者",
    searchIntent: "納期に間に合う書き出し速度の機種を知りたい",
    articlePurpose: "実測値で機種を絞り込ませる",
    evaluationAxis: "同一素材の書き出し時間と、連続稼働時の温度・動作音",
    usageScene: "自宅と客先を往復しながら編集する",
    uniqueExperience: "同一素材を 3 回書き出して中央値を取る自社検証",
    comparisonScope: "実売 15 万〜40 万円のノートパソコン",
    conclusionStance: "1 位を断言し、選ばなかった理由も書く",
    internalLinkStrategy: "順位表の商品名から個別レビューへ落とす",
    ctaStrategy: "実売価格を確認できる販売ページのみ。購入は急かさない",
  },
  emitLlmsTxt: true,
});

/**
 * 2 本目。1 本目と共通のコードで立ち上がることを示すためのもの。
 *
 * ここで足したのは設定値だけ。ルート表・画面・部品はすべて共通のまま。
 */
const SMALL_KITCHEN = build(SECOND_SITE_SLUG, {
  name: "せまい台所の道具",
  pattern: "comparison_lab",
  purpose: "台所が狭い家で、置ける大きさの調理道具を選べるようにする",
  genre: "小型調理家電・キッチン用品",
  revenueModel: "affiliate",
  extraPages: ["tools", "faq", "how_to_choose"],
  categories: [
    {
      slug: "rice-cookers",
      name: "炊飯器",
      oneLine: "設置に必要な奥行きと蒸気の逃げ方で比べた炊飯器。",
      initialArticleTypes: ["comparison", "ranking"],
    },
    {
      slug: "ovens",
      name: "オーブン・トースター",
      oneLine: "壁との距離をどれだけ空ける必要があるかで比べた加熱器具。",
      initialArticleTypes: ["comparison", "review"],
    },
  ],
  theme: { brandTheme: "teal-clay", density: "compact", radius: "small" },
  differentiation: {
    targetReader: "調理台の幅が 60cm 以下の家に住んでいる人",
    searchIntent: "置ける大きさかどうかを先に確かめたい",
    articlePurpose: "設置寸法から候補を外させる",
    evaluationAxis: "本体寸法と、必要な放熱スペースを含めた占有面積",
    usageScene: "調理台の上に出しっぱなしで毎日使う",
    uniqueExperience: "実機を 60cm の調理台に置いて撮影した設置写真",
    comparisonScope: "占有面積 0.15 平方メートル以下の製品",
    conclusionStance: "置ける・置けないをはっきり書く",
    internalLinkStrategy: "比較表の寸法から個別レビューへ落とす",
    ctaStrategy: "在庫と寸法を確認できる販売ページのみ",
  },
});

const SITES: readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[] = [
  { slug: SAMPLE_SITE_SLUG, blueprint: VIDEO_EDITING },
  { slug: SECOND_SITE_SLUG, blueprint: SMALL_KITCHEN },
];

export function sampleSiteNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

export function createSampleSiteRepository(): EditorialSiteRepositoryPort {
  return markEditorial({
    async findBySlug(slug: string) {
      return ok(SITES.find((s) => s.slug === slug)?.blueprint ?? null);
    },
    async list() {
      return ok(SITES);
    },
  });
}
