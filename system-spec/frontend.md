---
status: confirmed
category: frontend
aggregate: 確定
spec_cells: [frontend.web, frontend.mobile, frontend.tablet, frontend.desktop-windows, frontend.desktop-linux, frontend.desktop-macos]
serves_goals: [G1, G2]
---

# フロントエンド (frontend)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-seo-approved-diff-20260906。裏付け質疑 (`qa_refs`): `qa-frontend-web-fixed-header-seo-aio-v6`, `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-ogp-fallback-v6`, `qa-request-thumbnail-coverage-v6`, `qa-frontend-web-blog-composition-visibility`, `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-seo-approved-diff-20260906 (対応セル: web)

**質問**: 2026-09-06、提示済み eval-log/affiliate-hub/current-worktree/elegant-review/20260906/seo-change-proposal.md への続行確認。承認対象は次の変更提案全体（これは提示内容の要約で、利用者の逐語回答ではない）: 記事と変更前後の差分を運営者が確認し、承認した対象だけを反映する。夜間処理は観測だけを行う。記事更新・変更前後の履歴・所見の反映済み状態を同一の確定単位で保存し、途中失敗時は全体を変更しない。反映と取消は読み出した版との一致を確認し、同時編集や取消前の追加編集を上書きしない。対象範囲は元記事の作成日時で判定し、導入前の記事と作成日時不明の記事はこの反映経路から除外する。SEO実績は選択したブログ・記事と同じページの観測時刻付き推移へ接続し、クリック数だけで因果効果を断定しない。

**回答**: つづけて

### qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 追従ヘッダー・サムネイル・構造化データ・AI 向け表現物 (llms-full.txt と WebMCP) を、画面の側の要件としてどう書き分けるか。直前の qa-frontend-web-fixed-header-seo-aio-v5 は AI 向けの出力を目次のみ (llms.txt) として要件化していたが、2026-09-03 の対等提示による再確認で全文提供へ変わり、さらに WebMCP が加わったため差し替える

**回答**: （対等提示での再確認）２で、webmcpとか使えばいい？／llms-full.txt ＋ WebMCP の両方／自動生成のOGP画像で埋める／各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。

### qa-neutral-aio-policy-v7 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索（AIO）へ向けて、記事の内容をどこまで出しますか。(a) 目次のみ（llms.txt）＋AI学習は許可 — 題名・URL・短い説明だけを出す。【利点】本文は自サイトへ読みに来てもらう形が保たれ、流入が維持される。出す情報が少ないので生成の経路も軽い。後から全文へ広げる余地が残る。【懸念】AI 検索面が本文を引用しにくく、被引用の機会は全文提供より減る。学習許可により自分の文章は学習に使われる。(b) 全文（llms-full.txt）まで出す — 【利点】AI 検索面が本文を引用しやすく、被引用の機会が最も多い。AI 経由の可視性が最大になる。【懸念】本文が自サイトの外で読めてしまうため流入は減りうる。一度出した本文は取り消せない。(c) 何も出さず AI 学習も拒否 — AI 向けの表現物を作らない。【利点】実装コストがゼロで、生成・更新・混入事故の面倒が一切生じない。自分の文章が学習にも引用にも使われず、著作物の管理が手元に完全に残る。読者は必ず自サイトへ来る。【懸念】AI 検索経由の可視性は得られない。今後 AI 検索の比重が上がった場合、後から方針を変えても失った期間は取り戻せない。（2026-09-04 AskUserQuestion『AIO方針』。独立監査 C06 が qa-neutral-aio-policy-v6 の質問文自体を『(a)(b) は「利点＋懸念」の対称構成なのに (c) だけ肯定的な言い回しが一切なく、実装コストがゼロ・学習データへの不使用というありうる利点が書かれていない。否定側の排除に類する機序として中立回答を妨げる疑いがある』と指摘したため、3 案とも「利点＋懸念」を揃えて再提示した。順序は前回と同一。利用者の選択は前回と同じ (b) で変わらなかった）

**回答**: (b) 全文まで出す

### qa-neutral-ai-surface-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: AI 検索への出し方はどの形にしますか。(a) llms-full.txt ＋ WebMCP の両方 — AI 検索に引用される経路と、AI エージェントに検索・記事取得を使わせる経路の両方を持つ。実装は 2 系統分増える。WebMCP はまだ新しい仕様で対応するエージェントが限られるため、効果が出るのは先になる。(b) llms-full.txt のみ — AI 検索への被引用を狙う目的に対してはこれだけで十分で、今すぐ効く。実装も静的ファイルの生成だけで済む。サイトを訪れた AI エージェントは、普通の人間と同じように画面を読むしかない。(c) WebMCP のみ — AI エージェントに対しては最も高度なことができる。ただし AI 検索のクローラは WebMCP を呼ばないので、『検索結果に引用される』という今回の目的には直接は効かない。（2026-09-03 AskUserQuestion『AIへの出し方』。利用者が qa-neutral-aio-policy-v6 の回答内で『webmcpとか使えばいい？』と逆質問したことへ、llms-full.txt は取りに来るクローラに読ませるもの・WebMCP は訪れたエージェントに操作させるもので狙う場面が別であると回答したうえで提示した）

**回答**: llms-full.txt ＋ WebMCP の両方

### qa-neutral-ogp-fallback-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 記事に画像が無いとき、一覧のカードをどう埋めますか。(a) 自動生成のOGP画像で埋める — カードの寸法が記事によらず一定になり、読み込み中に版面が飛ばない。外部共有時も画像が付く。生成の実装が要り、題名を直したら作り直す手当ても要る。内容を表さない画像なので実写より情報量は劣る。(b) 無地のプレースホルダを置く — 実装が最も軽く、寸法も一定に保てる。ただし全ての画像なし記事が同じ見た目になるため、一覧でカードを見分ける手がかりにならない。外部共有時の見栄えも弱い。(c) 画像枠ごと省いて高さ可変 — 無意味な画像を出さずに済み、文字情報の密度が上がる。カードの高さが記事ごとに変わるので一覧の視線の流れが乱れ、読み込み中に並びが動く。（2026-09-03 AskUserQuestion『画像不在時』。独立監査 C06 が qa-decision-ogp-fallback-v4 を推奨バッジによる誘導の疑いとして指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者は前回と同じ案を選んだ）

**回答**: 自動生成のOGP画像で埋める

### qa-request-thumbnail-coverage-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 記事一覧のサムネイル表示は、どの画面を対象にしますか。（2026-09-03 利用者発話『各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。』を受けた要件化。発話は表示する場所を『各画面』と『トップ画面』としか述べていないため、対象の具体化はこの entry の設計適用で行い、発話が述べていない事柄を発話由来として扱わない）

**回答**: 各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。

### qa-frontend-web-blog-composition-visibility (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 作ったブログが何で構成されているかが見えず改善に着手できない。どこまで見えれば解決とみなすか。

**回答**: 4つすべてを満たす。(a) 作成直後に読者側の住所が実際に開き、404にならない。(b) 管理画面にそのブログの構成要素 (固定ページ・版面の帯・スロット・カテゴリー・記事) を実データの件数と各実体へのリンク付きで一覧する。(c) 管理画面の中で読者と同じ見た目をプレビューでき、公開前に確認できる。(d) 作成時点で公開に必要なのに無い要素を名指しで提示し、その場へ移動できる。描画は既存の SiteFrame と public-site-projection を通し、読者用と別の描画経路を作らない。作ると管理画面で見える姿と読者が見る姿がずれる。

### qa-frontend-web-capture-self-occlusion (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 改善要望フィードバックで画面の写しを撮るとき、送信モーダルと固定ボタン自身の写り込みをどう扱うか (2026-08-30 利用者ヒアリング)

**回答**: 利用者本人の回答を逐語主旨で記録する。(1) 「改善したい箇所のスクリーンショットを撮ると、編集画面の『改善したいことを送る』という画面が表示され、そのスクリーンショットが貼られてしまう」。(2) 「これでは本当に改善したい箇所を伝えることができない」。(3) 対処の範囲を 3 案 (機能ごと無効化 / 撮影中だけ自動で隠す / モーダルの自動表示だけ止める) で確認したところ、利用者は「撮影中だけ自動で隠す」を選択した。すなわちフィードバック機能そのものは残し、写しの取得が確定するまでの間だけ、送信モーダルと右下の固定ボタンを写しの対象から外す。(4) 撮り直し (再撮影) のときも同じ扱いとする。

### qa-frontend-web-affiliate-link-preview-v3 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 成果リンクを貼り付けた直後、登録判断のために何を画面へ表示するか（2026-08-29 利用者追加入力）

**回答**: アフィリエイトの、えーと、リンクを貼ったら、えーと、その画像、えーと、が表示されるとか、えー、この辺、えー、とりあえず、えー、画面を見て、えー、確認もしておいてください。

### qa-frontend-web-seo-ai-search-v2 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: SEO と AI 検索最適化 (SSR・構造化データ自動生成・robots/sitemap/RSS/llms.txt・IndexNow・鮮度表示) の実装契約と、最新ガイドライン出典の取り込み経路をどうするか。2026-08-24 対話ヒアリング (利用者原文を逐語主旨で記録) + 同日ウェブ調査。

**回答**: 利用者本人の回答を逐語主旨で記録する。
(1) 合わせて、SEO や AI による『その SEO に変わるやつ』(AI 検索・生成 AI 回答での引用) にも対応できるようにしておく。AI からの検索や評価が高くなるような仕組みにしておく。
(2) 最新のこれらの情報 (SEO / AI 検索最適化のガイドライン) をウェブから、海外も日本の情報も含めて取得した上で、それを反映できるようなブログを構築できるようにしておく。
#### 調査結果 (2026-08-24、海外+日本。一次情報と業者推定を区別)
- 一次情報: Google Search Central『AI 最適化ガイド』(2026-05-15 公開) は、AI Overviews / AI Mode が既存ランキング+RAG+query fan-out で動き、追加の技術要件は無く、index 可能かつ snippet 表示可能であることが唯一の条件、llms.txt や特別な schema は不要と明言する。Search Console に AI 機能由来の impressions を見る report がある。
- 一次情報: llms.txt (Answer.AI) は root の /llms.txt に Markdown を置く規約で正式標準ではない。IndexNow (Bing/Yandex/Naver/Seznam) は URL 更新 push で Google 非対応。ChatGPT search の retrieval は Bing index 由来のため IndexNow が AI 検索への到達経路になる。
- 海外/日本の業者知見 (推定値扱い): AI クローラ (GPTBot / ClaudeBot / PerplexityBot / Google-Extended) を遮断しない、各節冒頭に 2〜3 文の『答え』、統計・出典の明記、FAQPage/HowTo/Article/Person/Organization/BreadcrumbList の JSON-LD、最終更新日と『〜時点』の可視化、著者ページ (E-E-A-T)、AI 引用の定点観測。日本では FAQ 構造化データと結論ファーストを優先する論調が多く、アフィリエイト記事は一次体験・独自比較表・図解が有利。
#### frontend 章への反映方針
- 公開面は SSR/ISR で本文を HTML に含め、semantic HTML (article/section/h1〜h3/time) で出力する。robots.txt はテンプレート既定で AI クローラを許可し、ブログ単位で拒否リストを設定できる。
- ブロック構造から JSON-LD を自動生成する: BlogPosting/Article・Person (著者)・Organization・BreadcrumbList・FAQPage (FAQ ブロック)・HowTo (手順ブロック)・Product/Review (比較表・レビュー)。schema.org の型・必須プロパティを検証する pure 関数を置き、テストで妥当性を確認する。
- 配信: sitemap.xml・RSS/Atom・/llms.txt (低コスト・効果未確認と明記) を自動生成し、公開・更新時に IndexNow へ送信する (API key はブログ単位、秘密はサーバ側のみ)。
- 鮮度: 各記事に dateModified を出し、公開面にも『最終更新日』『〜時点』を表示する。
- 最新情報の取り込み: SEO / AI 検索ガイドラインの出典 (Google AI 最適化ガイド・AI 機能ページ・llms.txt・IndexNow) を仕様状態の targets / fetched-references に登録し、doc-fetch (C02) と鮮度監査 (C08) で再取得・再照合できるようにする。アプリ側は参照レジストリ (guideline_references) を DB に持ち、管理画面で確認日・要約を更新できる。

- (注記: 正本 qa_log[qa-frontend-web-seo-ai-search-v2].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-frontend-web-blog-builder (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: ブログテンプレート/テーマ/常時表示レイアウト/法定ページ/図解・比較ブロックの実装契約をどうするか。2026-08-24 対話ヒアリング (利用者原文を逐語主旨で記録)。参考ブログ https://makuring.jp/ は構成のみ参考にし、文章・素材は転用しない。同サイトの機械取得は本セッションで拒否されたため、構成の一次根拠は利用者の説明とする。

**回答**: 利用者本人の回答を逐語主旨で記録する。
(1) ブログを作成するための UI を構築・変更したい。今後様々なブログを作るため、ブログごとにテンプレートを元に作成できるようにする。
(2) ブログの色合い (配色) はその都度選択して構成を変更できるようにする。ページ単位で「このページはこの色合い」と調整できるようにする。
(3) ブログに関して、見える部分 (公開面)・作成する部分 (編集)・保存する部分 (永続化)・管理上で一覧表示する部分 (管理一覧) のそれぞれで、どのブログにどのアフィリエイトが反映されているかを管理できる UI/UX にする。
(4) 参考ブログ (makuring.jp) を丸パクリせず、配置・構成・タイトルの表記方法・トップページから作れるページ種別を参考に構築する。文章はそのまま使わない。
(5) 運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせを含めて全て構築できるようにする。
(6) 各ページの構成・記事の見やすい配置・図解・比較などの表現パターンも参考にして構築できるようにする。
(7) 参考ブログはガジェット前提だが本システムはガジェット限定ではないので、ジャンル依存部分 (スペック表など) は差し替え・調整できるようにする。
(8) サイドバー・ヘッダー・フッターは常に見えるようにする。参考ブログはスクロールで流れてしまうので、スクロール追従 (sticky) で整える。
(9) 今回で全ての内容を実装したいので、要件定義からタスク管理表まで作成する。
#### frontend 章への反映方針
- ブログ構成は宣言的データ (blog blueprint) とし、レンダリングは共通コンポーネント群 (Next.js/React) が担う。テンプレート = セクション型カタログの組合せ、テーマ = デザイントークン集合 (色は light-dark() で解決)。
- レイアウト部品: StickyHeader / StickySidebar / Footer を共通 layout に固定し、ページテンプレートはメイン領域だけを差し替える。
- 記事ブロック: figure(図解)/comparison(比較表)/cta/summary/spec-table(ジャンル依存スロット) の block 型を持ち、エディタで挿入・並べ替えできる。
- 固定ページ: 運営者情報/サイトポリシー/プライバシーポリシー/特定商取引法/お問い合わせ/全カテゴリー を固定ページ型テンプレートから生成し、フッターへ自動導線。お問い合わせは既存フォーム基盤 (改善要望フィードバック) を再利用する。
- 管理画面: ブログ一覧・ブログ詳細 (テンプレート/テーマ/掲載アフィリエイト) ・テーマ編集・テンプレート編集を単一用途画面として分離する。
- 参考サイトの文章・画像は取り込まず、構成のみ参照する。

- (注記: 正本 qa_log[qa-frontend-web-blog-builder].answer が見出しを含むため、章の階層を守ってコンパイラが深い階層へ押し下げた。文字は変えていない)

### qa-frontend-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 改善要望の送信モーダルは何を見せ、何を強制しないか (書面入力 docs/spec/12 §5)

**回答**: - **FB-AC-07**: 「この画面から一緒に送られるもの」を展開でき、自動収集される項目を送信前に確認できる。隠さない。
- **FB-AC-09**: 画面の写しが**完全でないことがある**ため、「この画面には、絵として写しにくい部品があります。撮れた画像を確かめてください。」を常に表示し、プレビューを見てから送る。完全性を保証しない。
- **FB-AC-10**: 「撮り直す」「**画像を外す（文章だけで送る）**」を常に選べる。貼り付け（Ctrl+V）とファイル選択も受け付ける。**画像なしでも送信は成立する。**

### qa-frontend-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: フロントエンド (frontend) × web のアーキテクチャは何か (2026-08-16 対話ヒアリング)

**回答**: 現行構成で確定。技術基盤は現行リポジトリの構成(Next.js + Cloudflare Workers/OpenNext + D1 + Drizzle ORM)を正として仕様に確定する。

### qa-frontend-web-analytics (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: Analytics 拡張の画面ビュー要件は何か (書面入力 docs/spec/03 §8)

**回答**: v1.0 22.8章のフィルタに加えて、次のビューを定義する。
| ビュー | 内容 |
| --- | --- |
| パフォーマンス概要 | 期間比較付きの主要KPI(PV/クリック/CTR/発生・承認CVR/承認・支払EPC/承認・支払報酬)。watermarkによる速報・確定・遅延を区別 |
| ファネル | 表示→閲覧→リンク表示→クリック→成果発生→承認→支払 の残存率。consent区分と対象ディメンションを表示 |
| 切り口分析 | angle × 媒体 のヒートマップ(CTR/EPC切替)。セルにnを常時表示 |
| 配置分析 | 記事テンプレート上に placement 別CTRをオーバーレイ表示 |
| リンク台帳 | TrackingLink 単位の一覧。CTR・EPC・状態・掲載先。並べ替え・CSV出力 |
| インサイト受信箱 | InsightReport の一覧。確認→適用(Brief作成へ遷移)→却下 |
| 実験 | Experiment の事前登録値、探索率、holdout、進捗、信頼区間、guardrail |
| ASP突合状況 | プログラム別の成果件数・承認率・突合率・取り込みエラー |

### qa-frontend-web-overhaul-v2 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: frontend×web: 単一用途画面分割・基本管理機能・再利用コンポーネント・マルチブログ/マルチ SNS 対応のフロントエンド要件は何か (2026-08-21 利用者ヒアリング逐語)

**回答**: 利用者本人の回答を逐語主旨で記録する。(1) 管理画面を単一用途ごとの画面に分割する (一覧・詳細・作成・編集の分離)。(2) 各管理対象に新規作成・削除を含む基本 CRUD 操作の UI を備える。(3) 1 つの商品に対して複数のブログを対応付けられる構成にする。各ブログにはそれぞれのコンセプトがあり、コンセプトごとに文章を作成できる UI にする。(4) SNS は X・Facebook など様々なものに対応できる拡張可能なチャネル構成とし、各 SNS への投稿状態が画面に反映されるようにする。(5) UI はコンポーネント化して再利用する。ハードコーディングの重複を書かず共通化する。(6) ブログごとにブログの構成を作成したい。新しくブログを構築する際には、そのブログごとにコンポーネントを作成できる仕様にする (ブログ単位の構成テンプレート/コンポーネントセットを定義・管理できる)。(7) 既存スタック (Next.js/React) を継続使用する。

## 意思決定 (decisions)

> **本章を主担当とする論点だけ**を載せる。全 8 件の一覧・候補比較・推奨根拠は [`00-requirements-definition.md`](./00-requirements-definition.md) にある。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 |

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 実装確定の書き戻し — feat-blog-ui-builder (P13、2026-08-30)

> 上の「確定内容 (質疑録)」は**方針**である。本節は `feat-blog-ui-builder` (P01〜P12) の
> 実装で**実際に確定した契約**と、方針と実装がずれた点を記録する。
> **方針を書き換えず、差分として足してある。**ずれを上書きで消すと、なぜその形になったかが読めなくなる。

### 1. テーマ実装契約 — 2 層 + 単一読み取り口

配色は 3 段で解決する。

```
page_theme_override（ページ単位の例外）
        ↓ 無ければ
blog_theme（ブログ既定）
        ↓ 無ければ
site_blueprint.theme（設計図の既定）
```

**確定した契約 — 読む口は `publicBlogAppearance()` の 1 本だけ。** 公開面も管理画面もここを通る。
別の読み方を作ると、同じブログの配色について 2 つの画面が別の値を出す
(2026-08-30 に実際に発生。`docs/spec/feat-blog-ui-builder/migration-report.md` §2)。

**確定した契約 — 2 層で上書きできるのは色 (`brandTheme`) と明暗 (`colorMode`) だけ。**
余白 (`density`) と角丸 (`radius`) は設計図のみ。
ページごとに骨格が変わると読者が「同じサイトだ」と思えなくなるためである。

**確定した契約 — dark を light の単純反転にしない**
(`tests/ui/theme-contrast.test.ts` が止める)。数値上 AA を満たしても暗所で眩しくなる。
11 配色 × light/dark = 22 通りが WCAG 2.2 AA を満たすことを実測済み。

方針の「色は light-dark() で解決」はそのまま成立している。

### 2. コンポーネント契約 — テンプレートは「並び方」だけを決める

テンプレートは 6 種で確定した (`src/domain/authoring/blog-template.ts`)。
`review_focus` / `comparison_focus` / `howto` / `news` / `minimal` / `gadget`。

**確定した契約 — テンプレートは記事の中身を知らない。** 決めるのは 4 つのみである。

- トップの区画の並び (`homeSections`)
- 記事ブロックの推奨順 (`articleBlockOrder`)
- サイドバーを既定で出すか (`sidebar`。`news` と `minimal` は `false`)
- 追加で薦める固定ページ (`suggestedPages`)

**「このテンプレートでは図解が使えない」の類を書いてはならない。**
書くとテンプレート差し替えの瞬間に既存記事の図解が消える。
`orderBlocksForTemplate()` は推奨順に無い種類を末尾へ元の順のまま付け、**1 つも落とさない**。

方針にあった `StickyHeader` / `StickySidebar` / `Footer` は実装済みである。
ただし受入 A3 (sticky 常時表示) の判定は保留で、単体・受入テストは緑だが
**「常時表示」の言葉の意味が受入文言として定まっていない**
(`docs/spec/feat-blog-ui-builder/final-review.md`)。

表現ブロックは 10 種で確定した。`answer` `key_points` `faq` `sources` `freshness`
`figure` `comparison` `cta` `summary` `spec_table`。
方針の 5 種 (figure/comparison/cta/summary/spec-table) に、AI 検索向けの 5 種が加わった形である。
記事ブロックの並びは全テンプレート共通で
`[answer, key_points]` で始まり `[faq, sources, freshness]` で終わる。
先頭が結論でないと AI 検索に途中から切り取られ、
信頼を確かめる材料は読み終わったところに置くためである。

### 3. SEO / AI 検索実装契約 (A10〜A14)

#### 3.1 JSON-LD — 画面と機械向け出力は同じ読み取りモデルから作る

**確定した契約 — 別の組み立てを置かない。**
置くと、記事を直したのに sitemap だけ古い、が起きる。

**確定した契約 — 構造化データを HTML に埋めるときは `<` を `<` に逃がしてから埋める。**
逃がさないと、本文に `</script>` を含む記事でスクリプトが途中で閉じ、
以降の JSON が本文として描画される。

**確定した契約 — 更新日は JSON-LD の `dateModified` と `<time dateTime>` で同じ値を出す。**
2 か所で別々に組み立てると、読者に見える日付と機械が読む日付がずれる。

**確定した契約 — 報酬・運営情報は読者向け読み取りポートを通さない。**

#### 3.2 sitemap / robots / RSS / llms.txt

**確定した契約 — origin は届いたリクエストの Host から作る。環境変数に固定しない。**
固定すると、プレビュー環境が本番の URL を書いた sitemap を出す。

**確定した契約 — `llms.txt` は設計図の任意項目。出さない設定なら 404 を返す (空ファイルを返さない)。**
空ファイルは「用意したが中身が無い」と読まれ、404 は「用意していない」と読まれる。意味が違う。

方針の「効果未確認と明記」は維持する。**Google は llms.txt を使わないと明言している。**

#### 3.3 IndexNow — 鍵の環境変数分離

**確定した契約 — 鍵はリポジトリ・管理画面・D1 のいずれにも置かず、Worker の環境変数 `INDEXNOW_KEY` だけに置く。**
鍵ファイル `/indexnow.txt` の中身が鍵そのもので、それが所有権の証明であるためである。
方針の「API key はブログ単位、秘密はサーバ側のみ」のうち、
**実装は環境変数 1 本に確定した** (ブログ単位ではない)。

**確定した契約 — 鍵が無いときは記事の公開は通り、通知だけが飛ばない。**
通知は届けば早くなるだけのもので、届かなくても記事は出る。
公開を止める設計にすると、鍵の設定漏れが公開停止として現れる。

担保している spec は 4 本ある。`tests/domain/seo/indexnow.test.ts` (送信判断の純関数) /
`tests/infrastructure/indexnow-client.test.ts` (鍵が無いときの送信スキップ) /
`tests/presentation/publish-article-indexnow.test.ts` (公開時の連動) /
`tests/architecture/open-doors.test.ts` (外向きに開いた口の台帳)。

#### 3.4 guideline_references — 90 日再確認

**確定した契約 — 90 日の判定は `referenceReviewStatus` だけが行う。画面側で数え直さない。**
2 か所で数えると、時差や境界の扱いが食い違ったときどちらが正しいか決められなくなる。

**確定した契約 — 90 日を超えた行は「再確認」と表示し、自動では消さない。**
消すと、古い指針に基づいた記事が残っていることに気付けなくなる。

**確定した契約 — ガイドラインの中身が変わったときは仕様セルを R4-reopen する。**
アプリのレジストリを直しただけでは仕様は動かない。
方針にあった「doc-fetch (C02) と鮮度監査 (C08) で再取得・再照合」はこの経路である。

**確定した契約 — 記事公開後の AI 検索点検は公開の条件にしない。**
条件にすると、点検を通すために内容を歪める力が働く。足りない項目は直し方 (hint) まで出す。

2026-08-30 時点の実測では、レジストリの登録は 0 件で、コードに書かれた候補 4 件
(Google AI 最適化ガイド / AI features and your website / llms.txt / IndexNow) は
すべて「原典未取得」である。**90 日の判定は動くが、判定する対象が無い。**

### 4. 方針どおりにならなかった点 (2026-08-30 時点で未解決)

| 方針 | 実装の現状 | 影響 |
|---|---|---|
| 固定ページ 6 種を固定ページ型テンプレートから生成しフッターへ自動導線 | **固定ページの語彙が 2 系統に割れている** (`SiteDocumentKey` 9 種 / `FixedPageKind` 8 種、同じ `legal_page` 表) | 18 経路のうち 12 経路が 404。新しい種別を足せない |
| 公開面は SSR/ISR で本文を HTML に含める | **公開記事の本文が 1 文字も出ていない** (H1 記事名 / H2「この記事の評価」のみ) | JSON-LD の元になるブロックが載る場所そのものが空 |

証跡は `docs/spec/feat-blog-ui-builder/evidence/11-a4-a13-http-status.txt` および
同 `evidence/README.md` §3.1 にある。原因の分析は `migration-report.md` §3。

**この 2 件を解いていない状態では、§3.1 の JSON-LD 契約は「あるべき契約」であって
現状の説明ではない。** 契約が守られていることの確認は、本文が出てから行う。

- 正本へ入れた理由: feat-blog-ui-builder P01〜P12 の実装で確定したテーマ実装契約・コンポーネント契約・SEO/AI検索実装契約 (JSON-LD/sitemap/IndexNow/guideline_references) を、方針を上書きせず差分として正本へ記録する。章へ直接書くと compile で消えるため。

### 記事カードの図版と題名リンクの読み上げ契約（2026-09-06）

同じ現行契約の全文と記録理由は [記事カードの図版と題名リンクの読み上げ契約（2026-09-06）](ui-ux.md) を参照。本章にも同じ契約を適用する。

### SEOの現行承認契約（2026-09-06）

同じ現行契約の全文と記録理由は [SEOの現行承認契約（2026-09-06）](database.md) を参照。本章にも同じ契約を適用する。

### Search Console検索語内訳の管理画面表示（2026-09-08実装確認）

同じ現行データ・表示契約の全文と記録理由は [Search Console検索語内訳の管理画面表示（2026-09-08実装確認）](database.md) を参照。frontendにも同じ段階表示と読取専用の契約を適用する。

- 正本へ入れた理由: GSC検索語の完成snapshot・再取得状態・上限と選択記事UIを同じ意味へ同期する。旧QA・公開履歴・feature評価と全163仕様のSTALEを保持する。

### 意思決定が本章に効く形

- **`decision-ui-theme-implementation` が本章に効く形**: 09 §2 は「配色 × 明暗の掛け合わせを設定として持たない」と書いている。`light-dark()` は掛け合わせを CSS 側で解く仕組みそのものなので、この禁止が実装の形で担保される。Tailwind の `dark:` クラス方式だと、禁じられている掛け合わせがクラス名として現れてしまう。Tailwind は配置と余白に使い、**色だけ `light-dark()`** にする。

- 正本へ入れた理由: 手書きの「意思決定 (decisions)」節に在った章固有の注釈。表と件数は正本から生成するようにしたため節ごと置き換わるが、注釈は正本から導けないので移した(2026-09-08 / ah-lwmf)。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| presentation | Apple Human Interface Guidelines | 画面設計・操作フロー・情報階層・アクセシビリティの上流原則 | https://developer.apple.com/design/human-interface-guidelines |
| application-architecture | Robert C. Martin — Clean Architecture | レイヤ境界・依存方向 (内向き)・ユースケース中心設計 | Clean Architecture (2017), the Dependency Rule |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| presentation | 引用可 | 第 1 章 Purpose — Make something meaningful. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Purpose) / 第 2 章 Agency — Let people do things their own way. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Agency) / 第 3 章 Responsibility — Act in people's best interest. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Responsibility) / 第 4 章 Familiarity — Build on what people know. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Familiarity) / 第 5 章 Flexibility — Adapt to diverse contexts and needs. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Flexibility) / 第 6 章 Simplicity — Be clear and direct. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Simplicity) / 第 7 章 Craft — Care about every detail. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Craft) / 第 8 章 Delight — Make it human. (https://developer.apple.com/design/human-interface-guidelines/design-principles#Delight) |
| application-architecture | **条項引用不可** — 取得経路が原理的に無い (この作業場所では永久に不可) | authority が書籍 (Clean Architecture, 2017) で、source_ref も URL ではなく書名と規則名の記述。fetched-references.json の取得対象 8 件のいずれでもなく、retrieval-evidence にも record が存在しない。この作業場所には書籍本文を取得する経路が無い。 |

- **presentation の引用範囲**: 取得物は Design principles の記事 1 本 (機械可読 endpoint, 26295 B)。引用根拠にできるのは**この記事に実在する 8 原則の名称・一文の定義・各原則配下の詳細項目の文言**まで。HIG の他ページ (Layout, Accessibility, Typography 等) は取得していないので、そこの主張を要件文の根拠にはできない。chapter 番号は Apple が付けたものではない — 記事は 8 つの h2 を番号無しで並べているだけで、ここでの番号は取得物の並び順に付けた序数である。番号を Apple の章番号として引かないこと。

- **application-architecture の反転先**: 反転先は無い。理由は難しさではなく、この作業場所が書籍本文を取得できないこと。fetched-but-no-body と not-in-fetch-targets は取得すれば塞がるが、これは塞がらない。3 種を『条項引用不可』の一語に潰すと、次に読む人が書籍を取りにいくか、取れるものを諦めるかのどちらかを必ず間違える。reason_class を消さないこと。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Clean Architecture — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-architecture.md`

#### 目的

変化しやすいUI、DB、framework、外部サービスから、長く保持したい業務ルールとuse caseを隔離し、技術交換やテストを目的達成の阻害要因にしない。

#### 解決する問題

- 業務ルールがcontroller/ORM/UI lifecycleへ埋まり、単体で検証できない。
- 外部技術変更が内側のuse caseまで波及し、置換費用を予測できない。
- 入出力形式やvendor型が境界を越え、責務と所有者が曖昧になる。

#### 適用条件

- business ruleが外部I/Oより長寿命で、UI/DB/providerの変更可能性がある。
- 複数delivery channelや外部integrationから同じuse caseを再利用する。
- 重要なpolicyを高速・決定論的にテストする価値が、境界導入費を上回る。

#### 非適用条件

- 寿命の短い検証用prototypeで、交換可能性より学習速度が明確に優先される。
- domain ruleがほぼ無い単純変換scriptで、port/adapterが実質的な抽象を生まない。
- 外部製品そのものがsystemの目的で、抽象化すると必要機能が失われる。ただしsecurity/audit boundaryは別途必要。

#### トレードオフ・失敗モード

- 境界、DTO、mapping、dependency injectionの量が増え、小規模systemでは認知負荷が先行する。
- 「4層を作ること」が目的化すると、変化軸のないinterfaceやpass-through use caseが増える。
- domain modelを万能化してdelivery固有の制約を隠すと、現実のlatency/transaction/error semanticsを見失う。
- portを外側が定義したりinner layerがORM型を返したりすると、名前だけcleanな依存逆転になる。

#### goalへの寄与

- `essential_purpose`に直結するpolicyを外部詳細から守り、goal達成ロジックの検証を速くする。
- 制約に「vendor lock-in低減」「複数platform」「高い変更頻度」がある場合、変更範囲と移行riskを局所化する。
- 適用判断は「何層あるか」でなく、守るgoal、予想される変更、boundary testで観測する。

---

#### 本章での適用

- 本章固有の原則採否 (確定内容・接地根拠ごとの `採否` / 根拠 / トレードオフ) は [`applied/frontend.md`](applied/frontend.md) にある。
- 章本文と別ファイルにしてあるのは、適用メモが確定セルの数だけ積み上がり、章の分量の見積もりを押し上げるためである (内容は 1 行も落としていない)。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| nextjs | 16.3.4 | Vercel (nextjs.org) | https://nextjs.org/docs | 2026-09-02T09:14:35Z | 2026-09-02T09:14:35Z |
| mdn-light-dark | 2026-04-18 | Mozilla (developer.mozilla.org) | https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/light-dark | 2026-08-22T15:05:07Z | 2026-08-22T15:05:07Z |
| llms-txt | 2026-08-10 | Jeremy Howard (Answer.AI) (llmstxt.org) | https://llmstxt.org/ | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |
| webmcp | 2026-09-03 | W3C Web Machine Learning Community Group (webmachinelearning.github.io) | https://webmachinelearning.github.io/webmcp/ | 2026-09-03T22:38:16Z | 2026-09-03T22:38:16Z |

## 状態の意味 (State semantics)

- `confirmed` / 「確定」は Analytics 画面要求の**判断済み**を表し、画面実装や受入試験の完了を表さない。
- 後段の `採否: applied` は設計に採用したことを表し、画面実装済みを表さない。
- 本章の実装状態は `partial`、検証状態は `unverified`。「Analytics 拡張」は未実装。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/03` §7〜§8、`00-requirements-definition.md` の I3〜I4、および本章の公式出典とする。

## As-Is

- `src/app/page.tsx` に D1 から最大20件を読む案件一覧がある。空状態と DB 接続失敗状態は表示する。
- `WebMcpProvider` と `/api/mcp` による WebMCP / Remote MCP PoC、`list_programs` / `record_conversion` / `get_revenue_summary` の3ツールがある。
- Analytics のルート、KPI、ファネル、ヒートマップ、インサイト受信箱、実験、ASP突合画面は未実装。

## To-Be

| 要件ID | 目標状態 |
|---|---|
| FRONT-REQ-001 | `docs/spec/03` §8 の8ビューを、共通の Workspace / 期間 / ディメンション条件で表示する |
| FRONT-REQ-002 | 発生見込・承認報酬・支払報酬をラベル・定義・数値のいずれでも混同させず、合算値を単一の「確定収益」として表示しない |
| FRONT-REQ-003 | 比較セルにnと期間を常時付与し、設定閾値未満は結論・率・勝者操作を抑止する |
| FRONT-REQ-004 | データ取得とドメイン判断を分離し、UI は同じ KPI 定義の表示モデルのみを消費する |

## Delta

1. 案件一覧は維持し、Analytics ルートとサーバー側データ取得境界を追加する。
2. KPI 式をコンポーネント内に重複実装せず、Analytics API / rollup の定義を唯一の入力にする。
3. 速報/確定、n不足、同意の影響、更新時刻を共通表示モデルで扱う。

## Dependencies

`auth / Workspace context` → `tenant 付き Analytics API` → `MetricRollup / KPI dictionary` → `Analytics 表示モデル` → `8ビュー`

- 生イベントテーブルを画面から直接参照しない。同意ゲート、速報/確定判定、n閾値は backend/database/security の正本に従属する。

## Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| FRONT-ACC-001 | `commission_amount_pending=1000円` / `commission_amount_approved=500円` / `commission_amount_paid=300円` の fixture を表示 | 「発生見込 1,000円」「承認報酬 500円」「支払報酬 300円」が別表示され、合算値を「確定収益」とする表示がない。コンポーネントテストとスクリーンショットを保存 |
| FRONT-ACC-002 | `n < configured_min_sample` の比較セル | nと「サンプル不足」を表示し、率・勝者ラベル・結論操作を表示しない/無効化する。境界値前後の自動テストを保存 |
| FRONT-ACC-003 | Analytics API が `503`の後に復旧 | 何が起き、データが安全か、次の行動が何かを表示。「再試行」の1回で復帰する E2E 記録を保存 |
| FRONT-ACC-004 | Workspace A から B のクエリ条件を送信 | B の数値・名前・件数を DOM / RSC payload / CSV に含まないことを統合テストで証明 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.frontend.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | frontend × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-seo-approved-diff-20260906` |
| 資するゴール (serves_goals) | G1, G2 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | written-requirements |
| 出典 path | `docs/spec/12-改善要望フィードバック仕様.md` |
| 出典 節 | §5 送信モーダル（FB-AC-04〜10） |
| 出典 sha256 | `ccd052dfcbf69cbd8a0b5b4d16f2912267dd15afef81fb3dd23717ba50a36c39` |
| 適用された設計知識 (design_applications) | 6 件 — 本章 `## 適用された設計知識` を参照 |

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## 章にしか無い記述 (正本へ未接続)

> 以下の 8 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)`, `##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)`, `### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)`, `### 章にしか無い記述 (正本へ未接続)`, `##### qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)`, `##### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `### compile が保てなかった行 (要判断)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)

**質問**: frontend×web: 追従ヘッダーの実装方針と、SEO/AIO を強くするための構造化データ・OGP・画像の版面確保・llms.txt 参照をどう要件化するか（2026-09-03 利用者追加入力）

**回答**: DevToolでしっかりとこの情報を分析解析を行って、SEO的に強いような要素をしっかりと反映して、SEOやAIO、AIのSEOのようなものに対しても対応できるようにしておいてください。それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）AIO は目次のみ（llms.txt）を出し、AI学習は許可する。画像が無い記事は自動生成のOGP画像で埋める。

##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)

- 確定要件: DevToolでしっかりとこの情報を分析解析を行って、SEO的に強いような要素をしっかりと反映して、SEOやAIO、AIのSEOのようなものに対しても対応できるようにしておいてください。それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）AIO は目次のみ（llms.txt）を出し、AI学習は許可する。画像が無い記事は自動生成のOGP画像で埋める。
- 設計解釈の記録経路: `dialogue`
- 原則: 表現物ごとに何を残し・落とし・加工するかを決め、機械可読の宣言と人間可読の版面を同じ情報源から導く (`ref-system-design-knowledge:information-design`)
  - 採否: `applied`
  - 章固有の根拠: 参照サイト観測 (同第5節) では head に title・description・canonical・`max-image-preview:large`・OGP 6種・Twitter Card `summary_large_image`・RSS alternate が揃い、JSON-LD は `@graph` に Person / Organization / WebSite を持ち、`WebSite.potentialAction` が SearchAction (`?s={s}`) を宣言する。一方トップに BreadcrumbList / ItemList の宣言は無い (同第7節)。本システムはこの観測済み要素を全て満たしたうえで、観測 gap を埋める: トップページの記事束を ItemList、下層を BreadcrumbList、記事を BlogPosting として宣言する。これら構造化データ・OGP・title/description は記事本文と同じデータ源から導出し、人間向け版面と機械向け宣言が食い違わないようにする。画像が無い記事は自動生成 OGP 画像を同じ経路で埋める
  - トレードオフ:
    - JSON-LD の種類を増やすと本文と宣言の乖離が起きやすくなるため、宣言は必ず記事データからの導出とし、手書きの上書き経路を設けない
    - AI 向けの目次 (llms.txt) を出すと本文への流入が減る可能性があるが、利用者は目次のみ提供・AI学習許可を選択したため、全文 (llms-full.txt) は出さない
- 原則: 見た目の安定と操作の予測可能性を、装飾ではなく版面の寸法宣言とフォーカス制御で担保する (`ref-system-design-knowledge:usability-accessibility`)
  - 採否: `applied`
  - 章固有の根拠: 参照サイトは img 54 件すべてに width/height と sizes を、52 件に srcset を持たせており (同第4節)、比較対象サイト (width/height 7/59・sizes 2/59) と明確に差が付いていた。読み込み中のレイアウト移動は読者の視線と誤タップの両方を壊すため、本システムも全画像に固有の width/height/sizes/srcset を必須とし、16:9 のカード枠を寸法で先取りする。追従ヘッダーは position:sticky で実装し、その高さぶんの余白と見出しの scroll-margin を同じ変数から導いて、アンカー移動時の見出し埋没を防ぐ。検索の重ね表示はフォーカストラップと Escape 復帰を備える
  - トレードオフ:
    - 全画像への寸法必須化は投稿時の手間を増やすため、寸法は投稿時に自動採寸して保存し、書き手に入力させない
    - sticky ヘッダーは高さ変化で余白計算が崩れるため、縮小表示への切替は高さを変えず内側の要素だけを詰める

> 以下の 2 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 検索最適化の分析結果を、ブログへどう反映しますか。(a) 提案を出し、運営者が承認して反映 — 公開中の本文や宣言が書き手の確認を経ずに書き換わることがない。承認の記録が残り、後から反映の理由を辿れる。反映の速度が運営者の作業量で律速し、明らかに直すべき所見も承認されなければ放置されうる。(b) 機械が自動で反映し事後通知 — 運営者の手数が最小で、所見が放置されない。一方で機械が公開中の本文と宣言を書き換えるため、書き手の意図した表現が壊れうる。公開後に取り消しても検索側の記録は元に戻らない。(c) 表示するだけで反映機構は作らない — 実装量が最も少なく、誤った自動変更のリスクがゼロ。分析結果を見ても直す作業は全て手作業になるため、所見と実際の記事のあいだが人の手でしか埋まらない。（2026-09-03 AskUserQuestion『反映方法』。独立監査 C06 が qa-decision-aeo-application-mode-v5 を推奨バッジによる誘導の疑いとして指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者の選択は前回の (a) から (b) へ変わった）

**回答**: 機械が自動で反映し事後通知

##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-neutral-application-mode-v6` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 人の承認を外すなら、取り消しの経路を承認より先に作る (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 推奨表示を外して再提示したところ選択が (a) 承認制 から (b) 自動反映 へ反転した。前回の qa-decision-aeo-application-mode-v5 は『取り消しの効かない変更は人の判断を挟まずに実行させない』という原理を適用していたが、対等な提示のもとで利用者は自動反映を選んだ。設計原理は決定を正当化する道具であって決定を決める権限を持たないため、原理の適用先を『承認を課す』から『承認が無い状態を安全にする』へ移す。承認という事前の関門が無くなったぶん、事後の可逆性が唯一の防御になる — よって反映は必ず差分として記録され、1 操作で元へ戻せ、何がいつなぜ変わったかが運営者へ通知される。この 3 つが揃わない反映経路を実装として持たない。可逆性が担保できない種類の変更 (外部へ出た後の表現物など) は、この経路の対象から外し qa-neutral-auto-scope-v6 の範囲制限で扱う
  - トレードオフ:
    - 自動反映は運営者の手数を最小にする代わりに、書き手の推敲した表現が機械の都合で書き換わりうる。差分履歴と取り消しで元へ戻せる形にして受け止める
    - 事後通知は読まれない前提で設計する必要があるため、通知を見逃しても後から変更の一覧を辿れる面を用意し、通知そのものを可逆性の担保にしない

### 章にしか無い記述 (正本へ未接続)

> 以下の 2 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)`, `##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

##### qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)

**質問**: frontend×web: 追従ヘッダーの実装方針と、SEO/AIO を強くするための構造化データ・OGP・画像の版面確保・llms.txt 参照をどう要件化するか（2026-09-03 利用者追加入力）

**回答**: DevToolでしっかりとこの情報を分析解析を行って、SEO的に強いような要素をしっかりと反映して、SEOやAIO、AIのSEOのようなものに対しても対応できるようにしておいてください。それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）AIO は目次のみ（llms.txt）を出し、AI学習は許可する。画像が無い記事は自動生成のOGP画像で埋める。

####### 確定内容 qa-frontend-web-fixed-header-seo-aio-v4 (対応セル: web)

- 確定要件: DevToolでしっかりとこの情報を分析解析を行って、SEO的に強いような要素をしっかりと反映して、SEOやAIO、AIのSEOのようなものに対しても対応できるようにしておいてください。それら検索がしっかりと強くなるような、そういうなるような構成にしておいてください。／（追加確認への回答）AIO は目次のみ（llms.txt）を出し、AI学習は許可する。画像が無い記事は自動生成のOGP画像で埋める。
- 設計解釈の記録経路: `dialogue`
- 原則: 表現物ごとに何を残し・落とし・加工するかを決め、機械可読の宣言と人間可読の版面を同じ情報源から導く (`ref-system-design-knowledge:information-design`)
  - 採否: `applied`
  - 章固有の根拠: 参照サイト観測 (同第5節) では head に title・description・canonical・`max-image-preview:large`・OGP 6種・Twitter Card `summary_large_image`・RSS alternate が揃い、JSON-LD は `@graph` に Person / Organization / WebSite を持ち、`WebSite.potentialAction` が SearchAction (`?s={s}`) を宣言する。一方トップに BreadcrumbList / ItemList の宣言は無い (同第7節)。本システムはこの観測済み要素を全て満たしたうえで、観測 gap を埋める: トップページの記事束を ItemList、下層を BreadcrumbList、記事を BlogPosting として宣言する。これら構造化データ・OGP・title/description は記事本文と同じデータ源から導出し、人間向け版面と機械向け宣言が食い違わないようにする。画像が無い記事は自動生成 OGP 画像を同じ経路で埋める
  - トレードオフ:
    - JSON-LD の種類を増やすと本文と宣言の乖離が起きやすくなるため、宣言は必ず記事データからの導出とし、手書きの上書き経路を設けない
    - AI 向けの目次 (llms.txt) を出すと本文への流入が減る可能性があるが、利用者は目次のみ提供・AI学習許可を選択したため、全文 (llms-full.txt) は出さない
- 原則: 見た目の安定と操作の予測可能性を、装飾ではなく版面の寸法宣言とフォーカス制御で担保する (`ref-system-design-knowledge:usability-accessibility`)
  - 採否: `applied`
  - 章固有の根拠: 参照サイトは img 54 件すべてに width/height と sizes を、52 件に srcset を持たせており (同第4節)、比較対象サイト (width/height 7/59・sizes 2/59) と明確に差が付いていた。読み込み中のレイアウト移動は読者の視線と誤タップの両方を壊すため、本システムも全画像に固有の width/height/sizes/srcset を必須とし、16:9 のカード枠を寸法で先取りする。追従ヘッダーは position:sticky で実装し、その高さぶんの余白と見出しの scroll-margin を同じ変数から導いて、アンカー移動時の見出し埋没を防ぐ。検索の重ね表示はフォーカストラップと Escape 復帰を備える
  - トレードオフ:
    - 全画像への寸法必須化は投稿時の手間を増やすため、寸法は投稿時に自動採寸して保存し、書き手に入力させない
    - sticky ヘッダーは高さ変化で余白計算が崩れるため、縮小表示への切替は高さを変えず内側の要素だけを詰める

> 以下の 2 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)`, `##### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

##### qa-neutral-application-mode-v6 (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 検索最適化の分析結果を、ブログへどう反映しますか。(a) 提案を出し、運営者が承認して反映 — 公開中の本文や宣言が書き手の確認を経ずに書き換わることがない。承認の記録が残り、後から反映の理由を辿れる。反映の速度が運営者の作業量で律速し、明らかに直すべき所見も承認されなければ放置されうる。(b) 機械が自動で反映し事後通知 — 運営者の手数が最小で、所見が放置されない。一方で機械が公開中の本文と宣言を書き換えるため、書き手の意図した表現が壊れうる。公開後に取り消しても検索側の記録は元に戻らない。(c) 表示するだけで反映機構は作らない — 実装量が最も少なく、誤った自動変更のリスクがゼロ。分析結果を見ても直す作業は全て手作業になるため、所見と実際の記事のあいだが人の手でしか埋まらない。（2026-09-03 AskUserQuestion『反映方法』。独立監査 C06 が qa-decision-aeo-application-mode-v5 を推奨バッジによる誘導の疑いとして指摘したため、推奨表示を外し 3 案を対等に並べて再提示した。順序は前回と同一。利用者の選択は前回の (a) から (b) へ変わった）

**回答**: 機械が自動で反映し事後通知

####### 接地根拠 qa-neutral-application-mode-v6 (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-neutral-application-mode-v6` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 人の承認を外すなら、取り消しの経路を承認より先に作る (`ref-system-design-knowledge:secure-by-design`)
  - 採否: `applied`
  - 章固有の根拠: 推奨表示を外して再提示したところ選択が (a) 承認制 から (b) 自動反映 へ反転した。前回の qa-decision-aeo-application-mode-v5 は『取り消しの効かない変更は人の判断を挟まずに実行させない』という原理を適用していたが、対等な提示のもとで利用者は自動反映を選んだ。設計原理は決定を正当化する道具であって決定を決める権限を持たないため、原理の適用先を『承認を課す』から『承認が無い状態を安全にする』へ移す。承認という事前の関門が無くなったぶん、事後の可逆性が唯一の防御になる — よって反映は必ず差分として記録され、1 操作で元へ戻せ、何がいつなぜ変わったかが運営者へ通知される。この 3 つが揃わない反映経路を実装として持たない。可逆性が担保できない種類の変更 (外部へ出た後の表現物など) は、この経路の対象から外し qa-neutral-auto-scope-v6 の範囲制限で扱う
  - トレードオフ:
    - 自動反映は運営者の手数を最小にする代わりに、書き手の推敲した表現が機械の都合で書き換わりうる。差分履歴と取り消しで元へ戻せる形にして受け止める
    - 事後通知は読まれない前提で設計する必要があるため、通知を見逃しても後から変更の一覧を辿れる面を用意し、通知そのものを可逆性の担保にしない

- 正本へ入れた理由: 章の生成節の内側へ手で書かれており、compile のたび消えていた散文。内容は正本から導けないため、消えようのない場所へ移した (2026-09-08 / ah-lwmf)。

### compile が保てなかった行 (要判断)

> 正本から導出できず、節・小節の引き継ぎでも守れなかった 12 行。版の更新のように**正しく消える行**も混ざる。正本へ接続するか、不要と確かめて消すこと。この節は compile のたびに作り直す。

- `| webmcp | 2026-09-02 | W3C Web Machine Learning Community Group (webmachinelearning.github.io) | https://webmachinelearning.github.io/webmcp/ | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |`
- `| Web (web) | 確定 | 確定質疑: qa-frontend-web-fixed-header-seo-aio-v6。裏付け質疑 (`qa_refs`): `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-ogp-fallback-v6`, `qa-neutral-application-mode-v6`, `qa-request-thumbnail-coverage-v6`, `qa-frontend-web-blog-composition-visibility`, `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |`
- `### qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `- 確定要件: （対等提示での再確認）２で、webmcpとか使えばいい？／llms-full.txt ＋ WebMCP の両方／自動生成のOGP画像で埋める／各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。`
- `| webmcp | 2026-09-02 | W3C Web Machine Learning Community Group (webmachinelearning.github.io) | https://webmachinelearning.github.io/webmcp/ | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |`
- `| Web (web) | 確定 | 確定質疑: qa-frontend-web-fixed-header-seo-aio-v6。裏付け質疑 (`qa_refs`): `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-ogp-fallback-v6`, `qa-neutral-application-mode-v6`, `qa-request-thumbnail-coverage-v6`, `qa-frontend-web-blog-composition-visibility`, `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |`
- `### qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `- 確定要件: （対等提示での再確認）２で、webmcpとか使えばいい？／llms-full.txt ＋ WebMCP の両方／自動生成のOGP画像で埋める／各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。`
- `| presentation | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | apple-hig は取得済み (retrieval-evidence/apple-hig.json, 17681 B) だが、取得物は JavaScript シェルで本文を含まない。可視テキストは 'This page requires JavaScript. Please turn on JavaScript in your browser and refresh the page to view its content.' のみ、見出し 1 件 (同文)、テキストを持つリンク 0 件。取得できているのはページの殻であって内容ではないため、引くべき条項がそもそも取得物に存在しない。 |`
- `- **presentation が引用可になる条件**: JS 実行後の DOM を取得できる経路 (browser-render 等) で本文を取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得経路を変えれば塞がる穴であって、塞げない穴ではない。`

- 正本へ入れた理由: 章の生成節の内側へ手で書かれており、compile のたび消えていた散文。内容は正本から導けないため、消えようのない場所へ移した (2026-09-08 / ah-lwmf)。

## compile が保てなかった行 (要判断)

> 正本から導出できず、節・小節の引き継ぎでも守れなかった 21 行。版の更新のように**正しく消える行**も混ざる。正本へ接続するか、不要と確かめて消すこと。この節は compile のたびに作り直す。

- `| webmcp | 2026-09-02 | W3C Web Machine Learning Community Group (webmachinelearning.github.io) | https://webmachinelearning.github.io/webmcp/ | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |`
- `| Web (web) | 確定 | 確定質疑: qa-frontend-web-fixed-header-seo-aio-v6。裏付け質疑 (`qa_refs`): `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-ogp-fallback-v6`, `qa-neutral-application-mode-v6`, `qa-request-thumbnail-coverage-v6`, `qa-frontend-web-blog-composition-visibility`, `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |`
- `### qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `- 確定要件: （対等提示での再確認）２で、webmcpとか使えばいい？／llms-full.txt ＋ WebMCP の両方／自動生成のOGP画像で埋める／各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。`
- `| webmcp | 2026-09-02 | W3C Web Machine Learning Community Group (webmachinelearning.github.io) | https://webmachinelearning.github.io/webmcp/ | 2026-09-03T12:43:18Z | 2026-09-03T12:43:18Z |`
- `| Web (web) | 確定 | 確定質疑: qa-frontend-web-fixed-header-seo-aio-v6。裏付け質疑 (`qa_refs`): `qa-neutral-aio-policy-v7`, `qa-neutral-ai-surface-v6`, `qa-neutral-ogp-fallback-v6`, `qa-neutral-application-mode-v6`, `qa-request-thumbnail-coverage-v6`, `qa-frontend-web-blog-composition-visibility`, `qa-frontend-web-capture-self-occlusion`, `qa-frontend-web-affiliate-link-preview-v3`, `qa-frontend-web-seo-ai-search-v2`, `qa-frontend-web-blog-builder`, `qa-frontend-web-spec-intake`, `qa-frontend-web`, `qa-frontend-web-analytics`, `qa-frontend-web-overhaul-v2` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |`
- `### qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `##### 確定内容 qa-frontend-web-fixed-header-seo-aio-v6 (対応セル: web)`
- `- 確定要件: （対等提示での再確認）２で、webmcpとか使えばいい？／llms-full.txt ＋ WebMCP の両方／自動生成のOGP画像で埋める／各画面のサムネイルを表示するようにしておいてくださいね。トップ画面にはサムネイルを表示するようにもしておいてください。`
- `| presentation | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | apple-hig は取得済み (retrieval-evidence/apple-hig.json, 17681 B) だが、取得物は JavaScript シェルで本文を含まない。可視テキストは 'This page requires JavaScript. Please turn on JavaScript in your browser and refresh the page to view its content.' のみ、見出し 1 件 (同文)、テキストを持つリンク 0 件。取得できているのはページの殻であって内容ではないため、引くべき条項がそもそも取得物に存在しない。 |`
- `- **presentation が引用可になる条件**: JS 実行後の DOM を取得できる経路 (browser-render 等) で本文を取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得経路を変えれば塞がる穴であって、塞げない穴ではない。`
- `> 正本 `decisions[]` の全 7 件。**7 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。`
- `| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |`
- `| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |`
- `| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | database |`
- `| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |`
- `| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |`
- `| **`decision-ui-theme-implementation`** | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | **frontend** |`
- `| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |`
- `| `decision-screen-priority` | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | `opt-performance-first` | confirmed | G1, G2 | ui-ux |`
