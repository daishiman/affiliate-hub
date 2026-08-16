import type {
  LlmCostEstimatorPort,
  LlmPort,
  LlmRequest,
  LlmResponse,
  SecretResolverPort,
} from "@/application/ports";
import { domainError, err, ok } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";
import { registerStub, stubCall } from "../stub-registry";

/**
 * 生成 AI の提供元の登録所。
 *
 * 差し替えのときに触るのはこの表と実装 1 ファイルだけ
 * (docs/architecture/changeability-scenarios.md ②)。
 * ドメインもユースケースも提供元の名前を知らない。
 */
export type LlmProviderKind = "anthropic" | "openai" | "workers_ai";

export const LLM_PROVIDER_LABEL: Readonly<Record<LlmProviderKind, string>> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  workers_ai: "Cloudflare Workers AI",
};

export type LlmProviderContext = {
  readonly credentialRef: string;
  readonly modelId: string;
  readonly secrets: SecretResolverPort;
};

type LlmFactory = (ctx: LlmProviderContext) => LlmPort;

/**
 * **これはスタブである。**
 *
 * 提供元の選定と API キーの登録が済むまで、呼ばれたら失敗を返す。
 * 空文字や固定文を返さないのは、生成されていない記事が
 * 「生成済み」として保存される事故を避けるため。
 */
function createStubLlm(kind: LlmProviderKind, ctx: LlmProviderContext): LlmPort {
  const entry = registerStub({
    id: `llm:${kind}`,
    port: "LlmPort",
    label: `${LLM_PROVIDER_LABEL[kind]} での文章生成`,
    blockedBy: "提供元の選定と、利用者ご自身による API キーの登録が必要",
  });
  void ctx;
  return {
    generateStructured: <T>() => stubCall<LlmResponse<T>>(entry, "generateStructured"),
    embed: () => stubCall<readonly (readonly number[])[]>(entry, "embed"),
  };
}

const FACTORIES: Readonly<Record<LlmProviderKind, LlmFactory>> = {
  anthropic: (ctx) => createStubLlm("anthropic", ctx),
  openai: (ctx) => createStubLlm("openai", ctx),
  workers_ai: (ctx) => createStubLlm("workers_ai", ctx),
};

export function createLlm(
  kind: LlmProviderKind,
  ctx: LlmProviderContext,
): Result<LlmPort, DomainError> {
  const factory = FACTORIES[kind];
  if (factory === undefined) {
    return err(domainError("NOT_SUPPORTED", "この生成AIの提供元には対応していません。"));
  }
  return ok(factory(ctx));
}

/**
 * 費用の概算。
 *
 * 単価は提供元と契約で変わるため、組み立て時に外から渡す。
 * ここに定数として書き込むと、値上げのたびにコードを直すことになる。
 */
export function createCostEstimator(pricing: {
  readonly inputMinorPerMillionTokens: number;
  readonly outputMinorPerMillionTokens: number;
  readonly currency: string;
}): LlmCostEstimatorPort {
  return {
    async estimate(request: LlmRequest) {
      // 概算のため、日本語はおおよそ 1 トークン = 1.5 文字として数える。
      const charCount =
        request.instructions.length +
        request.untrustedContext.reduce((n, b) => n + b.text.length, 0);
      const inputTokens = Math.ceil(charCount / 1.5);
      const estimatedCostMinor = Math.ceil(
        (inputTokens * pricing.inputMinorPerMillionTokens) / 1_000_000 +
          (request.maxOutputTokens * pricing.outputMinorPerMillionTokens) / 1_000_000,
      );
      return ok({ estimatedCostMinor, currency: pricing.currency });
    },
  };
}
