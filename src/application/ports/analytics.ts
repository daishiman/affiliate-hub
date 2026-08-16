import type { MetricKey, MetricSample } from "@/domain/analytics";
import type { ArticleId, SiteId, WorkspaceId } from "@/domain/shared";
import type { PortResult } from "./common";

/**
 * 指標の読み書き。
 *
 * 収益系の指標も同じポートで扱うが、
 * 編集判断へ戻せるかは domain/analytics/feedback-policy が決める。
 * ポート側で判断しない (判断はドメインの仕事)。
 */
export type MetricsRepositoryPort = {
  record(workspaceId: WorkspaceId, sample: MetricSample, dimensions: MetricDimensions): PortResult<true>;
  query(
    workspaceId: WorkspaceId,
    input: {
      keys: readonly MetricKey[];
      from: Date;
      to: Date;
      dimensions?: Partial<MetricDimensions>;
    },
  ): PortResult<readonly MetricSample[]>;
  /**
   * その軸で実際に絞り込める値の一覧。
   * 画面の選択肢をここから作る。画面側で候補を書き起こさない。
   */
  listAxisOptions(workspaceId: WorkspaceId, axis: string): PortResult<MetricAxisOptions>;
  /**
   * 絞り込んだときに、分けて数えられる指標。
   *
   * ここに無い指標は、絞り込むと出せない。
   * 出せないものを全体の数字で埋めると
   * 「この商品の読了率」として全体の読了率が出てしまう。
   * 絞り込みの有無で数字の意味が変わることを、呼び出し側が判断できるようにする。
   */
  listSplittableKeys(workspaceId: WorkspaceId): PortResult<readonly MetricKey[]>;
};

/**
 * 数字に添える切り口 (§22.8 の 11 軸)。
 *
 * 記録するときも絞り込むときも同じ形を使う。
 * 記録側と絞り込み側で持てる軸が違うと、
 * 画面に絞り込みの欄はあるのに中身が空、という状態になる。
 *
 * 軸の呼び名と意味は domain/analytics/dimensions.ts が正本。
 * ここは保存先が受け取る形だけを書く。
 */
export type MetricDimensions = {
  readonly siteId: SiteId | null;
  readonly articleId: ArticleId | null;
  readonly channel: string | null;
  readonly productId: string | null;
  readonly authorId: string | null;
  readonly personaId: string | null;
  readonly angle: string | null;
  readonly cta: string | null;
  readonly merchant: string | null;
  readonly asp: string | null;
  /** 記事を出した日時。期間で絞るために持つ。 */
  readonly publishedAt: Date | null;
};

/**
 * 絞り込みに使える値の一覧。
 *
 * **保存先がその軸を持っていないときは `null` を返す。**
 * 空配列を返すと「その軸には 1 件も無い」と読めてしまい、
 * 分けられないことに誰も気づかない。
 */
export type MetricAxisOptions = {
  readonly axis: string;
  readonly values: readonly { readonly value: string; readonly label: string }[] | null;
  /** 値を出せない理由。`values` が null のときは必ず入れる。 */
  readonly unavailableReason: string | null;
};

/**
 * クリック計測。
 *
 * アフィリエイト URL を書き換えずに測るため、
 * 計測識別子 (trackingRef) とクリックを別で記録する。
 */
export type ClickTrackingPort = {
  recordClick(input: {
    workspaceId: WorkspaceId;
    trackingRef: string;
    articleId: ArticleId | null;
    occurredAt: Date;
  }): PortResult<true>;
};
