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

  // 使い勝手を直す（改善要望）
  // 「バグ」「チケット」「トリアージ」は辞書の禁止表に入れてある。
  // 送る人は不具合かどうかを判定できないし、判定を求めると送られなくなる。
  feedbackReport: "改善要望",
  handoff: "払い出し",
  handoffPrompt: "指示文",
  feedbackCapture: "そのときの画面",
  redaction: "黒塗り",
  integrationKey: "連携の鍵",
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
    /**
     * **この 2 つは、画面から呼ばない。呼び出しが無いのは書き忘れではない。**
     *
     * できない理由は `requireCapability()`（`src/domain/identity/permissions.ts`）が
     * 作る。そこでは必ず「何ができないか」と「必要な権限名」と「誰に頼めばよいか」が
     * 入る。画面はそれを `Callout` の `reason` へ渡す。`reason` は省略できない型に
     * してあるので、**理由を書き忘れたまま出すことはコンパイルで止まる**。
     *
     * ここに一般の差し替え文を用意して画面へつなぐと、その保証が消える。
     * 理由が作られなかったときに、**それらしい文が代わりに出る**からである。
     * しかもそのとき、読み手の側にだけある文が 1 文以上あることを見ている検査
     * （`tests/ui/page-render-restricted.test.tsx`。文言に依存しない形にしてある）は
     * **緑になる**。黙って消えるのではなく、**埋まって見える**という壊れ方をする。
     *
     * つまり、つなぐと「理由が無いこと」を隠す道具になる。だからつながない。
     * この判断は `tests/ui/copy-dictionary.test.ts` が固定していて、
     * 画面から参照した時点で赤くなる。つなぐ必要が出たら、まず上の検査を
     * 「特定の理由が出ていること」を見る形へ作り直してから来ること。
     */
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

  /**
   * 事実の出どころ 6 種類。
   *
   * 「根拠あり」だけでは、メーカーの公表値と自分たちで測った値が
   * 同じ見た目で並んでしまう。読者はそこを区別して読みたい。
   * 文言は domain の FACT_LABELS と一致させる（テストで固定している）。
   */
  factSource: {
    official: "メーカー公称値",
    measured: "当サイトの測定",
    experience: "テスターの主観",
    inference: "以上から当サイトでは〜と判断",
    external: "利用者レビュー",
    commercial: "販売店提供情報",
  },

  /** 広告表示。法令に関わるため、ここ以外に書かない。 */
  disclosure: {
    /**
     * 景品表示法（ステルスマーケティング告示, 2023-10-01 施行）に基づく表示。
     *
     * **同じ文を読者ページの AI 向けの道具（`reader_get_disclosure`）も返す。**
     * 部品は業務層を読まない決まり（`tests/ui/ui-layers.test.ts`）なので
     * ここでは文字を書くが、`domain/compliance/disclosure.ts` の
     * `READER_DISCLOSURE_TEXT` と**1 文字でも違えばテストが落ちる**
     * （`tests/ui/disclosure-text.test.ts`）。`factSource` と同じ扱い。
     * 直すときは両方を直す。片方だけ直すと、画面と AI の断りが食い違う。
     */
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
    ctaColumn: "販売ページ",
    ctaLabel: "販売ページで確認する",
    /** 提携が無い商品を、空欄にせずこう書く。空欄は「貼り忘れ」に見える。 */
    ctaBlocked: "案内できる販売先がありません",
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
    /** 目次。節が 3 つ以上のときだけ出す（2 つ以下では逆に読みにくい）。 */
    tocTitle: "目次",
    /** 更新履歴。公開ゲートはこれが出ていることを前提に必須項目を通す。 */
    historyTitle: "更新履歴",
    historyPublished: "公開しました",
    historyUpdated: "内容を見直しました",
    historyNoUpdate: "公開してから直した箇所はありません。",
  },

  /**
   * 無いブログを開いたとき。
   *
   * **画面の中身と通信の答えを別々に決めない。** ここは `not-found.tsx` から
   * だけ使い、HTTP は 404 で返す。見た目だけ「見つかりません」にして 200 を返すと、
   * 検索エンジンには実在するページとして載り、公開後の見張りも壊れに気づけない。
   *
   * ブログ名を書かないのは、Next.js の `not-found.tsx` が
   * アドレスの `[site]` の値を受け取らないため。無い名前を推測して出すより、
   * 戻り先を確実に示すほうが読者は先へ進める。
   */
  siteMissing: {
    title: "このブログは見つかりませんでした",
    /** 見出しの繰り返しを避ける。同じ文を 2 回読み上げても情報は増えない。 */
    detailTitle: "指定されたブログはありません",
    body: "アドレスが変わったか、公開が取り下げられた可能性があります。",
    suggestedAction: "アドレスの綴りをご確認ください。",
    backToList: "公開中のブログの一覧を見る",
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

  /**
   * 改善要望。**送る側は開発の言葉を知らない前提で書く。**
   *
   * 「不具合」「起票」のような言葉を使うと、書ける人だけが書くようになる。
   * ここで足りるようにしておけば、画面ごとに言い回しを作る必要がない。
   */
  feedback: {
    openButton: "改善したいことを送る",
    modalTitle: "改善したいことを送る",
    screenLabel: "いま開いている画面",
    kindLabel: "どれに近いですか",
    kindNotWorking: "うまく動かない",
    kindHardToUse: "使いにくい・直したい",
    kindWantFeature: "こんな機能がほしい",
    bodyLabel: "改善したいこと",
    bodyHint: "うまく書けなくて構いません。いつ・どこで・何をしたら困ったか、思い出せる範囲で書いてください。",
    wishLabel: "どうなってほしいですか",
    wishHint: "思いつかなければ空のままで送れます。",
    wishMissing: "記入はありません。",
    disclosureTitle: "一緒に送るもの",
    disclosureBody:
      "画面の名前・アドレス・画面の大きさ・エラーの記録・直前の操作を一緒に送ります。お名前とメールアドレスは、作業する側へ渡す文には入りません。",
    captureTitle: "そのときの画面",
    captureTake: "画面の写しを撮る",
    captureRetake: "撮り直す",
    captureDrop: "画像を外す（文章だけで送る）",
    captureUndo: "元に戻す",
    capturePasteHint: "画像を貼り付ける（Ctrl+V）か、ファイルを選んでも追加できます。",
    captureUnavailable:
      "この環境では画面の写しを撮れません。文章だけでも送れます（貼り付けかファイル選択でも追加できます）。",
    captureIncomplete:
      "画面の写しは、開いている部分だけが写ります。画面の外にあるものは写りません。",
    captureRedactHint: "見せたくないところは黒塗りで隠してください。黒塗りは画像そのものに焼き込みます。",
    toolPen: "手書き",
    toolRect: "四角",
    toolArrow: "矢印",
    toolText: "文字",
    toolRedact: "黒塗り",
    colorRed: "赤",
    colorBrown: "茶",
    colorBlue: "青",
    colorBlack: "黒",
    textToPlace: "入れる文字",
    /**
     * 台紙をキーボードだけで使うときの言い回し。
     *
     * 印の位置は画素の座標なので、**見えない人には画面から一切分からない。**
     * 位置と、いま始点を決めたのかどうかを、文字にして読み上げへ渡す。
     * ここが無いと、経路だけはあるが「どこに置いたか分からないまま置く」になる。
     */
    captureKeyboardHint:
      "キーボードでも印を付けられます。台紙へ移動して、矢印キーで位置を動かし、Enter で始点を決め、もう一度 Enter で確定します。Esc でやめられます。Shift を添えると細かく動きます。",
    captureKeyboardPosition: "位置",
    captureKeyboardIdle: "始点を決めていません",
    captureKeyboardAnchored: "始点を決めました。もう一度 Enter で確定します",
    captureKeyboardPlaced: "印を確定しました",
    captureKeyboardCancelled: "描きかけをやめました",
    submit: "送る",
    sending: "送っています",
    sent: "送りました。ありがとうございます。",
    /** 一覧・詳細で使う言い回し。 */
    listTitle: "使い勝手を直す",
    emptyTitle: "まだ改善要望はありません",
    emptyBody: "画面の右下の「改善したいことを送る」から、気づいたことを送れます。",
    handoffTitle: "作業する側へ渡す",
    handoffCopyPrompt: "Claude Code 用の指示文をコピー",
    handoffCopyCommand: "取得コマンドをコピー",
    handoffMarkDone: "払い出し済みにする",
    handoffIdempotent: "同じ要望からは、何度押しても同じ指示文が出ます。二重に作業になりません。",
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
