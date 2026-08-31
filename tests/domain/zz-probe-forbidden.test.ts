/**
 * @tier 1
 * @req REQ-TM01, REQ-TM09
 * @types equivalence, decision-table
 *
 * **登録表に無い項目を、計測の記録に入れられないこと。**
 *
 * `docs/product/traceability.md` P 節の締めくくりは
 * 「プロンプト本文、生成された文章そのもの — **参照 ID だけ**を持つ」と書いている。
 * 2026-08-21 まで、それを支えていたのは `FORBIDDEN_FIELDS` の 17 語だけだった。
 * `buildTelemetryEvent` は**宣言された項目を見るだけ**で、表に無い項目は
 * 素通りして `payload` にそのまま保存される。実測では、`ai_model_usage` に
 * `editorNote` という名前で生成文を入れた記録が**そのまま通った**（`W03` 型）。
 * 禁止語の一覧は「うっかり」を止める網であって、名前は無限に作れる。
 *
 * 入口で表に無い項目を落とすように直したうえで、ここで留める。
 *
 * --- ファイル名について ---
 * この名前は穴を測るために作った一時ファイルの名残である。改名・移動は
 * `rm` / `mv` が見張りに止められたため行えていない。中身は一時ではなく、
 * `tests/domain/telemetry-undeclared-fields.test.ts` へ移して構わない。
 */
import { describe, expect, it } from "vitest";
import { buildTelemetryEvent } from "@/domain/analytics";

/** `ai_model_usage` の必須項目を、登録表のとおりに手で書き写したもの。 */
const AI_USAGE_PAYLOAD = {
  workspaceId: "ws_1",
  brandId: "br_1",
  siteSlug: "s",
  actorId: "u_1",
  modelId: "m_1",
  provider: "anthropic",
  usecase: "draft",
  promptTemplateId: "t_1",
  promptTemplateVersion: 1,
  inputTokens: 100,
  outputTokens: 200,
  durationMs: 1200,
  success: true,
  estimatedCostJpy: 3.5,
  artifactId: "a_1",
  artifactKind: "draft",
} as const;

describe("計測の記録に、表に無い項目を入れない", () => {
  it("表のとおりの項目だけなら通る（この試験の前提が壊れていないこと）", () => {
    const r = buildTelemetryEvent({
      key: "ai_model_usage",
      occurredAt: new Date("2026-08-21T00:00:00.000Z"),
      readerKey: null,
      payload: { ...AI_USAGE_PAYLOAD },
    });
    expect(r.ok, r.ok ? "" : r.error.message).toBe(true);
  });

  it("禁止語に当たらない名前でも、表に無ければ落ちる（文章の抜け道を塞ぐ）", () => {
    const r = buildTelemetryEvent({
      key: "ai_model_usage",
      occurredAt: new Date("2026-08-21T00:00:00.000Z"),
      readerKey: null,
      payload: {
        ...AI_USAGE_PAYLOAD,
        // `FORBIDDEN_FIELDS` のどれにも当たらない名前。
        editorNote: "生成された文章そのものをここへ入れる",
      },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("editorNote");
    expect(r.error.message).toContain("登録表に無い項目");
  });

  it("読者側のイベントでも同じように落ちる（AI の記録だけの話にしない）", () => {
    const r = buildTelemetryEvent({
      key: "page_view",
      occurredAt: new Date("2026-08-21T00:00:00.000Z"),
      readerKey: null,
      payload: { path: "/a", siteSlug: "s", referrerKind: "直接", memo: "自由記述" },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("memo");
  });
});
