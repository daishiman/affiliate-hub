/**
 * ローカルで画面を触るための見本データ（**開発機の D1 だけ**）。
 *
 * ここは「作る値」だけを持ち、当てる手順は `scripts/seed-local.ts` が持つ。
 * 分けてあるのは、**値をテストから読めるようにする**ため。
 * 手順と混ぜると、取り込むだけで `wrangler` が走るファイルになる。
 *
 * 決めごと 3 つ。
 *   1. 参考サイト由来の文章・固有名・色値は 1 つも書かない（`check:reference-reuse` の対象）。
 *   2. 作業場所は見本と同じ `ws_sample`。別 ID にすると、既にある見本の
 *      画面と、ここで入れた行が別々の作業場所に分かれて見える。
 *   3. ブログの URL 名は見本のブログ（`video-editing-gear`）に合わせる。
 *      読者側の設計図は見本が持っているので、ここで新しい名前を作ると
 *      `/s/<名前>` が 404 になる。
 */
import {
  ARTICLE_BLOCK_KINDS,
  type ArticleBlockKind,
  ARTICLE_TYPE_BY_TEMPLATE,
  type BlogArticleBlock,
  DELIVERY_PARTS,
  FIXED_PAGE_KINDS,
  FIXED_PAGE_LABEL,
  type FixedPageKind,
  FOOTER_SLOT_KEYS,
  HEADER_SLOT_KEYS,
  type BlogArticle,
  type LayoutRegion,
  REQUIRED_BLOCKS,
  SIDEBAR_SLOT_KEYS,
  SIDEBAR_STICKY_SLOT_KEYS,
  TOP_BANDS,
} from "@/domain/blogops";
import type {
  BlogDeliveryPartRecord,
  BlogLayoutBandRecord,
  BlogLayoutSlotRecord,
  BlogTagRecord,
  FixedPageRecord,
  SiteNetworkRecord,
} from "@/application/ports/blog-ops";
import { BLOG_OPS_SAMPLE_ROUTE_IDS } from "@/infrastructure/persistence/sample/blog-ops-sample-repository";

/** 見本の作業場所。`SAMPLE_WORKSPACE_ID` と同じ値であることを検査が見る。 */
export const SEED_WORKSPACE_ID = "ws_sample";
/** ログインに使う人。**この人だけが入れる。** */
export const SEED_USER_ID = "usr_local_owner";
export const SEED_USER_EMAIL = "owner@local.test";
export const SEED_USER_NAME = "ローカル検証用の担当者";
/**
 * 見本のブログ。読者側の設計図を見本が持っている 2 本。
 *
 * 親側は**見本の `SAMPLE_SITE_SLUG` と同じ名前にする**。揃えないと、
 * vitest（見本の上で描く）は緑のまま、Playwright（seed 済みの D1 を本物の
 * 通信で開く）だけが `/s/<名前>` 以下すべてで 404 になる。
 * 揃えるのは URL に出る名前だけで、記事の中身までは合わせない
 * （検査は `tests/architecture/seed-and-sample-agree.test.ts`）。
 */
export const SEED_HUB_SLUG = "home-office-desk";
export const SEED_SUB_SLUG = "gear-for-small-kitchen";

/** SQLite の文字列。`'` を 2 つ重ねる以外の細工をしない。 */
function q(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function seconds(daysAgo: number, base: number): number {
  return base - daysAgo * 24 * 60 * 60;
}

export type SeedArticle = {
  readonly id: string;
  readonly slug: string;
  readonly template: "T1" | "T2" | "T3" | "T4";
  readonly title: string;
  readonly lead: string;
  readonly status: "draft" | "review" | "published" | "archived";
  readonly daysAgo: number;
  /** 必須部品のうち、わざと入れないもの。空なら全部入れる。 */
  readonly missing: readonly string[];
  readonly ratings: readonly number[];
  /**
   * 必須の外に、わざと足す部品。
   *
   * 必須だけ入れると「最低限そろった記事」しか画面に出ず、
   * アイキャッチやコメント欄や前後リンクが**入ったときの**見え方が
   * 一度も見えない。`REQUIRED_BLOCKS` に無い部品はここで足す。
   */
  readonly extra?: readonly string[];
  /**
   * 部品ごとの見出しと本文。
   *
   * **書かないと空の枠が並ぶ。** 種類と位置だけ入れて中身を空にすると、
   * 「部品の並びは正しいが、文章が入ったときにどう見えるか」は
   * 一度も確かめられない。既定文は `DEFAULT_BLOCK_TEXT` にあり、
   * ここに書いた分だけが記事ごとの言葉で上書きされる。
   */
  readonly text?: Readonly<Record<string, { heading?: string; body?: string }>>;
  /** 付けるタグ。書かなければ順番で 1 つ付く。空配列なら**タグ無し**の見え方になる。 */
  readonly tagIds?: readonly string[];
  /** 置くブログ。既定は中心のブログ。子のブログにも記事があることを見せるために使う。 */
  readonly site?: "hub" | "sub";
};

/**
 * 部品ごとの既定の見出しと本文。
 *
 * 記事ごとに全部書くと量が増えるだけなので、**種類の意味が伝わる文**を
 * ここに 1 つずつ置き、記事側では違いの出る部品だけ上書きする。
 * 文章はすべて架空のもの（決めごと 1: 参考サイト由来の文章は書かない）。
 */
const DEFAULT_BLOCK_TEXT: Readonly<Record<string, { heading: string; body: string }>> = {
  breadcrumb: { heading: "", body: "" },
  "article-title": { heading: "", body: "" },
  "article-meta": { heading: "", body: "" },
  "featured-image": {
    heading: "",
    body: "机の上に道具を並べて、置き場所ごとに測っている様子。",
  },
  "disclosure-notice": {
    heading: "広告について",
    body: "この記事には広告リンクを含みます。順位づけに報酬額は使っていません。",
  },
  "intro-box": {
    heading: "この記事で分かること",
    body: "選ぶときに迷いやすい点を先に片づけます。読み終えたときに、次に何を調べればよいかが決まっている状態を目指します。",
  },
  "hierarchical-toc": { heading: "目次", body: "" },
  "editor-credential-box": {
    heading: "書いた人・確かめた人",
    body: "書いた人: ローカル検証用の担当者（実機で 3 か月使用）\n確かめた人: 編集担当（数値の出どころを再確認）",
  },
  "spec-section": {
    heading: "必要な条件",
    body: "最低限そろえたいのは 3 つです。置き場所に収まること、音が気にならないこと、後から足せること。ここを外すと、買い替えが早く来ます。",
  },
  "criterion-section": {
    heading: "何で比べたか",
    body: "同じ素材で同じ作業をして、かかった時間を測りました。数字は 3 回測った中央の値です。1 回だけの値は載せていません。",
  },
  "pick-section": {
    heading: "選んだもの",
    body: "迷ったらこれ、という 1 つを先に挙げます。合わない条件も併せて書くので、当てはまる人は次の候補へ進んでください。",
  },
  "product-card": {
    heading: "候補",
    body: "価格は変わります。押した先の販売店で必ず確かめてください。",
  },
  "summary-section": {
    heading: "まとめ",
    body: "置き場所が決まっているなら 1 つ目、後から足したいなら 2 つ目です。どちらも決めきれないときは、先に机の寸法を測ってください。",
  },
  "comment-form": { heading: "感想を送る", body: "名前も連絡先も要りません。" },
  "prev-next": { heading: "前後の記事", body: "" },
};

/**
 * E2E が名指しで開く記事の URL 名。
 *
 * **spec 側に文字列を書き写させないために出している。** 書き写すと、
 * ここの値を変えた日に E2E だけが静かに 404 を踏む。2026-08-26 に実際そうなった
 * （spec が `editing-monitor-picks` を手で持っていた）。
 */
export const SEED_ARTICLE_SLUGS = {
  /** 公開済み。読者側に出て、点を付けられる。見本と同じ記事。 */
  published: BLOG_OPS_SAMPLE_ROUTE_IDS.articleSlug,
  /** 下書き。読者側に出てはいけない。 */
  draft: "storage-for-4k-footage",
} as const;

/**
 * 記事は 11 本。**軸を 1 本ずつ動かして、見え方の分かれ目を全部作る。**
 *
 * どの軸を、どの記事で見るか。
 *
 * | 軸 | 値 | 見る記事 |
 * | --- | --- | --- |
 * | 記事型 | T1 まとめ | `ba_sample_starter_kit` |
 * | | T2 単品レビュー | `ba_seed_review_full` |
 * | | T3 ガイド | `ba_seed_stale` |
 * | | T4 カテゴリーのハブ | `ba_seed_fewvotes` |
 * | 状態 | 公開中 | 上の 4 本ほか |
 * | | 下書き | `ba_seed_draft`（読者側に出ない） |
 * | | 確認中 | `ba_seed_review_wait`（同上） |
 * | | 取り下げ | `ba_seed_archived`（同上） |
 * | 部品 | 必須が 1 つ欠ける | `ba_seed_draft`（公開しようとすると断られる） |
 * | | 必須のみ | `ba_seed_stale` |
 * | | 任意も全部 | `ba_seed_review_full`（アイキャッチ・コメント欄・前後） |
 * | 票 | 0 件 | `ba_seed_novotes`（目安が出ない側の端） |
 * | | 4 件 | `ba_seed_fewvotes`（同上、件数が足りない側） |
 * | | 5 件以上 | `ba_sample_starter_kit`（目安が出る側） |
 * | 鮮度 | 3 日前 | `ba_sample_starter_kit` |
 * | | 400 日前 | `ba_seed_stale`（「見直し時期」になる） |
 * | タグ | 付いている | ほぼ全部 |
 * | | 付いていない | `ba_seed_notags`（絞り込みから漏れる側） |
 * | 文字数 | 長い題名・長い導入 | `ba_seed_longform`（折り返しの見え方） |
 * | ブログ | 中心 | 上のすべて |
 * | | 子 | `ba_seed_sub_intro`（子にも記事があること） |
 *
 * **「公開中が 1 本だけ」では足りない。** 読者側に出る／出ないの境目は
 * 状態 4 種のうち 3 種が「出ない」側なので、出ない側を 1 種しか置かないと、
 * 「たまたま下書きだけ弾いている」実装でも画面は正しく見える。
 */
export const SEED_ARTICLES: readonly SeedArticle[] = [
  {
    /*
     * **1 本目だけは見本（D1 が無いときの代役）と同じ記事にしてある。**
     *
     * 代役と本物が別の記事を語っていると、見本で描く vitest は緑のまま、
     * 本物の通信で開く E2E だけが 404 になる。2026-08-26 に実際そうなった
     * （`/s/<ブログ>/blog/starter-kit-2026` が本番相当の環境に無かった）。
     * URL 名は `BLOG_OPS_SAMPLE_ROUTE_IDS` から取り、手で書き写さない。
     */
    id: "ba_sample_starter_kit",
    slug: BLOG_OPS_SAMPLE_ROUTE_IDS.articleSlug,
    template: "T1",
    title: "はじめての編集机まわり おすすめ 5 選",
    lead: "予算・置き場所・音の 3 点で絞り込み、迷いどころを先に片づけます。",
    status: "published",
    daysAgo: 3,
    missing: [],
    ratings: [5, 4, 5, 4, 5, 3],
  },
  {
    id: "ba_seed_draft",
    slug: SEED_ARTICLE_SLUGS.draft,
    template: "T2",
    title: "4K 素材の置き場所をどう決めるか",
    lead: "速さと容量のどちらを先に決めるかで、置き場所は変わります。",
    status: "draft",
    daysAgo: 1,
    missing: ["editor-credential-box"],
    ratings: [],
  },
  {
    id: "ba_seed_stale",
    slug: "color-calibration-basics",
    template: "T3",
    title: "色合わせの手順を、道具を増やさずに始める",
    lead: "まず今ある画面で測ってから、足りないものを足します。",
    status: "published",
    daysAgo: 400,
    missing: [],
    ratings: [3, 2, 4, 3, 5],
  },
  {
    id: "ba_seed_fewvotes",
    slug: "quiet-workspace-setup",
    template: "T4",
    title: "録音しながら編集できる机の作り方",
    lead: "音の出るものを机から離すだけで、録り直しが減ります。",
    status: "published",
    daysAgo: 20,
    missing: [],
    ratings: [5, 4, 4, 5],
  },
  {
    /**
     * 任意の部品まで全部入った記事。**T2（単品レビュー）で見る。**
     *
     * 必須だけの記事しか無いと、アイキャッチ・商品カード・コメント欄・
     * 前後リンクが入ったときの見え方が一度も画面に出ない。
     */
    id: "ba_seed_review_full",
    slug: "portable-ssd-for-editing",
    template: "T2",
    title: "持ち歩ける SSD を 3 か月使ってみた",
    lead: "速さより、持ち運びで壊れないかを先に見ました。",
    status: "published",
    daysAgo: 8,
    missing: [],
    /*
     * `ARTICLE_BLOCK_KINDS` 15 種のうち、必須に入らない 6 種をここで全部足す。
     * `spec-section` はどの記事型の必須にも入っていないので、
     * **ここで足さないと 15 種のうち 1 種だけが一度も画面に出ない。**
     */
    extra: [
      "breadcrumb",
      "featured-image",
      "spec-section",
      "product-card",
      "comment-form",
      "prev-next",
    ],
    ratings: [4, 5, 4, 4, 3, 5, 4],
    text: {
      "intro-box": {
        heading: "先に結論",
        body: "毎日持ち出すなら、速さの数字より外側の作りを見てください。落として困るのは中身のほうです。",
      },
      "product-card": {
        heading: "使った 1 台",
        body: "架空の製品です。価格・在庫は販売店で確かめてください。",
      },
    },
  },
  {
    /** 確認中。**読者側に出てはいけない。**下書きとは別の状態として置く。 */
    id: "ba_seed_review_wait",
    slug: "monitor-arm-basics",
    template: "T3",
    title: "モニターアームを付ける前に測るところ",
    lead: "机の厚みと奥行きだけ先に測ると、失敗が減ります。",
    status: "review",
    daysAgo: 2,
    missing: [],
    ratings: [],
  },
  {
    /** 取り下げ。**読者側に出てはいけない。**公開したあと下げた形。 */
    id: "ba_seed_archived",
    slug: "old-codec-guide",
    template: "T3",
    title: "いまは使わない書き出し形式のはなし",
    lead: "内容が古くなったので取り下げました。",
    status: "archived",
    daysAgo: 500,
    missing: [],
    ratings: [2, 3],
  },
  {
    /** 票が 1 件も無い公開記事。**目安が出ない側の、もう一方の端。** */
    id: "ba_seed_novotes",
    slug: "cable-management-first-step",
    template: "T3",
    title: "配線を片づける最初の一歩",
    lead: "抜き差しするものだけを手前に集めます。",
    status: "published",
    daysAgo: 12,
    missing: [],
    ratings: [],
  },
  {
    /** タグが 1 つも付いていない公開記事。**絞り込みから漏れる側の見え方。** */
    id: "ba_seed_notags",
    slug: "desk-lighting-notes",
    template: "T3",
    title: "手元の明かりをどこに置くか",
    lead: "画面の反射を減らす向きから決めます。",
    status: "published",
    daysAgo: 30,
    missing: [],
    ratings: [4, 4, 5],
    tagIds: [],
  },
  {
    /**
     * 長い題名と長い導入。**折り返しの見え方を見るために置く。**
     *
     * 短い文しか無いと、題名が 2 行になったとき・導入が畳まれたときの
     * 崩れが画面に出ない。中身は普通の記事として読める文にしてある。
     */
    id: "ba_seed_longform",
    slug: "choosing-a-laptop-for-long-timeline-editing",
    template: "T1",
    title: "長い尺の編集で止まらないノートパソコンの選び方と、買う前に確かめておきたい 7 つのこと",
    lead: "画面の大きさ・冷え方・電池の持ち・端子の数・重さ・保証・下取りの 7 点を、優先する順に並べ替えられる状態にします。どれを削ってよいかは使い方で変わるので、削ってよい順も一緒に書きます。",
    status: "published",
    daysAgo: 45,
    missing: [],
    extra: ["featured-image", "product-card"],
    ratings: [5, 5, 4, 3, 4, 5, 5, 2, 4],
  },
  {
    /** 子のブログにも公開記事を 1 本。**子が空だと、姉妹サイトの帯が空で出る。** */
    id: "ba_seed_sub_intro",
    slug: "small-kitchen-first-tools",
    template: "T1",
    title: "狭い台所で先に買う道具 3 つ",
    lead: "置き場所が要らないものから順に選びます。",
    status: "published",
    daysAgo: 6,
    missing: [],
    ratings: [4, 5, 4, 4, 5],
    tagIds: [],
    site: "sub",
  },
];

/**
 * タグ。**`kind` を書かないと全部 `topic` になる**（列の既定値）。
 *
 * `brand-tag-cloud` に出るのは `brand` だけなので、種類を書かない見本を入れると
 * **枠は正しいのに 1 件も出ない**という、いちばん気づきにくい形で画面が空になる。
 * 作り手の名前は**架空のもの**を置く（決めごと 1: 参考サイト由来の固有名は書かない）。
 */
const TAGS = [
  { id: "bt_seed_display", slug: "display", name: "画面まわり", note: "モニター・色・明るさ", kind: "topic" },
  { id: "bt_seed_storage", slug: "storage", name: "保存まわり", note: "外付け・速さ・容量", kind: "topic" },
  { id: "bt_seed_audio", slug: "audio", name: "音まわり", note: "録音・机・静かさ", kind: "topic" },
  { id: "bt_seed_brand_a", slug: "mihondo", name: "見本堂", note: "架空の作り手。ブランド絞り込みの見本。", kind: "brand" },
  { id: "bt_seed_brand_b", slug: "shisaku-lab", name: "試作ラボ", note: "架空の作り手。ブランド絞り込みの見本。", kind: "brand" },
] as const;

/**
 * サイドバーの枠の中身。
 *
 * **本文が要る枠と、要らない枠がある。**「探す」「カテゴリー」「ブランド」は
 * いまのデータから作るので空でも出るが、それ以外は**運営者が書いた本文が
 * 無いと枠ごと出ない**（`presentation/site/blog-sidebar.tsx`）。空のまま配ると
 * 「実装されていない」と読めてしまうので、見本には書いた状態を入れておく。
 *
 * `custom-html-slot-*` は**保存の直前に削られた形**（`sanitizeSlotHtml` が通す
 * タグだけ）を直に入れる。ここは保存経路を通らないので、通る形を手で守る。
 */
const SIDEBAR_SLOT_BODY: Readonly<Record<string, string>> = {
  "profile-card": "道具を実際に買って、使ってから書いています。\n\n合わないと思ったものは、合わない理由まで書きます。",
  "quick-link-menu": "はじめての人向けのまとめ\n\n買い替えの目安\n\n返品・保証の調べ方",
  "recent-comments": "「音まわりの記事、机の位置まで書いてあって助かりました」\n\n「保存の話、容量より速さという結論が意外でした」",
  "custom-html-slot-upper":
    "<p>この場所は運営者が自由に書ける枠です。</p><ul><li>お知らせ</li><li>期間限定の案内</li></ul>",
  "custom-html-slot-lower":
    "<p>枠の下側。<strong>貼った HTML は保存の直前に削られます。</strong></p>",
};

/**
 * ヘッダーの枠の中身（見出しと本文）。
 *
 * ヘッダーは**見出しのほうが効く**枠が多い。ブログ名も、大きな見出しの札も、
 * 出るのは短い言葉のほうで、本文は添え書きにしかならない。
 * そこで見出しを必ず埋め、本文は要る枠だけに書く。
 */
const HEADER_SLOT_TITLE: Readonly<Record<string, string>> = {
  "header-brand": "編集の道具",
  "header-search-modal": "探す",
  "mega-nav": "題目から探す",
  "hero-banner": "はじめての人はここから",
};
const HEADER_SLOT_BODY: Readonly<Record<string, string>> = {
  "header-brand": "道具選びの入口をここに集めます。",
  "header-search-modal": "",
  "mega-nav": "",
  "hero-banner": "予算と置き場所を決めてから、候補を絞ります。",
};

/** フッターの枠の中身。上と同じ考え方。 */
const FOOTER_SLOT_TITLE: Readonly<Record<string, string>> = {
  "footer-profile": "運営者",
  "footer-category-tree": "題目の一覧",
  "footer-logo-nav": "編集の道具",
  "legal-nav": "きまり",
};
const FOOTER_SLOT_BODY: Readonly<Record<string, string>> = {
  "footer-profile": "道具を実際に使って書いています。合わないものは、合わない理由まで書きます。",
  "footer-category-tree": "",
  "footer-logo-nav": "",
  "legal-nav": "",
};

/** 追従する枠の中身。上と同じ理由で、書いた状態を入れておく。 */
const SIDEBAR_STICKY_SLOT_BODY: Readonly<Record<string, string>> = {
  "sticky-promo-slot": "巻いても付いてくる枠です。案内をここに置きます。",
  "sticky-toc": "長い記事では、ここに見出しの一覧を出します。",
};

const LEGAL_PAGE_BODY: Readonly<Record<FixedPageKind, string>> = {
  profile: "この場所を運営している人と、判断のしかたを書きます。",
  sitemap: "扱っている題目と固定ページへの入り口を並べます。",
  site_policy: "何を選び、何を選ばないかの基準を書きます。",
  privacy_policy: "受け取る情報と、その使い道を書きます。",
  commercial_transaction: "法で求められる表示をまとめます。",
  contact: "連絡の方法と、返事までの目安を書きます。",
  review_guidelines: "比較・試用・確認の基準と、利益関係の扱いを書きます。",
  company: "運営する組織の名前と連絡先を書きます。",
};

const LEGAL_PAGES = FIXED_PAGE_KINDS.map(
  (kind) => [kind, FIXED_PAGE_LABEL[kind], LEGAL_PAGE_BODY[kind]] as const,
);

/**
 * 記事 1 本ぶんの部品を、位置と文章まで決めた形で返す。
 *
 * **SQL の中で組み立てない。**組み立てを SQL 文の中に置くと、
 * 「D1 に入っている並び」と「静止した写しに描かれる並び」が別々のコードから出て、
 * 写しのほうだけ正しく見える状態が作れてしまう。ここを 1 か所にしておくと、
 * 写しに出ているものは D1 にも同じ順で入っている。
 */
export function seedArticleBlocks(article: SeedArticle): readonly BlogArticleBlock[] {
  const required = REQUIRED_BLOCKS[article.template].filter(
    (kind) => !article.missing.includes(kind),
  );
  /*
   * 必須の前に見出しまわりを置き、任意の部品を後ろに足す。
   * 並びは position が正本で、種類の順ではない。
   * `extra` は `missing` に名指しされたものを入れない——「わざと入れない」が
   * 二か所で食い違うと、どちらが効いたのか記事を見ても分からなくなる。
   */
  const kinds = [
    "article-title",
    "article-meta",
    ...required,
    ...(article.extra ?? []).filter((kind) => !article.missing.includes(kind)),
  ].filter((kind, index, all) => all.indexOf(kind) === index);

  return kinds.map((kind, position) => {
    if (!(ARTICLE_BLOCK_KINDS as readonly string[]).includes(kind)) {
      throw new Error(`知らない部品です: ${kind}`);
    }
    // 記事ごとの言葉があればそれを、無ければ種類ごとの既定文を入れる。
    const fallback = DEFAULT_BLOCK_TEXT[kind] ?? { heading: "", body: "" };
    const override = article.text?.[kind];
    return {
      id: `bb_${article.id}_${position}`,
      kind: kind as ArticleBlockKind,
      heading: override?.heading ?? fallback.heading,
      body: override?.body ?? fallback.body,
      position,
    };
  });
}

/** 見本データを持つブログは 2 本。鍵は id を作るときの前置きにも使う。 */
export const SEED_SITE_KEYS = ["hub", "sub"] as const;
export type SeedSiteKey = (typeof SEED_SITE_KEYS)[number];

/** 鍵から URL 名へ。**逆写しを 2 か所に書かない。** */
export function seedSiteSlug(siteKey: SeedSiteKey): string {
  return siteKey === "sub" ? SEED_SUB_SLUG : SEED_HUB_SLUG;
}

/**
 * 版面の枠を、保存されている形（`BlogLayoutSlotRecord`）で返す。
 *
 * **SQL 文の中で組み立てない。**組み立てが SQL の中にあると、
 * D1 に入る枠と、静止した写しに描かれる枠が別々のコードから出る。
 * 別々だと、写しのほうにだけ枠がある状態が作れてしまい、
 * 「画面で見た」が「D1 で確かめた」の代わりにならなくなる。
 */
export function seedLayoutSlots(siteKey: SeedSiteKey): readonly BlogLayoutSlotRecord[] {
  const siteSlug = seedSiteSlug(siteKey);
  const region = (
    key: LayoutRegion,
    keys: readonly string[],
    title: Readonly<Record<string, string>>,
    body: Readonly<Record<string, string>>,
  ): readonly BlogLayoutSlotRecord[] =>
    keys.map((slotKey, position) => ({
      id: `ls_seed_${siteKey}_${slotKey}`,
      siteSlug,
      region: key,
      slotKey,
      title: title[slotKey] ?? "",
      body: body[slotKey] ?? "",
      position,
      enabled: true,
    }));

  const none: Readonly<Record<string, string>> = {};
  return [
    ...region("header", HEADER_SLOT_KEYS, HEADER_SLOT_TITLE, HEADER_SLOT_BODY),
    // 通常枠と追従枠の見出しは空にしてある。空のときの逃げ先は
    // `LAYOUT_SLOT_LABEL` の 1 か所で、そこが効いているかを画面で見る。
    ...region("sidebar", SIDEBAR_SLOT_KEYS, none, SIDEBAR_SLOT_BODY),
    ...region("sidebar_sticky", SIDEBAR_STICKY_SLOT_KEYS, none, SIDEBAR_STICKY_SLOT_BODY),
    ...region("footer", FOOTER_SLOT_KEYS, FOOTER_SLOT_TITLE, FOOTER_SLOT_BODY),
  ];
}

/** 上の帯。件数の上限は 3 で揃える（多いほうの端は記事の本数が足りない）。 */
export function seedLayoutBands(siteKey: SeedSiteKey): readonly BlogLayoutBandRecord[] {
  return TOP_BANDS.map((band, position) => ({
    id: `lb_seed_${siteKey}_${band}`,
    siteSlug: seedSiteSlug(siteKey),
    band,
    title: "",
    enabled: true,
    position,
    itemLimit: 3,
  }));
}

/** 配り口 9 種。全部「出す」側にして、切ったときとの差を後から作れるようにする。 */
export function seedDeliveryParts(siteKey: SeedSiteKey): readonly BlogDeliveryPartRecord[] {
  return DELIVERY_PARTS.map((part, position) => ({
    id: `dp_seed_${siteKey}_${part}`,
    siteSlug: seedSiteSlug(siteKey),
    part,
    enabled: true,
    note: "",
    position,
  }));
}

/** タグ。中心のブログにだけ置く（札はブログに属する）。 */
export function seedTags(): readonly BlogTagRecord[] {
  return TAGS.map((tag) => ({
    id: tag.id,
    siteSlug: SEED_HUB_SLUG,
    slug: tag.slug,
    name: tag.name,
    description: tag.note,
    kind: tag.kind,
  }));
}

/** 固定ページ 8 種。両方のブログに置く。 */
export function seedFixedPages(
  siteKey: SeedSiteKey,
  updatedAt: Date,
): readonly FixedPageRecord[] {
  return LEGAL_PAGES.map(([kind, title, body]) => ({
    id: `lp_seed_${siteKey}_${kind}`,
    siteSlug: seedSiteSlug(siteKey),
    kind,
    title,
    body,
    status: "published" as const,
    deletedAt: null,
    updatedAt,
  }));
}

/** サイト網。親を持たない中心が 1 本だけであること自体が見本になる。 */
export function seedNetwork(): readonly SiteNetworkRecord[] {
  return [
    {
      id: "sn_seed_hub",
      siteSlug: SEED_HUB_SLUG,
      role: "hub",
      parentSlug: null,
      name: "編集の道具",
      oneLine: "道具選びの入口をここに集めます。",
      position: 0,
      status: "active",
    },
    {
      id: "sn_seed_sub",
      siteSlug: SEED_SUB_SLUG,
      role: "sub",
      parentSlug: SEED_HUB_SLUG,
      name: "台所まわりの道具",
      oneLine: "中心から分けた、狭い題目のほう。",
      position: 1,
      status: "active",
    },
  ];
}

/** 記事 1 本を、保存されている形（`BlogArticle`）で返す。 */
export function seedArticleRecord(article: SeedArticle, now: Date): BlogArticle {
  const at = new Date(now.getTime() - article.daysAgo * 24 * 60 * 60 * 1000);
  return {
    id: article.id,
    siteSlug: seedSiteSlug(article.site ?? "hub"),
    slug: article.slug,
    template: article.template,
    title: article.title,
    lead: article.lead,
    status: article.status,
    authorName: SEED_USER_NAME,
    publishedAt: article.status === "published" ? at : null,
    updatedAt: at,
  };
}

/**
 * 当てる SQL を組み立てる。
 *
 * **同じものを 2 度当てても増えない**ようにするため、入れる前に
 * 種として入れた行だけを消す。消す範囲を作業場所とブログの URL 名で
 * 縛っているので、手で作った行は巻き込まない。
 */
export function buildSeedSql(nowSeconds: number): readonly string[] {
  const ws = q(SEED_WORKSPACE_ID);
  const hub = q(SEED_HUB_SLUG);
  const sub = q(SEED_SUB_SLUG);
  const out: string[] = [];

  out.push(
    `DELETE FROM blog_article_rating WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ${ws});`,
    `DELETE FROM blog_article_tag WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ${ws});`,
    `DELETE FROM blog_article_block WHERE article_id IN (SELECT id FROM articles WHERE workspace_id = ${ws});`,
    `DELETE FROM articles WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_tag WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_layout_slot WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_layout_band WHERE workspace_id = ${ws};`,
    `DELETE FROM blog_delivery_part WHERE workspace_id = ${ws};`,
    `DELETE FROM site_network_node WHERE workspace_id = ${ws};`,
    `DELETE FROM legal_page WHERE site_slug IN (${hub}, ${sub});`,
  );

  // 入口（作業場所・担当者・認証基盤の人）。担当の行が無いと通行証が出ない。
  out.push(
    `INSERT INTO workspaces (id, name, plan, owner_user_id, timezone, currency, created_at)
       VALUES (${ws}, ${q("ローカル検証")}, 'solo', ${q(SEED_USER_ID)}, 'Asia/Tokyo', 'JPY', ${nowSeconds})
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, owner_user_id = excluded.owner_user_id;`,
    `INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at)
       VALUES (${q(SEED_USER_ID)}, ${q(SEED_USER_NAME)}, ${q(SEED_USER_EMAIL)}, 1, NULL, ${nowSeconds * 1000}, ${nowSeconds * 1000})
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, name = excluded.name;`,
    `INSERT INTO memberships (id, workspace_id, user_id, invited_email, roles, scoped_brand_ids, display_name, invited_at, accepted_at, revoked_at)
       VALUES (${q("mb_seed_owner")}, ${ws}, ${q(SEED_USER_ID)}, ${q(SEED_USER_EMAIL)}, ${q('["owner"]')}, ${q("[]")}, ${q(SEED_USER_NAME)}, ${nowSeconds}, ${nowSeconds}, NULL)
       ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, roles = excluded.roles, revoked_at = NULL;`,
  );

  // サイト網。値は `seedNetwork()` が持つ。ここは形を SQL に移すだけ。
  for (const node of seedNetwork()) {
    out.push(
      `INSERT INTO site_network_node (id, workspace_id, site_slug, role, parent_slug, name, one_line, position, status, created_at, updated_at)
         VALUES (${q(node.id)}, ${ws}, ${q(node.siteSlug)}, ${q(node.role)}, ${node.parentSlug === null ? "NULL" : q(node.parentSlug)}, ${q(node.name)}, ${q(node.oneLine)}, ${node.position}, ${q(node.status)}, ${nowSeconds}, ${nowSeconds});`,
    );
  }

  /*
   * 版面は**中心と子の両方に敷く。**
   *
   * 2026-08-28 まで、枠・帯・配り口は中心のブログにしか入っていなかった。
   * 子の `/s/gear-for-small-kitchen` を開くと枠が 1 つも無い画面が出るが、
   * それが「子には設計図を持たせない仕様」なのか「行を入れ忘れただけ」なのかは
   * **画面から区別できない**。両方に敷けば、子で欠けているものはその場で実装の話になる。
   *
   * 領域は `LAYOUT_REGIONS` の 4 つ全部。1 領域でも抜くと、その領域の枠が
   * 「出ない」側に固定され、描けているかを一度も確かめられなくなる。
   */
  for (const siteKey of SEED_SITE_KEYS) {
    for (const slot of seedLayoutSlots(siteKey)) {
      out.push(
        `INSERT INTO blog_layout_slot (id, workspace_id, site_slug, region, slot_key, title, body, position, enabled)
           VALUES (${q(slot.id)}, ${ws}, ${q(slot.siteSlug)}, ${q(slot.region)}, ${q(slot.slotKey)}, ${q(slot.title)}, ${q(slot.body)}, ${slot.position}, ${slot.enabled ? 1 : 0});`,
      );
    }
    for (const band of seedLayoutBands(siteKey)) {
      out.push(
        `INSERT INTO blog_layout_band (id, workspace_id, site_slug, band, title, enabled, position, item_limit)
           VALUES (${q(band.id)}, ${ws}, ${q(band.siteSlug)}, ${q(band.band)}, ${q(band.title)}, ${band.enabled ? 1 : 0}, ${band.position}, ${band.itemLimit});`,
      );
    }
    for (const part of seedDeliveryParts(siteKey)) {
      out.push(
        `INSERT INTO blog_delivery_part (id, workspace_id, site_slug, part, enabled, note, position)
           VALUES (${q(part.id)}, ${ws}, ${q(part.siteSlug)}, ${q(part.part)}, ${part.enabled ? 1 : 0}, ${q(part.note)}, ${part.position});`,
      );
    }
  }

  for (const tag of seedTags()) {
    out.push(
      `INSERT INTO blog_tag (id, workspace_id, site_slug, slug, name, description, kind)
         VALUES (${q(tag.id)}, ${ws}, ${q(tag.siteSlug)}, ${q(tag.slug)}, ${q(tag.name)}, ${q(tag.description)}, ${q(tag.kind)});`,
    );
  }

  SEED_ARTICLES.forEach((article, articleIndex) => {
    const at = seconds(article.daysAgo, nowSeconds);
    const record = seedArticleRecord(article, new Date(nowSeconds * 1000));
    const publishedAt = record.publishedAt === null ? "NULL" : String(at);
    out.push(
      `INSERT INTO articles (id, workspace_id, site_slug, slug, article_template, type, title, lead, status, author_name, published_at, created_at, updated_at)
         VALUES (${q(record.id)}, ${ws}, ${q(record.siteSlug)}, ${q(record.slug)}, ${q(record.template)}, ${q(ARTICLE_TYPE_BY_TEMPLATE[record.template])}, ${q(record.title)}, ${q(record.lead)}, ${q(record.status)}, ${q(record.authorName)}, ${publishedAt}, ${at}, ${at});`,
    );

    for (const block of seedArticleBlocks(article)) {
      out.push(
        `INSERT INTO blog_article_block (id, article_id, kind, heading, body, position)
           VALUES (${q(block.id)}, ${q(article.id)}, ${q(block.kind)}, ${q(block.heading)}, ${q(block.body)}, ${block.position});`,
      );
    }

    /*
     * タグ。**書かなければ順番で 1 つ**、空配列なら 1 つも付けない。
     *
     * 子のブログの記事には付けない。タグは中心のブログに属しているので、
     * 子の記事に付けると、絞り込みが別のブログの札を拾う形になる。
     */
    const tagIds =
      article.tagIds ??
      (article.site === "sub" ? [] : [TAGS[articleIndex % TAGS.length].id]);
    for (const tagId of tagIds) {
      out.push(
        `INSERT INTO blog_article_tag (article_id, tag_id) VALUES (${q(article.id)}, ${q(tagId)});`,
      );
    }

    article.ratings.forEach((score, index) => {
      out.push(
        `INSERT INTO blog_article_rating (id, article_id, reader_key, score, comment, created_at)
           VALUES (${q(`br_${article.id}_${index}`)}, ${q(article.id)}, ${q(`reader_seed_${index}`)}, ${score}, NULL, ${at});`,
      );
    });
  });

  // 固定ページも両方のブログに。子だけ法務の入口が無い状態は、そのままだと審査で落ちる。
  for (const siteKey of SEED_SITE_KEYS) {
    for (const page of seedFixedPages(siteKey, new Date(nowSeconds * 1000))) {
      out.push(
        `INSERT INTO legal_page (id, site_slug, kind, title, body, status, deleted_at, updated_at)
           VALUES (${q(page.id)}, ${q(page.siteSlug)}, ${q(page.kind)}, ${q(page.title)}, ${q(page.body)}, ${q(page.status)}, ${page.deletedAt === null ? "NULL" : String(Math.floor(page.deletedAt.getTime() / 1000))}, ${nowSeconds});`,
      );
    }
  }

  return out;
}
