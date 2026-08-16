import type { PortResult, SecretResolverPort } from "@/application/ports";
import { domainError, err, ok } from "@/domain/shared";

/**
 * 秘密情報の取り出し。
 *
 * ここが秘密の値に触れてよい唯一の場所である。
 *
 * 守ること:
 *   - 取り出した値をログ・監査記録・エラー本文・ドメインオブジェクトへ入れない
 *   - 参照キー (`ref`) だけをドメインに持たせる (`credentialRef`)
 *   - 値をファイルやコマンドライン引数に書かない。登録は利用者本人が
 *     `wrangler secret put` を別のターミナルで実行する
 *
 * 参照キーの形式: `<種別>/<接続ID>/<用途>` 例: `asp/acc_123/api_key`
 * これを Cloudflare Workers の環境変数名へ写像する。
 */
const REF_PATTERN = /^[a-z][a-z0-9_-]*\/[A-Za-z0-9_-]+\/[a-z][a-z0-9_]*$/;

/** 参照キーを環境変数名に直す。`asp/acc_123/api_key` → `SECRET_ASP__ACC_123__API_KEY` */
export function refToEnvName(ref: string): string {
  return `SECRET_${ref.replace(/\//g, "__").replace(/-/g, "_").toUpperCase()}`;
}

export function createSecretResolver(env: Readonly<Record<string, unknown>>): SecretResolverPort {
  return {
    async resolve(ref: string): PortResult<string> {
      if (!REF_PATTERN.test(ref)) {
        return err(
          domainError("VALIDATION_FAILED", "秘密情報の参照キーの形式が正しくありません。", {
            field: "ref",
            suggestedAction: "`種別/接続ID/用途` の形式で指定してください。",
            // ref 自体は秘密ではないが、値と取り違えないよう本文には載せない
          }),
        );
      }
      const value = env[refToEnvName(ref)];
      if (typeof value !== "string" || value.length === 0) {
        return err(
          domainError("NOT_FOUND", "この接続の認証情報がまだ登録されていません。", {
            suggestedAction:
              "設定画面から登録してください。値は画面またはご自身のターミナルで入力します。",
            details: { ref },
          }),
        );
      }
      return ok(value);
    },
  };
}

/**
 * テスト用。秘密の「値」ではなく、あらかじめ用意した文字列を返す。
 * 本物の鍵をテストコードへ書かない。
 */
export function fakeSecretResolver(map: Readonly<Record<string, string>>): SecretResolverPort {
  return {
    async resolve(ref) {
      const v = map[ref];
      return v === undefined
        ? err(domainError("NOT_FOUND", "テスト用の秘密が定義されていません。", { details: { ref } }))
        : ok(v);
    },
  };
}
