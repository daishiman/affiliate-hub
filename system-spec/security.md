---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G1, G2, G3]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web-worker-image-upload-confirmed-20260906。裏付け質疑 (`qa_refs`): `qa-security-web-domain-behavior-privacy`, `qa-security-web-spec-intake`, `qa-security-web` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の該当セルと `qa_log` から **compile が描く**。手で書き換えても次の再生成で正本の値へ戻る (2026-09-04 まで手写しで、その間ずっと腐っていた)。

| 項目 | 値 |
|---|---|
| セル | security × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-security-web-worker-image-upload-confirmed-20260906` |
| 資するゴール (serves_goals) | G1, G2, G3 |
| required-info | `security-posture` — missing_effect: block / 接地: 済 (`qa-security-web-spec-intake`) |
| 出典 kind | user-dialogue |
| 出典 path | — (対話に基づくため path/節/sha256 を持たない) |
| 出典 節 | — |
| 出典 sha256 | — |
| 適用された設計知識 (design_applications) | 1 件 — 本章 `## 適用された設計知識` を参照 |

## 意思決定 (decisions)

> 正本 `spec-state.json` の `decisions[]` のうち、本章 (`security`) を主担当とする **0 件**。全 15 件の一覧は [`00-requirements-definition.md`](./00-requirements-definition.md) が正本から描く (章へ写さない)。

- 本章を主担当とする決定は無い。

## 確定内容 (質疑録)

### qa-security-web-worker-image-upload-confirmed-20260906 (対応セル: web)

**質問**: 画像送信を、確定仕様の『R2へ直接送信』から、現実装の『Workerで認可・容量・形式を検査して保存』に統一してよいですか？

**回答**: ok

### qa-security-web-domain-behavior-privacy (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: security×web: 他人のドメインを勝手に接続されないようにし、座標まで採る読者行動データで読者を特定できないようにするには、何を課すか

**回答**: ドメインは、所有権の確認が済むまで active にしない。管理画面で登録しただけでは pending であり、こちらが発行したトークンを利用者が自分の DNS へ置き、Cloudflare が検証して初めて配信へ結びつく。これにより、他人が所有するドメインを名前だけ入力して奪うことができない。同じホスト名を 2 つの workspace が同時に active にできないよう、hostname に一意制約を置く。切断後も行を revoked として残すのは、直後に別の workspace が同じ名前を取り、失効前のリンクの行き先を差し替えることを防ぐためである。読者行動は、同意が無ければ reader_key を null のまま記録する (既存 telemetry_events と同じ扱いを踏襲する)。座標は端末画面の絶対位置ではなく要素基準の比率で持ち、端末の解像度から個人を絞り込む手がかりにしない。ポインタの軌跡は連続的に採らず、クリックと一定間隔の標本のみとする。連続軌跡は筆跡に近い個人性を持ちうるためである。管理画面のヒートマップは常に集計後の分布だけを描き、個々の読者の 1 回ぶんの軌跡を再生する機能は作らない。読者からの削除依頼は既存の reader_key 索引でまとめて消せる状態を保つ

### qa-security-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: security×web: 秘密情報をどこに置き、誰が登録するか (書面入力 docs/spec/11 §5)

**回答**: - API キー・トークンは **GitHub Secrets と Cloudflare の環境変数**で管理する。
- **リポジトリのファイル、コマンドライン、AI が読める場所に置かない。**
  登録は利用者本人が、ブラウザまたは本人のターミナルで行う。代行しない。
- ログに秘密情報を出さない（`echo ${{ secrets.X }}` を書かない）。

### qa-security-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 書面入力 docs/spec/01-要求仕様書-v1.0.md §26.1 のセキュリティ (security) × web 要件は何か

**回答**: * SSRF対策
* ローカルIP・メタデータIPの遮断
* DNS再束縛対策
* リダイレクト回数制限
* ファイルサイズ制限
* MIME確認
* タイムアウト
* 危険ドメイン
* HTMLサニタイズ
* JavaScriptを実行しない安全取得
* ページ本文をAI命令として扱わない

## 章の注記 (chapter_notes)

> 正本 `spec-state.json` の `chapter_notes` を描く。**利用者の回答ではない。**確定内容 (質疑録) と混ぜて読まないために節を分けてある。

### 意思決定が本章に効く形

- **本章を主担当とする decision は 0 件**である (分母 = 上表 7 行)。これは security の論点が漏れているという意味ではなく、7 件のいずれも第一の適用先を security としないという意味である。security へ波及する条件を持つのは 2 件 — `decision-auth-method` (認証方式そのもの) と `decision-llm-provider` (API 鍵の預け先) で、どちらも主担当章側で確定済み。
- **`decision-llm-provider` の security 面の含意**: API 鍵は利用者本人がブラウザまたは別端末で登録する。**鍵の値も、その断片 (先頭数文字を含む) も、この作業場所に置かない・受け取らない・要求しない。**これは §5 秘密情報の運用そのものである。

- 正本へ入れた理由: 手書きの「意思決定 (decisions)」節に在った章固有の注釈。表と件数は正本から生成するようにしたため節ごと置き換わるが、注釈は正本から導けないので移した(2026-09-08 / ah-lwmf)。

### 章の規範本文を正本から再生成しない理由

同じ現行契約の全文と記録理由は [章の規範本文を正本から再生成しない理由](auth.md) を参照。本章にも同じ契約を適用する。

### この章の要件 ID を書いたのは誰か

この章の SEC-REQ-006〜009 は、**AI が導いた受入条件**である。利用者が逐語で述べた要求そのものではない。出所を次のとおり分けて記録する。

**利用者の逐語（`qa-security-web-upload-hardening-corrected` の answer に原文がある）**

> （該当する逐語は無い）

**そこから AI が導いた受入条件**

- 署名付き URL が期限まで再利用可能である事実を前提に、期限を分単位に留めること
- 容量と型の検査を、署名ではなく受領後の実体検査で行うこと
- ブラウザからの直接 PUT に必要な CORS 設定を明示すること

**利用者の確認を受けている範囲**

この章の要件は利用者の発言ではなく、Cloudflare R2 公式ドキュメント（system-spec/retrieval-evidence/cloudflare-r2.json、2026-09-05 取得）の一次情報から導いた。利用者へは提示していない。

この区別を残すのは、要件 ID の文面を後から見直すときに「利用者が言ったから変えられない」ものと「AI が導いたので設計判断で変えてよい」ものを取り違えないためである。

- 正本へ入れた理由: C06 round3 の指摘: 要件の出所が機械で辿れない。この章は利用者の発言ではなく Cloudflare R2 公式ドキュメントの一次情報から導いたので、その事実を章側で名乗らせる。

### 画像検査境界の再検討（2026-09-06、回答待ち）

これは実装観察であり、利用者の回答原文や新たな採用決定ではない。

画像を Worker で受領して検査後に R2 へ保存する現実装と、署名付き URL で R2 へ直接 PUT して受領後に検査する旧決定では、検査前オブジェクトを信頼しないための境界が異なる。経路の選択は [インフラ章の再検討記録](infrastructure.md) と連動し、利用者の回答前に本章を再確定しない。

共通の安全条件は、同一作業場所・所属記事の認可、検査完了前と回収中の画像への新規参照拒否、公開時だけ許可する匿名閲覧、削除済み画像 ID の再利用禁止である。現実装の確認結果は [ブロックエディターの検証報告](../docs/spec/feat-article-block-editor/elegant-review.md) に記録する。過去の公開・機密保護要件は削除せず、再確定時に reopen_log.discarded の参照と突き合わせる。

- 正本へ入れた理由: 画像方式の再選択に依存する安全境界を明示し、既存の技術解釈を利用者承認として再使用しない。

### 画像検査境界の確定（2026-09-06）

画像アップロードの現行の信頼境界は Worker である。R2 へ保存する前に、認証、`content.write`、workspace と記事の所属、同一 Origin、受信量、許可 MIME、ファイル先頭のシグネチャを検査する。検査前・回収中・削除済みの画像を新規本文参照へ使わせず、匿名閲覧は公開済み記事から到達する画像だけに限定する。

2026-09-06 の利用者回答「ok」により、`dec-article-image-upload-path` は `opt-worker-proxy-upload` へ更新済みである。この章に先に残る署名付き URL・受領後検査・CORS の記述と「回答待ち」は、旧決定または再検討中の履歴であり現行要件ではない。現行承認は `approval-article-image-upload-path-worker-20260906`、旧承認は履歴 `approval-article-image-upload-path` として区別する。

- 正本へ入れた理由: 再検討中の安全境界を、利用者承認後のWorker保存前検査へ確定し、旧方式を現行要件と誤読させない

### 歴史的スナップショット（現行規範ではない、2026-09-06 移送）

> 既存章にしか存在しなかった規範・受入条件・実装記録の保全移送。以下の本文は移送前のまま保持する。As-Is、Delta、PASS 等の実装・検証記録は本文に記された時点の記録であり、今回の実装完了・本番反映・新しい利用者承認を意味しない。後日の確定判断は本章の現在の質疑録・意思決定・日付付き注記を参照する。

#### 状態の意味 (State semantics)

- `confirmed` / 「確定」はセキュリティ要求の**判断済み**を表す。防御の実装済み・脅威検証済み・監査済みを意味しない。
- 後段の `採否: applied` は設計への採用を表し、統制の実装または有効性検証済みを表さない。
- 本章の実装状態は `partial`、検証状態は `unverified`。tenant 分離、同意ゲート、Analyst を含むロール認可は未実装。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は U8、`docs/spec/01` §25〜§26、`docs/spec/02` §6、`docs/spec/03` §9と、本章の OWASP 公式出典とする。


#### As-Is

- MCP 経路は `MCP_TOKEN` を定数時間比較し、未設定時は fail-closed。`same-origin` 経路ではブラウザ公開対象の読み取りツールのみを許可する PoC である。
- シークレットの環境分離はあるが、現行データに Workspace 境界と利用者ロールがない。
- SSRF 対策群、ConsentRecord、同意前の識別子抑止、AuditLog、Analyst 認可は要求のみで未実装。
- 記事画像をブラウザから直接アップロードする経路は存在せず、署名付き URL の発行・R2 の CORS ポリシー・受領後の型/大きさ検査のいずれも未実装。記事本文の描画時に要素・属性・URL スキームを絞る許可リストも未実装。


#### To-Be

| 要件ID | 目標状態 |
|---|---|
| SEC-REQ-001 | 全クエリ・更新・出力で `workspace_id` をサーバー側のセッションから導出し、クライアント指定値を信頼しない |
| SEC-REQ-002 | 同意前または撤回後は session ID、IP hash、経路復元可能な識別子を保存せず、匿名集計用イベントのみに限定する |
| SEC-REQ-003 | Owner〜Analyst の deny-by-default ポリシーを共通認可ゲートに集約し、Analyst は分析/レポートの読み取りのみ許可する |
| SEC-REQ-004 | 認証失敗、tenant 越境、認可拒否、公開/削除/権限変更/データ修正/出力を request ID と共に監査記録する |
| SEC-REQ-005 | URL 取得は私有/メタデータIPと危険ドメインの遮断、各リダイレクト後の DNS 再検証、回数/時間/サイズ上限、MIME 検証、HTML サニタイズ、JS非実行、本文と命令の分離を強制する |
| SEC-REQ-006 | 記事画像の署名付き URL は、資源 (アカウント・バケット・オブジェクトパス)・操作 (PUT)・期限だけを縛る。**同じ署名付き URL は期限まで何度でも再利用できる**ため、1 回きりの使い捨てとして設計しない。期限は分単位に留め、上限 7 日 (604,800 秒) の余地を使わない |
| SEC-REQ-007 | 署名で容量を縛れないこと (容量を署名へ含める S3 POST policy は R2 の S3 互換表に記載が無い) を前提に、型と大きさの検査を受領後に行う。拡張子と申告 MIME を信頼せず、保管された実体の先頭バイトで型を判定し、許可した画像型かつ上限以下でなければ公開経路へ出さない |
| SEC-REQ-008 | R2 バケットの CORS ポリシーで、ブラウザから直接 PUT できる出所を管理画面の生成元だけに限定する。`AllowedOrigins` にワイルドカードを置かず、`AllowedMethods` は PUT に絞り、`ExposeHeaders` は ETag に留める |
| SEC-REQ-009 | 記事本文の描画は、要素・属性・URL スキームの許可リストで絞る。埋め込み (embed) の宛先ホストも許可リストで限定し、任意ホストの iframe を通さない。文字色/背景色は名前付きトークンのみを受け、任意の値をスタイルとして注入させない |


#### Delta

1. auth の Workspace membership を全 data access の入口に統合し、テーブル・検索インデックス・エクスポートまで同じ境界を使う。
2. 同意判定を計測タグと受信 API の両方で強制し、クライアントだけに依存しない。
3. ロール定義と監査対象を1か所のポリシーに集約し、各ルートの独自判定を禁止する。
4. 画像アップロードの防御を「署名で全部縛る」前提から、「署名は資源・操作・期限だけを縛り、型と大きさは受領後に検める」二段構えへ改める。これは Cloudflare R2 の実能力に合わせた訂正であり、防御の水準を下げる変更ではない。
5. 記事本文の描画経路に許可リストを置く。断片が 19 種へ増え、code / table / embed / columns といった構造の深い断片が入るため、許可リストを断片ごとの分岐ではなく 1 か所に集約する。


#### Dependencies

`Better Auth` → `Workspace membership / role` → `tenant scope helper` → `ConsentRecord / collection gate` → `AuditLog / alert`

- URL 安全取得は利用者認可とは別の外部入力境界として実装する。security の PASS は auth の PASS だけで代替できない。

記事エディターの従属:

`Workspace membership` → `署名付き URL の発行 (資源・操作・期限)` → `R2 の CORS ポリシー` → `受領後の型・大きさ検査` → `描画時の許可リスト`

- 署名で縛れる範囲は Cloudflare R2 の公式仕様 (`system-spec/retrieval-evidence/cloudflare-r2.json`) に従属する。仕様を超えた制約を要件へ書かない。
- 鍵の並び (`workspace_id/記事id/一意なid.拡張子`) は infrastructure の正本に従属する。security はその並びが workspace 境界と一致していることを検める側に立つ。


#### Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| SEC-ACC-001 | Workspace A のメンバーが B の記事・リンク・集計・出力の既知IDを指定 | 全経路が未存在と同一の `404`。B のデータが response / log / export に漏れず、actor/workspace/request ID 付きの拒否監査あり |
| SEC-ACC-002 | 未同意と同意撤回後の訪問で行動イベントを送信 | 保存レコードの `session_id=null` / `ip_hash=null`、DB とアプリ管理ログに raw IP なし。複数イベントから個人経路を復元できないことを DB/ログ検査で証明 |
| SEC-ACC-003 | Analyst が分析閲覧、公開、削除、権限変更を実行 | 閲覧のみ成功、他は `403`。認可マトリクステストと各拒否の監査レコードを保存 |
| SEC-ACC-004 | loopback、RFC1918、link-local/メタデータIP、およびリダイレクト先が私有IPのURLを取得 | すべて取得前に拒否し、内容を返さない。DNS 再検証を含む自動テストと監査記録を保存 |
| SEC-ACC-005 | リダイレクト超過、タイムアウト、上限超過、MIME偽装、script/プロンプト命令を含むHTMLを取得 | 上限違反と MIME 不一致は拒否。許可HTMLでも script を実行せず、サニタイズ後の本文を命令として実行しないことを fixture テストで証明 |
| SEC-ACC-006 | 発行した署名付き URL で同じ鍵へ 2 回 PUT し、期限切れ後にもう 1 回 PUT する | 期限内の 2 回目が成功すること (再利用可能である事実の確認) と、期限後が失敗することの両方を記録。発行時の有効期限が分単位であることを、発行経路の単体テストで固定して保存 |
| SEC-ACC-007 | 拡張子 `.png` / 申告 MIME `image/png` で、実体が実行可能ファイルまたは上限超過の画像を PUT する | 受領後の検査が先頭バイトで型不一致を検出し、上限超過を検出して、いずれも公開経路へ出さない。検査の判定と拒否の監査記録を保存 |
| SEC-ACC-008 | 管理画面の生成元以外 (別ドメイン) から、同じ署名付き URL で PUT を試みる | preflight が CORS ポリシーで拒否される。バケットの CORS ポリシーに `AllowedOrigins: *` が含まれないことを、設定を読み出す検査で併せて保存 |
| SEC-ACC-009 | 19 種の断片に、`javascript:` リンク・許可外ホストの iframe・`<script>`・任意の 16 進色を仕込んだ本文を描画する | いずれも描画結果に残らず、リンクは無効化、iframe は許可ホスト外なら描かれず、色はトークン外なら既定色になる。許可リストの定義が 1 か所であることの検査と、断片ごとの fixture テストを保存 |

- (注記: chapter_notes 本文の見出しを本注記の下へ押し下げた。文字は変えていない)

- 正本へ入れた理由: 既存章にだけ存在する要件定義表・受入条件とその文脈を、正規writerのchapter_notesへ逐語移送して再生成時の欠落を防ぐ。利用者回答や承認内容は改変せず、過去の実装記録を現在のPASSとして扱わない。

### To-Be（規範契約）

> 2026-09-06 現行規範。旧注記「章の規範本文を正本から再生成しない理由」は superseded とし、その「再生成しない」指示を無効化する。正本 chapter_notes と正規 compiler を唯一の更新経路とする。旧 374 行等の欠落原因・旧方式・過去の実装/PASS 状態は歴史的スナップショットとして保持する。以下は要求であり、実装・受入・remote migration・本番公開の完了を意味しない。

画像関連要件は 2026-09-06 の現行 Worker アップロード・ライフサイクル契約で同 ID を改訂した。旧 direct PUT/CORS/容量・可逆性の規定は歴史記録のみとし適用しない。

| 要件ID | 目標状態 |
|---|---|
| SEC-REQ-001 | 全クエリ・更新・出力で `workspace_id` をサーバー側のセッションから導出し、クライアント指定値を信頼しない |
| SEC-REQ-002 | 同意前または撤回後は session ID、IP hash、経路復元可能な識別子を保存せず、匿名集計用イベントのみに限定する |
| SEC-REQ-003 | Owner〜Analyst の deny-by-default ポリシーを共通認可ゲートに集約し、Analyst は分析/レポートの読み取りのみ許可する |
| SEC-REQ-004 | 認証失敗、tenant 越境、認可拒否、公開/削除/権限変更/データ修正/出力を request ID と共に監査記録する |
| SEC-REQ-005 | URL 取得は私有/メタデータIPと危険ドメインの遮断、各リダイレクト後の DNS 再検証、回数/時間/サイズ上限、MIME 検証、HTML サニタイズ、JS非実行、本文と命令の分離を強制する |
| SEC-REQ-006 | 記事画像のアップロードに署名付き URL を発行しない。同一生成元の Worker API でログイン、workspace、記事の編集権限を検証し、サーバー生成鍵と pending/ready 台帳を用いる。画像 ID や鍵を知るだけでは更新・参照できない。 |
| SEC-REQ-007 | 画像の拡張子と申告 MIME を信用せず、受領した実バイトで PNG/JPEG/WebP/GIF を検証し、1 枚 8 MiB の上限と MIME 一致を R2 put 前に強制する。ready の確定に失敗した画像を公開配信しない。 |
| SEC-REQ-008 | 画像の書き込み API は same-origin 検証と認証・tenant 認可を通す。R2 バケットへのブラウザ直接 PUT を許可する CORS や公開書込経路は作らない。公開配信は ready かつ現行公開本文から参照された画像に限定する。 |
| SEC-REQ-009 | 記事本文の描画は、要素・属性・URL スキームの許可リストで絞る。埋め込み (embed) の宛先ホストも許可リストで限定し、任意ホストの iframe を通さない。文字色/背景色は名前付きトークンのみを受け、任意の値をスタイルとして注入させない |

- 正本へ入れた理由: 現行要件表を正本へ接続。旧再生成禁止 note を superseded とし、画像契約は現行実装・確定判断に同期。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| security | **条項引用不可** — 取得したが本文が無い (取得経路を変えれば可になる) | authentication と同一 authority・同一取得物 (landing page)。条項が取得物に無い点も同じ。 |

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

- 本章固有の原則採否 (確定内容・接地根拠ごとの `採否` / 根拠 / トレードオフ) は [`applied/security.md`](applied/security.md) にある。
- 章本文と別ファイルにしてあるのは、適用メモが確定セルの数だけ積み上がり、章の分量の見積もりを押し上げるためである (内容は 1 行も落としていない)。

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-asvs | 5.0.0 | OWASP Foundation (owasp.org) | https://owasp.org/www-project-application-security-verification-standard/ | 2026-08-16T09:11:19Z | 2026-08-23T00:32:00Z |
