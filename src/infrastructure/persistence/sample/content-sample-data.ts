import {
  type ArticleSummary,
  type PublishedArticle,
  type PublishedPerson,
  toSummary,
} from "@/application/read-models/published-article";
import type { SiteDocumentKey } from "@/domain/authoring";
import { registerStub } from "../../stub-registry";
import {
  FIFTH_SITE_SLUG,
  FOURTH_SITE_SLUG,
  SAMPLE_SITE_SLUG,
  SECOND_SITE_SLUG,
  THIRD_SITE_SLUG,
} from "./site-sample-repository";
import { sampleProductName } from "./sample-identity";

/**
 * ★ これは仮置きの見本記事です（スタブ）。★
 *
 * 記事は本来、生成 → 事実確認 → 承認 → 公開 を通って保存される。
 * その保存先ができるまで、画面の経路を通すためにここで固定値を返す。
 *
 * **参考記事の本文は 1 文も複製していない。** 参照したのは記事の並び
 * （結論 → 評価方法 → 順位 → 個別 → 選び方）だけで、その並びは
 * 仕様書 (ブログ層 §9.1) と一致するため、正本は仕様書側とする。
 *
 * --- ここに置いてある記事が「何のための見本」か ---
 *
 * 表示が分かれる条件を、**すべて 1 回以上出す**ように選んである。
 * 運営する人が「この入力だと画面はこう出る」を実物で確かめるための台本である。
 *
 *   記事タイプ        ranking / review / comparison / guide
 *                     （`tool` は入れていない。理由は下の「tool 型について」）
 *   言い切りの種類    fact / inference / opinion
 *   根拠              出典リンクあり / 出典名のみ / 期限切れ（expired）
 *   商品カード        実測値 / 推測値 / 未計測（null）/ 提携なし（理由つき）
 *   買う導線          転送の合言葉あり / ASP の URL のみ / 出さない
 *   順位表            除外あり / 除外なし、レビューへ落とせる商品と落とせない商品
 *   比較表            単位つき数値列 / 文字列列 / セルが埋まっていない行
 *   会話ブロック      読者・書き手・専門家・案内役の 4 話者
 *   監修者            あり / なし
 *   広告表記          必要 / 不要（広告モデルのブログ）
 *   訂正履歴          2 件 / 1 件 / 0 件（空のときの見え方）
 *   書き手の経歴      複数あり / 空（「無い」ことを隠さない表示）
 *
 * --- tool 型について ---
 *
 * `articleHref()` は `tool` 型記事を `/tools/<名前>` へ送るが、その道は
 * **記事ではなく読者の道具（診断・計算）を描く**。つまり今の実装では
 * tool 型の記事は記事として表示されない。見本に入れると
 * 「入れたのに出ない」を仕様と誤解させるので入れていない。
 * 道具そのものの見え方は `reader-interaction-sample.ts` の定義で確かめる。
 *
 * 見本記事はすべて `stub` 欄を持ち、画面に「見本」と表示される。
 * 中身の無いものを本物に見せない。
 */
export const CONTENT_SAMPLE_STUB = registerStub({
  id: "persistence:content-sample",
  port: "PublishedContentPort",
  label: "公開記事の保存先（見本データ）",
  // published_articles は D1 に作った（drizzle/0011）。保存先がつながっている場合、
  // ここは**見本を重ねる側**として残るだけで、出した記事はちゃんと残る。
  // ここが前に出るのは、保存先が結びついていない実行（`pnpm dev` の既定）だけ。
  blockedBy: "保存先（D1）が結びついていない実行での代わり。結びつければ出した記事はそのまま残る",
});

const STUB_MARK = { label: "見本の記事", blockedBy: CONTENT_SAMPLE_STUB.blockedBy } as const;

// ---------------------------------------------------------------------------
// 書き手と監修者
//
// 経歴が空の人（HAYASE）をわざと 1 人置いている。**空欄を隠さない**表示を
// 確かめるため。ここを埋めてしまうと、経歴の無い書き手が来たときに
// 画面がどうなるかを誰も知らないまま公開することになる。
// ---------------------------------------------------------------------------

const MOCHIZUKI: PublishedPerson = {
  slug: "mochizuki",
  name: "望月 かおる",
  bio: "在宅勤務の作業環境を 6 年ぶん記録してきました。腰痛で 2 度離職しています。",
  credentials: ["福祉用具専門相談員", "自社検証環境で年間 40 脚を計測"],
};

const SAKUMA: PublishedPerson = {
  slug: "sakuma",
  name: "佐久間 りく",
  bio: "理学療法士。着座姿勢と腰部負担の関係を確認しています。",
  credentials: ["理学療法士（国家資格）", "整形外科での臨床 9 年"],
};

const KUDO: PublishedPerson = {
  slug: "kudo",
  name: "工藤 なぎさ",
  bio: "家電の設置寸法を測り続けている書き手。狭い台所での置き場所を専門にしています。",
  credentials: ["住宅設備の販売職 6 年"],
};

/** 経歴が 1 つも無い書き手。空配列のときの見え方を確かめるために置いている。 */
const HAYASE: PublishedPerson = {
  slug: "hayase",
  name: "早瀬 ひかり",
  bio: "カメラを買って 2 年目です。分からなかったところを、分からなかった順に書いています。",
  credentials: [],
};

const ARAI: PublishedPerson = {
  slug: "arai",
  name: "新井 とおる",
  bio: "写真機材の専門家。作例の撮影条件と説明の正しさを確認しています。",
  credentials: ["光学機器メーカーでの設計職 12 年"],
};

const AZUMA: PublishedPerson = {
  slug: "azuma",
  name: "東 亮太",
  bio: "市民ランナー。月 150km を 8 年続けています。故障は 3 回。",
  credentials: ["フルマラソン 2 時間 58 分", "ランニング講座の講師 4 年"],
};

const YAMAGIWA: PublishedPerson = {
  slug: "yamagiwa",
  name: "山際 えみ",
  bio: "スポーツ医学の専門家。計測方法と、故障との関係の記述を確認しています。",
  credentials: ["スポーツ医学の研究職", "実業団チームでの帯同 5 年"],
};

const MIKAMI: PublishedPerson = {
  slug: "mikami",
  name: "三上 ゆい",
  bio: "通信料金の相談を受けてきました。契約書の細かい条件を読むのが仕事です。",
  credentials: ["携帯電話販売店での接客 7 年", "総務省の料金比較資料を毎月確認"],
};

// ---------------------------------------------------------------------------
// 1 本目のブログ「在宅ワークの机まわり」の記事（6 本）
// ---------------------------------------------------------------------------

/**
 * 全部入りの順位記事。
 *
 * 順位表・商品カード・会話ブロック・監修者・除外理由を 1 本に載せてある。
 * **1 本で全部見える記事を 1 つ置く**のは、部品どうしの間隔や見出しの重なりが
 * 積み上がったときに崩れないかを確かめられるようにするため。
 */
const CHAIR_RANKING: PublishedArticle = {
  slug: "chairs-for-long-hours",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "ranking",
  title: "8 時間座る人のための椅子の順位",
  summary: "同じ人が同じ姿勢で 8 時間座り、腰まわりの圧力を測って並べました。",
  categorySlug: "chairs",
  publishedAt: "2026-07-25",
  updatedAt: "2026-08-20",
  author: MOCHIZUKI,
  reviewedBy: SAKUMA,
  disclosureRequired: true,
  sections: [
    {
      id: "conclusion",
      heading: "結論",
      paragraphs: [
        "腰の負担を最優先にするなら ErgoOne Pro です。体重 55kg 未満の方は座面が沈みきらないため、FlexSeat 2 を選んでください。",
        "予算を 5 万円以内に抑えるなら、順位 3 位の DeskChair Air でも 8 時間は座れます。ただし肘掛けの高さが変えられません。",
      ],
      claims: [
        {
          id: "c1",
          statement: "ErgoOne Pro は 8 時間着座後の腰部圧力が最も低く、平均 38kPa でした。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "自社検証（2026-07-12、被験者 1 名・8 時間連続着座）",
              checkedAt: "2026-07-12",
            },
          ],
        },
        {
          id: "c2",
          statement:
            "この差は、毎日 8 時間座る人であれば 2 週間ほどで体感できると考えられます。",
          kind: "inference",
          evidence: [],
        },
        {
          id: "c3",
          statement: "座り心地の好みは体格で大きく変わるので、可能なら店頭で座ってから決めてほしいです。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
    {
      id: "methodology",
      heading: "どうやって比べたか",
      paragraphs: [
        "同一の被験者が、同じ机・同じ画面の高さで各機種に 8 時間ずつ座り、座面に敷いた圧力センサーで 10 分ごとに記録しました。室温は 24℃ に揃えています。",
        "座面の沈み込み量は、着座前と着座 4 時間後の高さの差で測っています。",
      ],
      claims: [
        {
          id: "c4",
          statement: "測定に使った圧力センサーは、測定前に基準分銅で校正しています。",
          kind: "fact",
          evidence: [
            {
              id: "e2",
              sourceLabel: "校正記録（2026-07-01）",
              url: "https://example.com/lab/calibration-2026-07",
              checkedAt: "2026-07-01",
            },
          ],
        },
      ],
    },
    {
      id: "how-to-choose",
      heading: "選び方",
      paragraphs: [
        "腰の負担・肘掛けの調整範囲・座面の広さの 3 つで、どれを諦めるかを先に決めると絞り込めます。3 つとも満たす椅子は 10 万円を超えます。",
      ],
    },
  ],
  // 4 話者すべてを 1 本に出す。案内役（assistant）が出る記事はここだけ。
  conversation: [
    { speaker: "reader", text: "腰が痛くならない椅子を教えてください。予算は 8 万円くらいです。" },
    {
      speaker: "writer",
      text: "8 万円なら 1 位か 2 位が入ります。体重が軽い方は 2 位のほうが合いますよ。",
    },
    {
      speaker: "expert",
      text: "圧力が低いことと痛みが出ないことは別です。1 時間に 1 度は立ってください。",
    },
    {
      speaker: "assistant",
      text: "体重と身長を入れていただければ、この記事の中から候補を 2 つに絞れます。",
    },
  ],
  // 3 脚とも同じ 4 項目で並べる。測っていないものは値を伏せて「未計測」と出す
  // （空欄にすると「無い」のか「測っていない」のか読者に伝わらない）。
  productCards: [
    {
      productId: "p_alpha_15",
      name: sampleProductName("p_alpha_15"),
      brand: "ErgoOne",
      oneLine: "腰の負担が最も小さい。肘掛けは 4 方向に動く。",
      specs: [
        { label: "8時間後の腰部圧力", value: "38kPa", kind: "fact" },
        { label: "座面の沈み込み", value: "12mm", kind: "fact" },
        { label: "肘掛けの調整", value: "上下・前後・左右・角度", kind: "fact" },
        { label: "座面の奥行き調整", value: "約50mm", kind: "inference" },
        // 1 位の商品にも測れていない項目を残す。**全部埋まっている商品しか無いと、
        // 「未計測」の見え方を誰も確かめられないまま公開することになる。**
        { label: "5万回加圧後の沈み込み変化", value: null, kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      // 転送の合言葉つき。読者は /go/<合言葉> を通る（画面の JavaScript が止まっていても数えられる）。
      trackingCode: "ergo1pro",
      affiliateUrl: "https://example.com/click?aid=sample&pid=ergoonepro",
      reviewSlug: "ergo-one-pro",
    },
    {
      productId: "p_beta_14",
      name: sampleProductName("p_beta_14"),
      brand: "FlexSeat",
      oneLine: "体重が軽くても沈む座面。小柄な人向け。",
      specs: [
        { label: "8時間後の腰部圧力", value: "44kPa", kind: "fact" },
        { label: "座面の沈み込み", value: "19mm", kind: "fact" },
        { label: "肘掛けの調整", value: "上下・前後", kind: "fact" },
        { label: "座面の奥行き調整", value: null, kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      // 合言葉なし・ASP の URL のみ。転送を通らない経路の見え方を確かめる。
      affiliateUrl: "https://example.com/click?aid=sample&pid=flexseat2",
      reviewSlug: "flexseat-2",
    },
    {
      productId: "p_gamma_16",
      name: sampleProductName("p_gamma_16"),
      brand: "DeskChair",
      oneLine: "5 万円を切る。肘掛けの高さは固定。",
      specs: [
        { label: "8時間後の腰部圧力", value: "52kPa", kind: "fact" },
        { label: "座面の沈み込み", value: null, kind: "fact" },
        { label: "肘掛けの調整", value: "なし（固定）", kind: "fact" },
        { label: "座面の奥行き調整", value: null, kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      // 提携していないので買う導線は出さない。理由を出して、貼り忘れと区別する。
      blockedReason: "この商品は、いま提携している販売先がありません。",
    },
  ],
  ranking: {
    caption: "8 時間座る人のためのオフィスチェアの順位",
    updatedAt: "2026-08-20",
    criteria: [
      {
        key: "lumbar_load",
        label: "腰への負担",
        weight: 0.4,
        measurement: "8 時間連続着座後の腰部圧力を 10 分ごとに記録し、平均で比較",
      },
      {
        key: "adjustability",
        label: "調整範囲",
        weight: 0.2,
        measurement: "座面高・座面奥行き・肘掛け・背もたれ角の可動域を実測",
      },
      {
        key: "durability",
        label: "耐久",
        weight: 0.15,
        measurement: "座面へ 80kg を 5 万回加えたあとの沈み込み量の変化",
      },
      {
        key: "support",
        label: "保証",
        weight: 0.1,
        measurement: "保証期間と、部品単位で交換できるかを確認",
      },
      {
        key: "price_value",
        label: "価格性能比",
        weight: 0.15,
        measurement: "計測した性能を実売価格で割った値を正規化",
      },
    ],
    entries: [
      {
        productId: "p_alpha_15",
        rank: 1,
        productName: sampleProductName("p_alpha_15"),
        totalScore: 81,
        criterionScores: [94, 88, 76, 70, 52],
        trackingCode: "ergo1pro",
        affiliateUrl: "https://example.com/click?aid=sample&pid=ergoonepro",
        reviewSlug: "ergo-one-pro",
        oneLine: "腰の負担が最も小さい。肘掛けは 4 方向に動く。",
      },
      {
        productId: "p_beta_14",
        rank: 2,
        productName: sampleProductName("p_beta_14"),
        totalScore: 74,
        criterionScores: [80, 68, 72, 75, 71],
        affiliateUrl: "https://example.com/click?aid=sample&pid=flexseat2",
        reviewSlug: "flexseat-2",
        oneLine: "体重が軽くても沈む座面。小柄な人向け。",
      },
      {
        // レビュー記事も買う導線も無い商品。商品名がリンクにならない見え方を確かめる。
        productId: "p_gamma_16",
        rank: 3,
        productName: sampleProductName("p_gamma_16"),
        totalScore: 63,
        criterionScores: [61, 40, 70, 55, 92],
        oneLine: "5 万円を切る。肘掛けの高さは固定。",
      },
    ],
    excluded: [
      {
        productId: "p_delta_13",
        productName: sampleProductName("p_delta_13"),
        reason: "背もたれが無く、8 時間の連続着座を前提にできないため",
      },
      {
        productId: "p_gamingx",
        productName: "GamingX Racer",
        reason: "座面の左右のせり上がりが大きく、被験者の体格で測定条件を揃えられなかったため",
      },
    ],
  },
  stub: STUB_MARK,
};

/** 短い個別レビュー。言い切りの種類（fact / opinion）と出典リンクの見え方。 */
const CHAIR_REVIEW_ERGO: PublishedArticle = {
  slug: "ergo-one-pro",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "review",
  title: "ErgoOne Pro を 3 か月使った記録",
  summary: "腰は楽になりました。ただし部屋が狭いと後ろに下がれません。",
  categorySlug: "chairs",
  publishedAt: "2026-05-18",
  updatedAt: "2026-08-11",
  author: MOCHIZUKI,
  reviewedBy: SAKUMA,
  disclosureRequired: true,
  sections: [
    {
      id: "summary",
      heading: "3 行でいうと",
      paragraphs: ["腰は楽。組み立ては 40 分。後ろのスペースを 70cm 空ける必要があります。"],
      claims: [
        {
          id: "c1",
          statement: "背もたれを最大まで倒すと、壁から 68cm の空間が必要でした。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "自社検証（実測、2026-05-20）",
              url: "https://example.com/lab/ergoone-clearance",
              checkedAt: "2026-05-20",
            },
          ],
        },
        {
          id: "c2",
          statement: "6 畳の部屋に置くなら、机の後ろが通路になっていない配置をおすすめします。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
    {
      id: "not-for",
      heading: "向いていない人",
      paragraphs: [
        "座ったまま頻繁に立ち座りする人。座面が深いので、浅く腰かける使い方には向きません。",
      ],
    },
  ],
  productCards: [
    {
      productId: "p_alpha_15",
      name: sampleProductName("p_alpha_15"),
      brand: "ErgoOne",
      oneLine: "腰の負担が最も小さい。肘掛けは 4 方向に動く。",
      specs: [
        { label: "8時間後の腰部圧力", value: "38kPa", kind: "fact" },
        { label: "必要な後方スペース", value: "68cm", kind: "fact" },
        { label: "組み立て時間", value: "約40分", kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      trackingCode: "ergo1pro",
      affiliateUrl: "https://example.com/click?aid=sample&pid=ergoonepro",
    },
  ],
  stub: STUB_MARK,
};

/** 監修者なしのレビュー。**同じ型でも監修欄が消えることを確かめる用。** */
const CHAIR_REVIEW_FLEX: PublishedArticle = {
  slug: "flexseat-2",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "review",
  title: "FlexSeat 2 は小柄な人に合うのか",
  summary: "体重 50kg でも座面が沈みます。肘掛けの前後調整はありません。",
  categorySlug: "chairs",
  publishedAt: "2026-06-02",
  updatedAt: "2026-07-14",
  author: MOCHIZUKI,
  disclosureRequired: true,
  sections: [
    {
      id: "summary",
      heading: "どんな椅子か",
      paragraphs: ["軽い体重でも座面が沈むので、太ももの裏が圧迫されにくい作りです。"],
      claims: [
        {
          id: "c1",
          statement: "体重 50kg の被験者で、座面の沈み込みは 19mm でした。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（2026-05-30）", checkedAt: "2026-05-30" },
          ],
        },
      ],
    },
  ],
  stub: STUB_MARK,
};

/** 比較記事。単位つき数値列・文字列列・セルが埋まっていない行を 1 枚に出す。 */
const CHAIR_COMPARISON: PublishedArticle = {
  slug: "ergo-one-vs-flexseat",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "comparison",
  title: "ErgoOne Pro と FlexSeat 2 の比較",
  summary: "腰の負担を取るか、体格の合わせやすさを取るか。数字で並べました。",
  categorySlug: "chairs",
  publishedAt: "2026-06-20",
  updatedAt: "2026-08-05",
  author: MOCHIZUKI,
  disclosureRequired: true,
  sections: [
    {
      id: "lead",
      heading: "どちらを選ぶか",
      paragraphs: [
        "体重 60kg 以上なら ErgoOne Pro、それ未満なら FlexSeat 2 です。境目の体重帯では、肘掛けの調整範囲で決めてください。",
      ],
    },
  ],
  comparison: {
    caption: "主要な計測値の比較",
    columns: [
      { key: "pressure", label: "腰部圧力", unit: "kPa", numeric: true },
      { key: "sink", label: "座面の沈み込み", unit: "mm", numeric: true },
      { key: "armrest", label: "肘掛けの調整" },
      { key: "warranty", label: "保証期間", unit: "年", numeric: true },
    ],
    rows: [
      {
        id: "p_alpha_15",
        label: sampleProductName("p_alpha_15"),
        cells: {
          pressure: { value: "38", kind: "fact", checkedAt: "2026-07-12" },
          sink: { value: "12", kind: "fact", checkedAt: "2026-07-12" },
          armrest: { value: "上下・前後・左右・角度", kind: "fact", checkedAt: "2026-07-12" },
          warranty: { value: "5", kind: "fact", checkedAt: "2026-07-12" },
        },
      },
      {
        // 保証期間のセルが無い行。**埋まっていない欄がどう出るか**を確かめる。
        id: "p_beta_14",
        label: sampleProductName("p_beta_14"),
        cells: {
          pressure: { value: "44", kind: "fact", checkedAt: "2026-07-13" },
          sink: { value: "19", kind: "fact", checkedAt: "2026-07-13" },
          armrest: { value: "上下・前後", kind: "fact", checkedAt: "2026-07-13" },
        },
      },
      {
        // 種類も確認日も付いていないセルだけの行。**印が無いときの出方**を確かめる。
        id: "p_gamma_16",
        label: sampleProductName("p_gamma_16"),
        cells: {
          pressure: { value: "52" },
          sink: { value: "不明" },
          armrest: { value: "なし（固定）" },
          warranty: { value: "1" },
        },
      },
    ],
  },
  stub: STUB_MARK,
};

/** 提携先がまったく無い記事。**買う導線が 1 つも出ない記事**の見え方。 */
const DESK_REVIEW: PublishedArticle = {
  slug: "wide-desk-w160",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "review",
  title: "幅 160cm の昇降デスクを 2 か月使う",
  summary: "揺れは天板の厚みで決まりました。脚のロックは緩みます。",
  categorySlug: "desks",
  publishedAt: "2026-07-02",
  updatedAt: "2026-07-22",
  author: MOCHIZUKI,
  disclosureRequired: true,
  sections: [
    {
      id: "shake",
      heading: "揺れるかどうか",
      paragraphs: [
        "高さを 110cm まで上げると、打鍵のたびに画面が揺れます。天板が 18mm の製品では顕著でした。",
      ],
      claims: [
        {
          id: "c1",
          statement: "高さ 110cm での天板先端の振幅は 3.2mm でした。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（変位計、2026-07-08）", checkedAt: "2026-07-08" },
          ],
        },
      ],
    },
  ],
  productCards: [
    {
      productId: "p_liftdesk_160",
      name: "LiftDesk 160",
      brand: "LiftDesk",
      oneLine: "天板 160cm。昇降は電動。",
      specs: [
        { label: "天板の厚み", value: "18mm", kind: "fact" },
        { label: "高さ110cmでの振幅", value: "3.2mm", kind: "fact" },
        { label: "耐荷重", value: null, kind: "fact" },
      ],
      blockedReason: "この販売元とは提携の申請中です。承認され次第、購入先を掲載します。",
    },
  ],
  stub: STUB_MARK,
};

/** 手引き。**期限切れの根拠**を含む記事（`expired: true` の見え方）。 */
const LIGHTING_GUIDE: PublishedArticle = {
  slug: "choosing-desk-lighting",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "guide",
  title: "画面に映り込まない手元照明の選び方",
  summary: "明るさより、光の来る向きです。机の右奥から当てると映り込みません。",
  categorySlug: "lighting",
  publishedAt: "2026-04-14",
  updatedAt: "2026-08-18",
  author: MOCHIZUKI,
  disclosureRequired: true,
  sections: [
    {
      id: "direction",
      heading: "向きを先に決める",
      paragraphs: [
        "画面の正面から当てる照明は、どれだけ高価でも映り込みます。右利きなら右奥、左利きなら左奥から当ててください。",
      ],
      claims: [
        {
          id: "c1",
          statement: "作業面の推奨照度は 500 ルクス以上とされています。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "照明の推奨照度に関する公開規格（2019 年版）",
              url: "https://example.com/standards/illuminance-2019",
              checkedAt: "2025-09-01",
              // 確認から 1 年近く経っている根拠。**古い根拠が古いと分かる**表示を確かめる。
              expired: true,
            },
          ],
        },
        {
          id: "c2",
          statement:
            "映り込みの多くは照明の位置で解決するため、演色性の高い製品へ買い替える必要はないと考えられます。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
    {
      id: "checklist",
      heading: "買う前に測るもの",
      paragraphs: ["机の奥行き、画面の高さ、部屋の主照明の位置。この 3 つだけで決まります。"],
    },
  ],
  stub: STUB_MARK,
};

/*
  道具（`/tools/storage-estimator`）の説明記事。

  **`reader-interaction-sample.ts` の道具と slug を合わせてある。** 合わせるのは
  見た目の都合ではない。`/tools/{slug}` という 1 つの住所に、道具の定義と
  `tool` 型の記事が同居する決まりだからで、揃っていないと片方だけが読者に届く。

  この記事があることで、道具のページに出典・書いた人・更新履歴が付く。
  数字だけを出して解釈も根拠も示さない画面は、読者がそれを信じて物を買う場所になる。

  書き手と分類は**このブログに実在するものへ結び直してある**（2026-08-30 の統合）。
  道具そのものは `TOOLS_BY_SITE` に載らない別枠なので撮影の話のままでよいが、
  記事は分類ページとパンくずに載る。存在しない `storage` を指したままだと、
  道具のページは緑のまま分類ページ側だけが空になる。
*/
const STORAGE_ESTIMATOR_ARTICLE: PublishedArticle = {
  slug: "storage-estimator",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "tool",
  title: "必要な保存容量の目安を出す",
  summary: "撮影する時間と記録レートから、素材を置いておくのに要る大きさを計算します。",
  categorySlug: "desks",
  publishedAt: "2026-07-02",
  updatedAt: "2026-07-28",
  author: MOCHIZUKI,
  disclosureRequired: false,
  sections: [
    {
      id: "outcome_state",
      heading: "このツールでできること",
      paragraphs: [
        "1 か月に撮る時間・カメラの記録レート・手元に残す期間の 3 つを入れると、素材だけで何ギガバイト要るかが出ます。",
        "買う前に「足りるかどうか」を数字で確かめるためのものです。",
      ],
      claims: [],
    },
    {
      id: "how_to_choose",
      heading: "計算・判定の根拠",
      paragraphs: [
        "記録レートは 1 秒あたりのメガビットなので、8 で割るとメガバイトになります。さらに 1000 で割ってギガバイトにし、撮影の分数と残す期間を掛けています。",
        "段を分けて出しているのは、どこで桁が大きくなったかを追えるようにするためです。",
      ],
      claims: [
        {
          id: "c1",
          statement: "編集中の一時ファイルと書き出し先は、この計算に含まれていません。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 2 本目のブログ「せまい台所の道具」の記事（4 本）
// ---------------------------------------------------------------------------

const RICE_COOKER_COMPARISON: PublishedArticle = {
  slug: "rice-cookers-for-60cm",
  siteSlug: SECOND_SITE_SLUG,
  type: "comparison",
  title: "幅 60cm の調理台に置ける炊飯器",
  summary: "蒸気の逃げ道を含めた占有面積で比べました。",
  categorySlug: "rice-cookers",
  publishedAt: "2026-07-10",
  updatedAt: "2026-08-22",
  author: KUDO,
  disclosureRequired: true,
  sections: [
    {
      id: "lead",
      heading: "先に測ってください",
      paragraphs: ["本体寸法だけでは置けません。上方向に 10cm 以上の空間が要ります。"],
      claims: [
        {
          id: "c1",
          statement: "各社の説明書は上方向に 10cm 以上の空間を求めています。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "各社の取扱説明書（設置条件の項）",
              checkedAt: "2026-07-05",
            },
          ],
        },
      ],
    },
  ],
  comparison: {
    caption: "占有面積の比較",
    columns: [
      { key: "width", label: "幅", unit: "cm", numeric: true },
      { key: "depth", label: "奥行き", unit: "cm", numeric: true },
      { key: "clearance", label: "必要な上部空間", unit: "cm", numeric: true },
      { key: "steam", label: "蒸気の逃げ方" },
    ],
    rows: [
      {
        id: "rc_a",
        label: "小型炊飯器 A",
        cells: {
          width: { value: "22.5", kind: "fact", checkedAt: "2026-07-05" },
          depth: { value: "28.0", kind: "fact", checkedAt: "2026-07-05" },
          clearance: { value: "10", kind: "fact", checkedAt: "2026-07-05" },
          steam: { value: "上方向", kind: "fact", checkedAt: "2026-07-05" },
        },
      },
      {
        id: "rc_b",
        label: "小型炊飯器 B",
        cells: {
          width: { value: "25.0", kind: "fact", checkedAt: "2026-07-06" },
          depth: { value: "31.5", kind: "fact", checkedAt: "2026-07-06" },
          steam: { value: "後方", kind: "inference", checkedAt: "2026-07-06" },
        },
      },
      {
        id: "rc_c",
        label: "小型炊飯器 C",
        cells: {
          width: { value: "21.0", kind: "fact", checkedAt: "2026-08-20" },
          depth: { value: "26.5", kind: "fact", checkedAt: "2026-08-20" },
          clearance: { value: "15", kind: "fact", checkedAt: "2026-08-20" },
          steam: { value: "上方向（水蒸気の量が多い）", kind: "fact", checkedAt: "2026-08-20" },
        },
      },
    ],
  },
  stub: STUB_MARK,
};

/** **除外が 1 つも無い順位表。** 除外の節が消えることを確かめる用。 */
const OVEN_RANKING: PublishedArticle = {
  slug: "compact-ovens-ranking",
  siteSlug: SECOND_SITE_SLUG,
  type: "ranking",
  title: "占有面積で選ぶ小型オーブンの順位",
  summary: "壁からの離隔を含めた設置面積の小ささで並べました。",
  categorySlug: "ovens",
  publishedAt: "2026-06-28",
  updatedAt: "2026-08-14",
  author: KUDO,
  disclosureRequired: true,
  sections: [
    {
      id: "conclusion",
      heading: "結論",
      paragraphs: [
        "調理台の幅が 60cm しかないなら CompactOven X です。奥行きに余裕があるなら、庫内の広い ToastPro 2 を選べます。",
      ],
      claims: [
        {
          id: "c1",
          statement: "CompactOven X の必要離隔を含めた設置面積は 0.11 平方メートルでした。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（実測、2026-06-20）", checkedAt: "2026-06-20" },
          ],
        },
      ],
    },
  ],
  ranking: {
    caption: "小型オーブンの順位（設置面積を主に評価）",
    updatedAt: "2026-08-14",
    criteria: [
      {
        key: "footprint",
        label: "設置面積",
        weight: 0.6,
        measurement: "本体寸法に、説明書が求める離隔を加えた面積を実測",
      },
      {
        key: "capacity",
        label: "庫内の広さ",
        weight: 0.25,
        measurement: "食パンを並べられる枚数と、天板の実寸で比較",
      },
      {
        key: "price_value",
        label: "価格性能比",
        weight: 0.15,
        measurement: "庫内容量を実売価格で割った値を正規化",
      },
    ],
    entries: [
      {
        productId: "p_compact_oven_x",
        rank: 1,
        productName: "CompactOven X",
        totalScore: 84,
        criterionScores: [96, 62, 78],
        affiliateUrl: "https://example.com/click?aid=sample&pid=compactovenx",
        reviewSlug: "compact-oven-x",
        oneLine: "設置面積が最も小さい。庫内は食パン 2 枚ぶん。",
      },
      {
        productId: "p_toast_pro_2",
        rank: 2,
        productName: "ToastPro 2",
        totalScore: 71,
        criterionScores: [58, 90, 70],
        affiliateUrl: "https://example.com/click?aid=sample&pid=toastpro2",
        oneLine: "庫内が広い。奥行きは 36cm 必要。",
      },
    ],
    // 除外なし。ここが空の順位表を 1 つ置いておく。
    excluded: [],
  },
  stub: STUB_MARK,
};

/** 監修者なし・会話ブロック 2 話者だけの記事。 */
const OVEN_REVIEW: PublishedArticle = {
  slug: "compact-oven-x",
  siteSlug: SECOND_SITE_SLUG,
  type: "review",
  title: "CompactOven X を狭い台所で 1 か月使う",
  summary: "壁から 5cm 離せば置けます。扉の開く向きに注意が要ります。",
  categorySlug: "ovens",
  publishedAt: "2026-07-12",
  updatedAt: "2026-07-29",
  author: KUDO,
  disclosureRequired: true,
  sections: [
    {
      id: "place",
      heading: "置けるか",
      paragraphs: ["幅 60cm の調理台なら、隣に 20cm の作業スペースが残ります。"],
      claims: [
        {
          id: "c1",
          statement: "扉は右開きで、開ききるまでに前方 32cm を使います。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（実測、2026-07-15）", checkedAt: "2026-07-15" },
          ],
        },
      ],
    },
  ],
  conversation: [
    { speaker: "reader", text: "扉の向きは変えられますか。左に壁があるので気になっています。" },
    { speaker: "writer", text: "変えられません。左に壁があるなら、前方に 32cm 空けて置いてください。" },
  ],
  stub: STUB_MARK,
};

/** 根拠が事実だけの短い手引き。 */
const KITCHEN_GUIDE: PublishedArticle = {
  slug: "how-to-measure-kitchen",
  siteSlug: SECOND_SITE_SLUG,
  type: "guide",
  title: "買う前に測る 4 か所",
  summary: "調理台の幅・奥行き・上部の空間・コンセントの位置。この 4 つです。",
  categorySlug: "rice-cookers",
  publishedAt: "2026-05-08",
  updatedAt: "2026-06-30",
  author: KUDO,
  disclosureRequired: false,
  sections: [
    {
      id: "measure",
      heading: "どこを測るか",
      paragraphs: [
        "調理台の幅と奥行きに加えて、吊り戸棚の下端までの高さを測ってください。蒸気の逃げ道がここで決まります。",
        "コンセントの位置は、機器を置く場所から 1m 以内かどうかだけ確認すれば十分です。",
      ],
      claims: [
        {
          id: "c1",
          statement: "延長コードでの接続は、多くの取扱説明書が禁止しています。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "各社の取扱説明書（安全上のご注意）",
              checkedAt: "2026-05-02",
            },
          ],
        },
      ],
    },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 3 本目のブログ「はじめてのカメラ」の記事（4 本）
// ---------------------------------------------------------------------------

/** 経歴が空の書き手＋監修者つき。**書き手の欄が空でも監修は出る**ことを見る。 */
const CAMERA_TERMS: PublishedArticle = {
  slug: "camera-terms-first",
  siteSlug: THIRD_SITE_SLUG,
  type: "guide",
  title: "最初に覚える言葉は 3 つだけ",
  summary: "絞り・シャッター速度・ISO。この 3 つの関係だけ分かれば撮れます。",
  categorySlug: "bodies",
  publishedAt: "2026-03-11",
  updatedAt: "2026-08-09",
  author: HAYASE,
  reviewedBy: ARAI,
  disclosureRequired: false,
  sections: [
    {
      id: "three",
      heading: "3 つの言葉",
      paragraphs: [
        "明るさは 3 つの設定で決まります。どれか 1 つを変えたら、残りのどれかが逆に動く、という関係です。",
        "最初のうちは絞りだけを触り、残りはカメラに任せてかまいません。",
      ],
      claims: [
        {
          id: "c1",
          statement: "絞りを 1 段開けると、取り込む光の量は約 2 倍になります。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "写真の露出に関する基礎資料",
              url: "https://example.com/photo/exposure-basics",
              checkedAt: "2026-03-05",
            },
          ],
        },
        {
          id: "c2",
          statement: "初心者の失敗写真は、大半が手ぶれかピント外れだと思います。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
    {
      id: "next",
      heading: "次に読むもの",
      paragraphs: ["撮りたいものが決まっている方は、本体の比較記事へ進んでください。"],
    },
  ],
  conversation: [
    { speaker: "reader", text: "設定が多すぎて、どこから触ればいいのか分かりません。" },
    { speaker: "writer", text: "絞りだけです。残りは自動のままで、半年は困りませんでした。" },
    { speaker: "expert", text: "自動でも記録は残ります。あとから設定値を見返すと理解が早まります。" },
  ],
  stub: STUB_MARK,
};

const CAMERA_COMPARISON: PublishedArticle = {
  slug: "entry-mirrorless-compare",
  siteSlug: THIRD_SITE_SLUG,
  type: "comparison",
  title: "入門用ミラーレス 3 台の比較",
  summary: "初期設定のまま未経験者が撮って、使える写真が何枚残ったかで比べました。",
  categorySlug: "bodies",
  publishedAt: "2026-04-20",
  updatedAt: "2026-08-16",
  author: HAYASE,
  reviewedBy: ARAI,
  disclosureRequired: true,
  sections: [
    {
      id: "lead",
      heading: "どれを選ぶか",
      paragraphs: [
        "子どもや動物を撮るなら SnapMini 2、風景が中心なら LumiOne です。迷ったら軽いほうを選んでください。持ち出さないカメラは上達しません。",
      ],
    },
  ],
  comparison: {
    caption: "未経験者 6 人が初期設定のまま撮った結果",
    columns: [
      { key: "keeper", label: "使えた写真の割合", unit: "%", numeric: true },
      { key: "weight", label: "重さ（本体のみ）", unit: "g", numeric: true },
      { key: "viewfinder", label: "のぞき窓" },
      { key: "battery", label: "1 回の充電で撮れる枚数", unit: "枚", numeric: true },
    ],
    rows: [
      {
        id: "c_snapmini_2",
        label: "SnapMini 2",
        cells: {
          keeper: { value: "72", kind: "fact", checkedAt: "2026-04-12" },
          weight: { value: "382", kind: "fact", checkedAt: "2026-04-12" },
          viewfinder: { value: "あり（電子）", kind: "fact" },
          battery: { value: "410", kind: "inference", checkedAt: "2026-04-12" },
        },
      },
      {
        id: "c_lumione",
        label: "LumiOne",
        cells: {
          keeper: { value: "64", kind: "fact", checkedAt: "2026-04-13" },
          weight: { value: "455", kind: "fact", checkedAt: "2026-04-13" },
          viewfinder: { value: "あり（電子）", kind: "fact" },
          battery: { value: "520", kind: "fact", checkedAt: "2026-04-13" },
        },
      },
      {
        id: "c_picoshot",
        label: "PicoShot",
        cells: {
          keeper: { value: "58", kind: "fact", checkedAt: "2026-04-14" },
          weight: { value: "298", kind: "fact", checkedAt: "2026-04-14" },
          viewfinder: { value: "なし（背面画面のみ）", kind: "fact" },
        },
      },
    ],
  },
  productCards: [
    {
      productId: "c_snapmini_2",
      name: "SnapMini 2",
      brand: "SnapMini",
      oneLine: "動くものに強い。未経験者の歩留まりが最も高かった。",
      specs: [
        { label: "使えた写真の割合", value: "72%", kind: "fact" },
        { label: "重さ", value: "382g", kind: "fact" },
        { label: "手ぶれ補正", value: "本体側にあり", kind: "fact" },
      ],
      priceNote: "レンズ込みの価格です。最新の金額は販売ページでご確認ください。",
      affiliateUrl: "https://example.com/click?aid=sample&pid=snapmini2",
    },
    {
      productId: "c_picoshot",
      name: "PicoShot",
      brand: "PicoShot",
      oneLine: "最も軽い。のぞき窓が無いので晴天下では見づらい。",
      specs: [
        { label: "使えた写真の割合", value: "58%", kind: "fact" },
        { label: "重さ", value: "298g", kind: "fact" },
        { label: "手ぶれ補正", value: null, kind: "fact" },
      ],
      blockedReason: "この商品は、いま提携している販売先がありません。",
    },
  ],
  stub: STUB_MARK,
};

const LENS_GUIDE: PublishedArticle = {
  slug: "first-lens",
  siteSlug: THIRD_SITE_SLUG,
  type: "guide",
  title: "最初の 1 本をどう選ぶか",
  summary: "焦点距離は「何歩下がれるか」で決まります。部屋の広さから逆算してください。",
  categorySlug: "lenses",
  publishedAt: "2026-05-25",
  updatedAt: "2026-07-19",
  author: HAYASE,
  disclosureRequired: false,
  sections: [
    {
      id: "distance",
      heading: "下がれる距離から決める",
      paragraphs: [
        "6 畳の部屋で人を全身で撮るなら、下がれるのは 3m ほどです。この距離では 35mm 前後が使いやすくなります。",
      ],
      claims: [
        {
          id: "c1",
          statement: "同じ立ち位置なら、焦点距離が長いほど写る範囲は狭くなります。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "レンズの画角に関する基礎資料",
              url: "https://example.com/photo/focal-length",
              checkedAt: "2026-05-20",
            },
          ],
        },
        {
          id: "c2",
          statement: "最初の 1 本を交換式にしない（単焦点にする）ほうが、上達は早いと考えられます。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
  ],
  stub: STUB_MARK,
};

/** **仕様がすべて未計測の商品カード。** 何も測れていないときの見え方。 */
const LENS_REVIEW: PublishedArticle = {
  slug: "lens-35mm-review",
  siteSlug: THIRD_SITE_SLUG,
  type: "review",
  title: "35mm の単焦点を 3 週間だけ使った",
  summary: "測れていない項目が多い記事です。分かったことだけ書きます。",
  categorySlug: "lenses",
  publishedAt: "2026-08-03",
  updatedAt: "2026-08-24",
  author: HAYASE,
  disclosureRequired: true,
  sections: [
    {
      id: "note",
      heading: "測れていないこと",
      paragraphs: [
        "解像度と周辺の描写は、計測用の設備が無いため測れていません。持ち出した感触だけを書きます。",
      ],
      claims: [
        {
          id: "c1",
          statement: "3 週間で 640 枚撮り、そのうち手ぶれで捨てたのは 12 枚でした。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "撮影記録（2026-08-01〜08-21）", checkedAt: "2026-08-21" },
          ],
        },
        {
          id: "c2",
          statement: "室内で使うなら、これ 1 本で足りると思います。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
  ],
  productCards: [
    {
      productId: "l_35mm_f18",
      name: "35mm F1.8 単焦点",
      brand: "LumiOne",
      oneLine: "室内で使いやすい 1 本。数値は測れていない。",
      specs: [
        { label: "中心の解像感", value: null, kind: "fact" },
        { label: "周辺の解像感", value: null, kind: "fact" },
        { label: "最短撮影距離", value: null, kind: "fact" },
        { label: "重さ", value: null, kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      affiliateUrl: "https://example.com/click?aid=sample&pid=lens35",
    },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 4 本目のブログ「走る人の道具」の記事（4 本）
//
// 収益モデルが広告（`ad`）なので、**記事中に買う導線を置かない**。
// 順位表と商品カードから成果リンクが 1 つも出ない状態がどう見えるかを確かめる。
// 広告表記（`disclosureRequired`）も不要側に倒してある。
// ---------------------------------------------------------------------------

const SHOE_RANKING: PublishedArticle = {
  slug: "training-shoes-ranking",
  siteSlug: FOURTH_SITE_SLUG,
  type: "ranking",
  title: "練習用ランニングシューズの順位",
  summary: "同じ人が全機種で 300km 走り、着地の衝撃と反発の残り方で並べました。",
  categorySlug: "shoes",
  publishedAt: "2026-06-06",
  updatedAt: "2026-08-19",
  author: AZUMA,
  reviewedBy: YAMAGIWA,
  disclosureRequired: false,
  sections: [
    {
      id: "conclusion",
      heading: "結論",
      paragraphs: [
        "毎日の練習に 1 足だけ選ぶなら CushionRun 5 です。週 1 回のスピード練習を足すなら、2 位の PaceTrainer 3 を履き分けてください。",
      ],
      claims: [
        {
          id: "c1",
          statement: "CushionRun 5 の着地時衝撃加速度は、計測した 5 機種で最も低い 6.8G でした。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "自社検証（加速度計、舗装路 10km、2026-05-30）",
              checkedAt: "2026-05-30",
            },
          ],
        },
        {
          id: "c2",
          statement: "衝撃の小ささが、そのまま故障の少なさを意味するわけではありません。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
    {
      id: "methodology",
      heading: "どうやって比べたか",
      paragraphs: [
        "同一のランナーが、同じ舗装路の同じ区間を各機種で 300km 走り、走行前後で反発の残り方を測っています。",
      ],
    },
  ],
  ranking: {
    caption: "練習用シューズの順位",
    updatedAt: "2026-08-19",
    criteria: [
      {
        key: "impact",
        label: "着地の衝撃",
        weight: 0.45,
        measurement: "加速度計で舗装路 10km の平均衝撃加速度を計測",
      },
      {
        key: "rebound_retention",
        label: "反発の残り方",
        weight: 0.35,
        measurement: "新品時と 300km 走行後で、中底の反発率の差を計測",
      },
      {
        key: "grip",
        label: "濡れた路面での接地",
        weight: 0.2,
        measurement: "散水した舗装路での滑り出し角度を計測",
      },
    ],
    entries: [
      // 広告モデルなので `affiliateUrl` も `trackingCode` も持たせない。
      {
        productId: "s_cushionrun_5",
        rank: 1,
        productName: "CushionRun 5",
        totalScore: 86,
        criterionScores: [95, 82, 74],
        reviewSlug: "shoe-cushionrun-5",
        oneLine: "着地の衝撃が最も小さい。重さは 285g。",
      },
      {
        productId: "s_pacetrainer_3",
        rank: 2,
        productName: "PaceTrainer 3",
        totalScore: 78,
        criterionScores: [70, 91, 72],
        oneLine: "反発が長持ちする。速い日の練習向け。",
      },
      {
        productId: "s_trailmix_1",
        rank: 3,
        productName: "TrailMix 1",
        totalScore: 69,
        criterionScores: [66, 60, 92],
        oneLine: "濡れた路面に強い。舗装路ではやや重い。",
      },
    ],
    excluded: [
      {
        productId: "s_racer_x",
        productName: "RacerX Elite",
        reason: "反発材の耐久が 300km に届かず、練習用の条件を満たさないため",
      },
    ],
  },
  stub: STUB_MARK,
};

const SHOE_REVIEW: PublishedArticle = {
  slug: "shoe-cushionrun-5",
  siteSlug: FOURTH_SITE_SLUG,
  type: "review",
  title: "CushionRun 5 で 300km 走った記録",
  summary: "膝の違和感は出ませんでした。中底は 250km を過ぎたあたりで沈みます。",
  categorySlug: "shoes",
  publishedAt: "2026-06-15",
  updatedAt: "2026-08-06",
  author: AZUMA,
  disclosureRequired: false,
  sections: [
    {
      id: "wear",
      heading: "300km でどうなったか",
      paragraphs: [
        "外側の踵から削れました。中底の反発は新品時の 82% です。500km までは練習に使えると考えています。",
      ],
      claims: [
        {
          id: "c1",
          statement: "300km 走行後の中底の反発率は、新品時の 82% でした。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（反発試験機、2026-06-10）", checkedAt: "2026-06-10" },
          ],
        },
        {
          id: "c2",
          statement: "この減り方なら、月 150km の人で 3 か月ごとの買い替えが目安になりそうです。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
  ],
  productCards: [
    {
      productId: "s_cushionrun_5",
      name: "CushionRun 5",
      brand: "CushionRun",
      oneLine: "着地の衝撃が最も小さい。重さは 285g。",
      specs: [
        { label: "着地時衝撃加速度", value: "6.8G", kind: "fact" },
        { label: "重さ（27cm）", value: "285g", kind: "fact" },
        { label: "300km後の反発率", value: "82%", kind: "fact" },
      ],
      // 広告モデルのブログでは買う導線を出さない。理由を書いて、貼り忘れと区別する。
      blockedReason: "このブログは広告の掲載だけで運営しており、記事の中に購入先を置いていません。",
    },
  ],
  stub: STUB_MARK,
};

const WATCH_COMPARISON: PublishedArticle = {
  slug: "gps-watch-accuracy",
  siteSlug: FOURTH_SITE_SLUG,
  type: "comparison",
  title: "GPS 時計 3 機種の距離と心拍の誤差",
  summary: "同じコースを同時に 3 台つけて走り、実測との差を出しました。",
  categorySlug: "watches",
  publishedAt: "2026-07-04",
  updatedAt: "2026-08-21",
  author: AZUMA,
  reviewedBy: YAMAGIWA,
  disclosureRequired: false,
  sections: [
    {
      id: "lead",
      heading: "何が違ったか",
      paragraphs: [
        "距離の誤差はどれも 1% 以内でした。差が出たのは心拍で、手首での計測は坂道で大きくずれます。",
      ],
    },
  ],
  comparison: {
    caption: "10km コースを同時計測した結果",
    columns: [
      { key: "distance_error", label: "距離の誤差", unit: "%", numeric: true },
      { key: "hr_error", label: "心拍の誤差（平均）", unit: "bpm", numeric: true },
      { key: "battery", label: "連続計測時間", unit: "時間", numeric: true },
      { key: "weight", label: "重さ", unit: "g", numeric: true },
    ],
    rows: [
      {
        id: "w_paceview",
        label: "PaceView 5",
        cells: {
          distance_error: { value: "0.4", kind: "fact", checkedAt: "2026-07-01" },
          hr_error: { value: "3.1", kind: "fact", checkedAt: "2026-07-01" },
          battery: { value: "28", kind: "inference", checkedAt: "2026-07-01" },
          weight: { value: "48", kind: "fact", checkedAt: "2026-07-01" },
        },
      },
      {
        id: "w_runsense",
        label: "RunSense Lite",
        cells: {
          distance_error: { value: "0.9", kind: "fact", checkedAt: "2026-07-01" },
          hr_error: { value: "7.8", kind: "fact", checkedAt: "2026-07-01" },
          battery: { value: "36", kind: "fact", checkedAt: "2026-07-01" },
          weight: { value: "39", kind: "fact", checkedAt: "2026-07-01" },
        },
      },
      {
        id: "w_trackmate",
        label: "TrackMate 2",
        cells: {
          distance_error: { value: "0.6", kind: "fact", checkedAt: "2026-07-01" },
          hr_error: { value: "12.4", kind: "fact", checkedAt: "2026-07-01" },
          weight: { value: "55", kind: "fact", checkedAt: "2026-07-01" },
        },
      },
    ],
  },
  stub: STUB_MARK,
};

const RUN_GUIDE: PublishedArticle = {
  slug: "how-to-not-get-injured",
  siteSlug: FOURTH_SITE_SLUG,
  type: "guide",
  title: "練習量を増やすときの決まりごと",
  summary: "週あたりの距離を 1 割以上増やさない。これだけで故障はかなり減ります。",
  categorySlug: "shoes",
  publishedAt: "2026-05-02",
  updatedAt: "2026-07-27",
  author: AZUMA,
  reviewedBy: YAMAGIWA,
  disclosureRequired: false,
  sections: [
    {
      id: "rule",
      heading: "1 割の決まり",
      paragraphs: [
        "先週 100km 走ったなら、今週は 110km までにしてください。靴を新しくした週は、増やさないほうが安全です。",
      ],
      claims: [
        {
          id: "c1",
          statement: "急な走行距離の増加が、ランニング障害の主要な要因のひとつとして挙げられています。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "ランニング障害に関する総説（2021 年）",
              url: "https://example.com/sports/running-injury-review",
              checkedAt: "2025-11-10",
              expired: true,
            },
          ],
        },
        {
          id: "c2",
          statement: "痛みが出た日は走らないほうが、結局は練習量を稼げると思います。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
  ],
  conversation: [
    { speaker: "reader", text: "月 150km から 200km に増やしたいのですが、どのくらいの期間をかければ安全ですか。" },
    { speaker: "writer", text: "週ごとに 1 割ずつなら、3 週間で届きます。増やした翌週は据え置いてください。" },
    { speaker: "expert", text: "距離だけでなく、走る路面の硬さが変わる週も負荷が上がります。同時に変えないでください。" },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 5 本目のブログ「格安SIMの相談所」の記事（3 本）
//
// 収益モデルが `lead`（申込みへの送客）。買う導線ではなく申込みへの導線が
// どう出るかを見る。契約期間と解約金を必ず併記する方針も文章で示している。
// ---------------------------------------------------------------------------

const PLAN_COMPARISON: PublishedArticle = {
  slug: "plans-under-3000",
  siteSlug: FIFTH_SITE_SLUG,
  type: "comparison",
  title: "月 3000 円以下・20GB 前後のプラン比較",
  summary: "同じ場所・同じ時刻で速度を測り、1 年間の総支払額で並べました。",
  categorySlug: "plans",
  publishedAt: "2026-07-16",
  updatedAt: "2026-08-25",
  author: MIKAMI,
  disclosureRequired: true,
  sections: [
    {
      id: "lead",
      heading: "どれを選ぶか",
      paragraphs: [
        "昼休みに動画を見る方は SpeedLine です。月額だけで選ぶと、昼の時間帯に読み込みが止まります。",
        "どのプランも解約金は無料ですが、端末を分割で買った場合は残債が残ります。",
      ],
      claims: [
        {
          id: "c1",
          statement: "12 時台の実測速度は、最も遅いプランで 0.8Mbps まで落ちました。",
          kind: "fact",
          evidence: [
            {
              id: "e1",
              sourceLabel: "自社検証（同一地点・同一時刻、2026-07-08〜07-12）",
              checkedAt: "2026-07-12",
            },
          ],
        },
      ],
    },
  ],
  comparison: {
    caption: "月額・実測速度・1 年間の総支払額",
    columns: [
      { key: "monthly", label: "月額", unit: "円", numeric: true },
      { key: "noon_speed", label: "12時台の実測速度", unit: "Mbps", numeric: true },
      { key: "yearly", label: "1年間の総支払額", unit: "円", numeric: true },
      { key: "contract", label: "契約期間の縛り" },
    ],
    rows: [
      {
        id: "m_speedline",
        label: "SpeedLine 20GB",
        cells: {
          monthly: { value: "2680", kind: "fact", checkedAt: "2026-08-25" },
          noon_speed: { value: "14.2", kind: "fact", checkedAt: "2026-07-12" },
          yearly: { value: "32160", kind: "fact", checkedAt: "2026-08-25" },
          contract: { value: "なし", kind: "fact", checkedAt: "2026-08-25" },
        },
      },
      {
        id: "m_lightmobile",
        label: "LightMobile 20GB",
        cells: {
          monthly: { value: "1980", kind: "fact", checkedAt: "2026-08-25" },
          noon_speed: { value: "0.8", kind: "fact", checkedAt: "2026-07-12" },
          yearly: { value: "23760", kind: "fact", checkedAt: "2026-08-25" },
          contract: { value: "なし", kind: "fact", checkedAt: "2026-08-25" },
        },
      },
      {
        id: "m_valuesim",
        label: "ValueSIM 25GB",
        cells: {
          monthly: { value: "2480", kind: "fact", checkedAt: "2026-08-25" },
          noon_speed: { value: "6.4", kind: "fact", checkedAt: "2026-07-12" },
          contract: { value: "12か月（途中解約金なし）", kind: "inference", checkedAt: "2026-08-25" },
        },
      },
    ],
  },
  productCards: [
    {
      productId: "m_speedline",
      name: "SpeedLine 20GB",
      brand: "SpeedLine",
      oneLine: "昼の時間帯でも速度が落ちにくい。月額は 2680 円。",
      specs: [
        { label: "月額", value: "2680円", kind: "fact" },
        { label: "12時台の実測速度", value: "14.2Mbps", kind: "fact" },
        { label: "契約期間の縛り", value: "なし", kind: "fact" },
        { label: "海外での利用", value: null, kind: "fact" },
      ],
      priceNote: "料金は変わります。申込みページで最新の条件と解約金をご確認ください。",
      trackingCode: "spdline20",
      affiliateUrl: "https://example.com/apply?aid=sample&pid=speedline20",
    },
    {
      productId: "m_lightmobile",
      name: "LightMobile 20GB",
      brand: "LightMobile",
      oneLine: "最も安い。昼の時間帯は動画が止まる。",
      specs: [
        { label: "月額", value: "1980円", kind: "fact" },
        { label: "12時台の実測速度", value: "0.8Mbps", kind: "fact" },
        { label: "契約期間の縛り", value: "なし", kind: "fact" },
        { label: "海外での利用", value: "不可", kind: "inference" },
      ],
      priceNote: "料金は変わります。申込みページで最新の条件と解約金をご確認ください。",
      affiliateUrl: "https://example.com/apply?aid=sample&pid=lightmobile20",
    },
  ],
  stub: STUB_MARK,
};

const PLAN_GUIDE: PublishedArticle = {
  slug: "how-to-check-data-usage",
  siteSlug: FIFTH_SITE_SLUG,
  type: "guide",
  title: "自分が毎月どれだけ使っているかの調べ方",
  summary: "直近 3 か月ぶんを見てください。1 か月だけでは決められません。",
  categorySlug: "plans",
  publishedAt: "2026-06-11",
  updatedAt: "2026-08-12",
  author: MIKAMI,
  disclosureRequired: false,
  sections: [
    {
      id: "how",
      heading: "どこを見るか",
      paragraphs: [
        "契約中の会社の利用明細に、月ごとのデータ量が出ています。旅行や引っ越しがあった月は外して考えてください。",
      ],
      claims: [
        {
          id: "c1",
          statement: "3 か月の中央値で選ぶと、上限に届かない月が大半になります。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
    {
      id: "caution",
      heading: "注意",
      paragraphs: [
        "自宅に固定回線がある方は、その月だけ数字が小さく出ます。外出が戻る時期を見込んで、1 段階上を選んでください。",
      ],
    },
  ],
  stub: STUB_MARK,
};

const ROUTER_REVIEW: PublishedArticle = {
  slug: "pocket-router-a",
  siteSlug: FIFTH_SITE_SLUG,
  type: "review",
  title: "持ち運べる回線 A を 1 か月使う",
  summary: "電車の中では途切れます。据え置きの代わりにはなりません。",
  categorySlug: "routers",
  publishedAt: "2026-08-01",
  updatedAt: "2026-08-23",
  author: MIKAMI,
  disclosureRequired: true,
  sections: [
    {
      id: "where",
      heading: "どこで使えたか",
      paragraphs: [
        "地下鉄の駅間では 3 回に 1 回途切れました。喫茶店と自宅では問題ありませんでした。",
      ],
      claims: [
        {
          id: "c1",
          statement: "同一路線を 30 回往復し、10 回で通信が 5 秒以上途切れました。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（2026-08-05〜08-18）", checkedAt: "2026-08-18" },
          ],
        },
        {
          id: "c2",
          statement: "在宅勤務の主回線として使うのは避けたほうがよいと思います。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
  ],
  productCards: [
    {
      productId: "r_pocket_a",
      name: "持ち運べる回線 A",
      brand: "SpeedLine",
      oneLine: "喫茶店では十分。地下鉄では途切れる。",
      specs: [
        { label: "月額", value: "3480円", kind: "fact" },
        { label: "連続使用時間", value: "9時間", kind: "fact" },
        { label: "重さ", value: "128g", kind: "fact" },
      ],
      priceNote: "料金は変わります。申込みページで最新の条件と解約金をご確認ください。",
      affiliateUrl: "https://example.com/apply?aid=sample&pid=pocketa",
    },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 取り出し
// ---------------------------------------------------------------------------

export const SAMPLE_ARTICLES: readonly PublishedArticle[] = [
  // 在宅ワークの机まわり
  CHAIR_RANKING,
  CHAIR_REVIEW_ERGO,
  CHAIR_REVIEW_FLEX,
  CHAIR_COMPARISON,
  DESK_REVIEW,
  LIGHTING_GUIDE,
  STORAGE_ESTIMATOR_ARTICLE,
  // せまい台所の道具
  RICE_COOKER_COMPARISON,
  OVEN_RANKING,
  OVEN_REVIEW,
  KITCHEN_GUIDE,
  // はじめてのカメラ
  CAMERA_TERMS,
  CAMERA_COMPARISON,
  LENS_GUIDE,
  LENS_REVIEW,
  // 走る人の道具
  SHOE_RANKING,
  SHOE_REVIEW,
  WATCH_COMPARISON,
  RUN_GUIDE,
  // 格安SIMの相談所
  PLAN_COMPARISON,
  PLAN_GUIDE,
  ROUTER_REVIEW,
];

export const SAMPLE_PEOPLE: readonly {
  readonly siteSlug: string;
  readonly kind: "author" | "expert";
  readonly person: PublishedPerson;
}[] = [
  { siteSlug: SAMPLE_SITE_SLUG, kind: "author", person: MOCHIZUKI },
  { siteSlug: SAMPLE_SITE_SLUG, kind: "expert", person: SAKUMA },
  { siteSlug: SECOND_SITE_SLUG, kind: "author", person: KUDO },
  { siteSlug: THIRD_SITE_SLUG, kind: "author", person: HAYASE },
  { siteSlug: THIRD_SITE_SLUG, kind: "expert", person: ARAI },
  { siteSlug: FOURTH_SITE_SLUG, kind: "author", person: AZUMA },
  { siteSlug: FOURTH_SITE_SLUG, kind: "expert", person: YAMAGIWA },
  { siteSlug: FIFTH_SITE_SLUG, kind: "author", person: MIKAMI },
];

/**
 * 訂正の履歴。
 *
 * 2 件・1 件・0 件のブログを混ぜてある。**0 件のときの見え方**は、
 * 訂正が出てからでは確かめられない（そのときには 1 件になっている）。
 */
export const SAMPLE_CORRECTIONS: readonly {
  readonly siteSlug: string;
  readonly id: string;
  readonly correctedAt: string;
  readonly articleSlug: string;
  readonly articleType: PublishedArticle["type"];
  readonly articleTitle: string;
  readonly what: string;
  readonly why: string;
}[] = [
  {
    siteSlug: SAMPLE_SITE_SLUG,
    id: "cor_1",
    correctedAt: "2026-08-20",
    articleSlug: CHAIR_RANKING.slug,
    articleType: CHAIR_RANKING.type,
    articleTitle: CHAIR_RANKING.title,
    what: "FlexSeat 2 の座面の沈み込みを 17mm から 19mm に直しました。",
    why: "初出時に体重 60kg での測定値を載せていました。記事の条件（50kg）で測り直しています。",
  },
  {
    siteSlug: SAMPLE_SITE_SLUG,
    id: "cor_2",
    correctedAt: "2026-08-05",
    articleSlug: CHAIR_COMPARISON.slug,
    articleType: CHAIR_COMPARISON.type,
    articleTitle: CHAIR_COMPARISON.title,
    what: "ErgoOne Pro の保証期間を 3 年から 5 年に直しました。",
    why: "販売元が保証条件を変更していたのに、記事が旧条件のままでした。",
  },
  {
    siteSlug: SECOND_SITE_SLUG,
    id: "cor_3",
    correctedAt: "2026-08-22",
    articleSlug: RICE_COOKER_COMPARISON.slug,
    articleType: RICE_COOKER_COMPARISON.type,
    articleTitle: RICE_COOKER_COMPARISON.title,
    what: "小型炊飯器 C を追加しました。",
    why: "占有面積の条件を満たす製品を掲載から漏らしていたため。",
  },
  {
    siteSlug: FOURTH_SITE_SLUG,
    id: "cor_4",
    correctedAt: "2026-08-19",
    articleSlug: SHOE_RANKING.slug,
    articleType: SHOE_RANKING.type,
    articleTitle: SHOE_RANKING.title,
    what: "RacerX Elite を掲載から除外し、その理由を追記しました。",
    why: "300km を走りきる前に反発材が劣化し、練習用としての比較条件を満たさなくなったため。",
  },
];

/**
 * 方針の文書。
 *
 * 既定（`SAMPLE_BASE_POLICIES`）を全ブログで共有し、ブログごとに違う言い方が要るものだけ
 * `SAMPLE_SITE_POLICY_OVERRIDES` で上書きする。画面側に直接書かない
 * （書くと言い回しの変更が全画面に散る）。
 *
 * 上書きを持たせてあるのは、**収益モデルが違えば広告の説明も違う**ため。
 * 広告掲載だけのブログに「リンクを経由して購入されると報酬が支払われます」と
 * 出るのは、事実として誤っている。
 */
type SampleSiteDocument = Readonly<{
  title: string;
  body: readonly string[];
}>;

export const SAMPLE_BASE_POLICIES: Readonly<Record<SiteDocumentKey, SampleSiteDocument>> = {
  methodology: {
    title: "評価方法",
    body: [
      "順位は、公開している評価基準の重みと、商品ごとの測定値だけで機械的に決まります。",
      "広告主から受け取る報酬の額は、評価にも順位にも一切使いません。報酬が高い商品を上に出すことはありません。",
      "測定できなかった項目は、推測ではなく「未測定」として扱います。",
    ],
  },
  "editorial-policy": {
    title: "編集方針",
    body: [
      "事実として書けるのは、出典または自社の計測記録があるものだけです。",
      "推測と意見は、事実と区別できる形で表示します。",
      "誤りが分かった場合は記事を書き換えるだけでなく、訂正の履歴に残します。",
    ],
  },
  "advertising-policy": {
    title: "広告に関する方針",
    body: [
      "このサイトの記事には広告（アフィリエイトリンク）が含まれます。",
      "リンクを経由して購入された場合、運営者に報酬が支払われることがあります。",
      "報酬の有無と金額は、掲載する商品の選定にも順位にも影響しません。",
    ],
  },
  "ai-policy": {
    title: "AI の使い方",
    body: [
      "記事の下書きには AI を使っています。",
      "公開する前に、必ず人が事実確認と最終承認を行います。AI だけで公開されることはありません。",
      "数値と出典は、人が原典にあたって確認しています。",
    ],
  },
  privacy: {
    title: "個人情報の扱い",
    body: [
      "問い合わせでいただいた情報は、返信以外の目的に使いません。",
      "アクセス状況の把握には、個人を特定しない形の記録のみを使います。",
    ],
  },
  operator: {
    title: "運営者情報",
    body: [
      "このブログは、掲載している道具を実際に使って比べている編集部が運営しています。",
      "連絡先は問い合わせページからお願いします。返信は 3 営業日以内を目安にしています。",
      "掲載内容についての指摘・訂正の依頼も、同じ窓口で受け付けています。",
    ],
  },
  tokushoho: {
    title: "特定商取引法に基づく表記",
    body: [
      "このブログは商品を販売していません。購入の契約は、リンク先の販売店と読者の間で成立します。",
      "価格・送料・返品の条件・支払い方法は、購入前に販売店のページでご確認ください。",
      "このブログの記載と販売店の記載が食い違う場合は、販売店の記載が優先されます。",
    ],
  },
  terms: {
    title: "利用規約",
    body: [
      "記事の内容は、掲載時点の情報にもとづきます。購入前に販売ページで最新の情報をご確認ください。",
      "記事の無断複製はお断りします。",
    ],
  },
};

/**
 * ブログごとの上書き。
 *
 * 上書きするのは**そのブログで事実が違う項目だけ**。全文を写して持つと、
 * 既定を直したときに上書き側だけが古いまま残る。
 */
export const SAMPLE_SITE_POLICY_OVERRIDES: Readonly<
  Record<string, Readonly<Partial<Record<SiteDocumentKey, SampleSiteDocument>>>>
> = {
  // 広告の掲載だけで運営しているブログ。成果報酬の説明をそのまま出すと事実に反する。
  [FOURTH_SITE_SLUG]: {
    "advertising-policy": {
      title: "広告に関する方針",
      body: [
        "このサイトには広告が掲載されます。記事の中に、購入先へ誘導するリンクは置いていません。",
        "広告の表示は、記事の内容にも順位にも影響しません。広告主から製品の提供を受けた場合は、その記事に明記します。",
        "計測に使った製品は、すべて運営者が自分で購入したものです。",
      ],
    },
  },
  // 申込みへ送るブログ。契約条件の明記までを方針に含める。
  [FIFTH_SITE_SLUG]: {
    "advertising-policy": {
      title: "広告に関する方針",
      body: [
        "このサイトの記事には広告（アフィリエイトリンク）が含まれます。リンク先は申込みページです。",
        "リンクを経由して申し込まれた場合、運営者に報酬が支払われることがあります。",
        "報酬の有無と金額は、掲載するプランの選定にも順位にも影響しません。",
        "契約期間の縛りと解約金は、報酬の条件にかかわらず、分かっている範囲をすべて記載します。",
      ],
    },
  },
};

/** ブログ固有の文面があれば優先し、無ければ全ブログ共通の文面を返す。 */
export function resolveSampleSiteDocument(
  siteSlug: string,
  key: SiteDocumentKey,
): SampleSiteDocument {
  return SAMPLE_SITE_POLICY_OVERRIDES[siteSlug]?.[key] ?? SAMPLE_BASE_POLICIES[key];
}

export function sampleArticlesBySite(siteSlug: string): readonly PublishedArticle[] {
  return SAMPLE_ARTICLES.filter((a) => a.siteSlug === siteSlug);
}

export function sampleArticleSummaries(
  articles: readonly PublishedArticle[],
): readonly ArticleSummary[] {
  return articles.map(toSummary);
}
