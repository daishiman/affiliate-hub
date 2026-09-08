import { type DomainError, type Result, err, ok, validationError } from "../shared";

/**
 * 読者行動の観測 (観測層)。
 *
 * 「どのような読者が閲覧しているか、どこに時間をかけているか、
 * どこのクリック率が高いか」に答えるための生イベントと、その日次集計。
 *
 * 設計上の要 (architecture/arch-blog-operations-console.md):
 *   - 生イベントは**要素相対比率**で持ち、個人へ戻す列を持たない。
 *   - 日次ロールアップは冪等で、同じ日を何度集計しても同じ結果になる。
 *   - 生イベントが 90 日で消えた後も集計は残る。
 *
 * 単一読者の行動を再現できないのは制約ではなく、**構造でそう保証している**。
 * 個人識別子を置かないことを列の不在で担保しており、運用の約束に頼らない。
 */

/**
 * 観測する出来事の種類。
 *
 * `view` は表示、`scroll` は到達した深さ、`dwell` は滞在、`click` は押下、
 * `exit` は離脱。5 つに絞るのは、種類を増やすほど 1 読者あたりの
 * イベント数が増え、90 日の保持でも量が読めなくなるためである。
 */
export const INTERACTION_KINDS = ["view", "scroll", "dwell", "click", "exit"] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERACTION_KIND_LABEL: Readonly<Record<InteractionKind, string>> = {
  view: "表示",
  scroll: "読み進み",
  dwell: "滞在",
  click: "押下",
  exit: "離脱",
};

/**
 * 読者の来歴の大分類。個人ではなく**集団**を表す。
 *
 * 「どのような方々が閲覧しているか」に答えるのはこの粒度までで、
 * これ以上細かくすると、少数の読者が一意に定まりうる。
 */
export const READER_SEGMENTS = ["search", "social", "direct", "referral", "internal"] as const;
export type ReaderSegment = (typeof READER_SEGMENTS)[number];

export const READER_SEGMENT_LABEL: Readonly<Record<ReaderSegment, string>> = {
  search: "検索から",
  social: "SNS から",
  direct: "直接",
  referral: "他サイトから",
  internal: "サイト内から",
};

/** 画面の幅の帯。端末そのものではなく、見え方の違いだけを持つ。 */
export const VIEWPORT_BANDS = ["narrow", "medium", "wide"] as const;
export type ViewportBand = (typeof VIEWPORT_BANDS)[number];

export const VIEWPORT_BAND_LABEL: Readonly<Record<ViewportBand, string>> = {
  narrow: "狭い画面",
  medium: "中くらいの画面",
  wide: "広い画面",
};

/** 公開面から観測の受け口へ送る event ID の最大長。 */
export const MAX_EVENT_ID_LENGTH = 128;

/**
 * 公開面と受け口が共有する、1 件ぶんの wire 契約。
 *
 * ブログ名は束の envelope にだけ置く。各 event に重ねて持つと、2 つの値が
 * 食い違う状態を作れてしまう。省略可能な数値は event 種別ごとに意味がなく、
 * 受け口で保存形の 0 へ正規化する。
 */
export type ReaderInteractionWireEvent = {
  /** producer が event 作成時に一度だけ付け、同じ本文の再送でも変えない。 */
  readonly eventId: string;
  readonly kind: InteractionKind;
  readonly segment: ReaderSegment;
  readonly viewportBand: ViewportBand;
  readonly positionRatio?: number;
  readonly dwellSeconds?: number;
  readonly elementKey?: string;
  readonly sessionKey: string;
  readonly articleSlug?: string;
  readonly occurredAt: string;
};

/** 1 回の送信単位。ブログ名の信頼元はこの envelope だけ。 */
export type ReaderInteractionWireEnvelope = {
  readonly siteSlug: string;
  readonly events: readonly ReaderInteractionWireEvent[];
};

export type ReaderInteractionEvent = {
  readonly id: string;
  readonly siteSlug: string;
  /** 記事に紐づかないページ (トップ・一覧) は null。 */
  readonly articleSlug: string | null;
  readonly kind: InteractionKind;
  readonly segment: ReaderSegment;
  readonly viewportBand: ViewportBand;
  /**
   * ページ全体に対する位置の比率 (0..1)。
   * 画素で持たないのは、同じ記事でも画面幅で画素位置が変わり、
   * 別の画面幅どうしを足し合わせられなくなるためである。
   */
  readonly positionRatio: number;
  /** `dwell` の滞在秒。それ以外は 0。 */
  readonly dwellSeconds: number;
  /** `click` で押された要素の識別子 (`cta-main` など)。それ以外は null。 */
  readonly elementKey: string | null;
  readonly occurredAt: Date;
};

/** 生イベントの保持日数。これを過ぎた行は捨て、集計だけが残る。 */
export const RAW_EVENT_RETENTION_DAYS = 90;

/**
 * 1 件の滞在として認める上限の秒数。
 *
 * 読んでいる時間の上限ではなく、**読んでいないことを弾く**ための線である。
 * 開いたまま席を立った窓は滞在を無限に伸ばし、平均滞在秒を 1 件で
 * 押し上げる。1 時間読み続けている読者と、1 時間放置された窓は、
 * 送られてくる値では区別が付かない。区別が付かないものは数えない。
 */
export const MAX_DWELL_SECONDS = 3600;

/**
 * 端末が名乗る発生時刻を、サーバーの現在時刻に対してどこまで遡って許すか。
 *
 * **端末の時計は信用しない。** ここを無制限にすると、時計が数日ずれた
 * 端末の観測がずれた日の集計へ入り、しかも数字は出るので誰も気づけない。
 * 未来は 0 日（つまり一切許さない）、過去はこの日数まで許して、
 * 外れたものは受け取った時刻へ寄せる。捨てないのは、時計がずれた読者の
 * 観測だけが消えると、その端末を使う層がまるごと見えなくなるためである。
 */
export const MAX_EVENT_BACKDATE_DAYS = 2;

/**
 * 続きの単位 (`sessionKey`) の最大長。
 *
 * 長さに上限を置くのは保存先を守るためで、中身は見ない。ここは公開面から
 * そのまま届く値なので、**識別子として意味を読み取らない**。
 */
export const MAX_SESSION_KEY_LENGTH = 64;

/** 押された要素の識別子の最大長。 */
export const MAX_ELEMENT_KEY_LENGTH = 64;

/**
 * 比率が 0..1 に収まるかを検査する。
 *
 * 範囲外を黙って丸めないのは、丸めると「送信側が壊れている」ことに
 * 気づけないまま、ヒートマップの端に偽の山ができるためである。
 */
export function validateRatio(value: number, field: string): Result<number, DomainError> {
  if (!Number.isFinite(value)) {
    return err(validationError("比率が数値ではありません。", field));
  }
  if (value < 0 || value > 1) {
    return err(validationError("比率は 0 以上 1 以下で送ってください。", field));
  }
  return ok(value);
}

/**
 * 集計の対象日を `YYYY-MM-DD` に正規化する。
 *
 * 日次ロールアップの冪等性は「同じ日を指す鍵が 1 つに定まること」に
 * 依る。時刻を含んだまま鍵にすると、同じ日を 2 回集計したときに
 * 別の行ができて、PV が二重に数えられる。
 */
export function toRollupDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/** 集計を引く期間の上限（日数）。両端を含めて数える。 */
export const MAX_METRICS_RANGE_DAYS = 366;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 集計を**やり直してよい日**かを判定する。
 *
 * --- なぜ日次実行と別の判断が要るか ---
 *
 * 定期実行は対象の日を自分で決めない。生イベントの表を数え上げて
 * (`pendingDays`)、観測のある組だけを集計する。だから「観測が 1 件も無い日」を
 * 集計しに行くことがない。
 *
 * 手で日付を指定できる入口を作ると、その保証が消える。集計は足し込みではなく
 * **置き換え**なので、生イベントが保持期限 (`RAW_EVENT_RETENTION_DAYS`) を過ぎて
 * 消えた日をやり直すと、既にできている正しい集計が**ゼロで上書きされる**。
 * 集計は生イベントより長く残る、という約束がそこで破れる。
 *
 * 守りをここ（入口の判断）に置くのは、これが集計そのものの性質ではなく
 * **呼び方の制約**だからである。`rollupDay` 側に入れると、定期実行が
 * 絶対に踏まない条件を毎回検査することになる。
 *
 * 未来の日を弾くのは、まだ観測が届いていない日をゼロで固めないため。
 */
export function validateRollupTargetDay(
  day: string,
  at: Date,
): Result<string, DomainError> {
  if (!DAY_PATTERN.test(day)) {
    return err(validationError("対象日は YYYY-MM-DD の形で指定してください。", "day"));
  }
  const today = toRollupDay(at);
  if (day > today) {
    return err(
      validationError("まだ来ていない日は集計できません。", "day"),
    );
  }
  const oldest = toRollupDay(
    new Date(at.getTime() - RAW_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  );
  if (day < oldest) {
    return err(
      validationError(
        `${RAW_EVENT_RETENTION_DAYS} 日より前の日はやり直せません。元になる観測が既に消えているため、やり直すと今ある集計が 0 で上書きされます。`,
        "day",
      ),
    );
  }
  return ok(day);
}

/**
 * 集計期間の形を確かめる。
 *
 * 3 つ見ている: 日付の書き方、始まりと終わりの前後、期間の長さ。
 *
 * 長さに上限を置くのは表示のためではなく、**保存先を守るため**である。
 * 期間は画面から来る文字列がそのまま SQL の範囲になるので、
 * 上限が無いと `from=0001-01-01` の 1 回で全期間の行を走査させられる。
 * 上限を「1 年 + 1 日」にしてあるのは、前年同日との比較が
 * 1 回の問い合わせで足りるようにするためである。
 */
export function validateMetricsRange(
  from: string,
  to: string,
): Result<{ readonly from: string; readonly to: string }, DomainError> {
  if (!DAY_PATTERN.test(from)) {
    return err(validationError("開始日は YYYY-MM-DD の形で指定してください。", "from"));
  }
  if (!DAY_PATTERN.test(to)) {
    return err(validationError("終了日は YYYY-MM-DD の形で指定してください。", "to"));
  }
  // 文字列のまま比べられる形にしてある (ゼロ詰めの ISO 日付)。
  // Date へ起こすと、実行環境の時間帯で 1 日ずれる経路が増える。
  if (from > to) {
    return err(validationError("開始日が終了日より後になっています。", "from"));
  }
  const days = Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000,
  ) + 1;
  if (days > MAX_METRICS_RANGE_DAYS) {
    return err(
      validationError(
        `一度に見られるのは ${MAX_METRICS_RANGE_DAYS} 日ぶんまでです。期間を分けてください。`,
        "to",
      ),
    );
  }
  return ok({ from, to });
}

/**
 * 1 日ぶんの集計値。ブログ単位と記事単位で同じ形を使う。
 *
 * 売上をここに持つのは、「どの記事がどれだけ稼いでいるか」を
 * PV と同じ 1 行で見るためである。別表に分けると、画面ごとに
 * 突き合わせ方が違って、同じ指標が画面ごとに別の値になる (AD-2)。
 */
export type DailyMetrics = {
  readonly day: string;
  readonly views: number;
  readonly uniqueSessions: number;
  readonly clicks: number;
  readonly conversions: number;
  /** 最小通貨単位 (円) の整数。小数で持つと足し合わせで誤差が出る。 */
  readonly revenueMinor: number;
  readonly averageDwellSeconds: number;
  readonly averageScrollRatio: number;
  /**
   * この行を作った生イベントの件数。**平均や率の分母ではない。**
   *
   * 「この数字を根拠にしてよいか」を後から判定するために持つ。
   * `views` で代用できないのは、滞在も読み進みも表示以外の種類の
   * イベントから出ており、表示が少なくても滞在の標本は足りることが
   * あるためである。逆もある。
   */
  readonly sampleCount: number;
};

/**
 * 示唆を出してよい最小の観測件数。
 *
 * 30 は「割合の推定が使い物になり始める」目安として広く使われる値で、
 * ここでも厳密な検定の閾値としてではなく**足切り**として使う。
 * 5 件の観測から「この置き場所のクリック率が高い」と言うと、
 * 運営者は 1 人の読者の偶然を仕様だと思って版面を作り替えてしまう。
 */
export const MIN_EVIDENCE_SAMPLES = 30;

/** 示唆を出してよいかの判定と、出せないときに画面へ書く理由。 */
export type EvidenceVerdict = {
  readonly sufficient: boolean;
  readonly sampleCount: number;
  /** 足りているときは `null`。足りないときだけ理由が入る。 */
  readonly reason: string | null;
};

/**
 * 期間ぶんの行から、示唆を出してよいかを決める。
 *
 * 数字そのものは足りなくても出す。伏せるのは**解釈**の側だけである。
 * 数字ごと隠すと、運営者は「観測が動いていない」のか「まだ少ない」
 * のかを区別できず、計測の故障に気づけなくなる。
 */
export function evidenceVerdict(
  rows: readonly Pick<DailyMetrics, "sampleCount">[],
  minimum: number = MIN_EVIDENCE_SAMPLES,
): EvidenceVerdict {
  const sampleCount = rows.reduce((total, row) => total + row.sampleCount, 0);
  if (sampleCount >= minimum) return { sufficient: true, sampleCount, reason: null };
  return {
    sufficient: false,
    sampleCount,
    reason: `観測が ${sampleCount} 件しかありません（示唆を出すには ${minimum} 件が要ります）。`,
  };
}

/**
 * クリック率。表示が 0 のときは 0 を返す。
 *
 * 0 除算を `null` ではなく 0 にするのは、並べ替えのためである。
 * `null` を混ぜると、表の並べ替えで「まだ誰も見ていない記事」が
 * 最上位にも最下位にも来うる。
 */
export function clickThroughRate(metrics: Pick<DailyMetrics, "views" | "clicks">): number {
  return metrics.views === 0 ? 0 : metrics.clicks / metrics.views;
}

/** 1 表示あたりの売上。並べ替えの主軸として使う。 */
export function revenuePerView(
  metrics: Pick<DailyMetrics, "views" | "revenueMinor">,
): number {
  return metrics.views === 0 ? 0 : metrics.revenueMinor / metrics.views;
}

/**
 * 同じ日の集計行を 1 つに畳む。
 *
 * ロールアップの再実行は、既存行を**置き換える**のであって足さない。
 * 足す実装にすると、再集計のたびに PV が増える。この関数が
 * 「同じ日は 1 行」を型の上で示す。
 */
export function mergeDaily(
  rows: readonly DailyMetrics[],
): readonly DailyMetrics[] {
  const byDay = new Map<string, DailyMetrics>();
  for (const row of rows) byDay.set(row.day, row);
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}
