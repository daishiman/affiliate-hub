import type { ChannelConnection, ChannelKind, Publication } from "@/domain/distribution";
import type {
  ChannelConnectionId,
  ContentVariantId,
  PublicationId,
  WorkspaceId,
} from "@/domain/shared";
import type { Page, Paged, PortResult } from "./common";

export type ChannelConnectionRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ChannelConnectionId): PortResult<ChannelConnection | null>;
  listByWorkspace(workspaceId: WorkspaceId, page: Page): PortResult<Paged<ChannelConnection>>;
  save(connection: ChannelConnection): PortResult<ChannelConnection>;
};

export type PublicationRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: PublicationId): PortResult<Publication | null>;
  /** 冪等キーでの検索。二重投稿を防ぐ入口。 */
  findByIdempotencyKey(workspaceId: WorkspaceId, key: string): PortResult<Publication | null>;
  listByVariant(workspaceId: WorkspaceId, variantId: ContentVariantId): PortResult<readonly Publication[]>;
  listDue(at: Date, limit: number): PortResult<readonly Publication[]>;
  /** 直近の配信。運営者が「いま何が止まっているか」を見る画面の入力。 */
  listRecent(workspaceId: WorkspaceId, limit: number): PortResult<readonly Publication[]>;
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
  /** 投稿する。冪等キーを渡し、実装側で二重送信を防ぐ。 */
  publish(input: ChannelPublishInput): PortResult<ChannelPublishResult>;
  /** 取り下げる。対応していないチャネルは失敗を返す (黙って成功にしない)。 */
  unpublish(externalId: string): PortResult<true>;
  /** 送信前の検査。文字数超過などをここで見つける。 */
  validate(input: ChannelPublishInput): PortResult<readonly string[]>;
};

export type ChannelPublishInput = {
  readonly connectionId: ChannelConnectionId;
  readonly idempotencyKey: string;
  readonly title: string | null;
  readonly body: string;
  readonly imageKeys: readonly string[];
  readonly scheduledAt: Date | null;
  /** 広告表記。本文に含めるかタグで示すかはチャネル能力表に従う。 */
  readonly disclosureText: string;
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
 */
export type ManualExportPort = {
  buildDraft(input: ChannelPublishInput): PortResult<{ markdown: string; instructions: string }>;
};
