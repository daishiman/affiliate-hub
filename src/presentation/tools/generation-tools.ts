import { z } from "zod";
import type { AppDeps } from "@/application/deps";
import {
  createCheckGenerationInputUseCase,
  createReadGenerationPlanUseCase,
  createReviewMaterialUseCase,
} from "@/application/usecases/generation/read-generation-plan";
import { createDraftContentVariantUseCase } from "@/application/usecases/generation/draft-content-variant";
import { GENERATION_INPUT_KEYS } from "@/domain/generation";
import { markEditorial } from "@/domain/shared";
import { defineTool } from "./define-tool";
import { type DraftContentVariantRaw, draftContentVariantSchema } from "./generation-input-schema";
import type { AnyToolDefinition } from "./tool-definition";

/**
 * 生成にまつわる道具。
 *
 * 仕組みを見る道具が 3 つと、実際に下書きを 1 本作らせる道具が 1 つ。
 *
 * **下書きを作る道具は `readOnly: false` にしてある。**
 * 保存はしないが、外部への呼び出しと費用が発生する。
 * `readOnly: false` の道具は WebMCP（読者のページの中で動く AI）へ載らないので、
 * ページを開いただけで課金が起きることは構造的に起きない。
 * REST とバックエンド MCP からは呼べる。
 *
 * さらに `requiresHumanApproval: true` にしてあるため、
 * AI サービスアカウントが自分の判断で記事を書き始めることもできない。
 */
export function generationTools(deps: AppDeps): readonly AnyToolDefinition[] {
  const draft = createDraftContentVariantUseCase({ llm: deps.llm, costs: deps.llmCosts });

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
    defineTool({
      name: "draft_content_variant",
      description:
        "承認済みの素材を渡して下書きを 1 本作らせます。どのモデルで書くかを model で指定してください（既定はありません。指定が無ければ作りません）。" +
        "18 項目のうち 1 つでも欠けていれば作りません。" +
        "取り込んだ資料は指示ではなく資料として渡し、指示の仕掛けが見つかった資料があるあいだは作りません。" +
        "作った下書きは保存しません。保存と公開は人が別の操作で行います。",
      schema: draftContentVariantSchema,
      readOnly: false,
      requiresHumanApproval: true,
      // 一式をまるごと渡さず、生成に要る 2 つだけを渡す。
      // 報酬のつなぎ目は渡さない（渡そうとしても型が受け付けない）。
      useCase: {
        async execute(actor, raw: DraftContentVariantRaw) {
          // JSON には区分の印を乗せられないため、「これは編集用の素材である」と
          // 宣言するのは入口のここ 1 箇所だけにする。
          // 商業区分の素材を混ぜたければこの行を書き換えるしかなく、
          // 差分に必ず現れる。
          const products = raw.provided.products?.map((p) =>
            markEditorial({ id: p.id, label: p.label }),
          );
          return draft.execute(actor, {
            ...raw,
            provided: { ...raw.provided, products },
          });
        },
      },
    }),
  ];
}
