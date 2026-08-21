/**
 * @tier 1
 * @req REQ-M03
 * @types contract
 *
 * **宣言している形どおりに呼べること。**
 *
 * 道具を呼ぶ側が AI のとき、入力は宣言（JSON Schema の `required`）から組み立てられる。
 * **AI は宣言を信じる以外にない。**`required` に入っていない項目は「無くても通る」と読む。
 * そこで断られると、断り文をどれだけ親切にしても直せない——足すべき項目が
 * 「要らない」と宣言されているからである。人なら画面を見て気づくが、AI には
 * 宣言と応答しか無い。
 *
 * ここが見張るのは**断り方ではなく、宣言と実際が一致していること**である。
 *
 * --- なぜ別のファイルなのか ---
 * `tool-catalog-adapters.test.ts` に置くと、同じ見本データを何度も書き換えながら
 * 進むことになる。あちらが対応状況を「対応中」に変えたあとでここが同じ道具を呼ぶと、
 * 「すでに「対応中」です。」で断られる。これは**宣言のずれではなく順番のずれ**で、
 * 同じ数に混ぜると「宣言が嘘だから断られた」と読めてしまう。
 * 見本データはモジュールの中に 1 組しか無いため、`createDeps()` を呼び直しても分かれない。
 * ファイルを分けるのがいちばん確実な分け方である。
 */
import { describe, expect, it } from "vitest";
import type { ActorContext } from "@/domain/shared";
import { createDeps } from "@/infrastructure/composition";
import { SAMPLE_ACTOR } from "@/infrastructure/identity/sample-actor";
import { buildToolCatalog } from "@/presentation/tools/catalog";
import { invokeTool, type AnyToolDefinition } from "@/presentation/tools/tool-definition";
import { requiredFieldsOf, validInputFor } from "./tool-inputs";

const catalog = buildToolCatalog(createDeps());

/** すべての役割を持つ人。宣言どおりの入力が権限で断られては、宣言を測れない。 */
const OWNER: ActorContext = { ...SAMPLE_ACTOR, roles: ["owner", ...SAMPLE_ACTOR.roles] };

const declarableTools = catalog.filter((t) => validInputFor(t) !== null);

/**
 * 走査対象の床。
 *
 * 2026-08-19 の実測は 111 個中 111 個（宣言から入力を組み立てられなかった道具は 0）。
 * 95 にしてあるのは、通常の整理で 16 個も減ることはまず無く、減っていたら
 * 「片付いた」より「入力の辞書が壊れて組み立てられなくなった」を先に疑うべきだからである。
 * 実測ちょうどに張ると、道具を 1 つ動かしただけで赤くなり、**床が狼少年になる。**
 * 狼少年になった床は、次に上げ下げされる。
 */
const DECLARATION_MIN_TOOLS = 95;

async function refusedForInput(tools: readonly AnyToolDefinition[]): Promise<readonly string[]> {
  const refused: string[] = [];
  for (const tool of tools) {
    const input = validInputFor(tool);
    if (input === null) continue;
    const result = await invokeTool(tool, OWNER, input);
    if (!result.ok && result.error.code === "VALIDATION_FAILED") {
      refused.push(
        `${tool.name}（required=${requiredFieldsOf(tool).join(",") || "なし"}）→ ${result.error.message}`,
      );
    }
  }
  return refused;
}

describe("宣言している形と、実際に通る形が一致していること", () => {
  it("宣言から入力を組み立てられる道具が、減っていない", () => {
    // **「0 件」は、走査対象が空でも同じ 0 になる。**
    // 下の 0 の理由を 1 つに絞るために、母集団のほうを先に確かめる。
    // この床を外すと、辞書が壊れて対象が 85 個へ痩せても下は緑のままになる（実測）。
    expect(
      declarableTools.length,
      `宣言から入力を組み立てられた道具が ${declarableTools.length} 個しかありません（床 ${DECLARATION_MIN_TOOLS} 個）。入力の辞書が壊れていないか先に見てください`,
    ).toBeGreaterThanOrEqual(DECLARATION_MIN_TOOLS);
  });

  it("入力不備で断る道具の数が 0 である", async () => {
    const refused = await refusedForInput(declarableTools);
    expect(
      refused.length,
      `宣言どおりに呼んでも断られる道具が ${refused.length} 個あります: ${refused.join(" / ")}。断り文を親切にしても直りません。宣言（required）のほうを実際に合わせてください`,
    ).toBe(0);
  });

  /**
   * **上の検査は、選択肢のある道具については宣言の外側を見ていない。**
   *
   * 入力を組み立てる側（`requiredFieldsOf`）は、選択肢があれば先頭の枝の必須も読む。
   * これは JSON Schema の正しい読み方だが、**読む側を賢くすると、書く側の嘘が隠れる。**
   * 外側の `required` が空でも、枝を読めば入力は組み立てられてしまう。
   * 呼ぶ側が枝まで読むとは限らないので、外側にも書けることは書く。
   */
  it("選択肢のある道具は、どれを選んでも要る項目を外側の required にも書いている", () => {
    const branchesOf = (tool: AnyToolDefinition): readonly unknown[] => {
      const schema = tool.inputSchema as { oneOf?: unknown; anyOf?: unknown };
      const branches = schema.oneOf ?? schema.anyOf;
      return Array.isArray(branches) ? branches : [];
    };
    const requiredOf = (schema: unknown): readonly string[] => {
      const value = (schema as { required?: unknown } | null)?.required;
      return Array.isArray(value) ? value.filter((f): f is string => typeof f === "string") : [];
    };

    const branchTools = catalog.filter((t) => branchesOf(t).length > 0);
    // 選択肢のある道具が 0 個になったら、この検査は何も見ずに緑になる。
    // 2026-08-19 の実測は 4 個（鍵の道具と、対応状況の道具、それぞれの別名）。
    expect(
      branchTools.length,
      `選択肢のある道具が ${branchTools.length} 個です。0 個ならこの検査は何も見ていません`,
    ).toBeGreaterThanOrEqual(1);

    const missing = branchTools
      .map((tool) => {
        const branches = branchesOf(tool);
        const common = requiredOf(branches[0]).filter((f) =>
          branches.every((b) => requiredOf(b).includes(f)),
        );
        const outer = requiredOf(tool.inputSchema);
        const notWritten = common.filter((f) => !outer.includes(f));
        return notWritten.length === 0 ? null : `${tool.name}（${notWritten.join(",")}）`;
      })
      .filter((line): line is string => line !== null);

    expect(
      missing.length,
      `どの選択肢でも要るのに外側の required に無い項目があります: ${missing.join(" / ")}`,
    ).toBe(0);
  });

  it("その 0 件は、見つける側が動いた結果である", async () => {
    // **`required` を空にして偽った道具**を 1 つ作り、見つかることを見る。
    // 見つける側が壊れていても 0 件は出る。0 の作り方を 2 通り持たないと、
    // 「一致している」と「測れていない」を区別できない。
    const honest = catalog.find((t) => requiredFieldsOf(t).length > 0)!;
    const lying: AnyToolDefinition = {
      ...honest,
      name: `${honest.name}__宣言を偽った合成例`,
      inputSchema: { type: "object", properties: {}, required: [] },
    };
    const refused = await refusedForInput([lying]);
    expect(
      refused.length,
      "見つかるはずの合成例（required を空にした道具）が見つかりません。見つける側が動いていません",
    ).toBe(1);
  });
});
