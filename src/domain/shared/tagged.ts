/**
 * 名前付き型 (tagged / branded type)。
 *
 * TypeScript は構造的部分型なので、`string` の別名を作っても取り違えを防げない。
 * `Tagged<string, "WorkspaceId">` にすると、ProductId を WorkspaceId の位置へ
 * 渡した時点でコンパイルエラーになる。
 *
 * 型の道具の名前を Brand ではなく Tagged にしている理由:
 * 「Brand」は業務用語 (Workspace > Brand > Site の Brand 集約) に予約する。
 * 用語辞書の言葉を型の道具が占有すると、コードと業務の会話がずれる。
 *
 * この層 (domain) は Next.js / Drizzle / 外部SDK / fetch に一切依存しない。
 * 依存を足したくなったら、それは application 層か infrastructure 層の仕事。
 */
declare const taggedSymbol: unique symbol;

export type Tagged<T, B extends string> = T & { readonly [taggedSymbol]: B };

/** 名前付き文字列IDを作るための最小ヘルパー。検証は各コンテキスト側で足す。 */
export function taggedString<B extends string>(value: string): Tagged<string, B> {
  return value as Tagged<string, B>;
}
