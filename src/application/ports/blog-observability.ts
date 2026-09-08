import type {
  DailyMetrics,
  InteractionKind,
  ReaderSegment,
  ViewportBand,
} from "@/domain/analytics";
import type { Commercial, Editorial, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 読者行動の観測 (観測層) のポート。
 *
 * **表は 1 つ、読み口は 2 つ。**
 *
 * 日次集計は PV と売上を同じ 1 行に持つ (AD-2)。別表に分けると、画面ごとに
 * 突き合わせ方が変わり、同じ指標が画面ごとに別の値になるためである。
 * 一方で、報酬データを編集判断へ渡してはならない (§12.3)。
 *
 * この 2 つは矛盾しない。**行を分けずに、読み口を分ける**。
 * `BlogAudiencePort` は売上列を返さない Editorial の口、
 * `BlogRevenuePort` は売上を含む Commercial の口である。ランキングや
 * 記事評価は前者しか受け取れないので、売上で並べ替える実装が書けない。
 */

/** 集計の対象期間。両端を含む。 */
export type MetricsRange = {
  /** `YYYY-MM-DD`。 */
  readonly from: string;
  readonly to: string;
};

/** 売上を含まない日次の姿。編集判断へ渡してよい範囲。 */
export type AudienceDaily = Omit<DailyMetrics, "revenueMinor">;

/** 読者の内訳。個人ではなく集団を表す。 */
export type AudienceBreakdown = {
  readonly bySegment: Readonly<Record<ReaderSegment, number>>;
  readonly byViewport: Readonly<Record<ViewportBand, number>>;
};

/**
 * ページのどこに時間をかけ、どこを押しているか。
 *
 * 位置を比率で持つのは、画面幅の違う観測どうしを足せるようにするため。
 * `buckets` は 0..1 を等分した区間で、区間数は保存側が決める。
 */
export type EngagementProfile = {
  readonly buckets: readonly {
    /** 区間の下端 (0..1)。 */
    readonly from: number;
    readonly to: number;
    /** この区間に到達した割合 (0..1)。 */
    readonly reachRatio: number;
    readonly averageDwellSeconds: number;
  }[];
  /** 要素別のクリック率。`views` が 0 の日は 0 として畳む。 */
  readonly clickThroughByElement: Readonly<Record<string, number>>;
};

/** 観測イベントの受け口。公開面から呼ばれる。 */
export type ReaderInteractionIntakePort = {
  /**
   * まとめて受ける。1 件ずつ送らせないのは、読者の回線と端末の負担を
   * 抑えるためと、1 件の失敗で他が落ちないようにするためである。
   */
  record(
    workspaceId: WorkspaceId,
    events: readonly {
      /** producer が付けた再送を識別する鍵。保存時に作り直さない。 */
      readonly eventId: string;
      readonly siteSlug: string;
      readonly articleSlug: string | null;
      readonly kind: InteractionKind;
      readonly segment: ReaderSegment;
      readonly viewportBand: ViewportBand;
      readonly positionRatio: number;
      readonly dwellSeconds: number;
      readonly elementKey: string | null;
      readonly sessionKey: string;
      readonly occurredAt: Date;
    }[],
  ): PortResult<{ readonly accepted: number }>;
};

/**
 * 日次集計を作る側。
 *
 * 冪等であることを型では表せないので、契約として書いておく:
 * **同じ日を何度集計しても同じ結果になる**。足し込みではなく置き換え。
 */
export type MetricsRollupPort = {
  /**
   * 集計し直す対象の組を、生イベントの側から数え上げる。
   *
   * **定期実行に「どのブログがあるか」を知らせない**ための口である。
   * ブログ一覧から回すと、観測が 1 件も無いブログまで毎日 SQL を撃つ。
   * さらに、一覧を引くために公開面の組み立てを cron が引き込むことになる
   * （Worker の重さの話は `distribution-scheduler.ts` の doc）。
   * 観測がある組だけが対象で、それは生イベントの表が知っている。
   */
  pendingDays(
    days: readonly string[],
    limit: number,
  ): PortResult<
    readonly {
      readonly workspaceId: WorkspaceId;
      readonly siteSlug: string;
      readonly day: string;
    }[]
  >;

  /** 1 日ぶんを集計し直す。既存の行は置き換える。 */
  rollupDay(workspaceId: WorkspaceId, siteSlug: string, day: string): PortResult<true>;
  /**
   * 保持期限を過ぎた生イベントを捨てる。集計は残る。
   * 戻り値は捨てた件数で、0 件は正常 (まだ古い行が無い)。
   */
  purgeExpiredEvents(before: Date): PortResult<{ readonly deleted: number }>;
};

/**
 * 読者の見え方だけを返す口。**売上を返さない。**
 *
 * ランキング・記事評価・改善提案はこの口だけを受け取る。
 */
export type BlogAudiencePort = {
  siteDaily(
    workspaceId: WorkspaceId,
    siteSlug: string,
    range: MetricsRange,
  ): PortResult<readonly AudienceDaily[]>;
  articleDaily(
    workspaceId: WorkspaceId,
    siteSlug: string,
    articleSlug: string,
    range: MetricsRange,
  ): PortResult<readonly AudienceDaily[]>;
  breakdown(
    workspaceId: WorkspaceId,
    siteSlug: string,
    range: MetricsRange,
  ): PortResult<AudienceBreakdown>;
  /**
   * 記事 1 本の、どこまで読まれ・どこが押されたか。
   *
   * `viewportBand` を渡すと**その画面幅の読者だけ**で計算し直す。
   * 画面側で絞れないのは、到達率の分母がここで決まるためである。
   * 全体で引いた結果を後から間引くと、出る数は「狭い画面の到達率」
   * ではなく「全体の到達率のうち狭い画面ぶん」になり、別の意味の値になる。
   */
  engagement(
    workspaceId: WorkspaceId,
    siteSlug: string,
    articleSlug: string,
    range: MetricsRange,
    viewportBand?: ViewportBand,
  ): PortResult<EngagementProfile>;
};

/** 記事 1 本ぶんの、売上を含む集計。運営者の画面だけが読む。 */
export type ArticleRevenueSummary = {
  readonly articleSlug: string;
  readonly views: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly revenueMinor: number;
};

/**
 * 売上を含む口。**Commercial 印が付くので、ランキングへ渡すと
 * コンパイルが通らない。**
 */
export type BlogRevenuePort = {
  siteDaily(
    workspaceId: WorkspaceId,
    siteSlug: string,
    range: MetricsRange,
  ): PortResult<readonly DailyMetrics[]>;
  /**
   * 「どの記事がどれだけ稼いでいるか」の一覧。売上の多い順。
   *
   * 期間を必須にしているのは、全期間の合計だけを見ると、公開が古い
   * 記事が常に上位に来て、最近の動きが読めなくなるためである。
   */
  articleRanking(
    workspaceId: WorkspaceId,
    siteSlug: string,
    range: MetricsRange,
    limit: number,
  ): PortResult<readonly ArticleRevenueSummary[]>;
};

export type EditorialReaderInteractionIntakePort = Editorial<ReaderInteractionIntakePort>;
export type EditorialBlogAudiencePort = Editorial<BlogAudiencePort>;
export type CommercialBlogRevenuePort = Commercial<BlogRevenuePort>;
