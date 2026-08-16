/**
 * 画面に出す言葉の正本。
 *
 * 同じ概念を画面ごとに違う言葉で呼ばないための 1 箇所。
 * 「ワークスペース」と「組織」が混ざると、利用者は別物だと思う。
 *
 * 対応関係:
 *   TERMS      … docs/architecture/ubiquitous-language.md と 1 対 1。ずれたらテストが落ちる。
 *   UI_COPY    … 状態・操作・確認など、辞書に無い画面固有の言い回し。
 *
 * 機械チェック: tests/ui/copy-dictionary.test.ts
 *   - TERMS が辞書と一致しているか
 *   - 「使ってはいけない言い換え」が画面のコードに混ざっていないか
 *
 * 多言語化について:
 *   いまは日本語だけ。ただし後から足せる形にしてある（Locale と resolveCopy）。
 *   文字列を JSX に直接書き始めると、後から抜き出す作業が画面の数だけ発生する。
 */

export type Locale = "ja";

export const DEFAULT_LOCALE: Locale = "ja";

/* ------------------------------------------------------------------------ */
/* 1. 概念の呼び名（ユビキタス言語辞書と 1 対 1）                              */
/* ------------------------------------------------------------------------ */

export const TERMS = {
  // 組織と権限
  workspace: "ワークスペース",
  brand: "ブランド",
  site: "サイト",
  membership: "メンバー",
  role: "役割",
  capability: "できること",
  actor: "実行者",

  // 商品
  product: "商品",
  productIdentity: "商品の同定",
  merchantOffer: "販売情報",
  comparisonSet: "比較セット",
  specifications: "仕様",
  productVariant: "商品バリエーション",

  // 主張と根拠
  claim: "主張",
  evidence: "根拠",
  testRun: "検証記録",
  provenance: "由来",
  factuality: "事実と推測の区別",

  // 順位
  rankingModel: "評価基準",
  criterion: "評価軸",
  scoreCard: "採点表",
  rankingResult: "順位",

  // 記事
  contentPackage: "コンテンツパッケージ",
  contentVariant: "コンテンツ版",
  siteBlueprint: "サイトブループリント",
  articleType: "記事種別",
  sectionSpec: "記事の節",
  audiencePersona: "読者ペルソナ",
  authorPersona: "書き手ペルソナ",
  conversationBlock: "会話ブロック",
  qualityCheck: "品質チェック",
  contentState: "状態",

  // 公開
  channel: "チャネル",
  channelConnection: "接続",
  publishMode: "出し方",
  manualExport: "書き出し",
  publication: "公開ジョブ",
  publishGate: "公開ゲート",

  // 収益
  asp: "ASP",
  affiliateAccount: "ASP アカウント",
  affiliateProgram: "提携プログラム",
  affiliateLink: "成果リンク",
  conversion: "成果",
  periodClosed: "締め",

  // 法令・表示
  disclosure: "広告表示",
  policyRule: "表現ルール",
  auditLog: "監査ログ",

  // 数字
  metric: "指標",
  metricSample: "計測点",
} as const;

export type TermKey = keyof typeof TERMS;

/** 画面から呼ぶときはこれを通す。直接 TERMS を参照しない（多言語化の口を1つに保つ）。 */
export function term(key: TermKey, _locale: Locale = DEFAULT_LOCALE): string {
  return TERMS[key];
}

/* ------------------------------------------------------------------------ */
/* 2. 画面共通の言い回し                                                       */
/* ------------------------------------------------------------------------ */

export const UI_COPY = {
  /** 4 つの状態。文言を画面ごとに変えない。 */
  state: {
    loadingTitle: "読み込んでいます",
    loadingBody: "少しお待ちください。",
    emptyTitle: "まだ何もありません",
    /** 空のときは「何をすれば埋まるか」を必ず添える。無言の空白を出さない。 */
    emptyBodyFallback: "最初の 1 件を登録すると、ここに表示されます。",
    errorTitle: "うまくいきませんでした",
    errorBodyFallback: "時間をおいて、もう一度お試しください。",
    forbiddenTitle: "この操作はできません",
    forbiddenBodyFallback: "必要な権限がありません。ワークスペースの管理者にご相談ください。",
  },

  /** 操作。動詞を統一する（「保存」と「登録」を混ぜない）。 */
  action: {
    save: "保存",
    saving: "保存しています",
    cancel: "やめる",
    close: "閉じる",
    back: "戻る",
    next: "次へ",
    retry: "もう一度試す",
    create: "追加",
    edit: "編集",
    remove: "削除",
    duplicate: "複製",
    preview: "下書きを見る",
    submitForReview: "確認を依頼する",
    approve: "承認する",
    requestChanges: "差し戻す",
    publish: "公開する",
    schedule: "予約する",
    unpublish: "公開を取り下げる",
    export: "書き出す",
    search: "探す",
    filter: "絞り込む",
    reset: "条件を戻す",
    run: "計算する",
    showDetails: "内訳を見る",
    hideDetails: "内訳を閉じる",
  },

  /** 入力欄。作法は全画面で同じ（src/presentation/ui/README.md を参照）。 */
  field: {
    optional: "任意",
    autoFilled: "自動で入りました",
    autoSource: "由来",
    resetToAuto: "自動の値に戻す",
    required: "入力してください",
    invalid: "形式が正しくありません",
    placeholderNone: "",
  },

  /** 取り消せない操作の確認。文言を変えない（毎回同じ形で聞く）。 */
  confirm: {
    title: "この操作は取り消せません",
    removeBody: "削除すると元に戻せません。よろしいですか。",
    publishBody: "公開すると、誰でも見られる状態になります。よろしいですか。",
    keepGoing: "続ける",
    stop: "やめる",
  },

  /** 時間のかかる処理。進捗を隠さない。 */
  progress: {
    queued: "順番待ちです",
    running: "実行しています",
    partial: "一部だけ終わりました",
    done: "終わりました",
    failedTitle: "途中で止まりました",
    cancel: "中止する",
    /** 秒数ではなく「何が終わって何が残っているか」を出す。 */
    stepFormat: "{done} / {total} 件",
  },

  /** 通知。消えてよいものだけトーストにする。失敗は画面に残す。 */
  toast: {
    saved: "保存しました",
    copied: "コピーしました",
    undo: "元に戻す",
  },

  /** まだ中身が無いもの。隠さず、そう名乗る。 */
  stub: {
    label: "見本",
    title: "ここはまだ見本です",
    bodyFormat: "{what}はまだつながっていません。",
    blockedByPrefix: "使えるようになる条件: ",
  },

  /** 事実と推測の区別。読者向けの言い方。 */
  factuality: {
    fact: "根拠あり",
    inference: "推測",
    opinion: "意見",
    factNote: "出典を確認できる内容です。",
    inferenceNote: "根拠から導いた推測です。断定ではありません。",
    opinionNote: "書き手の意見です。",
  },

  /** 広告表示。法令に関わるため、ここ以外に書かない。 */
  disclosure: {
    /** 景品表示法（ステルスマーケティング告示, 2023-10-01 施行）に基づく表示。 */
    bannerTitle: "広告を含みます",
    bannerBody:
      "この記事には広告（アフィリエイトリンク）が含まれます。リンクを経由して購入された場合、運営者に報酬が支払われることがあります。順位や評価には影響しません。",
    rankingNote: "順位づけに報酬額は使用していません。評価基準は公開しています。",
    methodologyLink: "評価方法を見る",
    policyLink: "広告に関する方針",
    /** 全ページの足元に常時出す一文。記事だけに出すと、一覧経由の読者に伝わらない。 */
    footerNote:
      "当サイトは広告（アフィリエイトリンク）による収益を得ています。報酬の有無と金額は、掲載商品の選定にも順位にも影響しません。",
  },

  /** 順位の説明。読者にもAIにも同じ言葉で出す。 */
  ranking: {
    rankColumn: "順位",
    productColumn: "商品",
    totalScoreColumn: "総合",
    excludedTitle: "選外にしました",
    excludedReasonLabel: "理由",
    criteriaTitle: "評価基準",
    criterionWeight: "重み",
    criterionMeasurement: "測り方",
    updatedAt: "評価日",
  },

  /** 根拠の表示。出典が無いときに黙らない。 */
  evidence: {
    sourceLabel: "出典",
    checkedAt: "確認日",
    noEvidenceTitle: "根拠がまだありません",
    noEvidenceBody: "根拠のない内容は、推測として表示しています。",
    expired: "根拠の有効期限が切れています",
  },

  /** 承認の流れ。 */
  approval: {
    draft: "下書き",
    review: "確認中",
    approved: "承認済み",
    scheduled: "予約済み",
    published: "公開中",
    archived: "取り下げ済み",
    humanRequired: "公開には人の承認が必要です",
    aiCannotApprove: "AI の操作は承認とみなしません",
  },

  /** 読者向けブログの記事。 */
  article: {
    publishedAt: "公開",
    updatedAt: "更新",
    author: "書き手",
    reviewedBy: "監修",
    /** 一覧が 0 件のとき。読者から見て故障と区別できるようにする。 */
    emptyListTitle: "まだ記事がありません",
    emptyListBody: "最初の記事を準備しています。公開までしばらくお待ちください。",
    searchEmptyTitle: "見つかりませんでした",
    searchEmptyBody: "言葉を短くするか、別の言い方でもう一度お試しください。",
  },

  /** 探す・気になる商品・問い合わせ。読者が自分で操作する画面。 */
  reader: {
    searchLabel: "探したい言葉",
    searchHint: "商品名でも、「持ち運びやすい」のような言い方でも構いません。",
    searchSubmit: "探す",
    searchPrompt: "言葉を入れて探してください。",
    searchResultFormat: "「{query}」の結果 {count} 件",
    shortlistTitle: "気になる商品",
    shortlistEmpty: "まだ保存された商品はありません。記事の中の「気になる」から保存できます。",
    contactLabel: "お問い合わせ内容",
    contactEmailLabel: "返信先のメールアドレス",
    contactSubmit: "送信する",
    contactSending: "送信しています",
    contactNote: "記事の誤りのご指摘は、訂正のページに記録して公開します。",
  },

  /** ナビゲーション。 */
  nav: {
    skipToContent: "本文へ移動",
    breadcrumbLabel: "現在の場所",
    mainNavLabel: "主なメニュー",
    currentPage: "現在のページ",
  },
} as const;

/**
 * 文言の差し込み。`{name}` を置き換える。
 * 文字列連結を画面に書かせないための入口（語順が言語で変わるため）。
 */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in values ? String(values[key]) : whole,
  );
}
