/**
 * 記事の構成テンプレート。
 *
 * 2 つの仕様書が同じものを別々に書いているため、ここで 1 つに統合する。
 *   プラットフォーム層 §16.4 標準記事構成
 *   ブログ層 §8 記事共通構成 / §9 記事タイプ
 *
 * 「見出しの並び」をコードに持つ理由:
 *   - 記事タイプごとの必須セクションを公開ゲートが機械的に検査できる
 *   - 複数ブログで同じ構成を再利用でき、ブログごとにコードを分岐しない
 *   - AI 生成のプロンプトが、この一覧をそのまま出力スキーマに使える
 */
export const ARTICLE_TYPES = ["ranking", "review", "comparison", "guide", "tool"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

/**
 * 記事タイプの表示名。**ここが唯一の正本**。
 *
 * 全部を「〜記事」で揃えてある。作成ウィザードでは「順位づけ」、
 * 書き方の案内では「順位をつける記事」と出ていた時期があり、
 * 同じものを指しているのかどうかが画面をまたぐと分からなかった。
 * 検査: tests/architecture/single-definition.test.ts
 */
export const ARTICLE_TYPE_LABEL: Readonly<Record<ArticleType, string>> = {
  ranking: "順位をつける記事",
  review: "1 つを詳しく見る記事",
  comparison: "2 つ以上を比べる記事",
  guide: "やり方を説明する記事",
  tool: "計算・判定の道具のページ",
};

/** セクションの識別子。文言ではなく役割で持つ (サイトごとに見出し文言を変えるため)。 */
export type SectionId =
  | "breadcrumb"
  | "disclosure" // 広告・アフィリエイト表記
  | "h1"
  | "one_sentence_conclusion" // 一文の結論
  | "dates" // 公開日・更新日・検証日
  | "byline" // 著者・編集者・監修者
  | "target_audience" // 対象読者
  | "suitable_for" // 向いている人
  | "not_suitable_for" // 向いていない人
  | "pros" // 主要なメリット
  | "cons" // 主要なデメリット
  | "quick_comparison" // 簡易比較
  | "toc" // 目次
  | "how_to_choose" // 選び方
  | "methodology" // 評価方法
  | "test_conditions" // 検証条件
  | "body" // 根拠付き本文
  | "measurements" // 実測値
  | "experience" // 体験
  | "conversation" // 会話・吹き出し
  | "ranking_list" // ランキング本体
  | "product_cards" // 各商品カード
  | "excluded_products" // 選外商品
  | "use_case_best" // 用途別ベスト
  | "alternatives" // 代替候補
  | "faq"
  | "final_conclusion" // 最終結論
  | "merchant_options" // 販売店の選択肢
  | "sources" // 出典
  | "update_log" // 更新履歴
  | "correction_report" // 訂正報告
  | "author_profile" // 著者情報
  // ハウツー記事固有
  | "outcome_state" // 完了後の状態
  | "required_time"
  | "required_cost"
  | "prerequisites"
  | "steps"
  | "success_state"
  | "troubleshooting"
  | "next_action";

export type SectionSpec = {
  readonly id: SectionId;
  readonly label: string;
  /** 欠けたら公開できないか。false は推奨。 */
  readonly required: boolean;
  /** なぜ必要か。編集者への説明であり、AI プロンプトの指示文にもなる。 */
  readonly purpose: string;
};

const S = (id: SectionId, label: string, required: boolean, purpose: string): SectionSpec => ({
  id,
  label,
  required,
  purpose,
});

/**
 * 全記事タイプ共通の骨格 (ブログ層 §8)。
 *
 * 冒頭 3 つ (パンくず → 広告表記 → H1) の順序は変えない。
 * 広告表記が H1 より下にあると「利用者が認識できる場所」の要件を満たしにくい。
 */
export const COMMON_ARTICLE_SECTIONS: readonly SectionSpec[] = [
  S("breadcrumb", "パンくず", true, "今どこを読んでいるかを示し、カテゴリーへ戻れるようにする"),
  S("disclosure", "広告・アフィリエイト表記", true, "広告であることを本文より先に認識できる位置に置く"),
  S("h1", "タイトル", true, "1ページに1つ。検索結果と一致させる"),
  S("one_sentence_conclusion", "一文の結論", true, "先に結論を出す。読者が読み進めるか判断できるようにする"),
  S("dates", "公開日・更新日・検証日", true, "情報の新しさを読者が自分で判断できるようにする"),
  S("byline", "著者・編集者・監修者", true, "誰が書いたか示す。公開ゲートの必須項目"),
  S("target_audience", "対象読者", false, "誰向けの記事か明示する"),
  S("suitable_for", "向いている人", true, "読者が自分に当てはまるか判断できるようにする"),
  S("not_suitable_for", "向いていない人", true, "買わない判断も支援する。信頼の源になる"),
  S("pros", "主要なメリット", true, "良い点を根拠付きで示す"),
  S("cons", "主要なデメリット", true, "影響する人と回避策をセットで書く"),
  S("quick_comparison", "簡易比較", false, "詳細を読まなくても差が分かる表"),
  S("toc", "目次", true, "長い記事で必要な箇所へ直接行けるようにする"),
  S("how_to_choose", "選び方または評価方法", true, "何を基準に選んだか示す"),
  S("body", "根拠付き本文", true, "結論→理由→根拠→具体例→例外→意味→次の行動の順で書く"),
  S("measurements", "実測・体験・引用", false, "測った値と体験を、種類を分けて示す"),
  S("conversation", "会話ブロック", false, "読者の疑問を代弁する。ここだけに根拠を置かない"),
  S("alternatives", "代替候補", true, "この商品が合わない読者の次の選択肢を示す"),
  S("faq", "FAQ", true, "検索前に読者が持っていた疑問へ答える"),
  S("final_conclusion", "最終結論", true, "誰にどれを薦めるかを言い切る"),
  S("merchant_options", "販売店の選択肢", false, "複数の販売店と価格確認日時を示す"),
  S("sources", "出典", true, "根拠へ到達できるようにする"),
  S("update_log", "更新履歴", true, "何をいつ直したか隠さない"),
  S("correction_report", "訂正報告", true, "読者が誤りを報告できる導線を置く"),
  S("author_profile", "著者情報", true, "書いた人の専門性と経験を示す"),
];

/** 記事タイプごとの追加・上書きセクション (ブログ層 §9)。 */
export const ARTICLE_TYPE_SECTIONS: Readonly<Record<ArticleType, readonly SectionSpec[]>> = {
  ranking: [
    S("use_case_best", "用途別ベスト", true, "1位だけでなく用途別の最適解を示す"),
    S("methodology", "評価基準", true, "何をどの重みで評価したか表示する"),
    S("test_conditions", "検証条件", true, "同じ条件で測ったことを示す"),
    S("ranking_list", "ランキング", true, "順位と点数を根拠付きで並べる"),
    S("product_cards", "各商品カード", true, "商品ごとの要点を同じ形式で並べる"),
    S("excluded_products", "選外商品", true, "なぜ選ばなかったかを示す"),
  ],
  review: [
    S("test_conditions", "検証条件", true, "どの環境でどう使ったか"),
    S("measurements", "実測", true, "測定値を条件付きで示す"),
    S("experience", "長期使用", false, "使い続けて分かったこと"),
    S("quick_comparison", "競合比較", true, "単体評価だけでは判断できないため"),
  ],
  comparison: [
    S("quick_comparison", "差分表", true, "違いだけを並べる"),
    S("use_case_best", "用途別結論", true, "どちらが誰に向くか"),
  ],
  guide: [
    S("outcome_state", "完了後の状態", true, "読み終えて何ができるようになるか"),
    S("required_time", "必要時間", true, "着手できるか判断できるようにする"),
    S("required_cost", "必要費用", true, "途中で止まらないようにする"),
    S("prerequisites", "事前準備", true, "始める前に揃えるもの"),
    S("steps", "全手順", true, "順番に実行できる粒度で書く"),
    S("success_state", "成功状態", true, "各ステップの完了をどう確認するか"),
    S("troubleshooting", "エラー対処", true, "つまずいた時の戻り道"),
    S("next_action", "次の行動", true, "読み終えた後にすること"),
  ],
  tool: [
    S("outcome_state", "このツールでできること", true, "使う前に結果が想像できるようにする"),
    S("how_to_choose", "計算・判定の根拠", true, "何をどう計算しているか示す"),
  ],
};

/** 記事タイプの全セクション。共通 + タイプ固有 (同じ id はタイプ固有を優先)。 */
export function sectionsFor(type: ArticleType): readonly SectionSpec[] {
  const overrides = new Map(ARTICLE_TYPE_SECTIONS[type].map((s) => [s.id, s]));
  const merged = COMMON_ARTICLE_SECTIONS.map((s) => overrides.get(s.id) ?? s);
  const extras = ARTICLE_TYPE_SECTIONS[type].filter(
    (s) => !COMMON_ARTICLE_SECTIONS.some((c) => c.id === s.id),
  );
  // タイプ固有の追加セクションは本文の直前へ差し込む。
  const bodyIndex = merged.findIndex((s) => s.id === "body");
  return [...merged.slice(0, bodyIndex), ...extras, ...merged.slice(bodyIndex)];
}

export function requiredSectionsFor(type: ArticleType): readonly SectionId[] {
  return sectionsFor(type)
    .filter((s) => s.required)
    .map((s) => s.id);
}

/**
 * 読者ページの器が必ず出す節。**原稿に書かせない。**
 *
 * ここに入れてよいのは「実際に読者の画面へ出ているもの」だけ。
 * 出ていないものを入れると、出していない項目を出したことにして
 * 公開ゲートを通せてしまう（ゲートが飾りになる）。
 *
 * 対応する表示箇所:
 *   breadcrumb → `presentation/site/page-frame.tsx`
 *   disclosure / dates / byline / toc / sources / update_log
 *     → `presentation/ui/templates/article-view.tsx`
 *   correction_report → `presentation/ui/templates/site-shell.tsx` の足元
 *   author_profile → 書き手のページ（byline から行ける）
 */
export const TEMPLATE_PROVIDED_SECTIONS: readonly SectionId[] = [
  "breadcrumb",
  "disclosure",
  "dates",
  "byline",
  "toc",
  "sources",
  "update_log",
  "correction_report",
  "author_profile",
];

/**
 * 節ではなく、専用の欄で受け取るもの。
 *
 * タイトルと一文の結論は、本文の節として書かせると
 * 一覧・検索・SNS へ出すときに取り出せない。1 つの欄で受け取る。
 */
export const HEADER_FIELD_SECTIONS: readonly SectionId[] = ["h1", "one_sentence_conclusion"];

/** 原稿に書いてもらう必須の節。入力欄はこの一覧から作る。 */
export function authoredSectionsFor(type: ArticleType): readonly SectionSpec[] {
  const provided = new Set<SectionId>([...TEMPLATE_PROVIDED_SECTIONS, ...HEADER_FIELD_SECTIONS]);
  return sectionsFor(type).filter((s) => s.required && !provided.has(s.id));
}

/**
 * 公開ゲートへ渡す「揃っている節」。
 *
 * 器が出す節と欄で受け取る節は最初から数に入れ、
 * 原稿の節は**中身が空でないものだけ**数える。
 * 空欄を数えると、見出しだけの記事が公開できてしまう。
 */
export function filledSectionIds(
  type: ArticleType,
  bodies: Readonly<Record<string, string | undefined>>,
): readonly SectionId[] {
  const authored = authoredSectionsFor(type)
    .filter((s) => (bodies[s.id] ?? "").trim() !== "")
    .map((s) => s.id);
  return [...TEMPLATE_PROVIDED_SECTIONS, ...HEADER_FIELD_SECTIONS, ...authored];
}

/** 記事に必須セクションが揃っているか。公開ゲートから呼ぶ。 */
export function missingSections(
  type: ArticleType,
  presentSections: readonly SectionId[],
): readonly SectionSpec[] {
  const present = new Set(presentSections);
  return sectionsFor(type).filter((s) => s.required && !present.has(s.id));
}
