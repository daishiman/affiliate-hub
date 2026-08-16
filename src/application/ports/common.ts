import type { DomainError, DomainEventName, Result } from "@/domain/shared";

/**
 * ポート共通の型。
 *
 * ポートは「外側とのつなぎ目の宣言」であり、ここに実装は 1 行も書かない。
 * fetch / SDK / Drizzle / Next.js の import が入ったら、それは infrastructure の仕事。
 */

/** ポートの戻り値。失敗はドメインの言葉で返す (HTTP ステータスを漏らさない)。 */
export type PortResult<T> = Promise<Result<T, DomainError>>;

/** 一覧取得の共通引数。件数制限を必須にして、全件取得の事故を防ぐ。 */
export type Page = {
  readonly limit: number;
  readonly cursor: string | null;
};

export type Paged<T> = {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
};

/** ID 生成。ドメインは ID の作り方を知らない。 */
export type IdGeneratorPort = {
  newId(): string;
};

/** 秘密情報の取り出し。値はここでしか触れない。ログや監査記録へは渡さない。 */
export type SecretResolverPort = {
  /** 参照キーから秘密を取り出す。見つからない場合は失敗を返す。 */
  resolve(ref: string): PortResult<string>;
};

/** 構造化ログ。個人情報と秘密は入れない。 */
export type LoggerPort = {
  info(event: string, fields?: Readonly<Record<string, unknown>>): void;
  warn(event: string, fields?: Readonly<Record<string, unknown>>): void;
  error(event: string, fields?: Readonly<Record<string, unknown>>): void;
};

/** ファイル保管 (R2)。画像・書き出しファイル。 */
export type StoragePort = {
  put(key: string, body: ArrayBuffer | string, contentType: string): PortResult<{ key: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): PortResult<string>;
  delete(key: string): PortResult<true>;
};

/** キャッシュ (KV)。取得に時間のかかる外部データを一時保持する。 */
export type CachePort = {
  get<T>(key: string): PortResult<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): PortResult<true>;
  delete(key: string): PortResult<true>;
};

/**
 * 後回しにできる仕事の受け渡し (Queues)。
 *
 * 生成・取込・配信のように時間がかかる処理は、
 * 画面の応答を待たせずにここへ積む。
 */
export type TaskQueuePort<T = unknown> = {
  enqueue(task: T, options?: { delaySeconds?: number }): PortResult<{ taskId: string }>;
};

/**
 * ドメインイベントの発行。
 *
 * コンテキスト間の連絡はイベントか公開インターフェースだけ (要求 B)。
 * 別コンテキストのリポジトリを直接呼ばない。
 */
export type DomainEvent = {
  /** 名前は domain の一覧にあるものだけ。綴りのずれを型で止める。 */
  readonly name: DomainEventName;
  readonly workspaceId: string;
  readonly occurredAt: Date;
  readonly payload: Readonly<Record<string, unknown>>;
};

export type EventPublisherPort = {
  publish(event: DomainEvent): PortResult<true>;
};
