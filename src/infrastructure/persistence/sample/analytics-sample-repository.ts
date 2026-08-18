import type {
  ClickTrackingPort,
  MetricDimensions,
  MetricsRepositoryPort,
  RedirectResolverPort,
  TrackingLinkIssuerPort,
} from "@/application/ports/analytics";
import type { MetricKey, MetricSample } from "@/domain/analytics";
import { ok } from "@/domain/shared";
import { registerStub, stubCall, stubReason } from "../../stub-registry";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * 本物の数字は、公開して読まれ始めてからでないと出ない。
 * ここでは「数え方が書いてあるか」「収益の数字を順位へ戻せないようにしてあるか」を
 * 画面で確かめられるところまでを用意している。
 *
 * **わざと一部の指標を空にしている。** すべて埋まった状態だけを置くと、
 * 「まだ計測できていません」がどう出るかを誰も確かめないまま公開してしまう。
 */
/**
 * 台帳の登録を 2 つに分けている。
 *
 * 数字の読み口は本物ができた（計測から導く）が、クリックの記録はまだ無い。
 * 1 件にまとめたままだと、控えに変えれば「クリックも済んだ」ことになり、
 * 未実装のままに変えれば「数字も未実装」になる。
 * **どちらに寄せても台帳が嘘になる**ので、分けて数える。
 */
const stub = registerStub({
  id: "persistence:analytics-sample",
  port: "指標の読み口",
  label: "数字（見本データ）",
  blockedBy: "済み（計測の記録から導く。d1/telemetry-repository.ts）",
  fallbackFor: "src/infrastructure/persistence/d1/telemetry-repository.ts",
});

/**
 * --- `click_events` という表は作らないことにした（記録を消さずに残す） ---
 *
 * この口の解除条件には、もともと「`click_events` テーブルと、リンクの計測
 * 識別子を発行する仕組み」と書いてあった。**その表は作らない。**
 * 画面から送るクリックはすでに `telemetry_events` の `affiliate_click` として
 * 入っており、専用の表を足すと**同じ「クリック数」が 2 つできる**。
 * 食い違ったときにどちらが正しいかを決める方法が無く、片方が正しいと
 * 決められない数字は、最終的に両方が信用されなくなる。
 *
 * 消さずに書いてあるのは、次に読んだ人が仕様（03 §1.2）から読み直して
 * 同じ表をもう一度作るのを防ぐためである。
 */
const clickStub = registerStub({
  id: "persistence:click-tracking-sample",
  port: "クリック計測",
  label: "クリックの記録（この実行では保存先が無い）",
  blockedBy:
    "済み（click_events 表はやめ、転送の入口 /go/ で押されたことを計測の記録へ入れる。d1/redirect-repository.ts）",
  fallbackFor: "src/infrastructure/persistence/d1/redirect-repository.ts",
});

export function sampleAnalyticsNotice(): string {
  return `${stub.label}で表示しています（${stubReason(stub)}）。`;
}

/** 見本の実測値。ここに無い指標は「未計測」として画面に出る。 */
const SAMPLE_VALUES: ReadonlyArray<readonly [MetricKey, number, number | null]> = [
  ["page_views", 12480, null],
  ["unique_readers", 8210, null],
  ["read_completion_rate", 0.42, 12480],
  // 0〜100 の % で持つ（計測が送ってくる形と揃える）。0.68 にすると
  // 本物につないだ瞬間に桁が変わり、見比べた人が壊れたと判断する。
  ["scroll_depth_p50", 68, 12480],
  ["time_on_page_seconds", 186, null],
  ["ai_answer_count", 340, null],
  ["ai_tool_success_rate", 0.91, 340],
  ["ai_answer_evidence_rate", 0.86, 340],
  ["webmcp_tool_invocations", 512, null],
  ["correction_count", 3, null],
  ["evidence_coverage_rate", 0.74, 128],
  ["review_overdue_count", 2, null],
  ["affiliate_click_count", 640, null],
  ["conversion_count", 18, null],
  ["revenue_amount", 42600, null],
  // 意図的に空けている指標:
  //   return_rate / ai_handoff_to_human_rate / stale_price_ratio /
  //   publish_gate_failure_rate / epc
  //   → 「未計測」の見え方と、母数の無い割合を出さないことを確かめる。
];

/**
 * 見本の内訳データ（§22.8 の 11 軸で絞り込むための元）。
 *
 * 1 行 = 「ある記事を、ある切り口で、ある先へ出した」1 件。
 * ここから足し合わせて数字を作る。
 *
 * **わざと軸ごとに粗さを変えている。**
 *   - 書き手 (author) は 2 人しか置いていない
 *   - CTA は 1 件だけ値が空（どこにも紐づかない投稿がある状態）
 * すべての軸がきれいに埋まった見本だけを置くと、
 * 「その軸では分けられません」の見え方を誰も確かめないまま公開してしまう。
 */
type SampleFact = {
  readonly siteId: string;
  readonly articleId: string;
  readonly productId: string;
  readonly authorId: string;
  readonly personaId: string;
  readonly channel: string;
  readonly angle: string;
  readonly cta: string | null;
  readonly merchant: string;
  readonly asp: string;
  readonly publishedAt: Date;
  readonly pageViews: number;
  readonly clicks: number;
  readonly conversions: number;
  readonly revenue: number;
};

const FACTS: readonly SampleFact[] = [
  {
    siteId: "site_makuring",
    articleId: "art_laptop_video",
    productId: "prd_macbook_air",
    authorId: "author_ai",
    personaId: "persona_beginner_editor",
    channel: "own_site",
    angle: "予算から選ぶ",
    cta: "価格を見る",
    merchant: "家電量販A",
    asp: "A8.net",
    publishedAt: new Date("2026-06-02T10:00:00Z"),
    pageViews: 7200,
    clicks: 380,
    conversions: 11,
    revenue: 26400,
  },
  {
    siteId: "site_makuring",
    articleId: "art_laptop_video",
    productId: "prd_macbook_air",
    authorId: "author_human",
    personaId: "persona_beginner_editor",
    channel: "x",
    angle: "予算から選ぶ",
    cta: "記事を読む",
    merchant: "家電量販A",
    asp: "A8.net",
    publishedAt: new Date("2026-06-02T12:00:00Z"),
    pageViews: 1450,
    clicks: 92,
    conversions: 2,
    revenue: 4800,
  },
  {
    siteId: "site_makuring",
    articleId: "art_editing_memory",
    productId: "prd_thinkpad_x1",
    authorId: "author_ai",
    personaId: "persona_pro_editor",
    channel: "own_site",
    angle: "作業時間から選ぶ",
    cta: "価格を見る",
    merchant: "通販B",
    asp: "もしもアフィリエイト",
    publishedAt: new Date("2026-07-14T09:00:00Z"),
    pageViews: 2630,
    clicks: 118,
    conversions: 4,
    revenue: 9200,
  },
  {
    // CTA を置いていない投稿。「この軸で分けられない件がある」を再現する。
    siteId: "site_gadget",
    articleId: "art_gadget_intro",
    productId: "prd_thinkpad_x1",
    authorId: "author_human",
    personaId: "persona_pro_editor",
    channel: "youtube",
    angle: "使ってみた",
    cta: null,
    merchant: "通販B",
    asp: "もしもアフィリエイト",
    publishedAt: new Date("2026-07-28T08:00:00Z"),
    pageViews: 1200,
    clicks: 50,
    conversions: 1,
    revenue: 2200,
  },
];

/** 絞り込んだときに分けて数えられる指標。内訳データに入っているものだけ。 */
const SPLITTABLE: readonly MetricKey[] = [
  "page_views",
  "affiliate_click_count",
  "conversion_count",
  "revenue_amount",
];

/** 軸ごとに、内訳データから値を取り出す方法。 */
const AXIS_VALUE: Readonly<Record<string, (f: SampleFact) => string | null>> = {
  product: (f) => f.productId,
  content: (f) => f.articleId,
  author: (f) => f.authorId,
  persona: (f) => f.personaId,
  channel: (f) => f.channel,
  angle: (f) => f.angle,
  cta: (f) => f.cta,
  merchant: (f) => f.merchant,
  asp: (f) => f.asp,
  site: (f) => f.siteId,
};

/** 絞り込みの指定を、内訳データの 1 行と突き合わせる。 */
function matches(fact: SampleFact, dimensions: Partial<MetricDimensions> | undefined): boolean {
  if (dimensions === undefined) return true;
  const pairs: readonly [string | null | undefined, string | null][] = [
    [dimensions.productId, fact.productId],
    [dimensions.articleId === undefined || dimensions.articleId === null
      ? dimensions.articleId
      : String(dimensions.articleId), fact.articleId],
    [dimensions.authorId, fact.authorId],
    [dimensions.personaId, fact.personaId],
    [dimensions.channel, fact.channel],
    [dimensions.angle, fact.angle],
    [dimensions.cta, fact.cta],
    [dimensions.merchant, fact.merchant],
    [dimensions.asp, fact.asp],
    [dimensions.siteId === undefined || dimensions.siteId === null
      ? dimensions.siteId
      : String(dimensions.siteId), fact.siteId],
  ];
  for (const [wanted, actual] of pairs) {
    // 未指定 (undefined / null) は「絞らない」。空文字も絞らない扱いにする。
    if (wanted === undefined || wanted === null || wanted === "") continue;
    if (wanted !== actual) return false;
  }
  if (dimensions.publishedAt != null && fact.publishedAt < dimensions.publishedAt) return false;
  return true;
}

/** 絞り込みが 1 つでも指定されているか。 */
function hasFilter(dimensions: Partial<MetricDimensions> | undefined): boolean {
  if (dimensions === undefined) return false;
  return Object.values(dimensions).some((v) => v !== undefined && v !== null && v !== "");
}

export function createSampleMetricsRepository(): MetricsRepositoryPort {
  return {
    async query(_workspaceId, input) {
      const wanted = new Set<MetricKey>(input.keys);

      // 絞り込みが無いときは、全体の見本値をそのまま返す。
      if (!hasFilter(input.dimensions)) {
        const samples: MetricSample[] = SAMPLE_VALUES.filter(([key]) => wanted.has(key)).map(
          ([key, value, denominator]) => ({
            key,
            value,
            from: input.from,
            to: input.to,
            denominator,
          }),
        );
        return ok(samples);
      }

      // 絞り込みがあるときは、内訳データから足し合わせる。
      // 分けて数えられない指標は**返さない**。
      // 全体の数字で埋めると「この商品の読了率」として全体の値が出る。
      const rows = FACTS.filter((f) => matches(f, input.dimensions));
      // 当てはまる行が 1 つも無いときは、**0 を返さず何も返さない**。
      // 0 と書くと「その条件では成果が出ていない」と読まれるが、
      // 実際には「その条件のデータが無い」であって意味が違う。
      if (rows.length === 0) return ok([]);
      const sum = (pick: (f: SampleFact) => number) => rows.reduce((a, f) => a + pick(f), 0);
      const built: Record<string, number> = {
        page_views: sum((f) => f.pageViews),
        affiliate_click_count: sum((f) => f.clicks),
        conversion_count: sum((f) => f.conversions),
        revenue_amount: sum((f) => f.revenue),
      };

      const samples: MetricSample[] = SPLITTABLE.filter((key) => wanted.has(key)).map((key) => ({
        key,
        value: built[key] ?? 0,
        from: input.from,
        to: input.to,
        denominator: null,
      }));
      return ok(samples);
    },

    async listAxisOptions(_workspaceId, axis) {
      const pick = AXIS_VALUE[axis];
      if (pick === undefined) {
        return ok({
          axis,
          values: null,
          unavailableReason:
            axis === "publishedAt"
              ? "投稿日時は一覧ではなく、開始日を選んで絞ります。"
              : "この切り口は、いまの見本データでは分けられません。",
        });
      }
      const seen = new Map<string, string>();
      for (const fact of FACTS) {
        const value = pick(fact);
        if (value === null) continue;
        if (!seen.has(value)) seen.set(value, value);
      }
      return ok({
        axis,
        values: [...seen].map(([value, label]) => ({ value, label })),
        unavailableReason: null,
      });
    },

    async listSplittableKeys() {
      return ok(SPLITTABLE);
    },

    // 記録はできない。できたふりをすると、集計が合わない原因が追えなくなる。
    record: () => stubCall(stub, "指標の記録"),
  };
}

/**
 * クリックの記録（保存先が無い実行での控え）。
 *
 * 本物は `d1/redirect-repository.ts` にある。保存先が結び付いていない実行
 * （`pnpm dev`・自動テスト）ではここへ回る。
 *
 * **成功したふりをしない。** 記録できたことにすると、
 * 「転送はできているのにクリック数が増えない」の原因が追えなくなる。
 */
export function createSampleClickTracking(): ClickTrackingPort {
  return {
    recordClick: () => stubCall(clickStub, "クリックの記録"),
  };
}

/**
 * 転送先の読み取り（保存先が無い実行での控え）。
 *
 * **`null`（＝知らない合言葉）を返さない。** 返すと、保存先が無いだけなのに
 * 「そんなリンクは無い」と読者に伝わり、リンクを消したのだと受け取られる。
 * 失敗として返し、入口の側で「いまは確認できない」と出し分ける。
 */
/**
 * 転送の写しの発行（保存先が無い実行での控え）。
 *
 * **成功を返さない。** 空の表を返して「発行できた」ことにすると、記事には
 * 合言葉が入らないのに公開だけ通り、順位表は ASP の URL を出し続ける。
 * 公開そのものは止めない（呼び出し側が失敗を飲み込む）が、
 * 何が起きたかはここで嘘をつかない。
 */
export function createSampleTrackingLinkIssuer(): TrackingLinkIssuerPort {
  return {
    issue: () => stubCall(clickStub, "転送の写しの発行"),
  };
}

export function createSampleRedirectResolver(): RedirectResolverPort {
  return {
    resolve: () => stubCall(clickStub, "転送先の読み取り"),
  };
}
