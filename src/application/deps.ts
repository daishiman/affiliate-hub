import type {
  EditorialClaimRepositoryPort,
  EditorialEvidenceRepositoryPort,
  EditorialProductRepositoryPort,
  EditorialRankingModelRepositoryPort,
  EditorialScoreCardRepositoryPort,
  EditorialTestRunRepositoryPort,
} from "./ports";
import type {
  EditorialContentPackageRepositoryPort,
  EditorialContentVariantRepositoryPort,
  EditorialPersonaRepositoryPort,
  EditorialSiteDraftRepositoryPort,
} from "./ports/authoring";
import type {
  ChannelConnectionRepositoryPort,
  ManualExportPort,
  PublicationRepositoryPort,
} from "./ports/distribution";
import type {
  ClickTrackingPort,
  MetricsRepositoryPort,
  RedirectResolverPort,
  TrackingCoveragePort,
} from "./ports/analytics";
import type { TelemetrySinkPort } from "./ports/telemetry";
import type { ImprovementRepositoryPort } from "./ports/improvement";
import type {
  FeedbackCaptureStoragePort,
  FeedbackRepositoryPort,
  HandoffTemplatePort,
  IntegrationKeyPort,
} from "./ports/feedback";
import type { EventPublisherPort, IdGeneratorPort } from "./ports/common";
import type {
  AuditLogPort,
  DisclosureRepositoryPort,
  PolicyRuleRepositoryPort,
} from "./ports/compliance";
import type { LlmCostEstimatorPort, LlmPort } from "./ports/llm";
import type {
  BrandRepositoryPort,
  MembershipRepositoryPort,
  WorkspaceRepositoryPort,
} from "./ports/identity";
import type {
  AffiliateAccountRepositoryPort,
  AffiliateProgramRepositoryPort,
  CommercialAffiliateLinkRepositoryPort,
  CommercialConversionRepositoryPort,
  CommercialLinkIngestionRepositoryPort,
} from "./ports/monetization";
import type {
  EditorialContactPort,
  EditorialReaderToolPort,
  EditorialShortlistPort,
} from "./ports/reader-interaction";
import type {
  EditorialPublishedArticleAdminPort,
  EditorialPublishedArticleWriterPort,
  EditorialPublishedContentPort,
  EditorialSiteRepositoryPort,
} from "./ports/site";

/**
 * ユースケースが必要とするもの一式。
 *
 * ここに並ぶのは実装ではなく**つなぎ目の宣言（ポート）**だけ。
 * 「どの実装を使うか」は `src/infrastructure/composition.ts` が決める。
 *
 * 機能を足すときは、ここへポートを 1 行足す。
 * 足した瞬間に、組み立て側が実装を渡していないことが型検査で分かる。
 */
export type AppDeps = {
  readonly rankingModels: EditorialRankingModelRepositoryPort;
  readonly scoreCards: EditorialScoreCardRepositoryPort;
  readonly products: EditorialProductRepositoryPort;
  readonly claims: EditorialClaimRepositoryPort;
  readonly evidence: EditorialEvidenceRepositoryPort;
  readonly testRuns: EditorialTestRunRepositoryPort;
  readonly sites: EditorialSiteRepositoryPort;
  readonly publishedContent: EditorialPublishedContentPort;
  /** 記事を読者ページへ出す口。読み口と分けている理由は ports/site.ts に書いた。 */
  readonly publishedArticles: EditorialPublishedArticleWriterPort;
  /** 公開後の訂正と非表示化。読者用の口に混ぜない。 */
  readonly publishedArticleAdmin: EditorialPublishedArticleAdminPort;
  readonly shortlist: EditorialShortlistPort;
  readonly readerTools: EditorialReaderToolPort;
  readonly contact: EditorialContactPort;
  readonly contentPackages: EditorialContentPackageRepositoryPort;
  readonly contentVariants: EditorialContentVariantRepositoryPort;
  readonly personas: EditorialPersonaRepositoryPort;
  /** ブログ作成ウィザードの下書き。ブログを増やすのはコードではなくここのデータ。 */
  readonly siteDrafts: EditorialSiteDraftRepositoryPort;
  readonly channelConnections: ChannelConnectionRepositoryPort;
  readonly publications: PublicationRepositoryPort;
  readonly manualExport: ManualExportPort;
  readonly metrics: MetricsRepositoryPort;
  readonly clickTracking: ClickTrackingPort;
  /** 転送の入口（`/go/<合言葉>`）が読む写し。読むだけで、ここからは書けない。 */
  readonly redirectResolver: RedirectResolverPort;
  /**
   * 順位表の成果リンクのうち、まだ合言葉が発行されていない件数。
   *
   * 0 件になるまで、突合できるクリック計測は完成していない。
   * 出しておかないと、ASP の URL が黙って出るだけで気づけない。
   */
  readonly trackingCoverage: TrackingCoveragePort;
  /**
   * 計測の記録先。
   *
   * domain はこの実装を知らない。保存先を替えても、
   * イベントの形 (domain/analytics/telemetry-events.ts) は変わらない。
   */
  readonly telemetry: TelemetrySinkPort;
  /**
   * 改善ループの記録。
   *
   * 見せ方の設定・1 周の記録・観測値をまとめて扱う。
   * 軸が増えてもこの口は増えない（設定は `軸 → 値` の集まりとして 1 つの形で入る）。
   */
  readonly improvement: ImprovementRepositoryPort;
  /**
   * 改善要望（使い勝手を直すループ）。運用のデータであり、
   * 記事の順位づけにも売上にも入らない。`guardEditorial` の対象外だが、
   * Editorial / Commercial のどちらでもないことが分かるようにここへまとめて置く。
   */
  readonly feedback: FeedbackRepositoryPort;
  readonly feedbackCaptures: FeedbackCaptureStoragePort;
  readonly handoffTemplates: HandoffTemplatePort;
  readonly integrationKeys: IntegrationKeyPort;
  /**
   * 連携の鍵の平文を作る。
   *
   * 作り方（乱数の取り方・長さ・ハッシュの掛け方）は infrastructure が持つ。
   * ここを型だけにしておくのは、鍵の作り方を差し替えたときに
   * 呼ぶ側（入口・画面）を 1 つも直さずに済ませるため。
   */
  readonly mintSecret: () => Promise<{ readonly plainValue: string; readonly hashedValue: string }>;
  readonly workspaces: WorkspaceRepositoryPort;
  readonly memberships: MembershipRepositoryPort;
  readonly brands: BrandRepositoryPort;
  readonly disclosures: DisclosureRepositoryPort;
  /**
   * 表現ポリシー（言ってはいけない書き方の一覧）。
   *
   * 記事の確認がここを読む。**読まない実装に差し替えると違反は 0 件になる**ので、
   * 「登録されているか」ではなく「呼ばれているか」を検査で固定してある
   * （tests/application/manage-content.test.ts）。
   */
  readonly policyRules: PolicyRuleRepositoryPort;
  readonly auditLog: AuditLogPort;
  /** 文脈をまたぐ連絡。別の文脈のリポジトリを直接呼ばないための唯一の経路。 */
  readonly events: EventPublisherPort;
  /** 新しい ID を作る。ドメインは「文字列を ID として読む」だけで、作らない。 */
  readonly ids: IdGeneratorPort;
  /**
   * 生成 AI。提供元の名前はここに出さない。
   * どこの提供元を使うかは `src/infrastructure/llm/llm-setup.ts` の 1 行が決める。
   */
  readonly llm: LlmPort;
  /** 呼ぶ前の費用の概算。実行してから請求で気づく、を避ける。 */
  readonly llmCosts: LlmCostEstimatorPort;
  /**
   * ここから下は Commercial 区分。
   * 順位づけのユースケースは Editorial 印のポートしか受け取らないので、
   * この 5 つを渡そうとするとコンパイルが通らない。
   */
  readonly affiliateAccounts: AffiliateAccountRepositoryPort;
  readonly affiliatePrograms: AffiliateProgramRepositoryPort;
  readonly affiliateLinks: CommercialAffiliateLinkRepositoryPort;
  readonly conversions: CommercialConversionRepositoryPort;
  /** 貼り付けられた成果リンクの受信箱。順位づけへは渡らない。 */
  readonly linkInbox: CommercialLinkIngestionRepositoryPort;
};
