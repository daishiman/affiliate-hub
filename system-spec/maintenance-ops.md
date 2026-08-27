---
status: confirmed
category: maintenance-ops
aggregate: 確定
spec_cells: [maintenance-ops.web, maintenance-ops.mobile, maintenance-ops.tablet, maintenance-ops.desktop-windows, maintenance-ops.desktop-linux, maintenance-ops.desktop-macos]
serves_goals: [G1, G2]
---

# 保守運用管理 (maintenance-ops)

- カテゴリ集約状態: **確定**
- 章確定マーカー: `status: confirmed`

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-ops-web-migration-guard。裏付け質疑 (`qa_refs`): `qa-ops-web-spec-intake`, `qa-ops-web` — 本章の「確定内容 (質疑録)」へ接地根拠として併記 |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-ops-web-migration-guard (対応セル: web)

**質問**: maintenance-ops×web: 自動適用の前に取る控えが空だったとき、どうふるまうべきか。控えは何日保管するか

**回答**: 空なら適用を中止する。wrangler が 0 で終わっても中身の無いファイルだけ残る場合があり、それを控えと呼ばない。控えは成果物として 30 日保管し (migrate.yml と同条件)、落ちても残るよう適用より先に保存する。保管に失敗したこと自体も落ちる扱いにする (if-no-files-found: error)

### qa-ops-web-spec-intake (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: maintenance-ops×web: カバレッジの数字を偽らないための規律は何か (書面入力 docs/spec/10 §2、08 ⑤)

**回答**: | アサーションの無いテスト | 実行するだけで「通った」ことになる。壊れても赤くならない |
| スタブを厚くテストして全体を押し上げる | 中身が仮の場所は行数が少なく通しやすい。**最も壊れると痛い場所は覆われないまま数字だけ上がる** |
| 閾値を下げて緑にする | 下げた記録が残らなければ、次の人は「元から 60% だった」と思う |
| 到達しにくい分岐を消して分母を減らす | 異常系を削るのは、異常系を守らないという意思決定である |

### qa-ops-web (対応セル: web) — 接地根拠 (required_info/qa_refs が名指す裏付け)

**質問**: 書面入力 docs/spec/02-補充仕様-ギャップと追加要件.md §7 の保守運用 (maintenance-ops) × web 要件は何か

**回答**: | 通知 | 投稿失敗・リンク切れ・プログラム終了・成果確定をメール/Slack/アプリ内で通知。通知チャネルはWorkspace設定 |
| レート制限 | 各Connectorにレートリミッタとコスト上限(特にX API従量課金)。上限接近で警告、超過で自動停止 |
| バックアップ | Workspace単位のエクスポート(記事・商品・リンク・成果CSV)。退会時データポータビリティ |
| 監査 | AuditLog の必須記録対象を列挙:公開/削除/リンク差し替え/権限変更/成果データ修正/エクスポート |
| 障害時 | リダイレクトはresolver storeで転送先を解決し、計測eventをQueueへ非同期配送する。SLOと劣化モードは`03` §1を正とする |
| 検索 | 記事・商品・リンクの横断全文検索。テナント別インデックス(26.4章と整合) |

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

### 条項引用の可否 (clause citation)

| concern | 可否 | 引ける条項 / 引けない理由 |
|---|---|---|
| operations | **条項引用不可** — 取得対象に無い (取れば可になる) | この concern の source_ref は SRE Workbook (https://sre.google/workbook/) だが、fetched-references.json の取得対象 8 件に含まれていない。取得していないものの章番号は引けない。同じ Google SRE でも reliability が引く sre-book とは別の本であり、sre-book の目次で workbook を代用することはできない。 |

- **operations が引用可になる条件**: targets[] に SRE Workbook を足して C02 で取得できた日に state を available へ変え、cited_clauses を埋め、検査を『この章は条項を引いていること』側へ反転させる。取得すれば塞がる穴であって、塞げない穴ではない。

## 適用された設計知識

> 以下の deep knowledge card は設計判断を支援する**非規範の参考資料**であり、実装済み・検証済みの証拠ではない。カード内の `採否: applied` は設計採用を意味し、実装状態は意味しない。規範となる差分は本章の To-Be / Delta 節と参照先仕様で管理する。

### Clean Code — deep knowledge card

- 出典カード: `ref-system-design-knowledge/references/clean-code.md`

#### 目的

codeを、次の変更者が意図・制約・failureを短時間で理解し、安全に変更・検証できる作業媒体にする。

#### 解決する問題

- 名前と抽象度が意図を表さず、readerが実装詳細からbusiness ruleを逆算する。
- 一つの変更理由が複数moduleへ散り、副作用とerror pathを予測できない。
- 重複したruleが別々に更新され、仕様のSSOTが崩れる。
- testがimplementation detailへ結合し、refactoringを妨げる。

#### 適用条件

- 複数人・長期保守・高変更頻度・重要ruleがあり、理解と変更の費用が支配的。
- test/lint/review/observabilityで改善効果をfeedbackできる。
- domain languageとcoding conventionをteamで合意・更新できる。

#### 非適用条件

- throwaway explorationでは全規則を先行適用せず、学習後に残すcodeだけを整理する。
- generated/vendor codeへ手動styleを強制しない。generation inputとboundaryを管理する。
- 短い関数、class化、DRY等を絶対値として扱い、局所的な明瞭さを悪化させる場合は適用しない。

#### トレードオフ・失敗モード

- naming/refactoring/testへ時間を使うため、寿命とriskが低いcodeでは投資超過になり得る。
- micro-function化でcontrol flowが多数fileへ散り、かえって読みにくくなる。
- DRYを急ぎ、異なるdomain conceptを一つの抽象へ結合して変更を難しくする。
- commentを全否定して、理由、trade-off、外部制約、security decisionまで消す。
- coverageやlint scoreを目的化し、重要behaviorの未検証を隠す。

#### goalへの寄与

- goalに関わるbusiness ruleを名前とtestで明示し、仕様→code→evidenceのtraceを短くする。
- maintenance objectiveには変更lead time、review指摘、escaped defect、rollback率などのoutcomeを使う。
- 無料toolの導入自体を成功とせず、teamが継続運用でき、重要riskを減らすかで判断する。

---

#### 本章での適用

##### 確定内容 qa-ops-web-migration-guard (対応セル: web)

- 確定要件: 空なら適用を中止する。wrangler が 0 で終わっても中身の無いファイルだけ残る場合があり、それを控えと呼ばない。控えは成果物として 30 日保管し (migrate.yml と同条件)、落ちても残るよう適用より先に保存する。保管に失敗したこと自体も落ちる扱いにする (if-no-files-found: error)
- 設計解釈の記録経路: `dialogue`
- 原則: 控えが在ることの判定を、終了コードではなく中身で行う (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: wrangler d1 export が 0 で終わっても中身の無いファイルだけが残る場合がある。deploy.yml は `[ ! -s "$backup_path" ]` で中身を見て、空なら exit 1 して適用へ進まない。控えの保存 (upload-artifact) は適用より前に置き、適用が落ちても控えが残るようにする
  - トレードオフ:
    - 空でないことしか見ておらず、中身が壊れた控えは通る。復元まで試すのが本筋だが、公開のたびに復元先を用意する費用に見合わないと判断した
- 原則: 保管に失敗したことを、保管したことと区別する (`docs/spec/11-CI-CD・品質ゲート仕様.md#§4-1`)
  - 採否: `applied`
  - 章固有の根拠: upload-artifact に if-no-files-found: error を付け、保管対象が無いまま緑になる道を塞ぐ。保管期間は 30 日で migrate.yml と揃え、公開経由か手動かで戻せる範囲が変わらないようにする
  - トレードオフ:
    - 30 日を過ぎた公開へは戻れない。それ以上遡る必要が出たときは D1 側の時点復旧に頼ることになる
##### 接地根拠 qa-ops-web-spec-intake (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-ops-web-spec-intake` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: スタブをカバレッジ計算から除外しない。加えて「スタブを除いた実質カバレッジ」を併記し、差が開いたら手抜きの合図とする (`docs/spec/10-テスト戦略仕様.md#§2-1`)
  - 採否: `applied`
  - 章固有の根拠: docs/product/coverage.md に全体と実質の 2 段を必ず並べる。1 つの数字にまとめない
  - トレードオフ:
    - 数字が 2 つになり読むのに手間がかかるが、スタブを厚く覆って全体を押し上げる手が効かなくなる
- 原則: 層別に測る。domain と application が最も壊れると痛い層なので、ここに高い水準を要求する (`docs/spec/10-テスト戦略仕様.md#§2-2`)
  - 採否: `applied`
  - 章固有の根拠: 閾値は層ごとに quality-gates.config.mjs へ置き、上限・下限は下げる方向にしか動かさない
  - トレードオフ:
    - 層の切り方を変えると閾値の比較ができなくなるため、層の定義自体を動かしにくくなる
- 原則: 古い判定は古く見えない。完全性評価が現在の仕様書の一部しか見ていない状態を、見張り (pnpm run verify の「仕様レポートの鮮度」) が落ちる側で表す (`docs/spec/08-仕様の未修正点.md#⑤`)
  - 採否: `applied`
  - 章固有の根拠: 指紋の焼き付け (scripts/spec-freshness.mjs --write) は再評価が PASS した後にだけ行う。先に焼くと「いまの仕様書に対する PASS」という嘘が 1 コマンドで作れる
  - トレードオフ:
    - 再評価が済むまで門が赤のままになるが、赤であること自体が未解消の告知になる
##### 接地根拠 qa-ops-web (対応セル: web)

- 本文: 「確定内容 (質疑録)」の `qa-ops-web` を参照
- 設計解釈の記録経路: `dialogue`
- 原則: 通知・監査・バックアップ・障害時分離の運用設計 (`docs/spec/02-補充仕様-ギャップと追加要件.md §7`)
  - 採否: `applied`
  - 章固有の根拠: 投稿失敗/リンク切れ/プログラム終了/成果確定の通知、AuditLog 必須記録対象の列挙、Workspace 単位エクスポート、リダイレクト転送の計測非依存(転送必達)を運用要件とする
  - トレードオフ:
    - リンク切れ監視やレポート取り込みの定期ジョブ(cron)運用が必要となり、失敗時の再実行手順を Runbook 化する
- 原則: 商品情報更新の検知と影響範囲更新 (REFRESH_DUE) (`docs/spec/01-要求仕様書-v1.0.md §8.4`)
  - 採否: `applied`
  - 章固有の根拠: 価格・仕様・販売状態の変更を検知して影響記事を一覧化し、人間確認を経て更新履歴を保存する
  - トレードオフ:
    - 検知頻度を上げると外部API利用量が増えるため、レート予算内でジャンル別に頻度を調整する
- 資するゴール: G1, G2

## 最新ドキュメント出典

| 対象 | バージョン | 公式発行元 | 出典URL | 取得 | 最新確認 |
|---|---|---|---|---|---|
| google-sre | 2017 | Google (sre.google) | https://sre.google/sre-book/table-of-contents/ | 2026-08-19T15:30:40Z | 2026-08-19T15:30:40Z |
| vitest | 4.1.11 | Vitest (vitest.dev) | https://vitest.dev/guide/ | 2026-08-24T11:38:56Z | 2026-08-24T11:38:55Z |
| github-actions | free-pro-team@latest | GitHub (docs.github.com) | https://docs.github.com/en/actions | 2026-08-22T15:05:16Z | 2026-08-22T15:05:16Z |
| stryker-mutator | 10.0.0 | Stryker Mutator (stryker-mutator.io) | https://stryker-mutator.io/docs/stryker-js/introduction/ | 2026-08-22T21:18:38Z | 2026-08-22T21:19:48Z |

## 状態の意味 (State semantics)

- `confirmed` / 「確定」は保守運用の**要求判断を収集済み**であることを表し、ジョブ稼働、通知到達、リストア成功または SLO 達成を表さない。
- 後段の `採否: applied` は運用設計への採用を表し、ジョブ/通知/監査の実装または稼働検証済みを表さない。
- Analytics 運用の実装状態は `not_started`、検証状態は `unverified`。Queue、Cron、運用通知、MetricRollup、再試行/DLQ は未実装。
- 本章内の `ref-system-design-knowledge/...` 参照は**非規範・取得証跡なし・実装根拠に使用不可**。規範根拠は `docs/spec/01` §18.3、`docs/spec/02` §7、`docs/spec/03` §5/§11、および本章の Google SRE 公式出典とする。

## As-Is

- アプリは案件一覧と3つの MCP ツールを同期的に D1 へ接続する PoC。案件一覧は DB 失敗を画面表示できる。
- Queue consumer / producer、Cron trigger、rollup 再構築、有限再試行、DLQ、Workspace 通知チャネル、AuditLog は存在しない。
- 計測 DB 障害中の既知リンク転送、ジョブ重複実行、pending→approved 後の過去再集計は未検証。

## To-Be

| 要件ID | 目標状態 |
|---|---|
| OPS-REQ-001 | Queue/Cron の各ジョブに idempotency key、状態、試行回数、次回時刻、最終エラーを持たせ、無限再試行を禁止する |
| OPS-REQ-002 | MetricRollup を生イベントから再構築でき、成果状態変更時は対象日を再集計して速報/確定を更新する |
| OPS-REQ-003 | 投稿失敗/リンク切れ/プログラム終了/成果確定を Workspace 設定のチャネルへ通知し、dedupe key で利用者向け重複を抑止する |
| OPS-REQ-004 | 計測 DB 障害中も既知リンクの転送を優先し、計測失敗は監査可能な再処理経路へ退避する |
| OPS-REQ-005 | 公開/削除/リンク差し替え/権限変更/成果修正/エクスポートと、ジョブの成功/失敗/再試行を AuditLog へ残す |
| OPS-REQ-006 | Connector ごとにレートとコスト上限を強制し、接近時は警告、超過時は外部呼び出しを自動停止する |
| OPS-REQ-007 | Workspace 単位の記事/商品/リンク/成果エクスポートとテナント分離済み横断検索を提供する |

## Delta

1. まず job contract、idempotency key、AuditLog を共通化し、その上に Queue/Cron を置く。
2. リンク転送と計測書き込みを分離し、通知はジョブ状態から派生させて各コネクタの個別判定を減らす。
3. rollup は加算だけでなく再構築可能にし、重複実行で値が増えないことを保証する。

## Dependencies

`Analytics event contract` → `job / idempotency / AuditLog contract` → `Queue / Cron` → `rollup / retry / DLQ` → `notification adapters` → `Runbook / alert`

- tenant 分離と同意実装の完了前に本番イベントを集計しない。通知は Queue 処理と結合させず、通知事業者の障害が本体ジョブを失敗させない。

## Acceptance evidence

| 受入ID | シナリオ | PASS の証跡 |
|---|---|---|
| OPS-ACC-001 | 計測 D1 を強制失敗させて既知 `/go/{id}` へアクセス | リンク先への `3xx` を維持し、計測失敗を request ID / tracking link ID 付きで再処理経路へ記録。HTTP トレースとキュー証跡を保存 |
| OPS-ACC-002 | テスト設定 `max_attempts=3` で同じ job を3回失敗 | attempt 1〜3 のみ実行し、4回目を実行せず DLQ/要手動対応へ移行。各試行の job ID / attempt / error / next_at と監査レコードを保存 |
| OPS-ACC-003 | 同一 Cron 区間を2回実行し、同一成果を再取込後に `approval_status: pending→approved`、`payment_status: unpaid→paid` へ更新 | イベント・rollup・通知が重複せず、対象日の発生見込・承認報酬・支払報酬だけが再計算される。DB 差分と job 履歴を保存 |
| OPS-ACC-004 | 通知事業者を障害化した状態で投稿ジョブを実行 | 本体ジョブの結果は保持し、通知だけを再試行。復旧後は dedupe key 単位で1件のみ配信し、ジョブ/通知/監査の相関を示す |
| OPS-ACC-005 | 監査必須の6操作とジョブ失敗/再試行を実行 | actorまたは service、workspace、action、target、result、request/job ID、timestamp が全件にあり、通常の業務ロールから改変不可。監査クエリ結果を保存 |
| OPS-ACC-006 | コスト上限前後で Connector を呼び出す | 接近時に1回の警告、超過後は外部通信なしで自動停止。カウンタ、通信トレース、監査記録を保存 |
| OPS-ACC-007 | Workspace A の検索とエクスポートに B と同名データを混在 | A のレコードだけが含まれ、マニフェストの件数/チェックサムと元データが一致。tenant 越境テストと出力証跡を保存 |

## 確定セルの記録 (正本 spec-state.json)

> 本節は正本 `system-spec/spec-state.json` の `coverage_matrix.maintenance-ops.web` が保持している確定内容の**転記**である。規範ではない。値が食い違ったら正本を正とする。

| 項目 | 値 |
|---|---|
| セル | maintenance-ops × web |
| 状態 | 確定 |
| 確定質疑 (qa_ref) | `qa-ops-web-spec-intake` |
| 資するゴール (serves_goals) | G1, G2 |
| required-info | なし (この確定に block 指定の必須情報は登録されていない) |
| 出典 kind | written-requirements |
| 出典 path | `docs/spec/10-テスト戦略仕様.md` |
| 出典 節 | §2 数字を偽らないための規律 |
| 出典 sha256 | `2c6b9edb34293ed9481df28c12f8b8343a21d99ab275d2c6e6984293d1b82430` |
| 適用された設計知識 (design_applications) | 5 件 — 本章 `## 適用された設計知識` を参照 |

### 本節を「転記」に留めた理由

C05 gaps[0] の「再生成して本文へ載せる」を採らず、本節は正本からの**転記**に留めてある。根拠となる 3 つの実測 (再生成で消える 374 行 / 正本の回答が章より古いことを示す 9 トークンの突き合わせ表 / 章と正本の `qa_ref` が 8 件中 7 件で不一致) は `system-spec/database.md` の同名節に 1 か所だけ書いてある。**本文を正本から複製すると退行する**ので、そちらを読まずに「正本に合わせる」修正をしないこと。本章の出典 §2「数字を偽らないための規律」は、まさにこの種の取り違え (対象を確かめずに数を揃える) を禁じている側である。

## 意思決定 (decisions)

> 正本 `decisions[]` の全 7 件。**7 件とも `status: confirmed`** で、いずれも利用者本人の `user_decision` を伴う。本章を主担当とする論点を太字で示す。

| ID | 論点 | 採用した選択肢 | 状態 | 資するゴール | 主担当章 |
|---|---|---|---|---|---|
| `decision-auth-method` | マルチテナントSaaSの利用者認証 (auth) をどの方式で実装するか | `opt-better-auth` | confirmed | G1 | auth |
| `decision-editorial-commercial-split` | Editorial（編集評価）と Commercial（報酬・成果）のデータを、D1 でどう分けるか | `opt-two-databases` | confirmed | G1, G2 | database |
| `decision-redirect-measurement-async` | リダイレクトの計測（ClickEvent の記録）を、転送を止めずにどう書くか | `opt-waituntil-fallback-cron` | confirmed | G2, G1 | infrastructure |
| `decision-llm-provider` | 記事生成に使う LLM プロバイダを 1 社に固定するか、複数を持つか | `opt-catalog-multi` | confirmed | G1 | backend |
| `decision-ui-theme-implementation` | 配色と明暗の 2 軸を、どの技術で実装するか | `opt-css-light-dark` | confirmed | G1 | frontend |
| **`decision-test-ci-tooling`** | テストと CI の道具立てを、いまの構成のまま進めるか変えるか | `opt-keep-current` | confirmed | G1, G2 | **maintenance-ops** |
| `decision-screen-priority` | ui-ux×web の画面で、記事の成績比較と回復すべき業務状態のどちらを先頭に置くか | `opt-performance-first` | confirmed | G1, G2 | ui-ux |

- **`decision-test-ci-tooling` の結論は「現行のまま」だが、「Playwright は不要」という判断ではない。** 10 の 7 種のうち**見た目の回帰だけは現行で測れておらず、その穴は実在する**。足さない理由は必要性ではなく走らせ方にある。11 §8-2 の 3 段 (手動・止めない) は 2026-08-18 に定例をやめており、いま基準を足しても回す場所が無い。穴があることを消さずに残すのが本項の要点である。
- **確定の出どころ**: 利用者本人が 2 つの選択肢から直接選び、回答原文は「現行のままで確定」(`user_decision.verbatim`、2026-08-20)。AI の推奨を昇格させたものでも、オーケストレーターが代理で決めたものでもない。
- **注意**: `system-spec/completeness-report.json` の gaps[3] は本項を `recommended_pending_confirmation` として未確定扱いしているが、これは **2026-08-16 時点の評価**である。正本ではすでに `confirmed`。C05 を再評価すれば消える。
