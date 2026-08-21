import { requireCapability } from "@/domain/identity";
import { err, ok } from "@/domain/shared";
import type { ActorContext } from "@/domain/shared";
import type {
  LlmCredentialVaultPort,
  LlmModelDescriptor,
  LlmModelSelection,
  LlmProviderCatalogPort,
} from "@/application/ports";
import type { UseCase } from "../usecase";

/**
 * 「いま選べるモデル」の一覧。
 *
 * 生成の画面に**モデルを選ぶ欄**を出すためだけの読み取り。
 *
 * --- 鍵を管理する一覧（`manage-llm-credentials`）と分けた理由 ---
 * あちらは鍵を登録・失効させる操作で、`integration_key.manage` が要る。
 * こちらは**書く人が使う**。書く人に鍵の管理権限を持たせないと
 * モデルが選べない、という形にすると、権限を配る側が
 * 「とりあえず管理権限を渡す」ほうへ倒れる。
 * 見せるものも違う。ここでは末尾 4 文字も、いつ誰が入れたかも出さない。
 * 出すのは**選べるかどうかと、選べない理由**だけである。
 *
 * --- 選べない理由を必ず言葉で返す ---
 * 「モデルが 1 つも出ない」は、画面では全部同じ空白に見える。
 * だが利用者がやることは、鍵を登録する・失効を解く・設定を入れる、で全部違う。
 * 空の一覧を返して画面に解釈させると、いちばんありがちな
 * 「準備中なのだろう」という誤読に落ちる。
 */

export type SelectableModelRow = {
  readonly providerId: string;
  readonly label: string;
  /** 目録に載っているモデル。選べない提供元でも隠さない（理由とともに出す）。 */
  readonly models: readonly LlmModelDescriptor[];
  /** いま選べない理由。選べるときは `null`。 */
  readonly unavailableReason: string | null;
};

export type ListSelectableModelsOutput = {
  readonly rows: readonly SelectableModelRow[];
  /** 1 つも選べないときの理由。1 つでも選べれば `null`。 */
  readonly emptyReason: string | null;
};

/**
 * 鍵の預かり所につながっているか。
 *
 * つながっていないとき（元締めの鍵や保存先が無い）も、
 * **提供元とモデルの一覧だけは返す**。何が使えるはずなのかは、
 * 使えないときほど読みたい情報である。
 */
export type CredentialAccess =
  | { readonly available: true; readonly vault: LlmCredentialVaultPort }
  | { readonly available: false; readonly reason: string };

export type ListSelectableModelsDeps = {
  readonly catalog: LlmProviderCatalogPort;
  readonly credentials: CredentialAccess;
};

export type ListSelectableModelsInput = Record<string, never>;

/** 選んだ値を 1 つの文字列で運ぶときの区切り。提供元の識別子には現れない。 */
export const MODEL_CHOICE_SEPARATOR = "::";

/**
 * 画面から届いた文字列を、選ばれたモデルへ直す。
 *
 * **一覧に無い組み合わせは `null` を返す。**
 * URL は誰でも書けるので、届いた文字列をそのまま
 * 「選ばれたモデル」として扱うと、目録に無いモデル名で呼び出しに行ける。
 * 単価が引けずに止まるので請求事故にはならないが、
 * 止まる場所が遠いほど、画面には理由の分からない失敗が出る。
 *
 * 選べない提供元（鍵が無いなど）の行も通さない。
 * ここで通すと、画面には「選べません」と出ているのに、
 * URL からは選べる状態が残る。
 */
export function selectModelFromRows(
  rows: readonly SelectableModelRow[],
  value: string,
): LlmModelSelection | null {
  const at = value.indexOf(MODEL_CHOICE_SEPARATOR);
  if (at < 0) return null;
  const providerId = value.slice(0, at);
  const modelId = value.slice(at + MODEL_CHOICE_SEPARATOR.length);
  if (providerId === "" || modelId === "") return null;

  const row = rows.find((r) => r.providerId === providerId);
  if (row === undefined || row.unavailableReason !== null) return null;
  if (!row.models.some((m) => m.modelId === modelId)) return null;
  return { providerId, modelId };
}

export function createListSelectableModelsUseCase(
  deps: ListSelectableModelsDeps,
): UseCase<ListSelectableModelsInput, ListSelectableModelsOutput> {
  return {
    async execute(actor: ActorContext) {
      const allowed = requireCapability(actor, "content.generate", "モデルの一覧");
      if (!allowed.ok) return err(allowed.error);

      const providers = await deps.catalog.listProviders();
      if (!providers.ok) return err(providers.error);

      // 鍵は「登録されているか」だけを見る。値には触れない
      // （触れる口がこの層に無い。`LlmCredentialVaultPort` の説明を参照）。
      const active = new Set<string>();
      if (deps.credentials.available) {
        const stored = await deps.credentials.vault.list(actor.workspaceId);
        if (!stored.ok) return err(stored.error);
        for (const s of stored.value) {
          if (s.status === "active") active.add(s.providerId);
        }
      }

      const rows: SelectableModelRow[] = [];
      for (const provider of providers.value) {
        const models = await deps.catalog.listModels(provider.providerId);
        if (!models.ok) return err(models.error);
        rows.push({
          providerId: provider.providerId,
          label: provider.label,
          models: models.value,
          unavailableReason: reasonFor({
            models: models.value,
            required: provider.required,
            hasActiveKey: active.has(provider.providerId),
            credentials: deps.credentials,
          }),
        });
      }

      const selectable = rows.filter((r) => r.unavailableReason === null);
      return ok({
        rows,
        emptyReason: selectable.length > 0 ? null : emptyReasonFor(rows, deps.credentials),
      });
    },
  };
}

/**
 * 1 つの提供元が選べない理由。
 *
 * 見る順を決めてある。**モデルの設定が先、鍵が後。**
 * 逆にすると、鍵の要らない提供元（Workers AI）に
 * 「鍵を登録してください」と出る。登録する先が無いので直しようがない。
 */
function reasonFor(input: {
  readonly models: readonly LlmModelDescriptor[];
  readonly required: boolean;
  readonly hasActiveKey: boolean;
  readonly credentials: CredentialAccess;
}): string | null {
  if (input.models.length === 0) {
    return input.required
      ? "選べるモデルが設定されていません。管理者が目録（LLM_PROVIDER_CATALOG）へ単価つきで登録するまで使えません。"
      : "この提供元は枠として残してあるだけで、いまは使えません。";
  }
  // 鍵の要らない提供元は、ここから先を見ない。
  if (!input.required) return "この提供元は枠として残してあるだけで、いまは使えません。";
  if (!input.credentials.available) return input.credentials.reason;
  if (!input.hasActiveKey) {
    return "この提供元の API キーがまだ登録されていません（失効させた場合も同じ表示になります）。";
  }
  return null;
}

/**
 * 1 つも選べないときに、画面の頭へ出す理由。
 *
 * 行ごとの理由をそのまま並べると、読む人は 5 行から
 * 「で、私は何をすればいいのか」を自分で組み立てることになる。
 */
function emptyReasonFor(
  rows: readonly SelectableModelRow[],
  credentials: CredentialAccess,
): string {
  if (!credentials.available) return credentials.reason;
  const withModels = rows.filter((r) => r.models.length > 0);
  if (withModels.length === 0) {
    return "選べるモデルが 1 つも設定されていません。管理者が目録（LLM_PROVIDER_CATALOG）へ単価つきで登録するまで、生成は始められません。";
  }
  return "API キーがまだ 1 つも登録されていません。設定画面から登録すると、ここに選べるモデルが並びます。";
}
