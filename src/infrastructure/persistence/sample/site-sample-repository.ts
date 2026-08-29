import type { EditorialSiteRepositoryPort } from "@/application/ports/site";
import { type SiteBlueprint, createSiteBlueprint } from "@/domain/authoring";
import { type WorkspaceId, markEditorial, ok, taggedString } from "@/domain/shared";
import { registerStub, stubReason } from "../../stub-registry";
import { SAMPLE_WORKSPACE_ID } from "./sample-identity";
import { createdSites } from "./site-draft-sample-repository";

/**
 * ★ これは仮置きの見本データです（スタブ）。★
 *
 * ここには**ブログを 5 本**置いている。数を増やしたのは飾りではなく、
 * **設定値の組み合わせが画面にどう出るかを、実物で確かめられるようにするため**である。
 * 5 本で次の軸をすべて 1 回以上出している:
 *
 *   ブログパターン  specialist_review / comparison_lab / beginner_guide /
 *                   editorial_media / service_signup
 *   配色            graphite-amber / blue / green / pink / white
 *   明暗            auto / light / dark
 *   詰まり具合      comfortable / compact
 *   角丸            medium / small / large / none
 *   収益モデル      affiliate / mixed / ad / lead
 *   llms.txt        出す / 出さない
 *   カテゴリー数    3 / 2 / 2 / 2 / 2
 *
 * **画面のコードは 1 行も分岐していない。** ブログを 1 本増やすときに
 * 触るのはこのファイルの定数と、下の一覧の 1 行だけである。
 * このことは `tests/domain/site-routes.test.ts` と
 * `tests/ui/blueprint-theme.test.ts` が機械的に確認する。
 */
const stub = registerStub({
  id: "persistence:site-sample",
  port: "SiteRepositoryPort",
  label: "ブログの設計図（見本データ）",
  blockedBy: "済み。見本の 5 本は保存先がつながったあとも残す（空の画面を作らないため）",
  fallbackFor: "src/infrastructure/persistence/d1/site-repository.ts",
});

/**
 * ブログの住所。
 *
 * 名前（`SAMPLE_` / `SECOND_` …）は呼び出し側が使っているので変えていない。
 * 変えるとテストと台本の側だけが古い名前で残り、**どのブログを指しているのか
 * ファイルごとに違う**状態ができる。指す先だけを差し替える。
 */
export const SAMPLE_SITE_SLUG = "home-office-desk";
export const SECOND_SITE_SLUG = "compact-kitchen-gear";
export const THIRD_SITE_SLUG = "first-camera";
export const FOURTH_SITE_SLUG = "run-and-recover";
export const FIFTH_SITE_SLUG = "mobile-plan-navi";

function build(
  slug: string,
  input: Omit<Parameters<typeof createSiteBlueprint>[0], "id" | "workspaceId">,
): SiteBlueprint {
  const built = createSiteBlueprint({
    id: taggedString<"SiteBlueprintId">(`sb_${slug.replace(/-/g, "_")}`),
    workspaceId: SAMPLE_WORKSPACE_ID as WorkspaceId,
    ...input,
  });
  if (!built.ok) {
    // 見本が不変条件を満たさないのは欠陥。黙って動かさない。
    throw new Error(`見本のブログ設計図が不正です (${slug}): ${built.error.message}`);
  }
  return built.value;
}

/**
 * 1 本目。**既定の設定に一番近いブログ。**
 *
 * 配色は既定（graphite-amber）、明暗は端末まかせ、詰まり具合も既定。
 * 「何も指定しないとこう出る」を確かめる基準にする。
 * 固定ページは最も多く、`llms.txt` も出す（全部入りの形）。
 */
const HOME_OFFICE = build(SAMPLE_SITE_SLUG, {
  name: "在宅ワークの机まわり",
  pattern: "specialist_review",
  purpose: "家で 1 日 8 時間働く人が、体を痛めない机まわりを選べるようにする",
  genre: "オフィスチェア・デスク・照明",
  revenueModel: "affiliate",
  extraPages: ["search", "shortlist", "faq", "glossary", "how_to_choose", "tools"],
  categories: [
    {
      slug: "chairs",
      name: "椅子",
      oneLine: "8 時間座り続けたときの腰の負担で選んだ椅子。",
      initialArticleTypes: ["ranking", "review", "comparison"],
    },
    {
      slug: "desks",
      name: "机",
      oneLine: "天板の広さと、昇降させたときの揺れで比べた机。",
      initialArticleTypes: ["review"],
    },
    {
      slug: "lighting",
      name: "照明",
      oneLine: "手元の明るさと、画面への映り込みで選ぶ照明。",
      initialArticleTypes: ["guide"],
    },
  ],
  theme: { brandTheme: "graphite-amber" },
  differentiation: {
    targetReader: "自宅の一室で在宅勤務をしている 30〜40 代の会社員",
    searchIntent: "腰が痛くならない椅子を予算内で決めたい",
    articlePurpose: "座面と背もたれの実測値で候補を 3 つまで絞らせる",
    evaluationAxis: "8 時間着座後の腰まわりの圧力分布と、座面の沈み込み量",
    usageScene: "同じ部屋で寝起きし、机の前から 1 日動かない",
    uniqueExperience: "同一の被験者が全機種を 8 時間ずつ使う自社の連続着座試験",
    comparisonScope: "実売 3 万〜15 万円の事務用椅子",
    conclusionStance: "1 脚を推し、体格別に例外も明記する",
    internalLinkStrategy: "順位表の商品名から個別レビューへ落とす",
    ctaStrategy: "実売価格と在庫を確認できる販売ページのみ。購入は急かさない",
  },
  emitLlmsTxt: true,
});

/**
 * 2 本目。**詰めた見た目のブログ。**
 *
 * 明るい画面に固定し、余白を詰め、角を小さくしてある。
 * 1 本目と同じ部品が、設定値だけでどれだけ違って見えるかを見る用。
 * 収益モデルは組み合わせ（`mixed`）。
 */
const COMPACT_KITCHEN = build(SECOND_SITE_SLUG, {
  name: "せまい台所の道具",
  pattern: "comparison_lab",
  purpose: "台所が狭い家で、置ける大きさの調理道具を選べるようにする",
  genre: "小型調理家電・キッチン用品",
  revenueModel: "mixed",
  extraPages: ["tools", "faq", "how_to_choose"],
  categories: [
    {
      slug: "rice-cookers",
      name: "炊飯器",
      oneLine: "設置に必要な奥行きと蒸気の逃げ方で比べた炊飯器。",
      initialArticleTypes: ["comparison", "guide"],
    },
    {
      slug: "ovens",
      name: "オーブン・トースター",
      oneLine: "壁との距離をどれだけ空ける必要があるかで比べた加熱器具。",
      initialArticleTypes: ["ranking", "review"],
    },
  ],
  theme: { brandTheme: "blue", density: "compact", radius: "small", colorScheme: "light" },
  differentiation: {
    targetReader: "調理台の幅が 60cm 以下の家に住んでいる人",
    searchIntent: "置ける大きさかどうかを先に確かめたい",
    articlePurpose: "設置寸法から候補を外させる",
    evaluationAxis: "本体寸法と、必要な放熱スペースを含めた占有面積",
    usageScene: "調理台の上に出しっぱなしで毎日使う",
    uniqueExperience: "実機を 60cm の調理台に置いて撮影した設置写真",
    comparisonScope: "占有面積 0.15 平方メートル以下の製品",
    conclusionStance: "置ける・置けないをはっきり書く",
    internalLinkStrategy: "比較表の寸法から個別レビューへ落とす",
    ctaStrategy: "在庫と寸法を確認できる販売ページのみ",
  },
});

/**
 * 3 本目。**手引き中心のブログ。**
 *
 * 角丸を大きくし、監修者を前に出す構成（`experts` ページあり）。
 * 記事は順位表を持たず、選び方と比較で構成される。
 */
const FIRST_CAMERA = build(THIRD_SITE_SLUG, {
  name: "はじめてのカメラ",
  pattern: "beginner_guide",
  purpose: "カメラを初めて買う人が、用語に詰まらずに 1 台を決められるようにする",
  genre: "デジタルカメラ・交換レンズ",
  revenueModel: "affiliate",
  extraPages: ["search", "authors", "experts", "review"],
  categories: [
    {
      slug: "bodies",
      name: "カメラ本体",
      oneLine: "撮りたいものから逆算して決めるカメラ本体。",
      initialArticleTypes: ["guide", "comparison"],
    },
    {
      slug: "lenses",
      name: "レンズ",
      oneLine: "最初の 1 本をどう選ぶか。焦点距離の意味から説明します。",
      initialArticleTypes: ["guide", "review"],
    },
  ],
  theme: { brandTheme: "green", radius: "large" },
  differentiation: {
    targetReader: "スマートフォン以外のカメラを持ったことがない 20 代",
    searchIntent: "何を基準に選べばよいか自体が分からない",
    articlePurpose: "選ぶ基準そのものを先に理解させる",
    evaluationAxis: "初期設定のまま撮ったときの失敗写真の少なさ",
    usageScene: "旅行と子どもの行事で、年に数回だけ使う",
    uniqueExperience: "未経験者 6 人に初期設定のまま撮ってもらった記録",
    comparisonScope: "レンズ込み 15 万円以内で買える組み合わせ",
    conclusionStance: "1 台に絞らず、撮る対象別に分岐して示す",
    internalLinkStrategy: "用語集から手引きへ、手引きから比較へ落とす",
    ctaStrategy: "配送予定と保証内容を確認できる販売ページのみ",
  },
});

/**
 * 4 本目。**暗い画面のブログ。**
 *
 * 明暗を `dark` に固定してある。読者側の切り替えより弱い既定なので、
 * 「ブログが暗いと決めていても、読者が明るいを選べば明るい」ことを確かめられる。
 * 収益モデルは広告（`ad`）で、成果リンクを持たない記事が並ぶ。
 */
const RUN_AND_RECOVER = build(FOURTH_SITE_SLUG, {
  name: "走る人の道具",
  pattern: "editorial_media",
  purpose: "市民ランナーが、故障せずに練習を続けられる道具を選べるようにする",
  genre: "ランニングシューズ・計測器",
  revenueModel: "ad",
  extraPages: ["search", "shortlist", "glossary"],
  categories: [
    {
      slug: "shoes",
      name: "シューズ",
      oneLine: "着地の衝撃と反発を測って比べた練習用シューズ。",
      initialArticleTypes: ["ranking", "review", "guide"],
    },
    {
      slug: "watches",
      name: "時計・計測器",
      oneLine: "心拍と距離の精度を実走で確かめた計測器。",
      initialArticleTypes: ["comparison"],
    },
  ],
  theme: { brandTheme: "pink", colorScheme: "dark" },
  differentiation: {
    targetReader: "週 3 回・月 150km 前後を走る市民ランナー",
    searchIntent: "膝を痛めずに練習量を増やせる靴を知りたい",
    articlePurpose: "着地の衝撃値から練習用と本番用を分けさせる",
    evaluationAxis: "着地時の衝撃加速度と、300km 走行後の反発の残り方",
    usageScene: "朝の舗装路を 60 分、雨の日も走る",
    uniqueExperience: "同一ランナーが全機種で 300km 走り込んだ摩耗の記録",
    comparisonScope: "実売 1 万 5000 円〜3 万円の練習用シューズ",
    conclusionStance: "用途別に 2 足を挙げ、1 足に絞らない",
    internalLinkStrategy: "用語集から順位表へ、順位表から個別レビューへ落とす",
    ctaStrategy: "広告掲載のみ。記事中に購入を促す導線を置かない",
  },
});

/**
 * 5 本目。**申込みへ送るブログ。**
 *
 * 収益モデルが `lead`（問い合わせの送客）で、配色は白系・角丸なし。
 * 商品を「買う」のではなく「申し込む」形の導線がどう出るかを見る用。
 */
const MOBILE_PLAN = build(FIFTH_SITE_SLUG, {
  name: "格安SIMの相談所",
  pattern: "service_signup",
  purpose: "毎月の通信費を、使い方を変えずに下げられるようにする",
  genre: "移動体通信サービス・通信機器",
  revenueModel: "lead",
  extraPages: ["tools", "search", "glossary"],
  categories: [
    {
      slug: "plans",
      name: "料金プラン",
      oneLine: "使ったデータ量から、実際に払う額で比べたプラン。",
      initialArticleTypes: ["comparison", "guide"],
    },
    {
      slug: "routers",
      name: "通信機器",
      oneLine: "持ち運ぶ回線と据え置きの回線、どちらが要るかから選ぶ機器。",
      initialArticleTypes: ["review"],
    },
  ],
  theme: { brandTheme: "white", colorScheme: "light", density: "compact", radius: "none" },
  differentiation: {
    targetReader: "大手通信会社と契約したまま 5 年以上が過ぎた人",
    searchIntent: "いまの使い方のまま月額をいくら下げられるか知りたい",
    articlePurpose: "直近 3 か月の使用量から乗り換え先を 1 つ選ばせる",
    evaluationAxis: "昼休みの時間帯に実測した通信速度と、1 年間の総支払額",
    usageScene: "通勤電車で動画を見る。自宅では固定回線を使う",
    uniqueExperience: "同一の場所と時刻で全社の回線を同時に実測した記録",
    comparisonScope: "月額 3000 円以下・データ 20GB 前後のプラン",
    conclusionStance: "使用量の帯ごとに勧める先を変える",
    internalLinkStrategy: "料金の計算道具から比較記事へ落とす",
    ctaStrategy: "申込みページへの送客のみ。契約期間と解約金を必ず併記する",
  },
});

const SITES: readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[] = [
  { slug: SAMPLE_SITE_SLUG, blueprint: HOME_OFFICE },
  { slug: SECOND_SITE_SLUG, blueprint: COMPACT_KITCHEN },
  { slug: THIRD_SITE_SLUG, blueprint: FIRST_CAMERA },
  { slug: FOURTH_SITE_SLUG, blueprint: RUN_AND_RECOVER },
  { slug: FIFTH_SITE_SLUG, blueprint: MOBILE_PLAN },
];

export function sampleSiteNotice(): string {
  return `${stub.label}で表示しています（${stubReason(stub)}）。`;
}

/**
 * 見本の 5 本と、ウィザードで作られたブログを合わせた一覧。
 *
 * **読者側の画面はこの 2 種類を区別しない。**
 * 区別すると「見本のブログでは動くが、作ったブログでは動かない」が起きる。
 */
function allSites(): readonly { readonly slug: string; readonly blueprint: SiteBlueprint }[] {
  return [...SITES, ...createdSites()];
}

/**
 * 見本のブログ 5 本だけ。
 *
 * 保存先を D1 にしたときも、この 5 本は消さずに残す。
 * 消すと、まだ 1 本も作っていない状態で読者側の画面が全部空になり、
 * 「作っていない」のか「壊れている」のかを見分けられなくなる。
 */
export function sampleSites(): readonly {
  readonly slug: string;
  readonly blueprint: SiteBlueprint;
}[] {
  return SITES;
}

export function createSampleSiteRepository(): EditorialSiteRepositoryPort {
  return markEditorial({
    async findBySlug(slug: string) {
      return ok(allSites().find((s) => s.slug === slug)?.blueprint ?? null);
    },
    async list() {
      return ok(allSites());
    },
  });
}
