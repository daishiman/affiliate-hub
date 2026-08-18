import type { OutboundLink, TrackingCoverage } from "@/application/read-models/article-tracking";
import type { MetricKey, MetricSample } from "@/domain/analytics";
import type { RedirectResolution } from "@/domain/monetization";
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
 * 転送（`/go/<合言葉>`）のときに読む写し。
 *
 * 読むだけの口である。写しを作るのは公開の側で、ここからは書けない。
 * 書ける口をここに置くと、転送の経路から転送先を差し替えられることになる。
 *
 * 知らない合言葉は**失敗ではなく `null`**。転送経路にとって
 * 「知らない合言葉が来る」は普通のことで（古いリンク・打ち間違い）、
 * 失敗にすると保存先の障害と見分けが付かなくなる。
 */
export type RedirectResolverPort = {
  resolve(code: string): PortResult<RedirectResolution | null>;
};

/**
 * 転送の写しを**作る**口。
 *
 * --- なぜ [[RedirectResolverPort]] に書き口を足さないのか ---
 * 読む口は転送の経路（`/go/<合言葉>`）が持っている。そこに書き口を足すと、
 * 読者からの要求で転送先を差し替えられる経路が型の上で作れてしまう。
 * 別の口にしておけば、公開の側だけがこれを受け取る。
 *
 * --- 同じリンクに合言葉を 2 つ作らない ---
 * 同じ記事の同じ位置・同じ転送先なら、すでにある合言葉をそのまま返す。
 * 作り直すと、クリックが 2 系統に割れて**どちらも実数より少なく**出る。
 * 転送先が変わったときだけ新しく発行し、古い写しは停止にする
 * （仕様 §1.1「転送先原本は不変とする。差し替え時は新規発行する」）。
 */
export type TrackingLinkIssuerPort = {
  /**
   * 記事に載る外向きリンクぶんの写しを作り、位置の鍵 → 合言葉を返す。
   *
   * `workspaceId` は**そのブログを持っている側**のものを渡す。読者の身元
   * （所属なし）を渡すと、記録は貯まるのに管理画面が 0 のままになる
   * （残課題 25 / 56。画面は正常に見えるので、いちばん切り分けにくい）。
   *
   * 発行できなかったリンク（`https` でない転送先など）は、返す表に入れない。
   * 空文字を入れて「発行済みに見える」状態にしない。
   */
  issue(
    workspaceId: WorkspaceId,
    links: readonly OutboundLink[],
  ): PortResult<ReadonlyMap<string, string>>;
};

/**
 * 突合できるようになっている割合を読む口。
 *
 * **合言葉が発行されていないリンクが順位表に出ていることを、画面から見えるようにする。**
 * 出していないと、ASP の URL が黙って出るだけで、クリックが 1 件も
 * 記録されていないことに誰も気づけない。
 */
export type TrackingCoveragePort = {
  summarize(workspaceId: WorkspaceId): PortResult<TrackingCoverage>;
};

/**
 * クリック計測。
 *
 * **アフィリエイト URL を書き換えずに測る。** URL に印を足す代わりに、
 * こちら側に入口（`/go/<合言葉>`）を置き、押されたことはこちらで数える。
 *
 * --- 記録先を専用の表にしない ---
 * ここで記録したクリックは `telemetry_events` の `affiliate_click` になる。
 * 画面から送るクリックがすでに同じ表へ入っているので、
 * 専用の表を足すと**同じ「クリック数」が 2 つでき、
 * 食い違ったときにどちらが正しいか決められない**
 * （残課題 25「事実だけを貯め、指標は毎回導く」）。
 *
 * --- 二重に数えない ---
 * 同じクリックを画面側とここの両方で数えないよう、
 * 転送の入口を通るリンクは画面側で数えない（`AffiliateLink` 部品が判断する）。
 * どちらで数えたかは記録に残す（`recordedVia`）ので、
 * 後から突き合わせて欠測の量を測れる。
 */
export type ClickTrackingPort = {
  /**
   * 押されたことを記録する。
   *
   * 引数に取るのは**解決済みの写しそのもの**である。合言葉だけを渡す形にすると、
   * 転送のために 1 回引いた表を記録のためにもう 1 回引くことになり、
   * その間に写しが変わると転送先と記録が食い違う。
   */
  recordClick(input: {
    resolution: RedirectResolution;
    occurredAt: Date;
  }): PortResult<true>;
};
