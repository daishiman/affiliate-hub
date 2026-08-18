import type { LlmPort, LlmRequest, LlmResponse } from "@/application/ports";
import type { LlmKeyAccess, LlmUsageRecorder } from "../key-access";
import type { LlmPricingLookup, ModelPricing } from "../pricing";
import { containsSecret, redactSecretsInText } from "@/domain/generation/llm-credential";
import {
  type DomainError,
  type Result,
  type WorkspaceId,
  domainError,
  err,
  ok,
} from "@/domain/shared";

/**
 * HTTP で呼ぶ提供元に共通の手順。
 *
 * --- なぜ 1 本にまとめたか ---
 * 提供元ごとに違うのは **送り先・見出し・本文の形・応答の読み方**の 4 つだけで、
 * 「単価を呼ぶ前に引く」「鍵は見出しにしか載せない」「成功でも失敗でも使った量を
 * 記録する」「記録できなければ成功として返さない」は 4 社とも同じである。
 * 提供元ごとに書くと、2 社目以降のどれかで 1 つ落ちる。落ちても画面は普通に
 * 描けるので、気づくのは請求か事故のときになる。
 *
 * --- 鍵と文章の分離 ---
 * 本文の組み立て（`spec.buildBody`）は**鍵を引数に取らない**。
 * 鍵が現れるのは `spec.headers(apiKey)` の中だけで、この 2 つは型として
 * 交わらない。「気をつける」ではなく「渡さない」で守る。
 *
 * 規範: docs/product/credential-registration.md
 */

export type ProviderSpec = {
  /** 記録に残す提供元の名前。目録（`LlmProviderKind`）と同じ綴りにする。 */
  readonly providerId: string;
  /** 画面と失敗の文面に出す呼び名。 */
  readonly label: string;
  /** 送り先。モデル名を経路に含める提供元があるので引数で受ける。 */
  endpoint(modelId: string): string;
  /** 送る本文。**鍵を受け取らない。** */
  buildBody(request: LlmRequest, modelId: string): Readonly<Record<string, unknown>>;
  /** 鍵が現れる唯一の場所。 */
  headers(apiKey: string): Record<string, string>;
  /** 応答から結果を取り出す。取り出せない形は失敗にする（黙って空を返さない）。 */
  readReply<T>(reply: unknown, fallbackModelId: string): Result<LlmResponse<T>, DomainError>;
  /** 類似記事の検出に応じられない理由。提供元ごとに事情が違うので文面も分ける。 */
  readonly embedRefusal: string;
};

export type HttpLlmDeps = {
  readonly vault: LlmKeyAccess;
  /** 単価の引き当て。モデルは依頼ごとに変わるので、組み立て時には決まらない。 */
  readonly pricing: LlmPricingLookup;
  /**
   * 使った量の記録先。**省略できない。**
   * 省ける形にすると、呼び出しを足すたびに記録が漏れ、
   * 漏れても画面は何も変わらないので請求が来るまで気づけない。
   */
  readonly usage: LlmUsageRecorder;
  readonly fetchImpl?: typeof fetch;
};

/**
 * 提供元が返した失敗を、画面に出せる形へ移す。
 *
 * **本文をそのまま載せない。** 提供元は鍵の一部（ときには全部）を載せた文面を
 * 返すことがある。ここでは鍵を持っているので、値そのもので突き合わせて捨てる。
 */
export function toFailure(
  spec: Pick<ProviderSpec, "providerId" | "label">,
  status: number,
  body: string,
  apiKey: string,
): DomainError {
  const safe = containsSecret(body, apiKey) ? "" : redactSecretsInText(body).slice(0, 300);
  const details = { providerId: spec.providerId, status, upstreamMessage: safe };
  if (status === 401 || status === 403) {
    return domainError("UNAUTHENTICATED", `${spec.label} に API キーが受け付けられませんでした。`, {
      suggestedAction: "設定画面から API キーを登録し直してください。",
      details,
    });
  }
  if (status === 429) {
    return domainError("RATE_LIMITED", `${spec.label} の利用上限に達しました。`, {
      retryable: true,
      suggestedAction: "しばらく待ってからお試しください。",
      details,
    });
  }
  if (status >= 500) {
    return domainError("UPSTREAM_UNAVAILABLE", `${spec.label} 側で問題が起きています。`, {
      retryable: true,
      suggestedAction: "しばらく待ってからお試しください。",
      details,
    });
  }
  return domainError("VALIDATION_FAILED", `${spec.label} への依頼が受け付けられませんでした。`, {
    suggestedAction: "選んでいるモデルが使えるかを設定画面で確認してください。",
    details,
  });
}

/** 形が違って読めなかったときの失敗。4 社で同じ文面にする（利用者には同じ出来事）。 */
export function unreadableReply(stopReason: string): DomainError {
  return domainError("UPSTREAM_UNAVAILABLE", "生成 AI が指定した形で答えませんでした。", {
    retryable: true,
    suggestedAction: "もう一度お試しください。続くようなら別のモデルを選んでください。",
    details: { stopReason },
  });
}

/**
 * 自由文として返ってきた JSON を読む。
 *
 * 道具呼び出しで受け取れる Anthropic 以外は、本文が文字列で返る。
 * 前置きや ```json が混ざって読めない回も料金は掛かるので、
 * **読めなかったことを失敗として返す**（空の記事を保存しない）。
 */
export function parseJsonText<T>(text: string | undefined, stopReason: string): Result<T, DomainError> {
  if (text === undefined || text.trim() === "") return err(unreadableReply(stopReason));
  try {
    return ok(JSON.parse(text) as T);
  } catch {
    return err(unreadableReply(stopReason));
  }
}

function costOf(input: number, output: number, pricing: ModelPricing): number {
  return Math.ceil(
    (input * pricing.inputMinorPerMillionTokens) / 1_000_000 +
      (output * pricing.outputMinorPerMillionTokens) / 1_000_000,
  );
}

export function createHttpLlm(spec: ProviderSpec, deps: HttpLlmDeps): LlmPort {
  const doFetch = deps.fetchImpl ?? fetch;

  async function note(
    workspaceId: WorkspaceId,
    modelId: string,
    pricing: ModelPricing,
    inputTokens: number,
    outputTokens: number,
    succeeded: boolean,
  ): Promise<Result<void, DomainError>> {
    return deps.usage.record({
      workspaceId,
      providerId: spec.providerId,
      modelId,
      purpose: "draft",
      inputTokens,
      outputTokens,
      estimatedCostMinor: costOf(inputTokens, outputTokens, pricing),
      currency: pricing.currency,
      succeeded,
    });
  }

  return {
    async generateStructured<T>(request: LlmRequest) {
      const modelId = request.model.modelId;

      /**
       * 単価を**呼ぶ前に**引く。
       *
       * 呼んでから引くと、単価の分からないモデルで一度は課金が発生し、
       * その 1 回だけ記録に残らない（記録には単価が要る）。
       */
      const pricing = await deps.pricing.find(request.model);
      if (!pricing.ok) return err(pricing.error);

      // 本文を先に組み立てる。**鍵を取り出す前**に済ませることで、
      // 鍵の見えている範囲を通信の一瞬だけに縮める。
      const body = spec.buildBody(request, modelId);

      const called = await deps.vault.useKey({
        workspaceId: request.workspaceId,
        providerId: spec.providerId,
        fn: async (apiKey): Promise<Result<LlmResponse<T>, DomainError>> => {
          const response = await doFetch(spec.endpoint(modelId), {
            method: "POST",
            headers: { "content-type": "application/json", ...spec.headers(apiKey) },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const text = await response.text().catch(() => "");
            return err(toFailure(spec, response.status, text, apiKey));
          }
          const parsed: unknown = await response.json().catch(() => null);
          return spec.readReply<T>(parsed, modelId);
        },
      });

      if (!called.ok) {
        // 鍵が無い・開けない・通信ごと失敗した。ここでは使った量が分からない。
        const noted = await note(request.workspaceId, modelId, pricing.value, 0, 0, false);
        if (!noted.ok) return noted;
        return called;
      }
      const result = called.value;
      const tokens = result.ok
        ? { input: result.value.inputTokens, output: result.value.outputTokens }
        : { input: 0, output: 0 };

      /**
       * 記録できなかったら、生成できていても失敗として返す。
       *
       * もったいないようだが、記録の落ちた呼び出しを黙って通すと
       * 「請求は増えるのに画面のどこにも出ない使い方」が積み上がる。
       * それに、記録先は記事の保存先と同じ D1 なので、
       * ここが書けない状態なら下書きも保存できない。
       */
      const noted = await note(
        request.workspaceId,
        modelId,
        pricing.value,
        tokens.input,
        tokens.output,
        result.ok,
      );
      if (!noted.ok) return noted;
      return result;
    },

    async embed() {
      /**
       * 0 埋めの配列を返さない。返すと**似ていない記事が似ていると判定される**。
       * 対応していないことは、対応していないと答える。
       */
      return err(
        domainError("NOT_SUPPORTED", spec.embedRefusal, {
          suggestedAction: "類似記事の検出には別の提供元を選んでください。",
        }),
      );
    },
  };
}
