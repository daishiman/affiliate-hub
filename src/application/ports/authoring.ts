import type {
  AudiencePersona,
  AuthorPersona,
  ContentPackage,
  ContentState,
  ContentVariant,
  SiteBlueprint,
} from "@/domain/authoring";
import type {
  AudiencePersonaId,
  AuthorPersonaId,
  BrandId,
  ContentPackageId,
  ContentVariantId,
  SiteBlueprintId,
  SiteId,
  WorkspaceId,
} from "@/domain/shared";
import type { Page, Paged, PortResult } from "./common";

export type ContentPackageRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ContentPackageId): PortResult<ContentPackage | null>;
  list(workspaceId: WorkspaceId, page: Page): PortResult<Paged<ContentPackage>>;
  save(pkg: ContentPackage): PortResult<ContentPackage>;
};

export type ContentVariantRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ContentVariantId): PortResult<ContentVariant | null>;
  listByPackage(
    workspaceId: WorkspaceId,
    packageId: ContentPackageId,
  ): PortResult<readonly ContentVariant[]>;
  listByState(workspaceId: WorkspaceId, state: ContentState, page: Page): PortResult<Paged<ContentVariant>>;
  /** 次回確認日を過ぎた公開済み記事。運用の起点になる。 */
  listReviewOverdue(workspaceId: WorkspaceId, at: Date, limit: number): PortResult<readonly ContentVariant[]>;
  save(variant: ContentVariant): PortResult<ContentVariant>;
};

export type PersonaRepositoryPort = {
  findAuthor(workspaceId: WorkspaceId, id: AuthorPersonaId): PortResult<AuthorPersona | null>;
  findAudience(workspaceId: WorkspaceId, id: AudiencePersonaId): PortResult<AudiencePersona | null>;
  listAuthors(workspaceId: WorkspaceId, page: Page): PortResult<Paged<AuthorPersona>>;
  listAudiences(workspaceId: WorkspaceId, page: Page): PortResult<Paged<AudiencePersona>>;
  saveAuthor(persona: AuthorPersona): PortResult<AuthorPersona>;
  saveAudience(persona: AudiencePersona): PortResult<AudiencePersona>;
};

/**
 * サイト。
 *
 * 「複数ブログに対応する」= 設計図 (SiteBlueprint) + 設定値 で表す。
 * ブログごとにコードを分けないため、サイトの違いはすべてこのデータに入る。
 */
export type Site = {
  readonly id: SiteId;
  readonly workspaceId: WorkspaceId;
  readonly brandId: BrandId;
  readonly blueprintId: SiteBlueprintId;
  readonly name: string;
  readonly domain: string;
  readonly locale: string;
  readonly launchedAt: Date | null;
};

export type SiteRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: SiteId): PortResult<Site | null>;
  findByDomain(domain: string): PortResult<Site | null>;
  list(workspaceId: WorkspaceId, page: Page): PortResult<Paged<Site>>;
  save(site: Site): PortResult<Site>;
};

export type SiteBlueprintRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: SiteBlueprintId): PortResult<SiteBlueprint | null>;
  list(workspaceId: WorkspaceId, page: Page): PortResult<Paged<SiteBlueprint>>;
  save(blueprint: SiteBlueprint): PortResult<SiteBlueprint>;
};
