import type {
  AudiencePersona,
  AuthorPersona,
  ContentPackage,
  ContentState,
  ContentVariant,
  CompositionReport,
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
import type { BrandScopeFilter, PageRequest, Paged, PortResult } from "./common";
import type { AuditLogEntry } from "@/domain/compliance";
import type { BlogTemplateId, BlogTheme } from "@/domain/authoring/blog-template";

export type ContentPackageRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ContentPackageId): PortResult<ContentPackage | null>;
  list(
    workspaceId: WorkspaceId,
    page: PageRequest,
    brandScope?: BrandScopeFilter,
  ): PortResult<Paged<ContentPackage>>;
  save(pkg: ContentPackage): PortResult<ContentPackage>;
};

export type ContentVariantRepositoryPort = {
  findById(workspaceId: WorkspaceId, id: ContentVariantId): PortResult<ContentVariant | null>;
  /**
   * 本文と、その保存先が管理する単調増加版を一緒に読む。
   *
   * `ContentVariant` は AI 出力契約なので保存用 metadata を混ぜない。
   * 外部配信はこの版を予約時に固定し、送信権の確保時に現在版と照合する。
   */
  findVersionedById(
    workspaceId: WorkspaceId,
    id: ContentVariantId,
  ): PortResult<{
    readonly variant: ContentVariant;
    readonly revision: number;
    /** trueならcontent_variants実表にあり、D1の原子的claim条件で照合できる。 */
    readonly persisted: boolean;
  } | null>;
  listByPackage(
    workspaceId: WorkspaceId,
    packageId: ContentPackageId,
  ): PortResult<readonly ContentVariant[]>;
  listByState(
    workspaceId: WorkspaceId,
    state: ContentState,
    /** brandScope適用後のContentVariantId昇順。cursorは直前ページ末尾のID。 */
    page: PageRequest,
    brandScope?: BrandScopeFilter,
  ): PortResult<Paged<ContentVariant>>;
  /** 次回確認日を過ぎた公開済み記事。運用の起点になる。 */
  listReviewOverdue(
    workspaceId: WorkspaceId,
    at: Date,
    limit: number,
    brandScope?: BrandScopeFilter,
  ): PortResult<readonly ContentVariant[]>;
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
/**
 * ブログを 1 回で作り切るための入力。
 *
 * 公開実体・下書きの完了・監査記録を分けて渡さない。
 * 3 つを別メソッドにすると、真ん中で失敗したときに
 * 「作れているが下書きは未完了」が必ず作れる。
 */
export type SiteProvisionRequest = {
  /**
   * どの作業場のものとして書くか。
   *
   * `blueprint.workspaceId` があるから省ける、とはしない。省くと
   * 「設計図はよその作業場のものだが、住所と版面はこちらに置かれた」という
   * ちぐはぐな行が作れる。**書くたびに 1 つの値から絞る**ことを型で強いる。
   */
  readonly workspaceId: WorkspaceId;
  readonly slug: string;
  readonly blueprint: SiteBlueprint;
  /** `createdSiteSlug` を今回の slug にした完了後の下書き。 */
  readonly completedDraft: SiteDraft;
  /** 作成開始時に読んだ下書きの版。DB claim が現在版と一致することを要求する。 */
  readonly expectedDraftRevision: number;
  /** 作成行と同じ transaction に入れる監査記録。 */
  readonly audit: AuditLogEntry;
  /** サイト網の節点に出す表示名と一行説明。 */
  readonly displayName: string;
  readonly oneLine: string;
  /**
   * 作成時に選んだ見せ方と色。
   *
   * `publishBlueprint` の `appearance` と違い**省略できない。**
   * 作成は 13 問で見せ方を必ず選ばせる経路なので、省ける形にすると
   * 「選んだのに既定のまま」という取りこぼしが型の上で許される。
   */
  readonly appearance: {
    readonly templateId: BlogTemplateId;
    readonly theme: BlogTheme;
  };
};

export type SiteProvisionOutcome = {
  readonly blueprint: SiteBlueprint;
  /** 保存した初期行数を、公開投影と同じ判定関数に通した結果。 */
  readonly composition: CompositionReport;
};

export type SiteDraftRepositoryPort = {
  find(workspaceId: WorkspaceId, id: SiteDraftId): PortResult<SiteDraft | null>;
  /** 作りかけの一覧。放置された下書きに気づけるようにする。 */
  list(workspaceId: WorkspaceId): PortResult<readonly SiteDraft[]>;
  /** `draft.revision` を期待版として CAS 保存し、成功時は次の版を返す。 */
  save(draft: SiteDraft): PortResult<SiteDraft>;
  /**
   * 完成した設計図をブログとして登録する。
   * ここを通ったものだけが読者から見える。
   *
   * **新規作成からは呼ばない。** 設計図だけを差し替える編集
   * （`edit-sites.ts`）のための口である。作成は `provisionSite` を通す。
   * 作成でここを直に呼ぶと、設計図はあるがサイト網の節点が無いブログ、
   * つまり「作成済みと出るのに 404」が再び作れてしまう。
   */
  publishBlueprint(
    slug: string,
    blueprint: SiteBlueprint,
    appearance?: {
      readonly templateId: BlogTemplateId;
      readonly theme: BlogTheme;
    },
  ): PortResult<SiteBlueprint>;
  /**
   * ブログを**読者が開ける状態にして**作る。
   *
   * 設計図・サイト網の節点・版面の帯・版面のスロットを 1 回の書き込みで揃える。
   * 途中で失敗したら何も残さない。部分成功を正常系として残さないため、
   * 個別の口に分けずここ 1 つにまとめてある。
   *
   * 作成後の確認は、読者向け公開投影を通して行う。保存層が別の数え方を持たない。
   */
  provisionSite(request: SiteProvisionRequest): PortResult<SiteProvisionOutcome>;
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
