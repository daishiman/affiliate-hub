import type { Brand, Membership, Workspace } from "@/domain/identity";
import type { BrandId, MembershipId, UserId, WorkspaceId } from "@/domain/shared";
import type { PageRequest, Paged, PortResult } from "./common";

export type CapacityLeaseKind = "brand" | "site" | "member" | "generation";

/**
 * 容量を使う処理が走っている間だけ持つ印。
 *
 * `limit` は domain の `PLAN_LIMITS` から渡す。保存先に同じ上限値を持たせないことで、
 * 契約を変えたのに判定だけ古い、という二重正本を作らない。
 */
export type AcquireCapacityLeaseInput = {
  readonly id: string;
  readonly kind: CapacityLeaseKind;
  readonly limit: number;
  readonly now: Date;
  readonly expiresAt: Date;
};

export type WorkspaceRepositoryPort = {
  findById(id: WorkspaceId): PortResult<Workspace | null>;
  findByOwner(userId: UserId): PortResult<readonly Workspace[]>;
  save(workspace: Workspace): PortResult<Workspace>;
  countBrands(id: WorkspaceId): PortResult<number>;
  countSites(id: WorkspaceId): PortResult<number>;
  /** 当月の AI 生成回数。上限判定に使う。 */
  countGenerationsThisMonth(id: WorkspaceId, now: Date): PortResult<number>;
  /** 実件数と実行中 lease を同じ D1 statement で数え、空きがある時だけ取得する。 */
  acquireCapacityLease(
    workspaceId: WorkspaceId,
    input: AcquireCapacityLeaseInput,
  ): PortResult<boolean>;
  /** 失敗を含む mutation 終了時に呼ぶ。既に無い lease の解放も成功として扱う。 */
  releaseCapacityLease(workspaceId: WorkspaceId, id: string, now: Date): PortResult<void>;
};

export type BrandRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: BrandId): PortResult<Brand | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<Brand>>;
  save(brand: Brand): PortResult<Brand>;
};

export type MembershipRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: MembershipId): PortResult<Membership | null>;
  findByUser(workspaceId: WorkspaceId, userId: UserId): PortResult<Membership | null>;
  /**
   * 招待したアドレスで引く。**招待を出す前に必ず通す。**
   *
   * 同じアドレスの行は 1 つしか作れない（保存先の一意制約）。先に引かずに
   * 保存すると、二重の招待は「保存先が落ちました」という無関係な断りで返り、
   * 押した人には**何を直せばよいか**が分からない。
   */
  findByInvitedEmail(workspaceId: WorkspaceId, invitedEmail: string): PortResult<Membership | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<Membership>>;
  /** 参加中と招待中の合計。解除済みの履歴行は容量へ数えない。 */
  countCurrent(workspaceId: WorkspaceId): PortResult<number>;
  save(membership: Membership): PortResult<Membership>;
  /** owner が既にいるか。owner は 1 ワークスペースに 1 人。 */
  findOwner(workspaceId: WorkspaceId): PortResult<Membership | null>;
};

/**
 * 認証基盤 (Better Auth) とのつなぎ目。
 *
 * ドメインは UserId しか知らない。
 * ログイン方式が Google からメールリンクへ変わっても、ここの下だけが変わる。
 */
export type AuthenticationPort = {
  /** 現在のリクエストの利用者。未ログインなら null。 */
  currentUserId(): PortResult<UserId | null>;
  /** 表示名とアイコン。監査ログと承認履歴の表示に使う。 */
  profileOf(userId: UserId): PortResult<{ displayName: string; avatarUrl: string | null } | null>;
};
