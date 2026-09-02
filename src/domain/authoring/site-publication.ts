/**
 * ブログが「読者から見える」と言える条件の**唯一の定義**。
 *
 * ここが 1 か所である理由は、13 問に答えて「作成済み」と出たのに
 * `/s/<URL名>` が 404 になった事故そのものにある。作成側は
 * 「設計図を保存できた」を成功と呼び、読者側は「サイト網の節点が
 * ちょうど 1 行ある」を配布条件にしていた。**成功の定義が 2 つあった。**
 *
 * だから条件はここにしか置かない。作成の完了判定も、管理画面の不足表示も、
 * 同じ `evaluateSiteComposition` を通す。片方だけ条件を足す形を作らない。
 *
 * 数える元は**保存された値**であって、作成手続きが返した戻り値ではない。
 * 手続きの戻り値を数えると、書けていないものを書けたと数えられる。
 */
import { FIXED_PAGE_KINDS } from "../blogops/fixed-page";
import {
  defaultLayoutBandSeeds,
  defaultLayoutSlotSeeds,
} from "../blogops/site-provisioning-defaults";

/** 公開に関わる構成要素。`site_blueprints` 以外の実体を種類で表す。 */
export const SITE_COMPOSITION_ELEMENTS = [
  "network_node",
  "fixed_pages",
  "layout_bands",
  "layout_slots",
  "categories",
  "articles",
] as const;

export type SiteCompositionElement = (typeof SITE_COMPOSITION_ELEMENTS)[number];

/**
 * 画面に出す言葉。**内部構造の語をそのまま出さない。**
 *
 * 「版面の帯」「スロット」は設計の語で、13 問に答えた人には通じない。
 * 通じない語で不足を告げると、原因が自分の入力にあると誤って受け取られ、
 * 13 問をやり直す導線ができる。
 */
export const SITE_COMPOSITION_LABEL: Readonly<Record<SiteCompositionElement, string>> = {
  network_node: "ブログの住所の登録",
  fixed_pages: "運営者・お問い合わせなどの固定ページ",
  layout_bands: "トップページに並ぶ帯",
  layout_slots: "ヘッダー・サイドバー・フッターの中身",
  categories: "記事のカテゴリー",
  articles: "読者に公開している記事",
};

/** 不足していたとき、その場で何を直せばよいか。 */
export const SITE_COMPOSITION_REMEDY: Readonly<Record<SiteCompositionElement, string>> = {
  network_node: "ブログを作り直すと住所が登録されます。",
  fixed_pages: "固定ページの画面から追加できます。",
  layout_bands: "トップページの構成画面から並べられます。",
  layout_slots: "版面の画面からヘッダー・サイドバー・フッターを設定できます。",
  categories: "カテゴリーの画面から追加できます。",
  articles: "記事の画面から公開できます。",
};

/** 読者向け公開投影に実在する各要素の件数。 */
export type CompositionCounts = Readonly<Record<SiteCompositionElement, number>>;

/**
 * 「ブログ作成」が終わったと言うために必要な保存行数。
 *
 * 保存層と画面で「1 件あれば十分」を別々に決めない。
 * 固定ページは 8 種、帯とスロットは現行の既定構成を
 * すべて作る。記事は作成ウィザードの責務外なのでここに含めない。
 *
 * この数は `site-provisioning-defaults.ts` / `fixed-page.ts` の配列から
 * 導く。数値を複製すると、既定構成を足した日に作成側だけが古くなる。
 */
export const SITE_PROVISIONING_REQUIRED_COUNTS: CompositionCounts = {
  network_node: 1,
  fixed_pages: FIXED_PAGE_KINDS.length,
  layout_bands: defaultLayoutBandSeeds().length,
  layout_slots: defaultLayoutSlotSeeds().length,
  categories: 1,
  articles: 0,
};

/** 作成後、内容の公開準備まで終えたと言うための追加件数。 */
export const SITE_CONTENT_REQUIRED_COUNTS: CompositionCounts = {
  ...SITE_PROVISIONING_REQUIRED_COUNTS,
  articles: 1,
};

/** 不足 1 件。強さ (公開を止めるか、質を下げるだけか) を伴う。 */
export type SiteCompositionGap = {
  readonly element: SiteCompositionElement;
  readonly label: string;
  readonly remedy: string;
  /** `blocking` は読者に届かない。`degrading` は届くが薄い。 */
  readonly severity: "blocking" | "degrading";
};

export type CompositionReport = {
  /** 読者がこのブログを開けるか。`blocking` が 1 件でもあれば false。 */
  readonly reachable: boolean;
  /** 作成ウィザードが責任を持つ必須実体がすべて保存されたか。 */
  readonly provisioningComplete: boolean;
  /** 公開固定ページと記事を含む、読者に内容を届ける準備が終わったか。 */
  readonly contentReady: boolean;
  readonly gaps: readonly SiteCompositionGap[];
  readonly counts: CompositionCounts;
};

/**
 * 各要素が「公開を止める」のか「質を下げるだけ」なのかの区分。
 *
 * **`blocking` は 1 種だけに絞ってある。** 判断軸は
 * 「それが無いとき、読者はそのブログを**開けない**のか、**開けるが薄い**のか」
 * であって、「あった方がよいか」ではない。
 *
 * `network_node` だけが `blocking` なのは、`resolvePublicSiteIdentity` が
 * サイト網の節点を 1 行も見つけられなければ必ず 404 を返すという実装上の事実に
 * よる。他の 5 種は 0 件でも `SiteFrame` はページを描き、読者は到達できる。
 *
 * `blocking` を増やせば「作成済みと言ったのに 404」はより起きにくくなるが、
 * 作成が巻き戻る場面が増え、13 問を通した人が完成に辿り着けない確率が上がる。
 * 「作れないブログ」と「薄いブログ」なら、薄いブログの方が直せる。
 * だから薄さは作成を止めず、`degrading` として画面に残す。
 */
export const SITE_COMPOSITION_SEVERITY: Readonly<
  Record<SiteCompositionElement, "blocking" | "degrading">
> = {
  network_node: "blocking",
  fixed_pages: "degrading",
  layout_bands: "degrading",
  layout_slots: "degrading",
  categories: "degrading",
  articles: "degrading",
};

/**
 * 保存値の件数から、開けるかどうかと不足一覧を導く。
 *
 * 件数 0 と、呼び出し側が必須の内訳不足を検出した要素を不足とみなす。
 */
export function evaluateSiteComposition(
  counts: CompositionCounts,
  contentIncompleteElements: readonly SiteCompositionElement[] = [],
): CompositionReport {
  const contentIncomplete = new Set(contentIncompleteElements);
  const gaps: SiteCompositionGap[] = [];
  for (const element of SITE_COMPOSITION_ELEMENTS) {
    if (
      counts[element] >= SITE_CONTENT_REQUIRED_COUNTS[element] &&
      !contentIncomplete.has(element)
    ) {
      continue;
    }
    gaps.push({
      element,
      label: SITE_COMPOSITION_LABEL[element],
      remedy: SITE_COMPOSITION_REMEDY[element],
      severity: SITE_COMPOSITION_SEVERITY[element],
    });
  }
  const provisioningComplete = SITE_COMPOSITION_ELEMENTS.every(
    (element) => counts[element] >= SITE_PROVISIONING_REQUIRED_COUNTS[element],
  );
  return {
    reachable: gaps.every((gap) => gap.severity !== "blocking"),
    provisioningComplete,
    contentReady: provisioningComplete && gaps.length === 0,
    gaps,
    counts,
  };
}

/** 公開を止めている不足だけ。作成の巻き戻し判定と、画面の最上段に使う。 */
export function blockingGaps(
  report: CompositionReport,
): readonly SiteCompositionGap[] {
  return report.gaps.filter((gap) => gap.severity === "blocking");
}
