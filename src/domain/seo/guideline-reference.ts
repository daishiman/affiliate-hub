/**
 * SEO / AI 検索の指針への参照（feat-blog-ui-builder）。
 *
 * 指針は生きた文書で、黙って変わる。URL を貼るだけでは
 * 「いつの内容を根拠にしたか」が残らないので、確認日（checkedAt）を必ず持たせ、
 * 一定日数を過ぎたら見直しを促す。鮮度の考え方は記事の出典
 * （`PublishedEvidence.checkedAt`）と同じで、「確認していないことを隠さない」。
 */

/** 確認からこの日数を超えたら見直し。四半期に 1 回は原典を読み直す。 */
export const REVIEW_INTERVAL_DAYS = 90;

export type GuidelineRegion = "global" | "jp";

export type GuidelineReference = {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly region: GuidelineRegion;
  /** いつ内容を確認したか（YYYY-MM-DD）。 */
  readonly checkedAt: string;
  /** 補足。取得できていない・要約しか読めていない等の但し書きを残す。 */
  readonly note?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * YYYY-MM-DD 同士の日数差。
 *
 * `Date.parse` に任意の書式を読ませない。UTC の 0 時に固定して読み、
 * 端末の時差で 1 日ずれる余地を消す。
 */
function daysBetween(fromYmd: string, toYmd: string): number {
  const from = new Date(`${fromYmd}T00:00:00Z`).getTime();
  const to = new Date(`${toYmd}T00:00:00Z`).getTime();
  return Math.floor((to - from) / DAY_MS);
}

/**
 * 確認日からの経過で、指針が見直し時期かを判定する。
 *
 * 90 日ちょうどまでは fresh、**超えたら** review_due。
 * 日付が読めないときは review_due に倒す。「読めない確認日」は
 * 「確認できていない」と同じであり、fresh 扱いにすると壊れた日付ほど新鮮に見える。
 */
export function referenceReviewStatus(
  ref: Pick<GuidelineReference, "checkedAt">,
  today: string,
): "fresh" | "review_due" {
  const elapsed = daysBetween(ref.checkedAt, today);
  if (Number.isNaN(elapsed)) return "review_due";
  return elapsed > REVIEW_INTERVAL_DAYS ? "review_due" : "fresh";
}

/**
 * 最初に登録しておく指針 4 件。
 *
 * **本文の全文はまだ取得していない。** WebSearch で存在・発行元・要旨・鮮度は
 * 確認済みだが、原典の全文を読んだわけではない。その差を note に書いて残す
 * （書かないと、要旨確認だけの行が「全文確認済み」に見える）。
 */
const WEB_VERIFIED = "WebSearch で存在・発行元・要旨を確認 (2026-08-24)。本文全文は未取得";

export const INITIAL_GUIDELINE_REFERENCES: readonly GuidelineReference[] = [
  {
    id: "google-ai-optimization-guide",
    title: "Google 検索の AI 機能で成功するためのガイド（AI 最適化ガイド）",
    url: "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide",
    publisher: "Google Search Central",
    region: "global",
    checkedAt: "2026-08-24",
    note: `${WEB_VERIFIED}。2026-05-15 公開の正式ガイド。追加の技術要件は課さず、index 可能・snippet 表示可能が条件`,
  },
  {
    id: "google-ai-features",
    title: "AI features and your website（AI 機能とウェブサイト）",
    url: "https://developers.google.com/search/docs/appearance/ai-features",
    publisher: "Google Search Central",
    region: "global",
    checkedAt: "2026-08-24",
    note: `${WEB_VERIFIED}。AI Overviews / AI Mode に追加要件なし (通常の検索最適化と同じ)`,
  },
  {
    id: "llms-txt-proposal",
    title: "llms.txt の提案（/llms.txt）",
    url: "https://llmstxt.org/",
    publisher: "Answer.AI",
    region: "global",
    checkedAt: "2026-08-24",
    note: `${WEB_VERIFIED}。提案段階の標準 (llmstxt.org)。Google は llms.txt を使用しないと公式に明言 (AI 最適化ガイド)`,
  },
  {
    id: "indexnow-documentation",
    title: "IndexNow プロトコルの文書",
    url: "https://www.indexnow.org/documentation",
    publisher: "IndexNow (indexnow.org)",
    region: "global",
    checkedAt: "2026-08-24",
    note: `${WEB_VERIFIED}。Bing/Yandex/Naver が参加、Google 非対応。鍵ファイルのホスト配信で所有権を検証`,
  },
];
