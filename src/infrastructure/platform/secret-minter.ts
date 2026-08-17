import { MIN_KEY_VALUE_LENGTH } from "@/domain/feedback";

/**
 * 取りに来るときの合言葉を作り、潰す。
 *
 * ここだけが平文を作る。作った平文は呼び出し側へ返して**すぐ捨てる**。
 * 保存先へは潰した値しか渡らない（`IntegrationKeyPort.issue` の型がそうなっている）。
 *
 * 使うのは実行環境が持つ Web Crypto。自前で乱数や要約を書かない
 * （自前実装は、間違っていても動いているように見えるため）。
 */

/** 32 バイト = 64 文字。総当たりで当てられる長さではない。 */
const BYTES = 32;

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 平文を潰す。同じ平文からは必ず同じ値になる（照合に使うため）。 */
export async function hashSecret(plainValue: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(plainValue));
  return toHex(new Uint8Array(digest));
}

export async function mintSecret(): Promise<{
  readonly plainValue: string;
  readonly hashedValue: string;
}> {
  const random = new Uint8Array(BYTES);
  crypto.getRandomValues(random);
  const plainValue = toHex(random);
  // 長さの下限は domain が決めている。ここで下回ったら組み立ての誤り。
  if (plainValue.length < MIN_KEY_VALUE_LENGTH) {
    throw new Error("作った合言葉が短すぎます（domain の下限を下回っています）。");
  }
  return { plainValue, hashedValue: await hashSecret(plainValue) };
}
