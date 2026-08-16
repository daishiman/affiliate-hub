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

## カテゴリ別収集状態

| プラットフォーム | 状態 | 根拠 |
|---|---|---|
| Web (web) | 確定 | 確定質疑: qa-ops-web |
| モバイル (mobile) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| タブレット (tablet) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Windows) (desktop-windows) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (Linux) (desktop-linux) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |
| デスクトップ (macOS) (desktop-macos) | 対象外 | 理由: 対象プラットフォームはWebのみ。モバイル・タブレットはレスポンシブWebとしてwebセルで扱い、ネイティブアプリ・デスクトップアプリはスコープ外 (利用者承認 approval-platform-web-only) |

## 確定内容 (質疑録)

### qa-ops-web (対応セル: web)

**質問**: 書面入力 docs/spec/02-補充仕様-ギャップと追加要件.md §7 の保守運用 (maintenance-ops) × web 要件は何か

**回答**: | 通知 | 投稿失敗・リンク切れ・プログラム終了・成果確定をメール/Slack/アプリ内で通知。通知チャネルはWorkspace設定 |
| レート制限 | 各Connectorにレートリミッタとコスト上限(特にX API従量課金)。上限接近で警告、超過で自動停止 |
| バックアップ | Workspace単位のエクスポート(記事・商品・リンク・成果CSV)。退会時データポータビリティ |
| 監査 | AuditLog の必須記録対象を列挙:公開/削除/リンク差し替え/権限変更/成果データ修正/エクスポート |
| 障害時 | 計測系障害単独を理由に既知の有効resolver entryの転送を止めない。未知・停止・破損entryは安全側で拒否し、SLOと劣化条件を監視 |
| 検索 | 記事・商品・リンクの横断全文検索。テナント別インデックス(26.4章と整合) |

## 上流指針 (doctrine anchor)

| concern | authority (正本) | 導く上流原則 | 出典 |
|---|---|---|---|
| operations | Google SRE | 運用手順・障害対応・トイル削減・ポストモーテムの上流指針 | https://sre.google/workbook/ |

- 本章の確定内容 (質疑録) は上記 authority を上流指針として適用する。具体技術の選定はこの指針に従属し、指針との乖離は再オープン (R4-reopen) の根拠になる。

## 適用された設計知識

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

##### 確定内容 qa-ops-web (対応セル: web)

- 確定要件: | 通知 | 投稿失敗・リンク切れ・プログラム終了・成果確定をメール/Slack/アプリ内で通知。通知チャネルはWorkspace設定 |
| レート制限 | 各Connectorにレートリミッタとコスト上限(特にX API従量課金)。上限接近で警告、超過で自動停止 |
| バックアップ | Workspace単位のエクスポート(記事・商品・リンク・成果CSV)。退会時データポータビリティ |
| 監査 | AuditLog の必須記録対象を列挙:公開/削除/リンク差し替え/権限変更/成果データ修正/エクスポート |
| 障害時 | 計測系障害単独を理由に既知の有効resolver entryの転送を止めない。未知・停止・破損entryは安全側で拒否し、SLOと劣化条件を監視 |
| 検索 | 記事・商品・リンクの横断全文検索。テナント別インデックス(26.4章と整合) |
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
| google-sre | 2026-08-16 | Google (sre.google) | https://sre.google/sre-book/table-of-contents/ | 2026-08-16T09:11:22Z | 2026-08-16T09:11:39Z |
