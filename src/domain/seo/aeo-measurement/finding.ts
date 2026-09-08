/**
 * 所見 —— 「このページのここが規則に合っていない」1 件（受入 A2・A5）。
 *
 * ==========================================================================
 * 所見と改善案を分けない
 * ==========================================================================
 *
 * 「見つけたこと」と「どうすればよいか」を別の型にすると、片方だけある行が
 * 作れてしまう。直し方の分からない指摘は運営者を困らせるだけだし、
 * 指摘の無い直し方は根拠が無い。**1 件の所見は、必ず直し方を連れている。**
 *
 * だから所見は `code` を持ち、直し方（`hint`）と重さ（`severity`）と
 * 「機械が直せるか」（`autoFixable`）は `FINDING_RULE` の表が持つ。
 * 所見の行そのものには文言を持たせない —— 持たせると、規則の文言を直した日に
 * 過去の行だけ古い言い方のまま残る。
 */

import type { MeasurementSource } from "./measurement-source";
import type { PageKey } from "./page-key";

export const FINDING_CODES = [
  // --- 系統①（静的解析）が見るもの ---
  "missing_title",
  "title_too_short",
  "title_too_long",
  "missing_meta_description",
  "meta_description_too_short",
  "meta_description_too_long",
  "missing_canonical",
  "canonical_not_self",
  "missing_og_image",
  "missing_open_graph",
  "open_graph_mismatch",
  "missing_json_ld",
  "incomplete_structured_data",
  "structured_data_date_not_visible",
  "missing_h1",
  "multiple_h1",
  "heading_level_skipped",
  "missing_image_alt",
  "missing_image_dimensions",
  "no_internal_links",
  "duplicate_title",
  "duplicate_meta_description",
  "orphan_page",
  "canonical_target_unreachable",
  "missing_llms_txt",
  "unexpected_llms_txt",
  // --- 系統②（Search Console）が見るもの ---
  "high_impressions_low_ctr",
  "position_declined",
  // --- 系統③（AI 検索の被引用）が見るもの ---
  "not_cited_by_ai_search",
] as const;

export type FindingCode = (typeof FINDING_CODES)[number];

export type FindingSeverity = "high" | "medium" | "low";

/**
 * その所見が**どこを直せば消えるか**。
 *
 * ==========================================================================
 * 「値を決められる」と「直せる」は別の話である
 * ==========================================================================
 *
 * `missing_canonical` は、正しい値が 1 つに決まる（記事の正規 URL）。
 * だから `autoFixable` は true である。しかし canonical を出しているのは
 * **画面のテンプレート**で、記事の中身（`PublishedArticle`）ではない。
 * 記事 JSON をいくら書き換えても canonical は出ない。
 *
 * この 2 つを 1 つの真偽値に畳むと、自動反映は
 * 「直したことにして記録を残す → 次の収集でまた同じ所見が出る →
 * また直したことにする」を繰り返す。**反映ログだけが積み上がり、
 * ページは 1 文字も変わらない。** 取り消しの一覧が、何も起きていない
 * 記録で埋まる。
 *
 * - `article`: 記事の中身を書き換えれば消える。自動反映の対象。
 * - `template`: 画面の作りを直さないと消えない。運営者へ見せて終わる。
 *   （直すのは開発で、この仕組みの仕事ではない）
 */
export type FindingFixTarget = "article" | "template";

export type FindingRule = {
  readonly label: string;
  readonly severity: FindingSeverity;
  /** 何をすればよいか。落ちた理由を人に調べさせない。 */
  readonly hint: string;
  /**
   * 機械が**正しい値を決められる**か。
   *
   * ここが true なのは「直した結果が 1 つに決まる」ものだけである。
   * 題名が長すぎる（`title_too_long`）は false —— どこを削るかは
   * 何を伝えたいかの話で、機械には決められない。切り詰めた題名は
   * 規則には合うが、読者に伝わらなくなる。**規則に合わせるために
   * 記事を悪くする自動反映は、直していない。**
   *
   * `autoFixable` が false の所見は、運営者に見せて終わる（A6 後段）。
   */
  readonly autoFixable: boolean;
  /** 直す場所。`autoFixable` と両方が揃ったときだけ自動反映が働く。 */
  readonly fixTarget: FindingFixTarget;
};

export const FINDING_RULE: Record<FindingCode, FindingRule> = {
  missing_title: {
    label: "題名が無い",
    severity: "high",
    hint: "記事の題名（title）を入れる。検索結果の見出しになる唯一の文。",
    autoFixable: true,
    fixTarget: "article"
  },
  title_too_short: {
    label: "題名が短すぎる",
    severity: "low",
    hint: "題名を10字以上にして、何について答えるページかを具体的に伝える。",
    autoFixable: false,
    fixTarget: "article"
  },
  title_too_long: {
    label: "題名が長すぎる",
    severity: "low",
    hint: "題名を 60 字までに収める。長い分は検索結果で切られて読まれない。",
    autoFixable: false,
    fixTarget: "article"
  },
  missing_meta_description: {
    label: "説明文が無い",
    severity: "medium",
    hint: "記事の要約（summary）を入れる。検索結果の 2 行目になる。",
    autoFixable: true,
    fixTarget: "article"
  },
  meta_description_too_short: {
    label: "説明文が短すぎる",
    severity: "low",
    hint: "要約を 50 字以上にする。短すぎると何の記事か伝わらない。",
    autoFixable: false,
    fixTarget: "article"
  },
  meta_description_too_long: {
    label: "説明文が長すぎる",
    severity: "low",
    hint: "要約を 160 字までに収める。長い分は検索結果で切られる。",
    autoFixable: false,
    fixTarget: "article"
  },
  missing_canonical: {
    label: "正規 URL の宣言が無い",
    severity: "medium",
    hint: "canonical を出す。同じ記事が複数の URL で読めるとき、どれが本物かを検索エンジンへ伝える。",
    autoFixable: true,
    fixTarget: "template"
  },
  canonical_not_self: {
    label: "正規URLが別のページを指している",
    severity: "high",
    hint: "canonical を、そのページ自身の公開URLへ合わせる。",
    autoFixable: false,
    fixTarget: "template"
  },
  missing_og_image: {
    label: "共有時の画像が無い",
    severity: "medium",
    hint: "og:image を出す。SNS に貼られたとき絵が出ないと、押される率が落ちる。",
    autoFixable: true,
    // 記事側の画像が無くても `resolveThumbnail` が代替図版へ落とすので、
    // ここが欠けるのは画面が og:image を出していないときだけである。
    fixTarget: "template"
  },
  missing_open_graph: {
    label: "共有用の基本情報が足りない",
    severity: "medium",
    hint: "og:title・og:description・og:type・og:url を公開ページの値と同じにする。画像は実在する場合だけ出す。",
    autoFixable: false,
    fixTarget: "template"
  },
  open_graph_mismatch: {
    label: "共有用の情報が画面と一致しない",
    severity: "medium",
    hint: "OGPの題名・説明・URLを、公開画面と同じ正本から生成する。",
    autoFixable: false,
    fixTarget: "template"
  },
  missing_json_ld: {
    label: "構造化データが無い",
    severity: "high",
    hint: "JSON-LD を出す。AI 検索がこの記事を「誰がいつ何について書いたか」として読む唯一の形。",
    autoFixable: true,
    fixTarget: "template"
  },
  incomplete_structured_data: {
    label: "構造化データの必須項目が足りない",
    severity: "high",
    hint: "公開画面が生成する型の必須項目を、画面と同じ正本から出す。",
    autoFixable: false,
    fixTarget: "template"
  },
  structured_data_date_not_visible: {
    label: "構造化データの日付が画面に見えない",
    severity: "medium",
    hint: "datePublished/dateModified と同じ日付を time[datetime] で読者にも表示する。",
    autoFixable: false,
    fixTarget: "template"
  },
  missing_h1: {
    label: "見出し（h1）が無い",
    severity: "high",
    hint: "ページの主題を h1 に置く。読み上げも検索も、まずここを見る。",
    autoFixable: true,
    fixTarget: "template"
  },
  multiple_h1: {
    label: "見出し（h1）が 2 つ以上ある",
    severity: "medium",
    hint: "h1 は 1 ページに 1 つにする。2 つあると、どちらが主題か機械が決められない。",
    autoFixable: false,
    fixTarget: "template"
  },
  heading_level_skipped: {
    label: "見出しの段が飛んでいる",
    severity: "low",
    hint: "h2 の次に h4 を置かない。飛ばすと読み上げの目次で階層が崩れる。",
    autoFixable: false,
    fixTarget: "template"
  },
  missing_image_alt: {
    label: "画像に説明文が無い",
    severity: "medium",
    hint: "img に alt を入れる。目で見ない読者にはこれが画像そのもの。",
    autoFixable: false,
    fixTarget: "article"
  },
  missing_image_dimensions: {
    label: "画像に寸法が無い",
    severity: "low",
    hint: "img に width と height を入れる。無いと読み込み中に本文が飛び跳ねる。",
    autoFixable: true,
    fixTarget: "template"
  },
  no_internal_links: {
    label: "同じブログへの行き先が無い",
    severity: "medium",
    hint: "関連する記事へのリンクを置く。行き止まりのページは読者も巡回も次へ進めない。",
    autoFixable: false,
    fixTarget: "article"
  },
  duplicate_title: {
    label: "別ページと同じ題名を使っている",
    severity: "medium",
    hint: "ページごとの答えが分かる固有の題名にする。",
    autoFixable: false,
    fixTarget: "article"
  },
  duplicate_meta_description: {
    label: "別ページと同じ説明文を使っている",
    severity: "low",
    hint: "そのページで分かることを固有の説明文にする。",
    autoFixable: false,
    fixTarget: "article"
  },
  orphan_page: {
    label: "同じブログから辿れない",
    severity: "high",
    hint: "一覧、パンくず、関連記事などからこのページへ届くリンクを置く。",
    autoFixable: false,
    fixTarget: "template"
  },
  canonical_target_unreachable: {
    label: "正規URLの行き先が公開集合にない",
    severity: "high",
    hint: "canonical を公開中のページへ向けるか、対象ページを公開する。",
    autoFixable: false,
    fixTarget: "template"
  },
  missing_llms_txt: {
    label: "AI向け案内ファイルが見つからない",
    severity: "medium",
    hint: "設計図で配信を有効にしたブログでは /llms.txt を内容入りで返す。",
    autoFixable: false,
    fixTarget: "template"
  },
  unexpected_llms_txt: {
    label: "無効なAI向け案内ファイルが公開されている",
    severity: "low",
    hint: "設計図で配信を無効にしたブログでは /llms.txt を 404 にする。",
    autoFixable: false,
    fixTarget: "template"
  },
  high_impressions_low_ctr: {
    label: "検索結果に出ているのに押されていない",
    severity: "medium",
    hint: "題名と要約を見直す。出てはいるので、順位ではなく見出しの問題である。",
    autoFixable: false,
    fixTarget: "article"
  },
  position_declined: {
    label: "掲載順位が下がっている",
    severity: "low",
    hint: "内容の鮮度と根拠を見直す。順位は下がった理由を教えてくれないので、まず更新日と出典を確かめる。",
    autoFixable: false,
    fixTarget: "article"
  },
  not_cited_by_ai_search: {
    label: "AI 検索に引用されていない",
    severity: "low",
    hint: "結論を冒頭に置き、要点・出典・更新日を出す。AI は答えの根拠にできる形の記事を引く。",
    autoFixable: false,
    fixTarget: "article"
  },
};

/**
 * 所見 1 件。
 *
 * `detail` は**そのページで実際に観測した値**を人の言葉で書く欄で、
 * 規則の説明（`hint`）とは別。「無い」と言われたときに
 * 「何が無いのか」がここに出る。
 */
export type Finding = {
  readonly source: MeasurementSource;
  readonly pageKey: PageKey;
  readonly code: FindingCode;
  readonly detail: string;
  /** 観測した時刻（ISO 8601）。所見の鮮度はここでしか分からない。 */
  readonly observedAt: string;
};

export function isFindingCode(value: string): value is FindingCode {
  return (FINDING_CODES as readonly string[]).includes(value);
}

export function severityOf(finding: Finding): FindingSeverity {
  return FINDING_RULE[finding.code].severity;
}

/**
 * この所見は、記事を書き換えれば消えるか。
 *
 * 自動反映が根拠にしてよいのはこれが true の所見だけである。
 * `autoFixable` だけを見ると、テンプレートの欠陥（canonical・JSON-LD・h1）を
 * 「記事を直して解決した」ことにしてしまう。
 */
export function isArticleAutoFixable(code: FindingCode): boolean {
  const rule = FINDING_RULE[code];
  return rule.autoFixable && rule.fixTarget === "article";
}

const SEVERITY_ORDER: Record<FindingSeverity, number> = { high: 0, medium: 1, low: 2 };

/**
 * 重い順に並べる。同じ重さなら新しい順。
 *
 * 並べ替えを画面側に置かないのは、所見の一覧が複数の画面に出るためで、
 * 画面ごとに違う順で並ぶと「さっき上にあった件が無い」に見える。
 */
export function byUrgency(a: Finding, b: Finding): number {
  const bySeverity = SEVERITY_ORDER[severityOf(a)] - SEVERITY_ORDER[severityOf(b)];
  if (bySeverity !== 0) return bySeverity;
  return b.observedAt.localeCompare(a.observedAt);
}
