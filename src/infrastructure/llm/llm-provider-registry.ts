import type {
  LlmCostEstimatorPort,
  LlmPort,
  LlmRequest,
  LlmResponse,
} from "@/application/ports";
import { domainError, err, ok } from "@/domain/shared";
import type { DomainError, Result } from "@/domain/shared";
import { registerStub, stubCall } from "../stub-registry";
import type { LlmKeyAccess, LlmUsageRecorder } from "./key-access";
import type { LlmProviderKind } from "./llm-provider-catalog";
import type { LlmPricingLookup } from "./pricing";
import { createAnthropicLlm } from "./providers/anthropic";
import { createGoogleLlm } from "./providers/google";
import { createOpenAiLlm } from "./providers/openai";
import { createXaiLlm } from "./providers/xai";

/**
 * 生成 AI の提供元の登録所。
 *
 * 差し替えのときに触るのはこの表と実装 1 ファイルだけ
 * (docs/architecture/changeability-scenarios.md ②)。
 * ドメインもユースケースも提供元の名前を知らない。
 *
 * --- 提供元の種類はここで定義しない ---
 * `LlmProviderKind` は目録（`llm-provider-catalog.ts`）が持つ。
 * 同じ union を 2 か所に書いていたところ、片方に `xai` を足しても
 * もう片方は 4 社のままで、型検査は通ってしまった。
 * 「どの提供元があるか」の答えは 1 つでなければならない。
 */
export const LLM_PROVIDER_LABEL: Readonly<Record<LlmProviderKind, string>> = {
  anthropic: "Anthropic",
  google: "Google Gemini",
  openai: "OpenAI",
  xai: "xAI",
  workers_ai: "Cloudflare Workers AI",
};

/**
 * 提供元アダプタを組み立てるのに要るもの。
 *
 * --- モデルと作業場所がここに無い理由 ---
 * どちらも**依頼ごとに変わる**（`LlmRequest` が運ぶ）。
 * 組み立て時に受け取る形にすると、提供元 1 つにつきモデル 1 つになり、
 * 記事ごとに選び分けられない。
 */
export type LlmProviderContext = {
  readonly vault: LlmKeyAccess;
  readonly usage: LlmUsageRecorder;
  readonly pricing: LlmPricingLookup;
  /** 検査で偽の応答を差し込むための口。本番では渡さない。 */
  readonly fetchImpl?: typeof fetch;
};

type LlmFactory = (ctx: LlmProviderContext) => LlmPort;

/**
 * **これはスタブである。**
 *
 * 提供元の選定と API キーの登録が済むまで、呼ばれたら失敗を返す。
 * 空文字や固定文を返さないのは、生成されていない記事が
 * 「生成済み」として保存される事故を避けるため。
 */
function createStubLlm(kind: LlmProviderKind, ctx: LlmProviderContext, blockedBy: string): LlmPort {
  const entry = registerStub({
    id: `llm:${kind}`,
    port: "LlmPort",
    label: `${LLM_PROVIDER_LABEL[kind]} での文章生成`,
    blockedBy,
  });
  void ctx;
  return {
    generateStructured: <T>() => stubCall<LlmResponse<T>>(entry, "generateStructured"),
    embed: () => stubCall<readonly (readonly number[])[]>(entry, "embed"),
  };
}

/**
 * 組み立てに要るものは 4 社とも同じなので、そのまま渡す。
 *
 * 提供元ごとに引数を選び直していたころは、`fetchImpl` を 1 社だけ渡し忘れても
 * 型が通り、**その社の検査だけが本物の通信を試みる**形が作れた。
 */
const http = (ctx: LlmProviderContext) => ({
  vault: ctx.vault,
  usage: ctx.usage,
  pricing: ctx.pricing,
  fetchImpl: ctx.fetchImpl,
});

const FACTORIES: Readonly<Record<LlmProviderKind, LlmFactory>> = {
  anthropic: (ctx) => createAnthropicLlm(http(ctx)),
  google: (ctx) => createGoogleLlm(http(ctx)),
  openai: (ctx) => createOpenAiLlm(http(ctx)),
  xai: (ctx) => createXaiLlm(http(ctx)),
  /**
   * Workers AI だけは鍵の預かり所を通らない（実行環境の結び付けで呼ぶ）ので、
   * 同じ手順に乗らない。繋ぐときは別の組み立てが要る。
   */
  workers_ai: (ctx) =>
    createStubLlm(
      "workers_ai",
      ctx,
      "Workers AI は API キーではなく実行環境の結び付け（binding）で呼ぶ。結び付けの追加と、使うモデルの決定が必要",
    ),
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

function isProviderKind(value: string): value is LlmProviderKind {
  return Object.prototype.hasOwnProperty.call(FACTORIES, value);
}

/**
 * 依頼ごとに提供元を振り分ける口。
 *
 * --- 「使う提供元は 1 行」をやめた ---
 * 以前はここで 1 社に固定していた（`ACTIVE_PROVIDER`）。
 * 記事ごとにモデルを選ぶと決めた時点で、その形は成り立たない。
 * 固定したまま選ばせると、画面で選んだモデルと実際に呼ばれる先が食い違い、
 * **記録には選んだほうが残る**ので、食い違いに気づく手がかりが消える。
 *
 * 振り分けの分岐はこの 1 か所だけにする。ここ以外に分岐を作ると、
 * どの記事がどの提供元で書かれたのかを辿れなくなる。
 */
export function createRoutingLlm(ctx: LlmProviderContext): LlmPort {
  // 提供元ごとのアダプタは 1 度だけ作る。依頼ごとに作り直すと、
  // 接続の使い回しが効かないうえ、組み立ての失敗が呼び出しのたびに起きる。
  const built = new Map<LlmProviderKind, LlmPort>();
  function portFor(providerId: string): Result<LlmPort, DomainError> {
    if (!isProviderKind(providerId)) {
      return err(
        domainError("NOT_SUPPORTED", "この生成AIの提供元には対応していません。", {
          details: { providerId },
        }),
      );
    }
    const cached = built.get(providerId);
    if (cached !== undefined) return ok(cached);
    const made = createLlm(providerId, ctx);
    if (made.ok) built.set(providerId, made.value);
    return made;
  }

  return {
    async generateStructured<T>(request: LlmRequest) {
      const port = portFor(request.model.providerId);
      if (!port.ok) return err(port.error);
      return port.value.generateStructured<T>(request);
    },
    async embed() {
      /**
       * 埋め込みは依頼に提供元が乗らない（`embed(texts)` だけ）。
       * どこへ送るかが決まらないので、ここでは断る。
       * 0 埋めの配列を返すと、**似ていない記事が似ていると判定される**。
       */
      return err(
        domainError("NOT_SUPPORTED", "類似記事の検出はまだ使えません。", {
          suggestedAction: "どの提供元で埋め込みを作るかを決めてから繋ぎます。",
        }),
      );
    },
  };
}

/**
 * 費用の概算。
 *
 * 単価は依頼で選ばれたモデルのものを引く。**見積りと記録が同じ 1 本を通る**
 * ので、値上げで片方だけ古くなることが起きない（`./pricing.ts`）。
 */
export function createCostEstimator(pricing: LlmPricingLookup): LlmCostEstimatorPort {
  return {
    async estimate(request: LlmRequest) {
      const found = await pricing.find(request.model);
      if (!found.ok) return err(found.error);

      // 概算のため、日本語はおおよそ 1 トークン = 1.5 文字として数える。
      const charCount =
        request.instructions.length +
        request.untrustedContext.reduce((n, b) => n + b.text.length, 0);
      const inputTokens = Math.ceil(charCount / 1.5);
      const estimatedCostMinor = Math.ceil(
        (inputTokens * found.value.inputMinorPerMillionTokens) / 1_000_000 +
          (request.maxOutputTokens * found.value.outputMinorPerMillionTokens) / 1_000_000,
      );
      return ok({ estimatedCostMinor, currency: found.value.currency });
    },
  };
}
