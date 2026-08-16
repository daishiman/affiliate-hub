import { z } from "zod";
import {
  createCheckGenerationInputUseCase,
  createReadGenerationPlanUseCase,
  createReviewMaterialUseCase,
} from "@/application/usecases/generation/read-generation-plan";
import { GENERATION_INPUT_KEYS } from "@/domain/generation";
import { defineTool } from "./define-tool";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 生成の仕組みを見る道具。
 *
 * **ここに「記事を書かせる道具」は無い。**
 * 書く操作は承認の段階と結びついており、ページ内の AI から直接起動させない。
 * ここで出せるのは、何を渡し何を渡さないか・どこから先が人の判断か、
 * そして渡そうとしている文章が指示の仕掛けを含んでいないか、の 3 つだけ。
 */
export function generationTools(): readonly AnyToolDefinition[] {
  // 入力欄の一覧は domain の定義から作る。ここで並べ直すと片方だけ古くなる。
  const providedShape = Object.fromEntries(
    GENERATION_INPUT_KEYS.map((k) => [k, z.boolean().describe(`${k} を渡したか`)]),
  );

  return [
    defineTool({
      name: "read_generation_plan",
      description:
        "生成の指示文の 7 つの塊、渡す 18 項目、8 つの手順、6 つの役、承認の段階のつながりを返します。書き役と確かめ役が分かれていることも、この結果で確認できます。",
      schema: z.object({ promptVersion: z.string().optional() }),
      readOnly: true,
      useCase: createReadGenerationPlanUseCase(),
    }),
    defineTool({
      name: "check_generation_input",
      description:
        "生成を始めてよいかを判定します。渡していない項目があれば、その項目名と埋め方を返します。足りないまま始めることはできません。",
      schema: z.object({
        // 中身ではなく「渡したかどうか」だけを受け取る。素材そのものを道具へ載せない。
        provided: z.object(providedShape).partial().optional(),
      }),
      readOnly: true,
      useCase: {
        async execute(actor, input: { provided?: Record<string, boolean> }) {
          // 真の欄だけを「渡した」と見なす。中身は持たないので目印を入れる。
          const provided = Object.fromEntries(
            Object.entries(input.provided ?? {})
              .filter(([, v]) => v === true)
              .map(([k]) => [k, k === "products" || k === "claims" ? [] : "指定済み"]),
          );
          return createCheckGenerationInputUseCase().execute(actor, {
            provided: provided as never,
          });
        },
      },
    }),
    defineTool({
      name: "review_untrusted_material",
      description:
        "取り込んだ文章に、指示として読ませようとする書き方が含まれていないかを調べます。見つけても自動では消さず、保留にして担当者の確認へ回します。",
      schema: z.object({ text: z.string().min(1).max(20000) }),
      readOnly: true,
      useCase: createReviewMaterialUseCase(),
    }),
  ];
}
