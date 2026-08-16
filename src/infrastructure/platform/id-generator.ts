import type { IdGeneratorPort } from "@/application/ports";

/**
 * ID 生成。
 *
 * ドメインは ID の作り方を知らない。ここを差し替えれば形式を変えられる。
 * 時刻を先頭に置くのは、DB のインデックスが挿入順に並んで断片化しにくいため。
 */
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomSuffix(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export const idGenerator: IdGeneratorPort = {
  newId(): string {
    return `${Date.now().toString(36)}${randomSuffix(12)}`;
  },
};

/** テスト用。連番で予測できる ID を返す。 */
export function sequentialIdGenerator(prefix = "id"): IdGeneratorPort {
  let n = 0;
  return { newId: () => `${prefix}-${++n}` };
}
