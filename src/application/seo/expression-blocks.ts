import type { ExpressionBlock } from "@/domain/authoring/blog-template";
import type { PublishedArticle } from "@/application/read-models/published-article";

/**
 * 公開済みの記事から、AI 検索が読む表現ブロックを取り出す。
 *
 * --- なぜ「取り出す」であって「保存する」ではないのか ---
 * `EXPRESSION_BLOCK_KINDS` は 10 種あるが、そのうち 9 種は
 * **読み取りモデルの中に既に住所を持っている**。
 *
 * | ブロック      | 正本の置き場                        |
 * | ------------- | ----------------------------------- |
 * | `answer`      | `summary`                           |
 * | `key_points`  | `keyPoints`（ここだけ他に無い）     |
 * | `faq`         | `faq`                               |
 * | `sources`     | `sections[].claims[].evidence`      |
 * | `freshness`   | `updatedAt`                         |
 * | `spec_table`  | `productCards[].specs`              |
 * | `comparison`  | `comparison`                        |
 * | `cta`         | `productCards[]` の成果リンク       |
 * | `summary`     | `sections[]`                        |
 * | `figure`      | 未接続（画像の配信方式が未決／§5）  |
 *
 * ブロックの配列をそのまま保存すると、同じ事実が 2 か所に載る。
 * 片方だけ直した日に、画面には新しい出典が出て構造化データには古い出典が残る。
 * だから**保存するのは `keyPoints` だけ**にして、残りはここで組み立てる
 * （`docs/product/design-decisions.md` §6）。
 *
 * --- なぜ AI 向けの 5 種だけなのか ---
 * `orderBlocksForTemplate` の `AI_FIRST` / `AI_LAST` に入っている 5 種
 * （answer / key_points / faq / sources / freshness）が、AI 検索に
 * 引用されるための構造そのものである。残りは見た目の骨組みで、
 * 画面部品（`ArticleView`）が既に自前で描いている。
 *
 * **無い種類は返さない。** 空の中身を持つブロックを返すと、
 * 監査（`auditArticleForAiSearch`）が「ある」と数え、
 * 読者に見えない項目に合格印が付く。
 */
export function expressionBlocksOf(article: PublishedArticle): readonly ExpressionBlock[] {
  const blocks: ExpressionBlock[] = [];

  const answer = article.summary.trim();
  if (answer !== "") blocks.push({ kind: "answer", text: answer });

  const keyPoints = (article.keyPoints ?? []).map((k) => k.trim()).filter((k) => k !== "");
  if (keyPoints.length > 0) blocks.push({ kind: "key_points", items: keyPoints });

  const faq = (article.faq ?? [])
    .map((item) => ({
      question: item.question.trim(),
      answer: item.answer.trim(),
    }))
    .filter((item) => item.question !== "" && item.answer !== "");
  if (faq.length > 0) {
    blocks.push({
      kind: "faq",
      items: faq,
    });
  }

  const sources = collectSources(article);
  if (sources.length > 0) blocks.push({ kind: "sources", items: sources });

  const asOf = article.updatedAt.trim();
  if (asOf !== "") blocks.push({ kind: "freshness", asOf });

  return blocks;
}

/** `sources` ブロックに載せる出典 1 件ぶん。 */
type SourceItem = {
  readonly label: string;
  readonly url?: string;
  readonly checkedAt: string;
};

/**
 * 記事じゅうの根拠から、出典の一覧を作る。
 *
 * 出典は節をまたいで散らばっており（`sections[].claims[].evidence`）、
 * 同じ出典が複数の主張から引かれることもある。
 *
 * --- まとめ方 ---
 * 束ねる鍵は `url ?? sourceLabel`。URL があるものは URL が正本で、
 * 無いもの（書籍・実測など）は名前で束ねる。**`id` では束ねない。**
 * 同じ出典でも主張ごとに別の id が振られるので、同じ出典が何度も並ぶ。
 *
 * 同じ鍵で確認日が違うときは**新しい方を残す**。古い方を残すと、
 * 読者には実際より古い確認日が見える（「いつの情報か」を実際より悪く言う）。
 *
 * --- 期限切れの出典を落とさない ---
 * `expired` が付いた証跡もそのまま載せる。落とすと出典欄からは消えるのに
 * 「出典がある」の判定だけが真のまま残り、古い根拠が読者からも監査からも
 * 見えなくなる。このリポジトリは `blockedReason`・`ranking.excluded` と
 * 繰り返し「黙って消さない」側を選んでいる。
 *
 * 並びは記事の出現順（節の順 → 主張の順）。並べ替えると、
 * 本文で読んだ順と出典欄の順がずれる。
 */
function collectSources(article: PublishedArticle): readonly SourceItem[] {
  const byKey = new Map<string, SourceItem>();
  for (const section of article.sections) {
    for (const claim of section.claims ?? []) {
      for (const evidence of claim.evidence) {
        const label = evidence.sourceLabel.trim();
        const url = evidence.url?.trim();
        const key = url !== undefined && url !== "" ? url : label;
        // 名前も URL も無い証跡は載せない（他の 4 種と同じ「空は返さない」）。
        if (key === "") continue;
        const item: SourceItem = {
          label: label === "" ? key : label,
          ...(url === undefined || url === "" ? {} : { url }),
          checkedAt: evidence.checkedAt,
        };
        const seen = byKey.get(key);
        // 文字列のまま比べられる（確認日は YYYY-MM-DD 固定）。
        if (seen === undefined || item.checkedAt > seen.checkedAt) byKey.set(key, item);
      }
    }
  }
  return [...byKey.values()];
}
