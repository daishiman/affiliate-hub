import {
  type GenerationInput,
  checkOutputShape,
  isPromptVersion,
  maxOutputTokensFor,
  missingInputFields,
  renderInstructionBlocks,
  renderInstructions,
  reviewMaterial,
  SELF_REPORTED_FIELDS,
  generatedVariantJsonSchema,
} from "@/domain/generation";
import { requireCapability, withBrandDefaults } from "@/domain/identity";
import type { Brand } from "@/domain/identity";
import { domainError, err, ok } from "@/domain/shared";
import type { ActorContext, BrandId, DomainError, Result } from "@/domain/shared";
import type { BrandRepositoryPort } from "@/application/ports";
import type {
  LlmCostEstimatorPort,
  LlmModelSelection,
  LlmPort,
  LlmRequest,
} from "@/application/ports";
import type { UseCase } from "../usecase";

/**
 * 下書きを 1 本作らせるユースケース。
 *
 * このアプリで唯一、生成 AI を実際に呼ぶ場所。
 * ここが 1 つあることで、次の 3 つが 1 箇所に集まる。
 *
 *   1. 「そろっていなければ始めない」（GC-1）
 *   2. 「取り込んだ文章は資料であって指示ではない」（プロンプト注入への備え）
 *   3. 「費用は呼ぶ前に見積もる」（実行してから請求で気づく、を避ける）
 *
 * 提供元の名前はここに 1 つも出てこない。
 * 受け取るのは `LlmPort` という形だけで、
 * 誰が生成するかは `src/infrastructure/llm/llm-setup.ts` が決める。
 *
 * **報酬に関する数字はこのユースケースに入って来られない。**
 * 入力は `GenerationInput` に限られ、その型には報酬の欄が無い。
 * 商品は `Editorial` の印つきなので、成果報酬の付いた素材を渡すと型検査で止まる。
 */

/** 外部から取り込んだ文章。指示ではなく資料として渡す。 */
export type DraftMaterial = {
  readonly label: string;
  readonly sourceUrl: string | null;
  readonly text: string;
};

export type DraftContentVariantInput = {
  /**
   * どのモデルで書くか。**選ばれていなければ生成しない。**
   *
   * `null` を受け取れる形にしてあるのは、画面から「まだ選んでいない」が
   * そのまま届くようにするためである。ここで既定を埋めると、
   * 利用者が選んだつもりのないモデルで記事が書かれ、しかも
   * **記録にはそのモデル名が残る**ので、後から「選んでいない」と分からなくなる。
   */
  readonly model?: LlmModelSelection | null;
  readonly provided: Partial<GenerationInput>;
  readonly materials?: readonly DraftMaterial[];
  readonly promptVersion?: string;
  /**
   * どのブランドで書くか。
   *
   * 渡すと、そのブランドの標準 CTA と標準免責が
   * **明示しなかった欄だけ**に入る（明示した値が勝つ）。
   * 渡さなければ何も補わず、足りない欄は下の ① で止まる。
   */
  readonly brandId?: BrandId;
  /** 1 本あたりの上限（最小単位。円なら円）。超える見積りは呼ばずに止める。 */
  readonly budgetMinor?: number | null;
};

export type DraftContentVariantResult = {
  readonly promptVersion: string;
  /** どの提供元で書いたか。選んだ値をそのまま返す。 */
  readonly providerId: string;
  /**
   * **実際に使われた**モデル。選んだ値ではなく、提供元が答えた値である。
   *
   * 提供元は別名（`-latest` など）で受けて実体で答えることがあり、
   * 選んだ値だけを残すと、同じ名前で中身の違う記事が並ぶ。
   */
  readonly modelId: string;
  /** 選んだモデル。上と食い違ったときに気づけるように、両方を残す。 */
  readonly requestedModelId: string;
  readonly output: Readonly<Record<string, unknown>>;
  readonly estimatedCostMinor: number;
  readonly currency: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  /** 指示文がどの塊で組み上がったか。何を渡したかを後から見えるようにする。 */
  readonly instructionBlocks: readonly {
    readonly id: string;
    readonly label: string;
    readonly charCount: number;
  }[];
  readonly materialCount: number;
  /** 合否の判断に使ってはならない欄。画面と道具の両方で同じものを出す。 */
  readonly notForVerdict: readonly string[];
};

export type DraftContentVariantDeps = {
  readonly llm: LlmPort;
  readonly costs: LlmCostEstimatorPort;
  /**
   * ブランド設定の読み出し口。
   *
   * 省略できるようにしてあるのは、生成そのものはブランドを知らなくても
   * 成り立つため（呼び出し側が 18 項目を全部渡せばよい）。
   * 渡してあるときだけ、**呼びかけ文と広告表記の既定値**をここから補う。
   */
  readonly brands?: BrandRepositoryPort;
};

/** 生成の温度。低くしてあるのは、同じ素材から違う事実が出てくるのを避けるため。 */
const TEMPERATURE = 0.2;

export function createDraftContentVariantUseCase(
  deps: DraftContentVariantDeps,
): UseCase<DraftContentVariantInput, DraftContentVariantResult> {
  return {
    async execute(actor, input) {
      const allowed = requireCapability(actor, "content.generate", "下書きの生成");
      if (!allowed.ok) return err(allowed.error);

      const version = input.promptVersion ?? "v1";
      if (!isPromptVersion(version)) {
        return err(
          domainError("VALIDATION_FAILED", `指示文の版「${version}」は形が違います。`, {
            suggestedAction: "v1・v2 のように、v と数字で指定してください。",
          }),
        );
      }

      // ⓪ どのモデルで書くかが決まっていなければ、ここで止まる。
      //    **代わりに何かを選ばない。** 既定を置くと、選んだ覚えのないモデルで
      //    記事ができ、記録にはそのモデル名だけが残る。
      //    あとから見た人には「利用者が選んだ」ようにしか見えない。
      const model = input.model ?? null;
      if (model === null || model.providerId === "" || model.modelId === "") {
        return err(
          domainError("VALIDATION_FAILED", "どのモデルで書くかが選ばれていません。", {
            suggestedAction:
              "生成の画面で提供元とモデルを選んでください。選べるものが無い場合は、設定画面で API キーが登録済みかを確認してください。",
          }),
        );
      }

      // ⓪-b ブランドの標準値で、明示しなかった欄だけを埋める。
      //     **AI に補わせているのではない。** 人が設定画面で決めた値を
      //     そのまま運んでいるだけで、決めていない欄（免責が未設定など）は
      //     埋まらず、下の ① で止まる。
      const provided = await applyBrandDefaults(deps.brands, actor, input.brandId, input.provided);
      if (!provided.ok) return err(provided.error);

      // ① そろっていなければ始めない。
      //    足りない分を AI に補わせると、素材に無いことがどこから来たか追えなくなる。
      const missing = missingInputFields(provided.value);
      if (missing.length > 0) {
        return err(
          domainError(
            "VALIDATION_FAILED",
            `渡していない項目が ${missing.length} 件あるため、生成を始められません。`,
            {
              suggestedAction: `${missing.map((m) => m.label).join("・")} を先に決めてください。`,
              details: { missing: missing.map((m) => m.key).join(",") },
            },
          ),
        );
      }
      const generationInput = provided.value as GenerationInput;

      // ② 取り込んだ文章に、指示として読ませようとする書き方が無いかを見る。
      //    見つけても自動で消さない。消すと「何が来ていたか」が残らない。
      const materials = input.materials ?? [];
      const held: string[] = [];
      for (const material of materials) {
        const review = reviewMaterial(material.text);
        if (!review.accepted) held.push(material.label);
      }
      if (held.length > 0) {
        return err(
          domainError(
            "VALIDATION_FAILED",
            `資料 ${held.length} 件が保留になっているため、生成を始められません: ${held.join("・")}`,
            {
              suggestedAction:
                "保留の資料を担当者が見て、使うかどうかを決めてください。自動では取り除きません。",
              details: { held: held.join(",") },
            },
          ),
        );
      }

      const request: LlmRequest = {
        /**
         * 鍵を引く先は**依頼した本人の作業場所**である。
         * 入力から受け取らないのは、他人の作業場所を指す依頼を
         * 書き方として作れないようにするため。
         */
        workspaceId: actor.workspaceId,
        model,
        instructions: renderInstructions(generationInput),
        untrustedContext: materials.map((m) => ({
          label: m.label,
          sourceUrl: m.sourceUrl,
          text: m.text,
        })),
        outputSchema: generatedVariantJsonSchema(),
        promptVersion: version,
        maxOutputTokens: maxOutputTokensFor(generationInput),
        temperature: TEMPERATURE,
      };

      // ③ 呼ぶ前に見積もる。
      const estimate = await deps.costs.estimate(request);
      if (!estimate.ok) return err(estimate.error);
      const budget = input.budgetMinor ?? null;
      if (budget !== null && estimate.value.estimatedCostMinor > budget) {
        return err(
          domainError(
            "VALIDATION_FAILED",
            `見積り ${estimate.value.estimatedCostMinor} が上限 ${budget} を超えるため、生成しませんでした。`,
            {
              suggestedAction: "長さを短くするか、上限を見直してください。",
              details: {
                estimated: String(estimate.value.estimatedCostMinor),
                budget: String(budget),
              },
            },
          ),
        );
      }

      const generated = await deps.llm.generateStructured<unknown>(request);
      if (!generated.ok) return err(generated.error);

      // ④ 途中で切れた本文をそのまま受け取らない。
      //    切れていることに気づかないまま保存すると、尻切れの記事が世に出る。
      if (generated.value.truncated) {
        return err(
          domainError("VALIDATION_FAILED", "生成が途中で打ち切られました。", {
            suggestedAction: "長さを短くしてやり直してください。途中までの本文は保存しません。",
          }),
        );
      }

      // ⑤ 決めた形に一致しない返答は受け取らない。
      const shaped = checkOutputShape(generated.value.output);
      if (!shaped.ok) return err(shaped.error);

      return ok({
        promptVersion: version,
        providerId: model.providerId,
        modelId: generated.value.modelId,
        requestedModelId: model.modelId,
        output: shaped.value,
        estimatedCostMinor: estimate.value.estimatedCostMinor,
        currency: estimate.value.currency,
        inputTokens: generated.value.inputTokens,
        outputTokens: generated.value.outputTokens,
        instructionBlocks: renderInstructionBlocks(generationInput).map((b) => ({
          id: b.id,
          label: b.label,
          charCount: b.text.length,
        })),
        materialCount: materials.length,
        notForVerdict: [...SELF_REPORTED_FIELDS],
      });
    },
  };
}


/**
 * ブランドの標準値を、明示されなかった欄へ移す。
 *
 * ブランドが読めなかったときに**黙って既定値をでっち上げない**。
 * 読めない理由をそのまま返し、呼び出し側に判断を戻す。
 * ここで握り潰すと、「設定したはずの免責が入っていない記事」が
 * 誰にも気づかれずに公開まで進む。
 */
async function applyBrandDefaults(
  brands: BrandRepositoryPort | undefined,
  actor: ActorContext,
  brandId: BrandId | undefined,
  provided: Partial<GenerationInput>,
): Promise<Result<Partial<GenerationInput>, DomainError>> {
  if (brands === undefined) return ok(provided);

  if (brandId !== undefined) {
    const found = await brands.findById(actor.workspaceId, brandId);
    if (!found.ok) return err(found.error);
    return ok(withBrandDefaults(found.value, provided));
  }

  const sole = await soleBrandOf(brands, actor);
  if (!sole.ok) return err(sole.error);
  return ok(withBrandDefaults(sole.value, provided));
}

/**
 * ブランドが 1 つしか無い作業場所の、その 1 つを返す。0 個または 2 個以上なら `null`。
 *
 * **2 つ以上あるときに選ばない**のがここの肝である。
 * AWS-ACC-03 は「呼び出し側が明示しなくても既定値が入る」ことを求めるが、
 * 候補が複数あるときに勝手に 1 つ選ぶと、**別のブランドの免責が載った記事**が出る。
 * 免責の取り違えは景表法・ステマ規制の側で効いてくるので、
 * 「入らない」より「違うものが入る」ほうが害が大きい。だから曖昧なら入れない。
 *
 * 画面（`/admin/generation`）はブランドの保存先を知らない。
 * 画面に選択欄を足すまでの間、1 つしか無い作業場所ではこの経路で既定値が届く。
 * 複数ある作業場所では `brandId` を明示するまで届かない——これは仕様であり、
 * 塞ぐなら画面へブランド選択欄を足すことになる。
 */
async function soleBrandOf(
  brands: BrandRepositoryPort,
  actor: ActorContext,
): Promise<Result<Brand | null, DomainError>> {
  // 2 件取れれば「2 つ以上ある」と判定できる。全件は要らない。
  const listed = await brands.list(actor.workspaceId, { limit: 2, cursor: null });
  if (!listed.ok) return err(listed.error);
  const items = listed.value.items;
  return ok(items.length === 1 ? items[0] : null);
}
