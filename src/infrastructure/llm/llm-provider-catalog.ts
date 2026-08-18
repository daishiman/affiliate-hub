import type {
  LlmModelDescriptor,
  LlmProviderCatalogPort,
  LlmProviderDescriptor,
} from "@/application/ports/llm-credential";
import { domainError, err, ok } from "@/domain/shared";

/**
 * 使える提供元とモデルの目録。
 *
 * --- 提供元は表、モデルは設定 ---
 * 分けているのは、変わる速さが 2 桁違うからである。
 * 提供元（4 社）は年単位でしか増えず、増えるときは実装（呼び出し方）も要る。
 * モデルは月単位で入れ替わり、**入れ替わっても呼び出し方は変わらない**。
 * 前者を表に、後者を設定に置くと、モデルの追加が配布なしで済む。
 *
 * --- 単価をここに書かない ---
 * 単価は値上げのたびに変わる。定数として書くと、
 * 値上げの日に「見積りだけ古い」状態になり、しかも誰も気づかない
 * （見積りは請求と別物なので、突き合わせない限りズレたままになる）。
 * よってモデルの設定に単価を同梱し、設定が無ければモデルも出さない。
 */

export type LlmProviderKind = "anthropic" | "google" | "openai" | "xai" | "workers_ai";

/**
 * 対応する提供元。
 *
 * `required: true` の 4 社が、利用者が鍵を登録して使う先である。
 *
 * --- `workers_ai` を残した理由 ---
 * **対応必須ではないが、枠として残す。** Cloudflare Workers AI は
 * 利用者が鍵を登録する先ではなく（同じ口座の中で動くため鍵が要らない）、
 * ほかの 4 社とは仕組みが違う。いま使う予定は無い。
 *
 * それでも消さないのは、`LlmProviderKind` から 1 つ消すと
 * 「鍵の要らない提供元がありうる」という前提ごと消えるためである。
 * 消してから足し直すときには、鍵を前提にした作りが固まっていて、
 * 鍵の要らない経路を後から通すほうが高くつく。
 * 画面には出るが `required: false` で下に並び、鍵の登録欄も出ない。
 */
const PROVIDERS: readonly LlmProviderDescriptor[] = [
  {
    providerId: "anthropic",
    label: "Anthropic（Claude）",
    keyIssueUrl: "https://console.anthropic.com/settings/keys",
    required: true,
  },
  {
    providerId: "google",
    label: "Google（Gemini）",
    keyIssueUrl: "https://aistudio.google.com/apikey",
    required: true,
  },
  {
    providerId: "openai",
    label: "OpenAI",
    keyIssueUrl: "https://platform.openai.com/api-keys",
    required: true,
  },
  {
    providerId: "xai",
    label: "xAI（Grok）",
    keyIssueUrl: "https://console.x.ai/",
    required: true,
  },
  {
    providerId: "workers_ai",
    label: "Cloudflare Workers AI（鍵の登録は不要）",
    keyIssueUrl: "",
    required: false,
  },
];

/**
 * 設定の形。`LLM_PROVIDER_CATALOG` に JSON で入れる。
 *
 * ```json
 * { "anthropic": [
 *     { "modelId": "…", "label": "…",
 *       "inputPricePerMillionMinor": 450, "outputPricePerMillionMinor": 2250,
 *       "currency": "JPY" } ] }
 * ```
 *
 * **モデル名をここに例として書き込まない。** 書くと、それが既定値のように
 * 読まれて設定されないまま残る。設定が無いときは 0 件を返し、
 * 画面が「選べるモデルがありません」と言う。黙って古い名前を使うより良い。
 */
type CatalogConfig = Readonly<Record<string, readonly LlmModelDescriptor[]>>;

function parseCatalog(raw: string): CatalogConfig | null {
  if (raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const out: Record<string, readonly LlmModelDescriptor[]> = {};
    for (const [providerId, value] of Object.entries(parsed)) {
      if (!Array.isArray(value)) return null;
      const models: LlmModelDescriptor[] = [];
      for (const item of value) {
        const model = parseModel(item);
        // 1 件でも形が違えば、その提供元ごと落とす。
        // 混ざったまま通すと、単価の欄が欠けたモデルが 0 円で見積もられる。
        if (model === null) return null;
        models.push(model);
      }
      out[providerId] = models;
    }
    return out;
  } catch {
    return null;
  }
}

function parseModel(item: unknown): LlmModelDescriptor | null {
  if (typeof item !== "object" || item === null) return null;
  const r = item as Record<string, unknown>;
  if (typeof r.modelId !== "string" || r.modelId === "") return null;
  if (typeof r.label !== "string" || r.label === "") return null;
  if (typeof r.inputPricePerMillionMinor !== "number") return null;
  if (typeof r.outputPricePerMillionMinor !== "number") return null;
  if (typeof r.currency !== "string" || r.currency === "") return null;
  return {
    modelId: r.modelId,
    label: r.label,
    inputPricePerMillionMinor: r.inputPricePerMillionMinor,
    outputPricePerMillionMinor: r.outputPricePerMillionMinor,
    currency: r.currency,
  };
}

export function createLlmProviderCatalog(rawConfig: string): LlmProviderCatalogPort {
  const catalog = parseCatalog(rawConfig);

  return {
    async listProviders() {
      return ok(PROVIDERS);
    },
    async listModels(providerId) {
      if (catalog === null) {
        // **空を返さない。** 空だと「まだ設定していない」と読まれ、
        // 設定を書き間違えた事実が消える。
        return err(
          domainError("VALIDATION_FAILED", "LLM_PROVIDER_CATALOG の書き方に誤りがあります。", {
            suggestedAction:
              "JSON の形（提供元ごとに modelId・label・単価・通貨を持つ配列）を確認してください。",
          }),
        );
      }
      return ok(catalog[providerId] ?? []);
    },
  };
}
