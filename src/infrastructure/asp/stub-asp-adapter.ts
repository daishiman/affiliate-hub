import type {
  AspAdapterPort,
  AspConversionResult,
  AspProductResult,
} from "@/application/ports";
import type { AspKind } from "@/domain/monetization";
import { ASP_LABEL } from "@/domain/monetization";
import { registerStub, stubCall } from "../stub-registry";
import type { AspAdapterContext } from "./asp-registry";

/**
 * ASP アダプタのスタブ。
 *
 * **これはスタブである。** 呼ばれると必ず失敗を返す。
 * 空配列や 0 件の成功を返さないのは、「連携済みだが成果が無い」状態と
 * 「まだ実装していない」状態を取り違えないため。
 *
 * 本実装で書くこと:
 *   - 認証情報は `ctx.secrets.resolve(ctx.credentialRef)` でのみ取得する
 *   - 取得した値をログ・エラー本文・戻り値へ入れない
 *   - `createLink` が返した URL は一切加工しない (パラメータ追加は規約違反)
 *   - レート制限は 429 を `RATE_LIMITED` に写して retryable にする
 */
export function createStubAspAdapter(
  asp: AspKind,
  _ctx: AspAdapterContext,
  blockedBy: string,
): AspAdapterPort {
  const entry = registerStub({
    id: `asp:${asp}`,
    port: "AspAdapterPort",
    label: `${ASP_LABEL[asp]} との連携`,
    blockedBy,
  });

  return {
    asp,
    searchProducts: () => stubCall<readonly AspProductResult[]>(entry, "searchProducts"),
    fetchConversions: () => stubCall<readonly AspConversionResult[]>(entry, "fetchConversions"),
    createLink: () => stubCall<{ url: string }>(entry, "createLink"),
  };
}
