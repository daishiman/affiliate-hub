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

/**
 * その出典を「どこまで確かめたか」。
 *
 * 確認日（`checkedAt`）だけでは、**要旨を読んだ**のと**原典の本文を取得した**のが
 * 区別できない。区別が無いと、要旨しか読んでいない行が原典確認済みの行と
 * 同じ見た目で並び、日付が新しいほど確かに見えるという逆さまが起きる。
 * 但し書き（`note`）に書いても、それは人が読む文であって機械は判定に使えない。
 */
export type GuidelineVerification =
  /** 要旨・存在・発行元までは確かめたが、原典の本文は取得していない。 */
  | { readonly kind: "summary_only" }
  /** 原典の本文を取得し、その時刻と本文の指紋を控えた。 */
  | {
      readonly kind: "source_fetched";
      /** 本文を取得した時刻（ISO 8601）。確認日より細かい粒度で残す。 */
      readonly fetchedAt: string;
      /** 取得した本文の sha256（16 進 64 文字）。次回取得との差分検出に使う。 */
      readonly contentSha256: string;
      /**
       * 1 つ前の取得で得た指紋。初回取得では入らない。
       *
       * 「前回」を出典の外（別の表）に置かない。指針の変化に気づけるかどうかは
       * この 2 つの指紋が並んでいるかだけで決まり、離すと片方だけ消える。
       */
      readonly previousSha256?: string;
      /**
       * この指紋の本文について、仕様章の再評価を完了したことを示す正本。
       *
       * 取得を繰り返した事実とは分ける。再取得だけでここを動かすと、本文が変わった
       * 警告を確認しないまま消せてしまう。初回取得だけは比較対象が無いため、取得した
       * 指紋を基準値として保存する。
       */
      readonly reEvaluatedSha256?: string;
      /** 再評価完了を記録した時刻（ISO 8601）。初回取得の基準値にも取得時刻を使う。 */
      readonly reEvaluatedAt?: string;
    };

export type GuidelineReference = {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly publisher: string;
  readonly region: GuidelineRegion;
  /** いつ内容を確認したか（YYYY-MM-DD）。 */
  readonly checkedAt: string;
  /** どこまで確かめたか。既定は「要旨まで」で、原典取得は明示的な操作でしか立たない。 */
  readonly verification: GuidelineVerification;
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
 * 出典の状態。
 *
 * - `verified_fresh`: 原典の本文を取得済みで、確認日も 90 日以内
 * - `review_due`: 確認日から 90 日超（原典取得の有無によらず読み直す）
 * - `unverified`: 原典の本文をまだ取得していない
 */
export type ReferenceReviewStatus = "verified_fresh" | "review_due" | "unverified";

/**
 * 確認日と検証の深さから、指針の状態を判定する。
 *
 * 90 日ちょうどまでは期限内、**超えたら** review_due。
 * 日付が読めないときは review_due に倒す。「読めない確認日」は
 * 「確認できていない」と同じであり、期限内扱いにすると壊れた日付ほど新鮮に見える。
 *
 * 期限内でも、原典の本文を取得していなければ `verified_fresh` は名乗らせない。
 * 「新しい」と「確かめた」は別のことで、混ぜると要旨だけの行が最も確かに見える。
 */
export function referenceReviewStatus(
  ref: Pick<GuidelineReference, "checkedAt" | "verification">,
  today: string,
): ReferenceReviewStatus {
  const elapsed = daysBetween(ref.checkedAt, today);
  if (Number.isNaN(elapsed) || elapsed > REVIEW_INTERVAL_DAYS) return "review_due";
  return ref.verification.kind === "source_fetched" ? "verified_fresh" : "unverified";
}

/** 仕様の再評価（R4 reopen）を促す理由。 */
export type SpecReopenReason = "unverified" | "review_due" | "content_changed";

type SpecReopenRequestBase = {
  readonly referenceId: string;
  readonly url: string;
  /** その出典を根拠にしている仕様章。空なら仕様には効いていない。 */
  readonly chapters: readonly string[];
};

export type SpecReopenRequest =
  | (SpecReopenRequestBase & {
      readonly reason: "content_changed";
      /** 画面で確認した本文版だけを再評価完了にするための指紋。 */
      readonly contentSha256: string;
    })
  | (SpecReopenRequestBase & { readonly reason: Exclude<SpecReopenReason, "content_changed"> });

/**
 * どの指針がどの仕様章の根拠になっているか。
 *
 * URL で引くのは、登録時に id を採番し直すため（初期候補の id は保存先には残らない）。
 * ここに無い出典は、登録されていても仕様の根拠ではないので再評価を起こさない。
 */
export const SPEC_CHAPTERS_BY_GUIDELINE: Readonly<Record<string, readonly string[]>> = {
  "https://developers.google.com/search/docs/fundamentals/ai-optimization-guide": ["ui-ux", "frontend"],
  "https://developers.google.com/search/docs/appearance/ai-features": ["ui-ux"],
  "https://llmstxt.org/": ["frontend"],
  "https://www.indexnow.org/documentation": ["backend"],
};

/**
 * 仕様の再評価が要る出典を挙げる。
 *
 * 閉ループの「戻り」の側。指針が古くなった／原典をまだ取っていない／本文が
 * 前回と変わった、のいずれかなら、その指針を根拠にした仕様章は
 * もう一度評価し直す必要がある。判定はここ 1 か所で、画面も監査も同じ答えを見る。
 *
 * 比較可能な前回指紋があり、今回の指紋が最後に仕様を再評価した指紋と違えば
 * `content_changed`。再取得ではなく再評価完了の記録を基準にするため、同じ本文を
 * 取り込み直しても、未確認の警告は消えない。
 */
export function specReopenRequests(
  references: readonly GuidelineReference[],
  today: string,
): readonly SpecReopenRequest[] {
  const requests: SpecReopenRequest[] = [];
  for (const ref of references) {
    const chapters = SPEC_CHAPTERS_BY_GUIDELINE[ref.url];
    if (chapters === undefined) continue;

    const status = referenceReviewStatus(ref, today);
    // 本文が変わったことを先に言う。古いだけより、変わったほうが仕様への効きが強い。
    if (
      ref.verification.kind === "source_fetched" &&
      ref.verification.previousSha256 !== undefined &&
      ref.verification.contentSha256 !== ref.verification.reEvaluatedSha256
    ) {
      requests.push({
        referenceId: ref.id,
        url: ref.url,
        reason: "content_changed",
        chapters,
        contentSha256: ref.verification.contentSha256,
      });
      continue;
    }

    const reason: Exclude<SpecReopenReason, "content_changed"> | null =
      status === "review_due" ? "review_due" : status === "unverified" ? "unverified" : null;
    if (reason === null) continue;
    requests.push({ referenceId: ref.id, url: ref.url, reason, chapters });
  }
  return requests;
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
    // 要旨までしか確かめていないことを、但し書きではなく型で持つ。
    verification: { kind: "summary_only" },
    note: `${WEB_VERIFIED}。2026-05-15 公開の正式ガイド。追加の技術要件は課さず、index 可能・snippet 表示可能が条件`,
  },
  {
    id: "google-ai-features",
    title: "AI features and your website（AI 機能とウェブサイト）",
    url: "https://developers.google.com/search/docs/appearance/ai-features",
    publisher: "Google Search Central",
    region: "global",
    checkedAt: "2026-08-24",
    // 要旨までしか確かめていないことを、但し書きではなく型で持つ。
    verification: { kind: "summary_only" },
    note: `${WEB_VERIFIED}。AI Overviews / AI Mode に追加要件なし (通常の検索最適化と同じ)`,
  },
  {
    id: "llms-txt-proposal",
    title: "llms.txt の提案（/llms.txt）",
    url: "https://llmstxt.org/",
    publisher: "Answer.AI",
    region: "global",
    checkedAt: "2026-08-24",
    // 要旨までしか確かめていないことを、但し書きではなく型で持つ。
    verification: { kind: "summary_only" },
    note: `${WEB_VERIFIED}。提案段階の標準 (llmstxt.org)。Google は llms.txt を使用しないと公式に明言 (AI 最適化ガイド)`,
  },
  {
    id: "indexnow-documentation",
    title: "IndexNow プロトコルの文書",
    url: "https://www.indexnow.org/documentation",
    publisher: "IndexNow (indexnow.org)",
    region: "global",
    checkedAt: "2026-08-24",
    // 要旨までしか確かめていないことを、但し書きではなく型で持つ。
    verification: { kind: "summary_only" },
    note: `${WEB_VERIFIED}。Bing/Yandex/Naver が参加、Google 非対応。鍵ファイルのホスト配信で所有権を検証`,
  },
];
