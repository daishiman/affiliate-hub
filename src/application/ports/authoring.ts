import type {
  AudiencePersona,
  AuthorPersona,
  ContentPackage,
  ContentState,
  ContentVariant,
  SiteBlueprint,
  SiteDraft,
} from "@/domain/authoring";
import type { Editorial } from "@/domain/shared";
import type {
  AudiencePersonaId,
  AuthorPersonaId,
  ContentPackageId,
  ContentVariantId,
  SiteBlueprintId,
  SiteDraftId,
  WorkspaceId,
} from "@/domain/shared";
import type { PageRequest, Paged, PortResult } from "./common";

export type ContentPackageRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ContentPackageId): PortResult<ContentPackage | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<ContentPackage>>;
  save(pkg: ContentPackage): PortResult<ContentPackage>;
};

export type ContentVariantRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ContentVariantId): PortResult<ContentVariant | null>;
  listByPackage(
    workspaceId: WorkspaceId,
    packageId: ContentPackageId,
  ): PortResult<readonly ContentVariant[]>;
  listByState(workspaceId: WorkspaceId, state: ContentState, page: PageRequest): PortResult<Paged<ContentVariant>>;
  /** 次回確認日を過ぎた公開済み記事。運用の起点になる。 */
  listReviewOverdue(workspaceId: WorkspaceId, at: Date, limit: number): PortResult<readonly ContentVariant[]>;
  save(variant: ContentVariant): PortResult<ContentVariant>;
  /**
   * 進行の現在地（§18.1 の 12 段階）を読む。まだ記録が無ければ `null`。
   *
   * **本文（`ContentVariant`）とは別に持つ。** 本文は AI の出力契約（§15.5）で、
   * 現在地は人の運用の位置。同じ型に混ぜると、AI が出力を返しただけで
   * 段階が進んだことになりかねない。
   */
  findState(workspaceId: WorkspaceId, id: ContentVariantId): PortResult<ContentState | null>;
  /**
   * 進行の現在地を保存する。
   *
   * これが無かったあいだ、段階を進める操作は**何も保存せずに成功を返して**いた。
   * 画面からは「操作が効いていない」のか「保存が壊れている」のかを区別できない。
   */
  saveState(
    workspaceId: WorkspaceId,
    id: ContentVariantId,
    state: ContentState,
  ): PortResult<ContentState>;
  /**
   * 記事 1 本を消す。本文と進行の現在地の両方を落とす。
   *
   * 片方だけ残すと、本文の無い段階が盤面に居座る。
   * 見つからないときは成功にせず断りを返す。
   */
  remove(workspaceId: WorkspaceId, id: ContentVariantId): PortResult<true>;
};

export type PersonaRepositoryPort = {
  findAuthor(workspaceId: WorkspaceId, id: AuthorPersonaId): PortResult<AuthorPersona | null>;
  findAudience(workspaceId: WorkspaceId, id: AudiencePersonaId): PortResult<AudiencePersona | null>;
  listAuthors(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<AuthorPersona>>;
  listAudiences(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<AudiencePersona>>;
  saveAuthor(persona: AuthorPersona): PortResult<AuthorPersona>;
  saveAudience(persona: AudiencePersona): PortResult<AudiencePersona>;
};

// ブログ（Site）の型と出し入れの窓口は、ここには置かない。
// 正本は domain/authoring/site.ts の `Site` と、
// application/ports/site.ts の `SiteRepositoryPort` の 2 つだけ。
// 以前はここにも別形の `Site` があり、`slug` を持つ側と `domain` を持つ側が
// 並んで育っていた。同じ「ブログ」を指す型が 2 つあると、
// どちらに合わせて書けばよいか読む側が決められなくなる。
// 検査: tests/architecture/single-definition.test.ts

/**
 * ブログ作成ウィザードの下書き。
 *
 * 設計図とは別に持つ。途中の状態を設計図として保存すると、
 * 空欄のまま公開されたブログが生まれる。
 */
export type SiteDraftRepositoryPort = {
  find(workspaceId: WorkspaceId, id: SiteDraftId): PortResult<SiteDraft | null>;
  /** 作りかけの一覧。放置された下書きに気づけるようにする。 */
  list(workspaceId: WorkspaceId): PortResult<readonly SiteDraft[]>;
  save(draft: SiteDraft): PortResult<SiteDraft>;
  /**
   * 完成した設計図をブログとして登録する。
   * ここを通ったものだけが読者から見える。
   */
  publishBlueprint(slug: string, blueprint: SiteBlueprint): PortResult<SiteBlueprint>;
  /**
   * 登録済みのブログを取り下げる。`publishBlueprint` の対。
   *
   * 登録と抹消を同じ窓口に置くのは、触る先が同じ 1 つの入れ物だから。
   * 別の窓口に分けると、片方だけが会社の絞り込みを忘れる形が作れてしまう。
   *
   * 見本として最初から入っているブログは消せない（コードの中にあるため）。
   * 消せないものを「消えた」と返さず、断りを返す。
   */
  removeBlueprint(workspaceId: WorkspaceId, slug: string): PortResult<true>;
};

export type SiteBlueprintRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: SiteBlueprintId): PortResult<SiteBlueprint | null>;
  list(workspaceId: WorkspaceId, page: PageRequest): PortResult<Paged<SiteBlueprint>>;
  save(blueprint: SiteBlueprint): PortResult<SiteBlueprint>;
};

/**
 * Editorial 印つきの別名。
 *
 * ユースケースはこちらだけを受け取る。素の型を受け取れるようにしておくと、
 * 「報酬のポートを混ぜても型が通る」状態が復活してしまう。
 */
export type EditorialContentPackageRepositoryPort = Editorial<ContentPackageRepositoryPort>;
export type EditorialContentVariantRepositoryPort = Editorial<ContentVariantRepositoryPort>;
export type EditorialPersonaRepositoryPort = Editorial<PersonaRepositoryPort>;
export type EditorialSiteBlueprintRepositoryPort = Editorial<SiteBlueprintRepositoryPort>;
export type EditorialSiteDraftRepositoryPort = Editorial<SiteDraftRepositoryPort>;
