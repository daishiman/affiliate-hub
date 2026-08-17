import type { EditorialPublishedContentPort } from "@/application/ports/site";
import {
  type ArticleSummary,
  type PublishedArticle,
  type PublishedPerson,
  toSummary,
} from "@/application/read-models/published-article";
import { markEditorial, ok } from "@/domain/shared";
import { registerStub } from "../../stub-registry";
import { SAMPLE_SITE_SLUG, SECOND_SITE_SLUG } from "./site-sample-repository";

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
 * 見本記事はすべて `stub` 欄を持ち、画面に「見本」と表示される。
 * 中身の無いものを本物に見せない。
 */
const stub = registerStub({
  id: "persistence:content-sample",
  port: "PublishedContentPort",
  label: "公開記事の保存先（見本データ）",
  blockedBy: "content_packages / published_articles テーブルの追加とマイグレーション",
});

const STUB_MARK = { label: "見本の記事", blockedBy: stub.blockedBy } as const;

const MIWA: PublishedPerson = {
  slug: "miwa",
  name: "三輪 さとし",
  bio: "受注制作の動画編集を 8 年。納期に追われる現場で機材を選び続けてきました。",
  credentials: ["映像制作会社での編集職 5 年", "自社検証環境で年間 30 機種を計測"],
};

const KUDO: PublishedPerson = {
  slug: "kudo",
  name: "工藤 なぎさ",
  bio: "家電の設置寸法を測り続けている書き手。狭い台所での置き場所を専門にしています。",
  credentials: ["住宅設備の販売職 6 年"],
};

const EXPERT_ARAI: PublishedPerson = {
  slug: "arai",
  name: "新井 とおる",
  bio: "映像技術の専門家。計測方法の妥当性を確認しています。",
  credentials: ["映像信号処理の研究職", "計測機器の校正実務"],
};

// ---------------------------------------------------------------------------
// 1 本目のブログの記事
// ---------------------------------------------------------------------------

const LAPTOP_RANKING: PublishedArticle = {
  slug: "laptops-for-video-editing",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "ranking",
  title: "動画編集向けノートパソコンの順位",
  summary: "同じ素材を 3 回書き出し、その中央値で並べました。",
  categorySlug: "laptops",
  publishedAt: "2026-07-25",
  updatedAt: "2026-08-01",
  author: MIWA,
  reviewedBy: EXPERT_ARAI,
  disclosureRequired: true,
  sections: [
    {
      id: "conclusion",
      heading: "結論",
      paragraphs: [
        "納期が読める書き出し速度を最優先にするなら Alpha Studio 15 です。持ち歩く時間が長い人は Beta Creator 14 を選んでください。",
      ],
      claims: [
        {
          id: "c1",
          statement: "Alpha Studio 15 の 4K 書き出し時間は中央値 6 分 12 秒です。",
          kind: "fact",
          evidence: [
            { id: "e1", sourceLabel: "自社検証（2026-07-12、同一素材 3 回）", checkedAt: "2026-07-12" },
          ],
        },
        {
          id: "c2",
          statement: "この差は 10 分程度の素材を 1 日 5 本扱う人なら体感できると考えられます。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
    {
      id: "methodology",
      heading: "どうやって比べたか",
      paragraphs: [
        "同一の 4K 素材（3 分・カラーグレーディングあり）を各機種で 3 回書き出し、その中央値を使っています。室温は 24℃ に揃えました。",
      ],
    },
    {
      id: "how-to-choose",
      heading: "選び方",
      paragraphs: [
        "書き出し時間・持ち運ぶ重さ・画面の色の正確さの 3 つで、どれを諦めるかを先に決めると絞り込めます。",
      ],
    },
  ],
  conversation: [
    { speaker: "reader", text: "書き出しが速い機種を選べば間違いないですか。" },
    { speaker: "writer", text: "毎日持ち歩くなら重さも見てください。速さだけで選ぶと通勤で後悔します。" },
    { speaker: "expert", text: "計測は室温を揃えないと再現しません。この記事は 24℃ で統一しています。" },
  ],
  // 記事構成 `product_cards`。順位表と同じ商品を、同じ項目の並びで見せる。
  // 3 台とも同じ 4 項目で、測っていないものは値を伏せて「未計測」と出す
  // （空欄にすると「無い」のか「測っていない」のか読者に伝わらない）。
  productCards: [
    {
      productId: "p_alpha_15",
      name: "Alpha Studio 15",
      brand: "Alpha",
      oneLine: "書き出しが最も速い。重さは 1.9kg。",
      specs: [
        { label: "4K書き出し（10分素材）", value: "6分12秒", kind: "fact" },
        { label: "重さ", value: "1.9kg", kind: "fact" },
        { label: "連続稼働時の動作音", value: "やや大きい", kind: "fact" },
        { label: "色域（DCI-P3）", value: null, kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      affiliateUrl: "https://example.com/click?aid=sample&pid=alpha15",
      reviewSlug: "alpha-studio-15",
    },
    {
      productId: "p_beta_14",
      name: "Beta Creator 14",
      brand: "Beta",
      oneLine: "1.3kg。持ち歩く人向け。",
      specs: [
        { label: "4K書き出し（10分素材）", value: "8分40秒", kind: "fact" },
        { label: "重さ", value: "1.3kg", kind: "fact" },
        { label: "連続稼働時の動作音", value: "静か", kind: "fact" },
        { label: "色域（DCI-P3）", value: "約95%", kind: "inference" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      affiliateUrl: "https://example.com/click?aid=sample&pid=beta14",
    },
    {
      productId: "p_gamma_16",
      name: "Gamma Pro 16",
      brand: "Gamma",
      oneLine: "画面が大きい。据え置き向け。",
      specs: [
        { label: "4K書き出し（10分素材）", value: "6分55秒", kind: "fact" },
        { label: "重さ", value: "2.4kg", kind: "fact" },
        { label: "連続稼働時の動作音", value: null, kind: "fact" },
        { label: "色域（DCI-P3）", value: null, kind: "fact" },
      ],
      priceNote: "価格は変わります。最新の金額は販売ページでご確認ください。",
      // 提携していないので買う導線は出さない。理由を出して、貼り忘れと区別する。
      blockedReason: "この商品は、いま提携している販売先がありません。",
    },
  ],
  ranking: {
    caption: "動画編集向けノートパソコンの順位",
    updatedAt: "2026-08-01",
    criteria: [
      { key: "measured_performance", label: "書き出し速度", weight: 0.4, measurement: "同一素材の 4K 書き出し時間を 3 回計測し中央値で比較" },
      { key: "usability", label: "使い勝手", weight: 0.2, measurement: "画面の明るさ・色域・キーボード操作を実機で評価" },
      { key: "durability", label: "連続稼働", weight: 0.15, measurement: "連続 60 分書き出し時の温度と動作音を計測" },
      { key: "support", label: "保証", weight: 0.1, measurement: "保証期間と修理受付の窓口の有無を確認" },
      { key: "price_value", label: "価格性能比", weight: 0.15, measurement: "計測した性能を実売価格で割った値を正規化" },
    ],
    entries: [
      {
        productId: "p_alpha_15",
        rank: 1,
        productName: "Alpha Studio 15",
        totalScore: 78,
        criterionScores: [92, 78, 70, 60, 55],
        affiliateUrl: "https://example.com/click?aid=sample&pid=alpha15",
        reviewSlug: "alpha-studio-15",
        oneLine: "書き出しが最も速い。重さは 1.9kg。",
      },
      {
        productId: "p_beta_14",
        rank: 2,
        productName: "Beta Creator 14",
        totalScore: 76,
        criterionScores: [71, 86, 64, 80, 82],
        affiliateUrl: "https://example.com/click?aid=sample&pid=beta14",
        oneLine: "1.3kg。持ち歩く人向け。",
      },
      {
        productId: "p_gamma_16",
        rank: 3,
        productName: "Gamma Pro 16",
        totalScore: 70,
        criterionScores: [88, 62, 81, 40, 41],
        oneLine: "画面が大きい。据え置き向け。",
      },
    ],
    excluded: [
      {
        productId: "p_delta_13",
        productName: "Delta Light 13",
        reason: "書き出し速度が合格ラインを下回ったため",
      },
    ],
  },
  stub: STUB_MARK,
};

const LAPTOP_REVIEW: PublishedArticle = {
  slug: "alpha-studio-15",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "review",
  title: "Alpha Studio 15 を 3 週間使った記録",
  summary: "書き出しは速い。ただし連続稼働時の動作音は大きめです。",
  categorySlug: "laptops",
  publishedAt: "2026-07-18",
  updatedAt: "2026-07-30",
  author: MIWA,
  disclosureRequired: true,
  sections: [
    {
      id: "summary",
      heading: "3 行でいうと",
      paragraphs: ["速い。重い。うるさい。"],
      claims: [
        {
          id: "c1",
          statement: "連続 60 分の書き出し時、1m 地点の動作音は 44dB でした。",
          kind: "fact",
          evidence: [{ id: "e1", sourceLabel: "自社検証（騒音計 A、2026-07-14）", checkedAt: "2026-07-14" }],
        },
        {
          id: "c2",
          statement: "静かな部屋で長時間作業する人には気になると思います。",
          kind: "opinion",
          evidence: [],
        },
      ],
    },
    {
      id: "not-for",
      heading: "向いていない人",
      paragraphs: ["毎日 1 時間以上持ち歩く人。1.9kg は肩に来ます。"],
    },
  ],
  stub: STUB_MARK,
};

const LAPTOP_COMPARISON: PublishedArticle = {
  slug: "alpha-vs-beta",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "comparison",
  title: "Alpha Studio 15 と Beta Creator 14 の比較",
  summary: "速さを取るか、軽さを取るか。数字で並べました。",
  categorySlug: "laptops",
  publishedAt: "2026-07-20",
  updatedAt: "2026-07-31",
  author: MIWA,
  disclosureRequired: true,
  sections: [
    {
      id: "lead",
      heading: "どちらを選ぶか",
      paragraphs: ["据え置きなら Alpha、持ち歩くなら Beta です。"],
    },
  ],
  comparison: {
    caption: "主要な仕様の比較",
    columns: [
      { key: "weight", label: "重さ", unit: "kg", numeric: true },
      { key: "export", label: "書き出し時間", unit: "秒", numeric: true },
      { key: "noise", label: "動作音", unit: "dB", numeric: true },
      { key: "port", label: "映像出力" },
    ],
    rows: [
      {
        id: "p_alpha_15",
        label: "Alpha Studio 15",
        cells: {
          weight: { value: "1.90", kind: "fact", checkedAt: "2026-07-12" },
          export: { value: "372", kind: "fact", checkedAt: "2026-07-12" },
          noise: { value: "44", kind: "fact", checkedAt: "2026-07-14" },
          port: { value: "HDMI 2.1", kind: "fact", checkedAt: "2026-07-12" },
        },
      },
      {
        id: "p_beta_14",
        label: "Beta Creator 14",
        cells: {
          weight: { value: "1.30", kind: "fact", checkedAt: "2026-07-15" },
          export: { value: "521", kind: "fact", checkedAt: "2026-07-15" },
          noise: { value: "38", kind: "fact", checkedAt: "2026-07-15" },
        },
      },
    ],
  },
  stub: STUB_MARK,
};

const STORAGE_GUIDE: PublishedArticle = {
  slug: "choosing-storage",
  siteSlug: SAMPLE_SITE_SLUG,
  type: "guide",
  title: "素材を失わない保存先の選び方",
  summary: "3 か所に置く。置き場所の性質を変える。この 2 つだけです。",
  categorySlug: "storage",
  publishedAt: "2026-06-30",
  updatedAt: "2026-07-28",
  author: MIWA,
  disclosureRequired: true,
  sections: [
    {
      id: "rule",
      heading: "決まりごとは 2 つ",
      paragraphs: [
        "同じ素材を 3 か所に置き、そのうち 1 か所は手元から離れた場所にします。",
      ],
      claims: [
        {
          id: "c1",
          statement: "手元の 2 台だけに置くと、落雷や盗難で同時に失われることがあります。",
          kind: "inference",
          evidence: [],
        },
      ],
    },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 2 本目のブログの記事（同じ型・同じ画面で表示される）
// ---------------------------------------------------------------------------

const RICE_COOKER_COMPARISON: PublishedArticle = {
  slug: "rice-cookers-for-60cm",
  siteSlug: SECOND_SITE_SLUG,
  type: "comparison",
  title: "幅 60cm の調理台に置ける炊飯器",
  summary: "蒸気の逃げ道を含めた占有面積で比べました。",
  categorySlug: "rice-cookers",
  publishedAt: "2026-07-10",
  updatedAt: "2026-08-02",
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
          evidence: [{ id: "e1", sourceLabel: "各社の取扱説明書（設置条件の項）", checkedAt: "2026-07-05" }],
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
    ],
    rows: [
      {
        id: "rc_a",
        label: "小型炊飯器 A",
        cells: {
          width: { value: "22.5", kind: "fact", checkedAt: "2026-07-05" },
          depth: { value: "28.0", kind: "fact", checkedAt: "2026-07-05" },
          clearance: { value: "10", kind: "fact", checkedAt: "2026-07-05" },
        },
      },
      {
        id: "rc_b",
        label: "小型炊飯器 B",
        cells: {
          width: { value: "25.0", kind: "fact", checkedAt: "2026-07-06" },
          depth: { value: "31.5", kind: "fact", checkedAt: "2026-07-06" },
        },
      },
    ],
  },
  stub: STUB_MARK,
};

const OVEN_REVIEW: PublishedArticle = {
  slug: "compact-oven-x",
  siteSlug: SECOND_SITE_SLUG,
  type: "review",
  title: "小型オーブン X を狭い台所で 1 か月使う",
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
    },
  ],
  stub: STUB_MARK,
};

// ---------------------------------------------------------------------------
// 取り出し
// ---------------------------------------------------------------------------

const ARTICLES: readonly PublishedArticle[] = [
  LAPTOP_RANKING,
  LAPTOP_REVIEW,
  LAPTOP_COMPARISON,
  STORAGE_GUIDE,
  RICE_COOKER_COMPARISON,
  OVEN_REVIEW,
];

const PEOPLE: readonly { readonly siteSlug: string; readonly kind: "author" | "expert"; readonly person: PublishedPerson }[] = [
  { siteSlug: SAMPLE_SITE_SLUG, kind: "author", person: MIWA },
  { siteSlug: SAMPLE_SITE_SLUG, kind: "expert", person: EXPERT_ARAI },
  { siteSlug: SECOND_SITE_SLUG, kind: "author", person: KUDO },
];

const CORRECTIONS: readonly {
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
    correctedAt: "2026-08-01",
    articleSlug: LAPTOP_RANKING.slug,
    articleType: LAPTOP_RANKING.type,
    articleTitle: LAPTOP_RANKING.title,
    what: "Beta Creator 14 の重さを 1.4kg から 1.3kg に直しました。",
    why: "初出時に旧型の仕様値を参照していたため。実機を計測し直しました。",
  },
];

/**
 * 方針の文書。
 *
 * ブログごとに文言を変えられるようにしてあるが、既定は共通。
 * 画面側に直接書かない（書くと言い回しの変更が全画面に散る）。
 */
const POLICIES: Readonly<Record<string, { title: string; body: readonly string[] }>> = {
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
      "この サイトの記事には広告（アフィリエイトリンク）が含まれます。",
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
  terms: {
    title: "利用規約",
    body: [
      "記事の内容は、掲載時点の情報にもとづきます。購入前に販売ページで最新の情報をご確認ください。",
      "記事の無断複製はお断りします。",
    ],
  },
};

function bySite(siteSlug: string): readonly PublishedArticle[] {
  return ARTICLES.filter((a) => a.siteSlug === siteSlug);
}

function summaries(articles: readonly PublishedArticle[]): readonly ArticleSummary[] {
  return articles.map(toSummary);
}

/** 見本の記事であることを画面に出すための一文。 */
export function sampleContentNotice(): string {
  return `${stub.label}で表示しています（${stub.blockedBy}が済むまでの仮です）。`;
}

export function createSampleContentRepository(): EditorialPublishedContentPort {
  return markEditorial({
    async listRecent(siteSlug: string, limit: number) {
      const sorted = [...bySite(siteSlug)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      return ok(summaries(sorted.slice(0, limit)));
    },
    async listByCategory(siteSlug: string, categorySlug: string) {
      return ok(summaries(bySite(siteSlug).filter((a) => a.categorySlug === categorySlug)));
    },
    async findArticle(siteSlug: string, slug: string) {
      return ok(bySite(siteSlug).find((a) => a.slug === slug) ?? null);
    },
    async search(siteSlug: string, query: string, limit: number) {
      // 見本なので単純な部分一致。全文検索は保存先ができてから差し替える。
      const q = query.toLowerCase();
      const hit = bySite(siteSlug).filter(
        (a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q),
      );
      return ok(summaries(hit.slice(0, limit)));
    },
    async findPerson(siteSlug: string, kind: "author" | "expert", slug: string) {
      return ok(
        PEOPLE.find((p) => p.siteSlug === siteSlug && p.kind === kind && p.person.slug === slug)
          ?.person ?? null,
      );
    },
    async listByPerson(siteSlug: string, personSlug: string) {
      return ok(
        summaries(
          bySite(siteSlug).filter(
            (a) => a.author.slug === personSlug || a.reviewedBy?.slug === personSlug,
          ),
        ),
      );
    },
    async listCorrections(siteSlug: string) {
      return ok(CORRECTIONS.filter((c) => c.siteSlug === siteSlug));
    },
    async findPolicyDocument(_siteSlug: string, key: string) {
      return ok(POLICIES[key] ?? null);
    },
  });
}
