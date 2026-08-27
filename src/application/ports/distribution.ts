import type { ChannelConnection, ChannelKind, Publication } from "@/domain/distribution";
import type {
  ChannelConnectionId,
  ContentVariantId,
  DomainError,
  PublicationId,
  Result,
  WorkspaceId,
} from "@/domain/shared";
import type { BrandScopeFilter, PageRequest, Paged, PortResult } from "./common";

export type ChannelConnectionRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ChannelConnectionId): PortResult<ChannelConnection | null>;
  listByWorkspace(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<ChannelConnection>>;
  /** provider主体または秘密参照が同じ接続を、並行要求でも1行へ収束させる。 */
  createIfAbsent(
    connection: ChannelConnection,
  ): PortResult<{ readonly connection: ChannelConnection; readonly created: boolean }>;
  /**
   * 同じprovider主体への外部送信を、複数Workerをまたいで1件へ直列化する。
   * 取得できた場合だけ、その取得に固有のopaque tokenを返す。
   */
  acquireProviderDeliveryLease(input: {
    readonly kind: ChannelKind;
    readonly providerIdentity: string;
    readonly holderPublicationId: PublicationId;
    readonly at: Date;
    readonly expiresAt: Date;
  }): PortResult<string | null>;
  /** holderと取得tokenが同じleaseだけを解放する。別Workerが更新したleaseは消さない。 */
  releaseProviderDeliveryLease(input: {
    readonly kind: ChannelKind;
    readonly providerIdentity: string;
    readonly holderPublicationId: PublicationId;
    readonly leaseToken: string;
  }): PortResult<void>;
  save(connection: ChannelConnection): PortResult<ChannelConnection>;
};

export type PublicationRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: PublicationId): PortResult<Publication | null>;
  /** 冪等キーでの検索。二重投稿を防ぐ入口。 */
  findByIdempotencyKey(workspaceId: WorkspaceId, key: string): PortResult<Publication | null>;
  /**
   * 同じworkspace・冪等キーの配信を原子的に1件へ収束させる。
   * `created=false` でも失敗ではなく、先に作られた正本を返す。
   */
  createIfAbsent(
    publication: Publication,
  ): PortResult<{ readonly publication: Publication; readonly created: boolean }>;
  listByVariant(workspaceId: WorkspaceId, variantId: ContentVariantId): PortResult<readonly Publication[]>;
  listDue(at: Date, limit: number): PortResult<readonly Publication[]>;
  /**
   * 読んだ版を次の版へ原子的に進める、Publication更新の唯一の境界。
   * workerのclaimだけでなく、取りやめ・修正・再予約も必ずここを通す。
   * 先に別処理が1項目でも変えていた場合は `null` を返す。
   */
  compareAndSwap(before: Publication, next: Publication): PortResult<Publication | null>;
  /**
   * 外部送信権を確保する唯一の境界。
   * Publication全列CASに加え、予約時に固定した本文版が現在版と同じことを
   * 保存先の同一UPDATE条件で原子的に検証する。旧行の版欠落はnullを返す。
   */
  claimForDelivery(before: Publication, next: Publication): PortResult<Publication | null>;
  /**
   * 直近の配信。ブランド絞り込みを limit より先に行う。
   *
   * `listRecent(...).filter(...)` にすると、先頭が担当外で埋まったときに
   * 担当ブランドの行が次ページへ押し出されたまま永久に見えなくなる。
   */
  listRecent(
    workspaceId: WorkspaceId,
    limit: number,
    brandScope?: BrandScopeFilter,
  ): PortResult<readonly Publication[]>;
  /** 指定月の予定と日時未指定を返す。月内件数へ固定limitを掛けない。 */
  listForCalendar(
    workspaceId: WorkspaceId,
    fromInclusive: Date,
    toExclusive: Date,
    brandScope?: BrandScopeFilter,
  ): PortResult<readonly Publication[]>;
  /** 新規行・fixtureの保存用。既存Publicationの業務変更にはcompareAndSwapを使う。 */
  save(publication: Publication): PortResult<Publication>;
};

/**
 * 各チャネルへの投稿。
 *
 * チャネルごとに別の型を作らない。1 つの契約に揃えることで、
 * チャネルを 1 つ増やしても呼び出し側 (ユースケース) は変わらない。
 */
export type ChannelConnectorPort = {
  readonly kind: ChannelKind;
  /** 実認証でprovider主体を確定する。token/JWTはこの戻り値へ含めない。 */
  resolveIdentity(): PortResult<ChannelProviderIdentity>;
  /** 認証情報を値として返さず、接続可能かだけを確かめる。 */
  checkReadiness(): PortResult<true>;
  /**
   * provider側の冪等キーを最初のclaim時に一度だけ作る。
   * 保存後のretryは同じ値を使い、外部に別recordを増やさない。
   */
  prepareDeliveryKey(input: ChannelPublishInput, at: Date): PortResult<string>;
  /** 投稿する。冪等キーを渡し、実装側で二重送信を防ぐ。 */
  publish(input: ChannelPublishInput): PortResult<ChannelPublishResult>;
  /** 取り下げる。対応していないチャネルは失敗を返す (黙って成功にしない)。 */
  unpublish(externalId: string): PortResult<true>;
  /** 送信前の検査。文字数超過などをここで見つける。 */
  validate(input: ChannelPublishInput): PortResult<readonly string[]>;
};

export type ChannelProviderIdentity = {
  readonly providerIdentity: string;
  readonly accountLabel: string;
};

export type ChannelPublishInput = {
  readonly connectionId: ChannelConnectionId;
  readonly idempotencyKey: string;
  /** provider固有の不透明な冪等キー。送信前の原子的claimで確定・保存する。 */
  readonly providerDeliveryKey: string | null;
  readonly title: string | null;
  readonly body: string;
  readonly imageKeys: readonly string[];
  readonly scheduledAt: Date | null;
  /** provider recordに保存する不変時刻。最初の外部送信claimで確定する。 */
  readonly providerRecordCreatedAt: Date | null;
  /** 広告表記。本文に含めるかタグで示すかはチャネル能力表に従う。 */
  readonly disclosureText: string;
};

/** 接続行から本番コネクタを引き当てるcompositionの口。 */
export type ChannelConnectorProviderPort = {
  forConnection(connection: ChannelConnection): Result<ChannelConnectorPort, DomainError>;
};

export type ChannelPublishResult = {
  readonly externalId: string;
  readonly externalUrl: string | null;
  readonly publishedAt: Date;
};

/**
 * 公式 API が無いチャネル (note) 向けの書き出し。
 *
 * 「直接公開」を提供しないことを、型でも明確にする。
 * 非公式 API を使う実装をここに足してはならない。
 *
 * 出し先の種類を**引数で受け取る**。`ChannelPublishInput` には接続の識別子しか
 * 入っておらず、そこから種類は辿れない。種類を渡さない形にすると、実装は
 * 「note のことだ」と決め打ちするしかなくなり、note 以外の手作業の出し先を
 * 足した日に、手順書だけが note のまま残る。
 */
export type ManualExportPort = {
  buildDraft(
    kind: ChannelKind,
    input: ChannelPublishInput,
  ): PortResult<{ markdown: string; instructions: string }>;
};
