/**
 * SEO / AEO の計測ループが持つ 3 つのデータ源（feat-seo-aeo-measurement-loop）。
 *
 * ==========================================================================
 * なぜ 3 つを 1 つの型にまとめるのか
 * ==========================================================================
 *
 * 3 つは**性質がまったく違う**。
 *
 *   ① サイト内静的解析  … 自分の HTML を自分で読む。再現する。鍵が要らない。
 *   ② Search Console    … 外の記録を借りる。数日遅れる。鍵が要る。
 *   ③ AI 検索の被引用   … 外へ問い合わせる。同じ問いでも答えが変わる。金がかかる。
 *
 * 違うものを 1 つの型にしているのは、**同じ扱いをするため**ではない。
 * むしろ逆で、「どの系統から来た所見か」を全ての所見に必ず持たせ、
 * 系統ごとに違う扱い（自動反映の根拠にしてよいか・どのくらいの間隔で
 * 更新されるはずか）を**分岐ではなく表として書ける**ようにするためである。
 *
 * 系統を文字列で持ち回ると、どこか 1 箇所で綴りを間違えたときに
 * 「その系統だけ静かに扱われない」状態になる。止まったことに気づけない。
 */

export const MEASUREMENT_SOURCES = ["static_audit", "search_console", "ai_citation"] as const;

export type MeasurementSource = (typeof MEASUREMENT_SOURCES)[number];

/** 画面と通知に出す名前。系統の識別子をそのまま人に見せない。 */
export const MEASUREMENT_SOURCE_LABEL: Record<MeasurementSource, string> = {
  static_audit: "サイト内静的解析",
  search_console: "Search Console",
  ai_citation: "AI 検索での被引用",
};

/**
 * その系統が**外部の資格情報を要るか**。
 *
 * 系統①だけが false。ここが分かれているおかげで、鍵が 1 つも登録されて
 * いない状態でも計測ループは成立する（A1・NFR8）。「鍵が無いから何も動かない」
 * は、導入した初日に運営者が見る画面としては最悪である。
 */
export const MEASUREMENT_SOURCE_NEEDS_CREDENTIAL: Record<MeasurementSource, boolean> = {
  static_audit: false,
  search_console: true,
  ai_citation: true,
};

/**
 * その系統を**自動反映の根拠にしてよいか**（NFR5）。
 *
 * ==========================================================================
 * なぜ系統①だけなのか
 * ==========================================================================
 *
 * 自動反映には、止める人がいない。以前は「提案までとし、運営者の承認を経て
 * 反映する」決まりだったが、それは差し替えられた。人が事前に根拠の弱さを
 * 見る経路が無いなら、**根拠の弱さを型の側で締め出す**しかない。
 *
 * 系統①は再現する。同じ HTML を読めば同じ所見が出るので、
 * 「なぜ書き換えたのか」を後から誰でも確かめ直せる。
 *
 * 系統②③は再現しない。Search Console の数字は日によって動くし、
 * AI の答えは同じ問いでも変わる。**再現しない観測を根拠に本文を書き換えると、
 * 書き換えた理由が二度と再現できない。** 取り消せても、なぜ起きたかは分からない。
 *
 * 系統②③は「反映のあとで何が動いたか」を見る材料に留める。
 */
export const MEASUREMENT_SOURCE_CAN_JUSTIFY_AUTO_APPLY: Record<MeasurementSource, boolean> = {
  static_audit: true,
  search_console: false,
  ai_citation: false,
};

/**
 * その系統が更新されるはずの間隔（ミリ秒・NFR6）。
 *
 * 想定間隔は仕様が決めている（系統①=記事保存時 / ②=日次 / ③=公開時と週次）。
 * ここに置くのは**閾値**、つまり「これを超えたら止まっていると見なす」線である。
 * 想定間隔そのままにすると、1 回遅れただけで止まったことになる。
 *
 * 系統①は記事を保存したときに走るので、記事を書かない日が続けば
 * 当然更新されない。それを「止まっている」と言うと嘘になるので、
 * 他より長く取っている。
 */
export const MEASUREMENT_STALE_AFTER_MS: Record<MeasurementSource, number> = {
  static_audit: 14 * 24 * 60 * 60 * 1000,
  search_console: 3 * 24 * 60 * 60 * 1000,
  ai_citation: 10 * 24 * 60 * 60 * 1000,
};

export function isMeasurementSource(value: string): value is MeasurementSource {
  return (MEASUREMENT_SOURCES as readonly string[]).includes(value);
}
