---
status: confirmed
category: security
aggregate: 確定
spec_cells: [security.web, security.mobile, security.tablet, security.desktop-windows, security.desktop-linux, security.desktop-macos]
serves_goals: [G1]
---

# セキュリティ (security)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## 状態の意味 (State semantics)

- `confirmed` / 「確定」はセキュリティ要求の**判断済み**を表す。防御の実装済み・脅威検証済み・監査済みを意味しない。
- 後段の `採否: applied` は設計への採用を表し、統制の実装または有効性検証済みを表さない。
- 本章の実装状態は `partial`、検証状態は `unverified`。tenant 分離、同意ゲート、Analyst を含むロール認可は未実装。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は U8、`docs/spec/01` §25〜§26、`docs/spec/02` §6、`docs/spec/03` §9と、本章の OWASP 公式出典とする。

## As-Is

- MCP 経路は `MCP_TOKEN` を定数時間比較し、未設定時は fail-closed。`same-origin` 経路ではブラウザ公開対象の読み取りツールのみを許可する PoC である。
- シークレットの環境分離はあるが、現行データに Workspace 境界と利用者ロールがない。
- SSRF 対策群、ConsentRecord、同意前の識別子抑止、AuditLog、Analyst 認可は要求のみで未実装。

## To-Be

| 要件ID | 目標状態 |
|---|---|
| SEC-REQ-001 | 全クエリ・更新・出力で `workspace_id` をサーバー側のセッションから導出し、クライアント指定値を信頼しない |
| SEC-REQ-002 | 同意前または撤回後は session ID、IP hash、経路復元可能な識別子を保存せず、匿名集計用イベントのみに限定する |
| SEC-REQ-003 | Owner〜Analyst の deny-by-default ポリシーを共通認可ゲートに集約し、Analyst は分析/レポートの読み取りのみ許可する |
| SEC-REQ-004 | 認証失敗、tenant 越境、認可拒否、公開/削除/権限変更/データ修正/出力を request ID と共に監査記録する |
| SEC-REQ-005 | URL 取得は私有/メタデータIPと危険ドメインの遮断、各リダイレクト後の DNS 再検証、回数/時間/サイズ上限、MIME 検証、HTML サニタイズ、JS非実行、本文と命令の分離を強制する |

## Delta

1. auth の Workspace membership を全 data access の入口に統合し、テーブル・検索インデックス・エクスポートまで同じ境界を使う。
2. 同意判定を計測タグと受信 API の両方で強制し、クライアントだけに依存しない。
3. ロール定義と監査対象を1か所のポリシーに集約し、各ルートの独自判定を禁止する。

## Dependencies

`Better Auth` → `Workspace membership / role` → `tenant scope helper` → `ConsentRecord / collection gate` → `AuditLog / alert`

- URL 安全取得は利用者認可とは別の外部入力境界として実装する。security の PASS は auth の PASS だけで代替できない。

## Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| SEC-ACC-001 | Workspace A のメンバーが B の記事・リンク・集計・出力の既知IDを指定 | 全経路が未存在と同一の `404`。B のデータが response / log / export に漏れず、actor/workspace/request ID 付きの拒否監査あり |
| SEC-ACC-002 | 未同意と同意撤回後の訪問で行動イベントを送信 | 保存レコードの `session_id=null` / `ip_hash=null`、DB とアプリ管理ログに raw IP なし。複数イベントから個人経路を復元できないことを DB/ログ検査で証明 |
| SEC-ACC-003 | Analyst が分析閲覧、公開、削除、権限変更を実行 | 閲覧のみ成功、他は `403`。認可マトリクステストと各拒否の監査レコードを保存 |
| SEC-ACC-004 | loopback、RFC1918、link-local/メタデータIP、およびリダイレクト先が私有IPのURLを取得 | すべて取得前に拒否し、内容を返さない。DNS 再検証を含む自動テストと監査記録を保存 |
| SEC-ACC-005 | リダイレクト超過、タイムアウト、上限超過、MIME偽装、script/プロンプト命令を含むHTMLを取得 | 上限違反と MIME 不一致は拒否。許可HTMLでも script を実行せず、サニタイズ後の本文を命令として実行しないことを fixture テストで証明 |

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-security-web |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-security-web (対応セル: web)

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

##### 確定内容 qa-security-web (対応セル: web)

- 確定要件: * SSRF対策
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
- 設計解釈の記録経路: `dialogue`
- 原則: URL取り込みの SSRF / DNS再束縛 / 危険ドメイン防御 (`docs/spec/01-要求仕様書-v1.0.md §26.1`)
  - 採否: `applied`
  - 章固有の根拠: アフィリエイトURL解決はローカルIP・メタデータIP遮断、リダイレクト回数制限、JavaScript非実行の安全取得で行う
  - トレードオフ:
    - 安全取得のみでは JS レンダリング必須ページの情報が取れないが、構造化データ優先(§10.3)で許容する
- 原則: OAuthトークン暗号化・最小権限とプロンプトインジェクション対策 (`docs/spec/01-要求仕様書-v1.0.md §26.2-26.3`)
  - 採否: `applied`
  - 章固有の根拠: 外部アカウント秘密はテナント別に暗号化分離し、取得ページ本文をAI命令として実行しない(情報源と命令の分離)
  - トレードオフ:
    - 命令分離により柔軟な自動抽出は制限されるが、乗っ取り型攻撃を構造的に遮断できる
- 資するゴール: G1

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| owasp-asvs | 5.0 | OWASP Foundation (owasp.org) | https://owasp.org/www-project-application-security-verification-standard/ | 2026-08-16T09:11:19Z | 2026-08-16T09:11:39Z |
