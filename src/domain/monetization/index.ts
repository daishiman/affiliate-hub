/**
 * Affiliate & Monetization コンテキスト (Commercial 区分)。
 *
 * このバレルを import してよいのは application / infrastructure / presentation だけ。
 * 他のドメインコンテキスト、特に ranking からの import は
 * 依存方向テスト (tests/architecture) で失敗する。
 */
export * from "./affiliate-link";
export * from "./affiliate-program";
export * from "./conversion";
export * from "./link-ingestion";
export * from "./tracking-link";
