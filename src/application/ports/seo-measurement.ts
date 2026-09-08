import type {
  AutoApplyPlan,
  Finding,
  FindingCode,
  MeasurementSource,
  PageKey,
  PageObservation,
  RevisionSnapshot,
} from "@/domain/seo/aeo-measurement";
import type { PortResult } from "./common";
import type { PublishedArticle } from "@/application/read-models/published-article";
import type { DomainError } from "@/domain/shared";

/**
 * SEO / AEO 計測ループのつなぎ目（feat-seo-aeo-measurement-loop）。
 *
 * ==========================================================================
 * 「集める側」と「しまう側」を別の口にする
 * ==========================================================================
 *
 * 3 つのデータ源は、壊れ方がまるで違う。
 *
 * - 系統①（サイト内静的解析）は自分のサイトを読むだけなので、
 *   ネットワークが生きていれば必ず答えが返る。
 * - 系統②（Search Console）は資格情報が要り、日ごとの上限があり、
 *   そもそも所有権の確認が済んでいないと 403 を返す。
 * - 系統③（AI 検索での被引用）は返事が毎回違う。同じ問いで
 *   引用されたりされなかったりする。
 *
 * これを 1 つの `collect()` に畳むと、②が落ちたときに①の結果まで
 * 捨てることになる。**系統ごとに別の口**にして、片方が落ちても
 * もう片方の所見が入るようにする。
 *
 * ==========================================================================
 * 資格情報はこの層に現れない
 * ==========================================================================
 *
 * `SearchConsoleClientPort` も `AiCitationClientPort` も、鍵を引数に取らない。
 * 鍵は infrastructure の実装が `env` から読み、この層は「読める状態か」
 * （`configured()`）しか知らない。鍵をここへ通すと、ユースケースの
 * 引数として渡り歩き、監査記録や失敗メッセージへ載る道ができてしまう。
 */

/**
 * 見たページ 1 件の身元。
 *
 * `pageKey` は URL から作った突合の鍵で、それだけでは
 * 「どのブログのどの記事か」が分からない。**分からないまま所見を保存すると、
 * 自動反映のときに URL から記事を逆引きする必要が出る。** 逆引きの規則は
 * URL の作りを変えた日に壊れ、壊れたことは自動反映が黙って止まる形で現れる。
 *
 * 見た時点では必ず分かっているので、そのとき一緒に保存する。
 * 記事ではないページ（トップ・一覧）は `articleSlug` が null。
 */
export type ObservedPageIdentity = {
  readonly pageKey: PageKey;
  readonly siteSlug: string;
  readonly articleSlug: string | null;
};

/** 所見の保存。**(ページ, 規則) で上書き**する。 */
export type SeoFindingPort = {
  /** 問題が無い記事にも残る観測先。旧反映履歴の観測先も作業場所内で引き継ぐ。 */
  observedPageKey(input: { readonly siteSlug: string; readonly articleSlug: string }): PortResult<PageKey | null>;
  /**
   * ある系統の、あるページ群についての所見を、いまの姿へ入れ替える。
   *
   * 引数に `pages` を取るのは、**消す責任をこの口が持つ**ためである。
   * 「見た範囲の中で、今回出なかった所見は直った」と決められるのは、
   * どこを見たかを知っている呼び出し側だけ。所見だけ渡して upsert すると、
   * 直った所見が永久に残る。
   */
  replaceForPages(input: {
    readonly source: MeasurementSource;
    /** 所見ゼロの成功観測も巡回履歴に残す。 */
    readonly observedAt: string;
    readonly pages: readonly ObservedPageIdentity[];
    readonly findings: readonly Finding[];
    /** page集合が毎回変わる取得元を、site×source時刻で後着runから守る。 */
    readonly siteSnapshotSlug?: string;
    /** 取得元が site 全体を完全に返したときだけ、旧所見を site 単位で解消する。 */
    readonly completeSiteSlug?: string;
    /** Search Console は記事巡回順に使わないため false。省略時は観測履歴を残す。 */
    readonly recordPageObservations?: boolean;
  }): PortResult<{ readonly added: number; readonly resolved: number }>;

  /**
   * 自動反映の候補。**記事に結びついた所見だけ**を、記事ごとにまとめて返す。
   *
   * 記事ごとにまとめるのは NFR7 のためである。1 件ずつ返すと、
   * 呼び出し側が 1 件反映した時点で冷却期間に入り、同じ記事の 2 件目が
   * 14 日待ちになる。
   */
  groupedByArticle(input: {
    readonly siteSlug?: string;
    readonly articleSlug?: string;
    /** 記事詳細は反映済みの観測先も使い、実績の履歴を継続表示する。 */
    readonly includeApplied?: boolean;
    readonly limit: number;
  }): PortResult<
    readonly {
      readonly siteSlug: string;
      readonly articleSlug: string;
      readonly pageKey: PageKey;
      readonly title: string;
      readonly findings: readonly Finding[];
    }[]
  >;

  list(input: {
    readonly siteSlug?: string;
    readonly source?: MeasurementSource;
    readonly limit: number;
  }): PortResult<readonly Finding[]>;

  /** 選択サイト内の、記事に結びついた自動修正可能な未反映所見。未指定時は作業場所全体。 */
  unappliedSummary(input?: { readonly siteSlug?: string }): PortResult<{
    readonly count: number;
    readonly oldestObservedAt: string | null;
  }>;


};

export type AutoApplyLogEntry = {
  readonly id: string;
  readonly pageKey: PageKey;
  readonly siteSlug: string;
  readonly articleSlug: string;
  readonly justifiedBy: readonly Finding[];
  readonly snapshot: RevisionSnapshot;
  readonly diffSummary: string;
  readonly appliedAt: string;
  readonly revertedAt: string | null;
  readonly notifiedAt: string | null;
  /** 旧履歴には無い。版の証拠が無い履歴を自動では取り消さない。 */
  readonly approvedBy?: string | null;
  readonly afterRevision?: number | null;
};

/** 編集元と公開側の現在の版。作成日時の不明を公開日時で補わない。 */
export type SeoArticleState = {
  readonly article: PublishedArticle;
  readonly archivedAt: string | null;
  readonly createdAt: string | null;
  readonly revision: number;
  readonly sourceArticleId: string | null;
  readonly sourceRevision: number | null;
};

/** factoryで作業場所に束縛する。記事・編集元・履歴・所見の更新は1回で確定する。 */
export type SeoArticleRevisionPort = {
  find(input: { readonly siteSlug: string; readonly articleSlug: string }): PortResult<SeoArticleState | null>;
  applyApproved(input: {
    readonly before: SeoArticleState;
    readonly after: PublishedArticle;
    readonly plan: AutoApplyPlan;
    readonly appliedCodes: readonly FindingCode[];
    readonly diffSummary: string;
    readonly approvedBy: string;
  }): PortResult<AutoApplyLogEntry>;
  revert(input: {
    readonly logId: string;
    readonly at: string;
    readonly revertedBy: string;
  }): PortResult<AutoApplyLogEntry>;
};

/** 自動反映の記録。**積む。取り消しても行を消さない。** */
export type SeoAutoApplyLogPort = {
  list(input: {
    readonly siteSlug?: string;
    readonly limit: number;
  }): PortResult<readonly AutoApplyLogEntry[]>;

  /** ある反映が最後だった時刻。冷却期間（NFR3）の判定に使う。 */
  lastAppliedAt(pageKey: PageKey): PortResult<string | null>;
};

export type SourceCollectionState = {
  readonly source: MeasurementSource;
  readonly lastCollectedAt: string | null;
  readonly lastFailureReason: string;
  readonly lastFailedAt: string | null;
};

/** 系統ごとの最後の収集時刻（NFR6）。 */
export type SeoSourceCollectionPort = {
  all(): PortResult<readonly SourceCollectionState[]>;
  recordSuccess(input: {
    readonly source: MeasurementSource;
    readonly collectedAt: string;
  }): PortResult<true>;
  recordFailure(input: {
    readonly source: MeasurementSource;
    readonly failedAt: string;
    readonly reason: string;
  }): PortResult<true>;
};

export type MeasurementSetting = {
  readonly introducedAt: string;
  readonly autoApplyPaused: boolean;
  readonly pausedAt: string | null;
  readonly resumedAt: string | null;
  readonly citationCheckLimit: number;
  /** 全ブログで共有する月あたりの web 検索回数。未設定なら費用が出る系統③を止める。 */
  readonly citationMonthlySearchLimit: number | null;
};

export type SeoMeasurementSettingPort = {
  /** 無ければ `introducedAt = now` で作って返す。導入時刻はここでしか決まらない。 */
  loadOrCreate(now: string): PortResult<MeasurementSetting>;
  setPaused(input: { readonly paused: boolean; readonly at: string }): PortResult<MeasurementSetting>;
  setCitationCheckLimit(limit: number): PortResult<MeasurementSetting>;
  setCitationMonthlySearchLimit(limit: number): PortResult<MeasurementSetting>;
};

/** 1 HTTP request が使える web 検索回数。月次予算の単位もこの検索回数で揃える。 */
export const CITATION_SEARCHES_PER_REQUEST = 3;
export const MAX_CITATION_MONTHLY_SEARCH_LIMIT = 100_000;

export type CitationMonthlyBudgetStatus = {
  readonly monthKey: string;
  readonly limitSearches: number | null;
  /** 提供元usageで確認できた実検索数。 */
  readonly usedSearches: number;
  /** 送信後にusageを確認できず、再利用しない検索枠。 */
  readonly unconfirmedSearches: number;
  readonly reservedSearches: number;
  readonly remainingSearches: number | null;
  readonly reached: boolean;
};

export type CitationSearchReservation = {
  readonly id: string;
  readonly monthKey: string;
  readonly siteSlug: string;
  readonly reservedSearches: number;
  readonly limitSearches: number;
};

export type SeoCitationBudgetPort = {
  current(input: {
    readonly at: string;
    readonly monthlyLimit: number | null;
  }): PortResult<CitationMonthlyBudgetStatus>;
  reserve(input: {
    readonly siteSlug: string;
    readonly at: string;
    readonly monthlyLimit: number;
    readonly siteMonthlyLimit: number;
    readonly requestedSearches: number;
  }): PortResult<{
    readonly reservation: CitationSearchReservation | null;
    readonly status: CitationMonthlyBudgetStatus;
    readonly unavailableReason: "monthly_exhausted" | "site_exhausted" | "concurrent" | "setting_changed" | null;
  }>;
  settle(input: {
    readonly reservation: CitationSearchReservation;
    readonly usedSearches: number;
    readonly unconfirmedSearches: number;
    readonly attempted: readonly {
      readonly siteSlug: string;
      readonly articleSlug: string;
      readonly pageKey: PageKey;
      readonly attemptedAt: string;
    }[];
    readonly at: string;
  }): PortResult<CitationMonthlyBudgetStatus>;
};

/** 公開済み記事を作業場所に束縛し、対象サイトで先に絞る。未観測→最古の順。 */
export type SeoMeasurementArticlePort = {
  list(input: {
    readonly siteSlug: string;
    readonly limit: number;
    readonly source: "static_audit" | "ai_citation";
  }): PortResult<readonly PublishedArticle[]>;
};

export type PageMetric = {
  readonly pageKey: PageKey;
  readonly metricDate: string;
  readonly impressions: number | null;
  readonly clicks: number | null;
  readonly position: number | null;
  readonly aiCitations: number | null;
};

/** ページごとの実績。**積む**（上書きするのは同じ日の同じページだけ）。 */
export type SeoPageMetricPort = {
  /** Search Console の観測値だけを更新し、AI の観測値は保持する。 */
  upsertMany(input: { readonly metrics: readonly PageMetric[]; readonly observedAt: string }): PortResult<number>;
  /** 日ごとの最新チェック。0=確認して引用なし、1=引用あり。未確認は行を作らない。 */
  upsertAiCitations(metrics: readonly Pick<PageMetric, "pageKey" | "metricDate" | "aiCitations">[]): PortResult<number>;
  recent(input: {
    readonly pageKey: PageKey;
    /** YYYY-MM-DD。両端を含む観測日で絞り、件数を日数の代わりにしない。 */
    readonly from: string;
    readonly to: string;
  }): PortResult<readonly PageMetric[]>;
};

export type SearchQueryMetric = {
  readonly siteSlug: string;
  readonly pageKey: PageKey;
  readonly metricDate: string;
  readonly query: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly position: number;
};

export type SearchQueryBreakdown = {
  /** 日付の新しい順、同日は表示回数順の明細。期間合計や検索語ランキングではない。 */
  readonly rows: readonly SearchQueryMetric[];
  /** 表示上限のため、同じ期間の確定明細がほかにもある。API公開上限とは別。 */
  readonly truncated: boolean;
  /** 指定期間の全日を新しい順に返す。明細ゼロの日も完了状態を残す。 */
  readonly dates: readonly {
    readonly metricDate: string;
    readonly active: boolean;
    /** 再開待ちも含む取得未完了。現在処理が動いていることは保証しない。 */
    readonly refreshing: boolean;
    /** 表示中の完了分の上限状態。旧記録で確認できない場合もnull。 */
    readonly activeMayBeLimited: boolean | null;
    readonly activeCompletedAt: string | null;
  }[];
};

export type SearchQuerySyncTarget = {
  readonly siteSlug: string;
  readonly metricDate: string;
  readonly runId: string;
  readonly startRow: number;
  readonly revision: number;
};

/** 検索語明細は日別 snapshot が完成したときだけ旧集合と入れ替える。 */
export type SeoSearchQueryMetricPort = {
  beginOrResume(input: {
    readonly siteSlug: string;
    readonly from: string;
    readonly to: string;
    readonly observedAt: string;
  }): PortResult<SearchQuerySyncTarget>;
  stagePage(input: {
    readonly target: SearchQuerySyncTarget;
    readonly rows: readonly SearchQueryMetric[];
    readonly nextStartRow: number;
    readonly complete: boolean;
    readonly mayBeLimited: boolean;
    readonly observedAt: string;
  }): PortResult<number>;
  recent(input: {
    readonly siteSlug: string;
    readonly pageKey: PageKey;
    readonly from: string;
    readonly to: string;
    /** 最新日から、同日は表示回数の多い検索語から返す。 */
    readonly limit: number;
  }): PortResult<SearchQueryBreakdown>;
};

/** 収集cronは表示用の読取実装を要求しない。 */
export type SeoSearchQueryCollectionPort = Pick<SeoSearchQueryMetricPort, "beginOrResume" | "stagePage">;
/** 画面は検索語の取得開始・保存を実行しない。 */
export type SeoSearchQueryReadPort = Pick<SeoSearchQueryMetricPort, "recent">;

// --------------------------------------------------------------------------
// 収集器（3 系統）
// --------------------------------------------------------------------------

/** 系統①: 自分のサイトの公開 HTML を読んで、観測した事実を返す。 */
export type StaticAuditCollectorPort = {
  observe(url: string): PortResult<PageObservation>;
  /** 404・空・内容ありを区別し、本文そのものは保持しない。 */
  observeLlmsTxt(url: string): PortResult<import("@/domain/seo/aeo-measurement").LlmsTxtObservation>;
};

export type SearchConsoleRow = {
  readonly url: string;
  readonly metricDate: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly position: number;
};

export type SearchConsoleQueryRow = SearchConsoleRow & {
  /** Google が返した表記をそのまま保持する。匿名化された検索語は API から返らない。 */
  readonly query: string;
};

export type SearchConsoleRows = {
  readonly rows: readonly SearchConsoleRow[];
  /** Google が公開する 50,000 行/日の上限に達した可能性。 */
  readonly mayBeLimited: boolean;
};

export type SearchConsoleQueryRows = {
  readonly rows: readonly SearchConsoleQueryRow[];
  /** API 応答の生行数。壊れた行も取得予算を消費するため、型変換後の rows と分ける。 */
  readonly rowsFetched: number;
  readonly startRow: number;
  readonly nextStartRow: number;
  /** 短いページまたは Google の公開上限まで到達した。 */
  readonly complete: boolean;
  readonly mayBeLimited: boolean;
};

/** 系統②: Search Console。**鍵は引数に現れない。** */
export type SearchConsoleClientPort = {
  /** 鍵が登録されているか。中身は返さない。 */
  configured(): boolean;
  fetchRows(input: {
    readonly siteUrl: string;
    readonly startDate: string;
    readonly endDate: string;
  }): PortResult<SearchConsoleRows>;
  /** 匿名 query を含まない、API が返した上位行の内訳。日別で続きから取れる。 */
  fetchQueryRows(input: {
    readonly siteUrl: string;
    readonly metricDate: string;
    readonly startRow: number;
    readonly rowBudget: number;
  }): PortResult<SearchConsoleQueryRows>;
};

export type CitationCheckResult = {
  readonly url: string;
  readonly cited: boolean;
  /** 引用として拾えた箇所。無ければ空。**保存する前に人が読むためのもの。** */
  readonly excerpt: string;
  readonly checkedAt: string;
};

export type CitationCheckAttempt =
  | { readonly ok: true; readonly value: CitationCheckResult; readonly searchesUsed: number }
  | { readonly ok: false; readonly error: DomainError; readonly searchesUsed: number | null };

/** 系統③: AI 検索で引用されているか。**鍵は引数に現れない。** */
export type AiCitationClientPort = {
  configured(): boolean;
  /**
   * 1 ページずつ問う。まとめて問う口を用意しないのは、
   * 上限（`citationCheckLimit`）を数える単位を 1 呼び出し 1 ページに
   * 固定するためである。まとめられると、上限が意味を失う。
   */
  check(input: {
    readonly url: string;
    readonly query: string;
    /** 月次予約で得たgrantだけを渡す。予約なしの有料通信を型で許さない。 */
    readonly maxSearches: number;
  }): Promise<CitationCheckAttempt>;
};
