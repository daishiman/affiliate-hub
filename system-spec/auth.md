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
| better-auth | 1.7.1 | Better Auth (www.better-auth.com) | https://www.better-auth.com/docs/introduction | 2026-08-19T15:30:39Z | 2026-08-19T15:30:39Z |

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
| 拒否の request ID 付き監査 | ローカル受入 PASS | `tests/acceptance/feat-auth-workspace/denial-audit.test.ts`、`drizzle/0023_aromatic_flatman.sql` |
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

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.auth.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

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

- **出典が `user-dialogue` なのは本章だけ**である (分母 = `coverage_matrix` の web セル 8 件。残り 7 件は `written-requirements`)。したがって本章の確定は `docs/spec/*.md` の sha256 に束縛されておらず、**元文書が書き換わっても検知できない**。これは穴だが、対話由来の確定に後から path を与えると出典を偽ることになるため塞がない。塞がる条件は、この確定内容が `docs/spec` のいずれかの節として書き起こされたとき。

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。

## 意思決定 (decisions)

> 正本 `decisions[]` の全 7 件。**7 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| **`decision-auth-method`** | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | **auth** |
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | database |
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | frontend |
| `decision-test-ci-tooling` | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | maintenance-ops |
| `decision-screen-priority` | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | `opt-performance-first` | confirmed | G1, G2 | ui-ux |

- **`decision-auth-method` の caveat**: ライブラリ更新の追従を maintenance-ops に組み込むこと。採用は「費用ゼロ・ロックインなし」で得たので、追従を止めた時点でその前提が消える。
