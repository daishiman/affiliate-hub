import type { GenerationInput } from "@/domain/generation";
import { markEditorial } from "@/domain/shared";

/**
 * **これは見本データ（スタブ）である。**
 *
 * 「18 項目がそろった状態」を画面で実際に押して確かめるために置いてある。
 * 本番では商品・主張・根拠の各画面で承認されたものを組み立てて渡す。
 *
 * 見本であることを画面側でも表示する。表示せずに置くと、
 * 「もう素材がそろっている」と誤解されたまま先へ進む。
 */
export function sampleGenerationInput(): GenerationInput {
  return {
    subject: "動画編集に向くノートパソコンの選び方",
    products: [
      markEditorial({ id: "prod_air15", label: "見本ノート A（15インチ）" }),
      markEditorial({ id: "prod_pro14", label: "見本ノート B（14インチ）" }),
    ],
    claims: [
      { id: "claim_export", statement: "4K の書き出しにかかる時間が実測で 2 割短い" },
      { id: "claim_battery", statement: "編集作業を続けた状態で 6 時間持つ" },
    ],
    evidence: [
      { id: "ev_bench", sourceUrl: "https://example.com/bench" },
      { id: "ev_spec", sourceUrl: null },
    ],
    testRuns: [{ id: "run_export_2026_03" }],
    authorPersona: { id: "persona_editor", role: "映像編集を仕事にしている書き手" },
    audiencePersona: { id: "persona_beginner", knowledgeLevel: "編集を始めて半年ほどの人" },
    channel: "blog",
    contentPurpose: "予算内で迷わず 1 台を選べるようにする",
    purchaseStage: "比較検討",
    angle: "書き出し時間と持ち運びやすさの釣り合い",
    length: { kind: "standard", minChars: 3_000, maxChars: 6_000 },
    cta: { kind: "compare", phrase: "条件を絞って比べる" },
    disclosure: "この記事には広告（アフィリエイトリンク）が含まれます。",
    forbiddenExpressions: ["絶対に", "必ず速くなる", "誰でも稼げる"],
    articleTemplate: {
      type: "comparison",
      sectionIds: ["intro", "criteria", "ranking", "detail", "faq", "closing"],
    },
    siteBlueprint: { id: "blueprint_creator", slug: "creator-gear" },
    rankingModel: { id: "model_video_editing" },
  };
}
