/**
 * 記号の名前と、その選び方。
 *
 * 形（SVG）とは別のファイルに置く。**選ぶ仕事は絵を持たない。**
 * 一緒にすると、名前から記号を選ぶだけの処理を呼ぶために
 * React の部品ごと読み込むことになる。
 */

export const ICON_NAMES = [
  "smartphone",
  "headphones",
  "plug",
  "battery",
  "laptop",
  "speaker",
  "appliance",
  "projector",
  "wifi",
  "shield",
  "gamepad",
  "shoe",
  "chair",
  "desk",
  "lamp",
  "bag",
  "home",
  "grid",
  "camera",
  "watch",
  "keyboard",
  "car",
  "tag",
  "search",
  "list",
  "megaphone",
  "compass",
] as const;

export type IconName = (typeof ICON_NAMES)[number];

/**
 * どれにも当てはまらなかったときの記号。
 *
 * 印を落とさない。落とすとその行だけ文字の始まる位置がずれ、
 * 一覧が階段状に崩れる。「分類」の意味で当たり障りのないものを使う。
 */
export const DEFAULT_CATEGORY_ICON: IconName = "tag";

/**
 * 手がかりの表。**上から順に見て、最初に当たったものを使う。**
 *
 * 並び順がそのまま決まりごとになる。日本語のカテゴリー名は語が重なるためで、
 * 「モバイルバッテリー」と「充電器」はどちらも充電の話だし、
 * 「ノートPC」と「ノート（文房具）」は同じ 2 文字で始まる。
 * **狭いほうを上に置く。** 逆にすると、広いほうが先に当たって
 * 細かい区別が全部消える。
 */
const RULES: readonly { readonly icon: IconName; readonly words: readonly string[] }[] = [
  { icon: "battery", words: ["モバイルバッテリー", "バッテリー", "電池", "power-bank", "battery"] },
  { icon: "plug", words: ["充電器", "充電", "アダプタ", "ケーブル", "charger", "cable", "adapter"] },
  {
    icon: "headphones",
    words: ["イヤホン", "ヘッドホン", "ヘッドフォン", "earphone", "earbuds", "headphones"],
  },
  { icon: "speaker", words: ["スピーカー", "オーディオ", "speaker", "audio"] },
  { icon: "laptop", words: ["ノートpc", "ノートパソコン", "パソコン", "laptop", "notebook-pc", "pc"] },
  {
    icon: "smartphone",
    words: ["スマホ", "スマートフォン", "タブレット", "携帯", "smartphone", "phone", "tablet"],
  },
  { icon: "keyboard", words: ["キーボード", "マウス", "keyboard", "mouse"] },
  { icon: "camera", words: ["カメラ", "レンズ", "写真", "camera", "lens", "lenses", "photo"] },
  {
    icon: "projector",
    words: ["プロジェクター", "モニター", "ディスプレイ", "テレビ", "projector", "monitor", "display"],
  },
  { icon: "wifi", words: ["光回線", "ルーター", "回線", "通信", "wifi", "wi-fi", "router", "internet"] },
  { icon: "shield", words: ["vpn", "セキュリティ", "安全", "security", "privacy"] },
  { icon: "gamepad", words: ["ゲーミング", "ゲーム", "gaming", "game"] },
  { icon: "watch", words: ["腕時計", "ウォッチ", "時計", "watch", "wearable"] },
  { icon: "car", words: ["自動車", "カー用品", "ドライブ", "car", "driving"] },
  { icon: "shoe", words: ["シューズ", "スニーカー", "靴", "shoes", "sneakers"] },
  { icon: "chair", words: ["椅子", "いす", "チェア", "chair", "chairs", "seat"] },
  { icon: "desk", words: ["机", "デスク", "テーブル", "desk", "desks", "table"] },
  { icon: "lamp", words: ["照明", "ライト", "ランプ", "電球", "lighting", "lamp", "light"] },
  {
    icon: "appliance",
    words: [
      "家電",
      "掃除機",
      "冷蔵庫",
      "洗濯",
      "調理",
      "炊飯",
      "オーブン",
      "トースター",
      "台所",
      "キッチン",
      "appliance",
      "appliances",
      "kitchen",
      "rice-cookers",
      "ovens",
    ],
  },
  { icon: "home", words: ["インテリア", "住まい", "暮らし", "生活", "home", "living", "interior"] },
  { icon: "bag", words: ["バッグ", "かばん", "リュック", "財布", "bag", "backpack", "wallet"] },
  { icon: "megaphone", words: ["お知らせ", "ニュース", "news", "updates"] },
  { icon: "list", words: ["まとめ", "比較", "ランキング", "ranking", "comparison"] },
  { icon: "grid", words: ["すべて", "全て", "一覧", "all", "index"] },
];

/** 英字だけでできた手がかりか。日本語とは当て方を変えるので分ける。 */
const asciiWord = (word: string): boolean => /^[a-z0-9-]+$/.test(word);

/**
 * カテゴリーの名前から、その内容に合う記号を選ぶ。
 *
 * --- なぜ表を手で書き並べないのか ---
 * 参考にした作りは、カテゴリー 12 個それぞれに手でアイコンを指定していた。
 * ブログが 1 本ならそれで足りる。**このプラットフォームは違う。**
 * ブログは設計図から何本でも作られ、カテゴリー名は運営が自由に決める。
 * 手書きの表にすると、新しいブログを 1 本作るたびにこのファイルを開いて
 * 追記する仕事が生まれ、追記を忘れた分だけ記号が抜けた行が混ざる。
 *
 * --- 英語の手がかりを「含む」で当てない理由 ---
 * `car` を単純な部分一致で見ると `card`（カード）や `carpet`（じゅうたん）に当たり、
 * `pc` は `pcs` に当たる。**間違った記号は、記号が無いより悪い。**
 * 読者は絵を先に見るので、鞄のカテゴリーに車の絵が付いていると、
 * 文字を読み直すまで違う場所だと思う。
 *
 * そこで英字の手がかりは**語のまとまりとして**当てる。
 * slug は区切りが `-` と決まっているので前後を区切りで挟んで見る。
 * 表示名のほうは日本語が混ざるため、前後が英数字でないことだけを確かめる。
 *
 * 日本語の手がかりは「含む」で当てる。日本語には語の区切りが無く、
 * 「モバイルバッテリー」の中の「バッテリー」を当てられなくなるからである。
 *
 * @param label カテゴリーの表示名（「モバイルバッテリー」など）
 * @param slug  URL に使う名前（「powerbank」など）。英語の手がかりになる。
 * @returns 選んだ記号の名前。判断できないときは既定の記号。
 */
export function pickCategoryIcon(label: string, slug: string): IconName {
  const text = label.toLowerCase();
  // 区切りを `-` に揃え、両端にも付ける。`-chair-` の形で丸ごと一致を見るため。
  const path = `-${slug.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-`;

  for (const rule of RULES) {
    for (const word of rule.words) {
      if (asciiWord(word)) {
        if (path.includes(`-${word}-`)) return rule.icon;
        if (new RegExp(`(^|[^a-z0-9])${word}([^a-z0-9]|$)`).test(text)) return rule.icon;
      } else if (text.includes(word)) {
        return rule.icon;
      }
    }
  }
  /*
    当たらないのは異常ではない。運営はカテゴリー名を自由に決められるので、
    表に無い言葉が来るのがふつうである。ここで印を落とすと、
    その行だけ文字の始まる位置がずれて一覧が崩れる。
  */
  return DEFAULT_CATEGORY_ICON;
}
