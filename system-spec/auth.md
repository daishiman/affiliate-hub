---
status: confirmed
category: auth
aggregate: 確定
spec_cells: [auth.web, auth.mobile, auth.tablet, auth.desktop-windows, auth.desktop-linux, auth.desktop-macos]
serves_goals: [G1]
---

# 認証(ログイン) (auth)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web |
| モバイル (mobile) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末のセキュアストレージ・生体認証・OS のアカウント連携を認証経路に持たない。セッションはブラウザの Cookie に一本化し、端末固有のトークン保管とその失効設計を対象から外す。 |
| タブレット (tablet) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末のセキュアストレージ・生体認証・OS のアカウント連携を認証経路に持たない。セッションはブラウザの Cookie に一本化し、端末固有のトークン保管とその失効設計を対象から外す。 |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末のセキュアストレージ・生体認証・OS のアカウント連携を認証経路に持たない。セッションはブラウザの Cookie に一本化し、端末固有のトークン保管とその失効設計を対象から外す。 |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末のセキュアストレージ・生体認証・OS のアカウント連携を認証経路に持たない。セッションはブラウザの Cookie に一本化し、端末固有のトークン保管とその失効設計を対象から外す。 |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: Web 以外を対象外にした帰結として、端末のセキュアストレージ・生体認証・OS のアカウント連携を認証経路に持たない。セッションはブラウザの Cookie に一本化し、端末固有のトークン保管とその失効設計を対象から外す。 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | auth × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-auth-web` |
| 資するゴール (serves_goals) | G1 |
| required-info | `auth-model` — missing_effect: block / 接地: 済 (`qa-auth-web`) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 2 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`auth`) を主担当とする **1 件**。全 15 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール |
|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 |

- **`decision-auth-method` の caveat**: ライブラリ更新の追従を保守運用 (maintenance-ops) に組み込むこと / 組織 (Workspace) 管理UIは自作となる

## 確定内容 (質疑録)

### qa-auth-web (対応セル: web)

**質問**: 認証 (auth) × web の方式は何か (2026-08-16 対話ヒアリング)

**回答**: A. Better Auth (Better Auth + Google OAuth) を選択。無料・OSS で、D1/Drizzle アダプタにより現行の Next.js + Cloudflare Workers + D1 スタックと同居できる。Google ログインを初期提供し、メール/パスワード・パスキーは後続拡張とする。セッションは D1 に保存し、Workspace 単位のマルチテナント分離と §25 のロール (Owner/Admin/Researcher/Writer/Reviewer/Publisher/Analyst) 権限をアプリ層で紐付ける。外部公開・予約投稿等の重要操作は認証済みユーザーの明示承認を必須とする。

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 意思決定が本章に効く形

正本 `decisions[]` の一覧と状態は `00-requirements-definition.md` が正本から生成する。
**ここには表を写さない。**写した表は正本が動いても追従せず、2026-09-04 まで
「全 7 件」と書かれたまま残った (実際には 12 件) のがその実例である。

本章に効くのは 1 件だけである。

- **`decision-auth-method` の caveat**: ライブラリ更新の追従を maintenance-ops に
  組み込むこと。採用は「費用ゼロ・ロックインなし」で得たので、追従を止めた時点で
  その前提が消える。
- **G3 (AEO/SEO) の 4 決定は本章を主担当としない。**構造化データの生成・解析・
  基準の再確認・履歴保持は、いずれも認証の境界の内側で動く既存の管理画面経路に
  乗る。認証方式そのものを動かす論点は含まれていない。

- 正本へ入れた理由: 各章の手書き意思決定表は正本 decisions[] の写しで、件数が 7 のまま古びていた。表は 00-requirements-definition.md が正本から生成するので削る。削れない章固有の突き合わせ (この決定が本章にどう効くか) を正本へ移し、compile の純関数出力として復元されるようにする。

### 章の規範本文を正本から再生成しない理由

`## 確定セルの記録` は 2026-09-04 から compile が正本 `matrix` / `qa_log` から描く。
一方で **章の規範本文 (To-Be 契約表・故障モード・初期 SLO・Acceptance evidence) は
正本から再生成しない。** その判断の根拠となる 3 つの実測 (再生成で消える 374 行 /
正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が
8 件中 7 件で不一致) は `system-spec/database.md` の同じ節に 1 か所だけ書いてある。
**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

- 正本へ入れた理由: 確定セルの記録を compile 生成へ移したため、その節の内側に手で書かれていた散文が 次の再生成で消える。散文が守っているのは「章の規範本文を正本で置き換えない」という 判断で、これは今も生きている。消えようのない場所 (正本) へ移して compile に描かせる。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| authentication | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | owasp-asvs は取得済み (retrieval-evidence/owasp-asvs.json, 67761 B) だが、取得したのは project landing page であって ASVS 本体ではない。ASVS の章番号・要件番号は本体側にあり landing page には無いため、引くべき条項が取得物に存在しない。 |
| security | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | authentication と同一 authority・同一取得物 (landing page)。条項が取得物に無い点も同じ。 |

- **authentication が引用可になる条件**: 章番号・要件番号を持つ ASVS 本体 (公式配布の要件文書) を targets[] に足して取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。
- **security が引用可になる条件**: authentication の reversal と同じ。ASVS 本体を取得できた日に両 concern を同時に available へ変える。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Secure by Design — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/secure-by-design.md`

#### 目的

利用者の注意や運用後のpatchへ安全性を押し付けず、systemのdefault、architecture、development lifecycleに安全な結果を組み込み、被害可能性と復旧費を下げる。

#### 解決する問題

- 認証・認可・data protectionが後付けで、business flowと矛盾する。
- defaultが過大権限/公開状態で、利用者の完全な設定に安全性が依存する。
- 単一防御の突破で全面侵害になり、検知・封じ込め・復旧の証拠が無い。
- dependency、secret、build、releaseの供給chain riskが製品境界外として放置される。

#### 適用条件

- identity、個人/機密data、金銭、外部入力、admin操作、multi-tenant boundaryを扱う全system。
- compromise時の影響がgoal、法規、信頼、運用継続を損なう。
- vendor/serviceを使う場合も、共有責任とfailure/exit planを明示できる。

#### 非適用条件

- security自体が不要なsystemは原則ない。asset/threatが極小ならcontrolを軽量化できるが、根拠付きrisk acceptanceが必要。
- controlがthreatを減らさず、accessibility/availability/safetyを重大に損なう場合はそのcontrolを採用しない。代替・補償統制を設計する。
- checklist準拠だけでproject固有のtrust boundaryとabuse caseを置き換えない。

#### トレードオフ・失敗モード

- friction、latency、delivery費、運用負荷が増えるため、risk reductionと明示的に釣り合わせる。
- security theaterとしてcontrol数だけ増やし、owner、evidence、responseを持たない。
- fail closedを無差別適用してavailability/safety incidentを起こす。degraded modeとbreak-glass監査が必要。
- secretを隠しても過大権限や長期credentialを残す、暗号化してもkey lifecycleを設計しない等の局所最適。
- free tier製品を価格だけで選び、audit、export、retention、MFA、incident support不足を見落とす。

#### goalへの寄与

- stakeholderの安全・信頼・継続性をsuccess criteriaへ変換し、threat/control/evidenceをgoalへトレースする。
- security controlは「導入済み」ではなく、阻止/検知/復旧時間、権限範囲、data exposureで効果を測る。
- 予算0制約でも、secure default、最小data、短命credential、標準機能、open-source検査を優先し、残余riskを隠さない。

---

#### 本章での適用

##### 確定内容 qa-auth-web (対応セル: web)

- 確定要件: A. Better Auth (Better Auth + Google OAuth) を選択。無料・OSS で、D1/Drizzle アダプタにより現行の Next.js + Cloudflare Workers + D1 スタックと同居できる。Google ログインを初期提供し、メール/パスワード・パスキーは後続拡張とする。セッションは D1 に保存し、Workspace 単位のマルチテナント分離と §25 のロール (Owner/Admin/Researcher/Writer/Reviewer/Publisher/Analyst) 権限をアプリ層で紐付ける。外部公開・予約投稿等の重要操作は認証済みユーザーの明示承認を必須とする。
- 設計解釈の記録経路: `dialogue`
- 原則: 最小権限の原則: ロールごとに操作可能範囲を限定し、公開・削除等の重要操作は承認フローを経る (`docs/spec/01-要求仕様書-v1.0.md#§25 チーム権限`)
  - 採否: `applied`
  - 章固有の根拠: Better Auth のセッション/組織機能の上にアプリ層で Workspace ロールを実装し、§25 の Researcher/Writer/Reviewer/Publisher/Analyst 分業を強制する
  - トレードオフ:
    - ロール管理UIを自作する実装コストが増えるが、IDaaS 依存とユーザー課金を回避できる
- 原則: 秘密情報 (OAuth クライアントシークレット・セッション鍵) は環境シークレットに分離し、テナントデータと混在させない (`docs/spec/01-要求仕様書-v1.0.md#§26.2 秘密情報管理`)
  - 採否: `applied`
  - 章固有の根拠: Google OAuth のシークレットは Cloudflare Workers の Secrets に保管し、D1 にはセッション/アカウント情報のみを保存する
  - トレードオフ:
    - シークレットローテーション手順を保守運用に追加する必要がある
- 資するゴール: G1

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| better-auth | 1.7.2 | Better Auth (better-auth.com) | https://better-auth.com/docs/introduction | 2026-08-29T23:02:28Z | 2026-08-29T23:02:28Z |

## 上流指針 (doctrine anchors)

> 本章の設計判断が従う上流の正本 (1 concern 1 authority)。具体技術ではなく上流工程を導く規範であり、下位の技術選定は本節と矛盾してはならない。正本: `ref-system-design-knowledge/references/doctrine-anchor-registry.json`

| 設計 concern | 上流の正本 (authority) | 導く範囲 | 出典 | 最終確認 | 本章の確定セルへの反映 |
|---|---|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | **未記入** |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ | 2026-07-12 | **未記入** |

> **未記入** の行は、上流の正本を掲げただけで本章の確定内容へ反映した箇所を示せていない。表への出現は反映の証拠ではない。

## To-Be / Delta

> 本章の**規範**。上位概念 (要件定義書 U3 ゴール / U4 目標 / U9 具体的やりたいこと) を本章の serves_goals で絞り込んだ射影であり、設計知識 card (非規範の参考資料) とは役割が異なる。As-Is (現行実装の姿) は spec-state.json の管轄外のため本節では断定せず、到達点と、その到達を判定する観測点だけを規範として置く。

### 到達すべき状態 (To-Be)

- **G1**: 一つのアフィリエイトURLを起点に、正しい商品情報・比較候補・根拠・書き手・読者・媒体・広告表示を統合し、目的の異なる高品質コンテンツを安全に作成・公開・改善できる

### 受入条件 (Delta の判定点)

- (本章ゴールに紐づく目標 U4 が無い。受入条件が未定義である)

### 本章がかなえる具体的やりたいこと (U9)

- **I1**: アフィリエイトURL登録から商品識別・情報収集・比較候補抽出・根拠付きデータ作成までを一元化する
- **I2**: 書き手・読者ペルソナと媒体ルールを入力に、ブログ・X・Instagram・Threads・note等の媒体別コンテンツを生成し人間承認を経て公開する
- **I4**: 分析結果を次のコンテンツ生成 (Brief提案・配信戦略) へ反映する。ただし商品評価・ランキングへは自動反映しない
- **I5**: 読者向けブログ画面の UI/UX を、参考サイト実測を根拠に組み立てる (スクロール追従する目次・検索窓とカテゴリー/タグ/ブランドのサイドバー導線・分類ごとのアイコン・広告と本文の視覚的区別)。参考サイトの弱点 (alt欠落・目次の二重読み上げ・本文外見出しの混入) は繰り返さない
- **I8**: 記事作成エディター (管理画面) の UI/UX を、見出し階層・画像alt・内部リンク・構造化データの素材が書きながら揃う形へ改善し、公開前に欠落が見える状態にする

### 本章に効く確定意思決定

- **decision-auth-method**: マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか
  - 採択: Better Auth + Google OAuth (自己ホスト) (`opt-better-auth`)
  - 目的適合: マルチテナントSaaSの一般ユーザー認証に適合。Drizzle/D1 アダプタで現行スタックと同居し、§25 のロール権限と組み合わせやすい
- **decision-editorial-commercial-split**: Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか
  - 採択: D1 を 2 本に分け、バインディングを分ける（DB_EDITORIAL / DB_COMMERCIAL） (`opt-two-databases`)
  - 目的適合: G1（安全な作成・公開）に直結。ランキング計算の関数へ Commercial のバインディングを渡さなければ、混ぜようがない
- **decision-redirect-measurement-async**: リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか
  - 採択: ctx.waitUntil で D1 へ書き、失敗ぶんだけ R2 へ退避して Cron で回収する (`opt-waituntil-fallback-cron`)
  - 目的適合: G2 の欠測を、有料プランを増やさずに減らせる。G1 の「転送は必達」も保てる
- **decision-llm-provider**: 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか
  - 採択: 単価表（config/llm-provider-catalog.json）を正本に、複数社を差し替え可能にする（現行） (`opt-catalog-multi`)
  - 目的適合: G1 に適合。長い記事は高いモデル、判定は安いモデル、と用途で分けられる
- **decision-ui-theme-implementation**: 配色と明暗の 2 軸を、どの技術で実装するか
  - 採択: CSS の light-dark() と data 属性（配色は属性、明暗は color-scheme） (`opt-css-light-dark`)
  - 目的適合: 09 §2 の 2 軸モデルをそのまま表現できる。掛け合わせを設定値にしない
- **decision-test-ci-tooling**: テストと CI の道具立てを、いまの構成のまま進めるか変えるか
  - 採択: 現行のまま（Vitest / Stryker / fast-check / axe-core / GitHub Actions） (`opt-keep-current`)
  - 目的適合: 10 の 7 種のうち、単体・契約・境界値・ミューテーション・性質・読み上げを既に覆っている
- **decision-screen-priority**: ui-ux×web の画面で、先頭に何を置くか。UIUX-REQ-001 は「今、利用者が判断・回復すべき業務状態」を先頭に置くと書いており、qa-uiux-web-screen-priority の本人回答は「記事の成績比較」を先頭に置くと言っている。両者は先頭の 1 つを争っている
  - 採択: 記事の成績比較を先頭に置き、回復すべき業務状態はその下に常設の帯として置く (`opt-performance-first`)
  - 目的適合: G2「どういう情報・切り口・媒体・配置がクリック率とアフィリエイト成果に有効かを計測・分析し、一元管理できる」に直結する。成績比較は毎日見る対象で、開いた理由そのものである
- **dec-blog-domain-strategy**: 作成した各ブログにどうやって固有の住所 (ドメイン) を割り当てるか。現状はホスト解決が無く、全ブログが単一 Worker 上の /s/<slug> パスで、ドメインがブログの内容と無関係になっている。
  - 採択: ワイルドカードサブドメイン方式 (<slug>.<基底ドメイン>) (`opt-wildcard-subdomain`)
  - 目的適合: G1 の『複数ブランド・複数ブログ構築』に直接資する。ブログごとに独立した住所を持ちながら、ブログを1本増やすのに DNS も設定も触らずに済むため、コードもルートも増やさない既存方針と一致する。
- **dec-structured-data-emission**: 構造化データ (Article/BlogPosting・FAQPage・HowTo・Speakable・BreadcrumbList) と canonical・OGP・robots を、どこで生成するか。現状は記事本文へ書き手が書き込む前提の箇所があり、書かれなければ欠落したまま公開される。
  - 採択: 配信時に記事データから導出する (Worker のレンダリング経路で生成) (`opt-render-time-derive`)
  - 目的適合: G3 に直接資する。記事データが正本となるため、本文・見出し・画像・公開日を直せば構造化データが自動で追従し、I6 の『人手で書き足す前提にしない』を構造で満たす。
- **dec-editor-editing-model**: 記事エディターの編集モデルを、外側 (節) と内側 (本文の断片) の 2 層構造のまま見せるか、Notion のような単一階層へ潰すか
  - 採択: 2 層を維持し、層を UI で明示する (節=固定の見出し2 / 本文の断片=見出し3・4) (`opt-two-layer-visible`)
  - 目的適合: 節の並びが記事の骨格 (目次・必須ブロック検査) を保証したまま、節の中身だけ自由に書ける。G3 の機械可読な見出し階層が編集操作で壊れない
- **dec-article-image-upload-path**: 記事エディターから添付する画像を、どの経路で Cloudflare R2 へ格納するか
  - 採択: 署名付き URL を発行し、ブラウザから R2 へ直接 PUT する (`opt-r2-direct-put`)
  - 目的適合: 記事本文と同じ編集操作の中で画像を置けるため、G1 の『統合された編集』を切らさない。大きな画像でも Worker のリクエストサイズ上限に当たらない
- **dec-article-body-storage-format**: 断片カタログを 19 種へ広げた記事本文を、どの形で保存するか (拡張 Markdown 文字列のままか、構造化 JSON ツリーへ移すか)
  - 採択: 現行どおり拡張 Markdown 文字列で保存し、parseProse / serializeProse で往復する (`opt-extended-markdown-string`)
  - 目的適合: 既に公開されている記事のデータが 1 件も壊れないまま断片を 19 種へ広げられる。G1 の『既存の全情報を編集・表示できる』を移行なしで満たす

## 状態の意味 (State semantics)

- `confirmed` / 「確定」は、認証方式の**要求判断を収集済み**であることを表す。実装済み・統合済み・受入試験合格を表さない。
- 後段の `採否: applied` も「設計判断に採用」の意味であり、コードへの適用済みを意味しない。
- 本章の実装状態は `partial`。ローカルの受入・結合試験は `pass` だが、Google OAuth の実往復、Workers 上の実 HTTP、dev / production D1 migration は `unverified`。要求判断の確定とリリース検証を混同しない。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**とする。規範根拠は `docs/spec/01` §25〜§26、`00-requirements-definition.md` の U8、本章の「最新ドキュメント出典」に記録した公式出典とする。

## As-Is

- Better Auth + Google OAuth の adapter、D1 の認証・セッション表、許可メールと membership の二段ゲートが実装されている。`/admin` の入口は `src/middleware.ts`、操作権限は application 層の `requireCapability` が担う。
- Workspace / membership / role、tenant-scoped port、他 Workspace の存在を隠す応答、request ID 付きの拒否監査が実装され、ローカルの受入・D1 結合試験で検証されている。
- ブランドの標準 CTA・標準免責は、Workspace にブランドが 1 件だけなら管理画面と MCP の生成経路へ既定値として届く。複数ブランド時の選択 UI と `brands` の本番永続化は未完了。
- `src/lib/mcp/auth.ts` の `MCP_TOKEN` と `same-origin` 読み取り WebMCP は PoC 経路として残る。`same-origin` は利用者の身元を証明せず、Workspace 認可の代替ではない。
- Google OAuth の実往復、本番 Secrets、本番 D1 への migration 適用は未検証である。コードとローカル試験があることを、本番利用可能の証拠にはしない。

## To-Be

| 要件ID | 目標状態 |
|---|---|
| AUTH-REQ-001 | Better Auth + Google OAuth で人の身元を確認し、セッションを D1 で管理する |
| AUTH-REQ-002 | 全ユースケースで `session -> workspace_membership -> role` をサーバー側で検証する |
| AUTH-REQ-003 | `MCP_TOKEN` は PoC 限定とし、本番の機械間 MCP は許可 Workspace と最小権限に紐付く service identity を使う。`same-origin` は公開読み取りのみ、保護 WebMCP は Better Auth セッション + Workspace 認可を要求する |
| AUTH-REQ-004 | 公開・削除・権限変更等はロール認可と明示承認の両方を満たし、監査イベントを残す |

## Delta

1. dev 環境で Google OAuth の実往復を行い、認証 callback、cookie 属性、D1 セッション作成、ログアウト後の無効化を実測する。
2. `brands` の永続化と複数ブランド時の明示選択を実装し、誤った CTA・免責を自動選択しない状態を保つ。
3. PoC の `MCP_TOKEN` を Workspace と最小権限に結びつく service identity へ置き換え、`same-origin` は公開読み取りだけに限定し続ける。
4. migration `0022` / `0023` を dev D1 へ適用する前に既存 `disclosures` 行数を確認し、適用後に tenant 分離と request ID 索引を実測する。

### Implementation evidence (2026-08-24 final review)

| 観点 | 状態 | 証跡 |
|---|---|---|
| 未認証の `/admin` 遮断 | ローカル受入 PASS | `tests/acceptance/feat-auth-workspace/admin-entry-middleware.test.ts` |
| tenant / capability 境界 | ローカル受入 PASS | `tests/acceptance/feat-auth-workspace/access-boundary.test.ts`、`tests/architecture/tenant-scoped-schema.test.ts` |
| 拒否の request ID 付き監査 | ローカル受入 PASS | `tests/acceptance/feat-auth-workspace/denial-audit.test.ts`、`drizzle/0024_aromatic_flatman.sql` |
| ブランド既定値の配線 | ローカル受入 PASS | `tests/acceptance/feat-auth-workspace/brand-defaults-wiring.test.ts` |
| Google OAuth / Workers / dev・production D1 | 未検証 | `docs/spec/feat-auth-workspace/release-notes.md` §7 |

書き戻しは `system-spec/spec-state.json` の `auth.web` を R4 `reopen` し、要求判断 `qa-auth-web` を変えずに本文を更新して再確定した。受領記録は `docs/spec-writeback-receipt.md` にある。正本 state の `implementation_snapshot` は現行 writer に更新 action が無いため古いままであり、writer 拡張は Beads `ah-u5l` で追跡する。

## Dependencies

`Better Auth / Google OAuth シークレット` → `D1 認証スキーマ` → `Workspace membership / role` → `共通認可ゲート` → `AuditLog`

- 本章は security の tenant 分離と frontend の Workspace 選択の前提。認証のみでテナント分離済みとみなさない。

## Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| AUTH-ACC-001 | 未認証で保護ルート/APIへアクセス | リダイレクトまたは `401`、応答に保護データなし。統合テストログを保存 |
| AUTH-ACC-002 | Workspace A のセッションで Workspace B の既知IDを参照 | 未存在IDと同一の `404` 応答・本文で、B の値を一切返さない。拒否は request ID 付きで監査記録 |
| AUTH-ACC-003 | Analyst が分析閲覧と公開操作を実行 | 分析閲覧は成功し、公開は `403`。actor / workspace / action / result を含む監査記録と認可テストを保存 |
| AUTH-ACC-004 | ログアウト後に旧セッションを再利用 | `401`、セッション無効化レコードと自動テスト結果を保存 |
| AUTH-ACC-005 | 未認証 `same-origin` と Workspace A 限定の service identity で保護ツールを呼ぶ | `same-origin` に保護ツールを公開せず、service identity は A のみ成功、B は拒否。`tools/list` / `tools/call` の契約テストと監査記録を保存 |

## 章にしか無い記述 (正本へ未接続)

> 以下の 1 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### 本節を「転記」に留めた理由`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## 章にしか無い記述 (正本へ未接続)

> 以下の 3 件は正本 `spec-state.json` の `qa_ref` / `qa_refs` / `required_info[].grounded_by` のいずれからも導けない (`### Web (web)`, `#### 主たる接地根拠: `qa-auth-web``, `### 本章での適用`)。compile が消さずに引き継いでいるだけで、**章が正本の投影である性質はここだけ破れている**。正本へ接続するか、不要と確かめて消すこと。

### Web (web)

- 資するゴール: G1

#### 主たる接地根拠: `qa-auth-web`

**問**

認証 (auth) × web の方式は何か (2026-08-16 対話ヒアリング)

**答**

A. Better Auth (Better Auth + Google OAuth) を選択。無料・OSS で、D1/Drizzle アダプタにより現行の Next.js + Cloudflare Workers + D1 スタックと同居できる。Google ログインを初期提供し、メール/パスワード・パスキーは後続拡張とする。セッションは D1 に保存し、Workspace 単位のマルチテナント分離と §25 のロール (Owner/Admin/Researcher/Writer/Reviewer/Publisher/Analyst) 権限をアプリ層で紐付ける。外部公開・予約投稿等の重要操作は認証済みユーザーの明示承認を必須とする。

- (根拠の性質: 利用者が代替案を見たうえで明示選択した決定 / 出所: 既存の認証方式の確定 (decisions.decision-auth-method)。ブラウザ Cookie セッションに一本化する認証モデルが確定済みであることを、必須情報 auth-model の接地として紐付ける。 / 回答時刻: 2026-09-05T01:12:00Z)

### 本章での適用

> **未記入** — 本章固有の適用記述が spec-state に無い。以下の card 本文は共有資産の逐語であり、同じ card を引く他章と一致する。この節は現時点で「参照した」ことしか示しておらず、「適用した」証拠ではない。

## compile が保てなかった行 (要判断)

> 正本から導出できず、節・小節の引き継ぎでも守れなかった 2 行。版の更新のように**正しく消える行**も混ざる。正本へ接続するか、不要と確かめて消すこと。この節は compile のたびに作り直す。

- `| Web (web) | 確定 | 確定質疑: qa-auth-web。資するゴール: G1 |`
- `> 本章の各確定セルが何を根拠に確定したかの実体。`qa_ref` が主たる接地根拠、`qa_refs` がそれを支える裏付け質疑であり、いずれも qa_log (spec-state.json) の逐語である。ここに現れない主張は本章の確定内容ではない。`
