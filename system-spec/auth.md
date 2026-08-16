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

## 状態の意味 (State semantics)

- `confirmed` / 「確定」は、認証方式の**要求判断を収集済み**であることを表す。実装済み・統合済み・受入試験合格を表さない。
- 後段の `採否: applied` も「設計判断に採用」の意味であり、コードへの適用済みを意味しない。
- 本章の実装状態は `not_started`、検証状態は `unverified`。後述の Better Auth / Workspace / ロールは目標仕様であり、現行機能ではない。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**とする。規範根拠は `docs/spec/01` §25〜§26、`00-requirements-definition.md` の U8、本章の「最新ドキュメント出典」に記録した公式出典とする。

## As-Is

- `src/lib/mcp/auth.ts` の `MCP_TOKEN` 一致による Bearer 認証と、`Sec-Fetch-Site: same-origin` を読み取り範囲に限定する WebMCP PoC のみ。
- `same-origin` は利用者の身元を証明しない。現行の保護範囲は「公開ページと同じ読み取り」であり、ログインまたは Workspace 認可の代替にならない。
- Better Auth、Google OAuth、D1 セッション、Workspace 所属、Owner〜Analyst のロール認可は未実装。

## To-Be

| 要件ID | 目標状態 |
|---|---|
| AUTH-REQ-001 | Better Auth + Google OAuth で人の身元を確認し、セッションを D1 で管理する |
| AUTH-REQ-002 | 全ユースケースで `session -> workspace_membership -> role` をサーバー側で検証する |
| AUTH-REQ-003 | `MCP_TOKEN` は PoC 限定とし、本番の機械間 MCP は許可 Workspace と最小権限に紐付く service identity を使う。`same-origin` は公開読み取りのみ、保護 WebMCP は Better Auth セッション + Workspace 認可を要求する |
| AUTH-REQ-004 | 公開・削除・権限変更等はロール認可と明示承認の両方を満たし、監査イベントを残す |

## Delta

1. Better Auth テーブルと Google OAuth 統合を追加する。
2. Workspace / membership / role を認証情報と分離して追加し、共通の認可ゲートを経由させる。
3. MCP トークンと Web 利用者セッションの責務を混ぜず、既存 PoC は機械間経路として局所化する。

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

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-auth-web |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-auth-web (対応セル: web)

**質問**: 認証 (auth) × web の方式は何か (2026-08-16 対話ヒアリング)

**回答**: A. Better Auth (Better Auth + Google OAuth) を選択。無料・OSS で、D1/Drizzle アダプタにより現行の Next.js + Cloudflare Workers + D1 スタックと同居できる。Google ログインを初期提供し、メール/パスワード・パスキーは後続拡張とする。セッションは D1 に保存し、Workspace 単位のマルチテナント分離と §25 のロール (Owner/Admin/Researcher/Writer/Reviewer/Publisher/Analyst) 権限をアプリ層で紐付ける。外部公開・予約投稿等の重要操作は認証済みユーザーの明示承認を必須とする。

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| authentication | OWASP ASVS + Secrets Management Cheat Sheet | 認証方式・セッション・資格情報/シークレット/API キーの取扱いの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |
| security | OWASP ASVS + Secrets Management Cheat Sheet | 脅威モデル・入力検証・暗号化・監査ログの上流指針 | https://owasp.org/www-project-application-security-verification-standard/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

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
| better-auth | 1.6.29 | Better Auth (www.better-auth.com) | https://www.better-auth.com/docs/introduction | 2026-08-16T09:01:51Z | 2026-08-16T09:02:16Z |
