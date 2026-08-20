# 仕様書構成

## 関心ごとの正本と優先順位

同じ記述が複数文書にある場合は、次の表で指定した「関心ごとの正本」を優先する。上位文書が下位文書の詳細を上書きするのではなく、上位は目的と制約、下位は該当領域の詳細契約を担う。

| 優先 | 関心 | 正本 | 役割 |
| --- | --- | --- | --- |
| 0 | プラットフォーム層とブログ層の関係、同一概念の正規定義の所在、共有ドメインサービス、禁止依存 | `04-二層構造統合仕様.md` | **2本の v1.0 が同じ概念に触れる箇所の唯一の裁定文書** |
| 1 | プロダクト目的、全体スコープ、横断原則、共通用語 | `01-要求仕様書-v1.0.md` | Product Requirements の基準文書。発信者向けコンテンツ運用基盤の目的と境界 |
| 2 | v1.0 で不足した非Analytics要件、未決事項、移行上の補足 | `02-補充仕様-ギャップと追加要件.md` | 差分と決定待ち事項を管理する。Analytics本文は要約に留める |
| 3 | 計測、イベント、成果、集計、KPI、アトリビューション、実験、Insight | `03-分析・解析基盤仕様.md` | **Analytics領域で唯一の詳細な規範正本** |
| 4 | 読者向け比較メディア、WebMCP、公開ゲート、読者ドメインのデータ契約 | `ai-first-webmcp.md` | Phase 0 で導入した読者面の詳細契約。発信者向け案件管理とはドメインが異なる |
| 5 | Phase 0 読者ドメインと現行スキーマの差分 | `data-model-gap.md` | 運営者3テーブルと読者ドメインの非同一を記録する。Analytics正本は `03` |
| 6 | Phase 0 完了条件の検証可能な分解 | `completion-criteria.md` | `ai-first-webmcp.md` §28 の検査可能な投影。要求を増やさない |
| 7 | 実装への投影 | `../../system-spec/*.md` | 上記正本から導出した技術仕様。要求を変更せず、実装詳細を具体化する |
| 8 | 仕様プロセスの機械正本 | `../../system-spec/spec-state.json` | 収集、承認、追跡、`review_runs` の状態を管理する。Markdownの要求本文の正本ではない |
| 9 | 機械可読な検査派生物 | `../../system-spec/completeness-report.json` | `spec-state.json` と仕様から生成する完全性レポート。状態や要求を上書きしない |
| 10 | 記事の文章そのものの作り方（順序・文体・雛形・事実と推論・ペルソナ差分・重複対策・品質検査） | `05-文章作成メソッド仕様.md` | 文章レベルの唯一の正本。構成は `06`、生成の仕組みは `07` |
| 11 | サイトの構造パラメータと記事構成テンプレート、ウィザードとの接続 | `06-サイトブループリント-記事構成テンプレート.md` | Site Blueprint / ArticleTemplate の正本 |
| 12 | プロンプト・スキル・サブエージェント・評価セットの設計 | `07-生成基盤設計.md` | 生成基盤の正本。実装可能な具体度で記述する |
| 12-2 | 仕様文書そのものに残っている未修正点 | `08-仕様の未修正点.md` | 4件の内訳・深刻度・解除条件。生成工程 (C03/C01) 側の課題であり、手で直さない |
| 12-3 | 見た目の切り替え（配色 × 明暗）の規範とコントラスト下限 | `09-UIテーマ仕様.md` | UI テーマの唯一の規範正本。実装契約は `../architecture/ui-system.md` |
| 12-4 | 何をテストしなければならないか、カバレッジの測り方と偽らない規律 | `10-テスト戦略仕様.md` | テストの唯一の規範正本。配置と補助部品は `../architecture/testing-architecture.md` |
| 12-5 | 自動検査・公開・構造変更の起動条件、閾値の一元管理、品質ゲート | `11-CI-CD・品質ゲート仕様.md` | CI/CD の唯一の規範正本。運用手順は `../product/ci-cd-guide.md` |
| 12-6 | 管理者からの改善要望の受け取り・払い出し・Claude Code 連携 | `12-改善要望フィードバック仕様.md` | プロダクト自体を良くするループの唯一の規範正本。実装契約は `../architecture/feedback-loop.md` |
| 13 | 要件と実装の双方向対応（§30.8） | `../product/traceability.md` | 全要件の実装状態・画面・状態表現・アクセシビリティの追跡表 |
| 14 | 仮定・指摘・意思決定・変更の記録 | `../product/ledgers.md` | ASM / FND / ADR / CHG の台帳 |
| 15 | テストが届いている割合の実測（層別・スタブを除いた実質の併記） | `../product/coverage.md` | 実測値の記録先。**手で書かない**（閾値の仕組み設置後は生成物） |
| 16 | 自動チェックと公開の運用手順（非エンジニア向け） | `../product/ci-cd-guide.md` | 規範ではなく手順。規範は `11-CI-CD・品質ゲート仕様.md` |
| 17 | 対話ヒアリングで聞き取った一次根拠の写し | `dialogue-confirmations.md` | 規範ではなく**写し**。要求を新しく作らない。元の記録は `../../system-spec/spec-state.json` の `qa_log`（`source.kind = user-dialogue`）で、そちらを書き換えずに書き起こしを足している。競合したら一次根拠は `qa_log` 側 |

競合時は「対象の関心を特定 → その関心の正本を採用 → 派生物を再生成・同期」の順で解消する。判断不能な競合だけを未決事項へ戻し、複数の本文を同時に修正して整合させ続ける運用はしない。

## 文書状態の4軸

単一の「確定／ドラフト」では意味が混ざるため、変更単位ごとに次の4軸を記録する。

| 軸 | 値 | 判定対象 |
| --- | --- | --- |
| `requirement_status` | `draft / approved / superseded` | 要求・契約が承認済みか |
| `document_status` | `draft / approved / generated / stale` | 文書自体が承認済みか、生成物か、正本より古いか |
| `implementation_status` | `not_started / partial / implemented` | 現行実装が仕様を満たすか |
| `verification_status` | `unverified / pass / fail / stale` | 受け入れ条件を証拠付きで検証したか、または証拠が古くないか |

文書ヘッダーのversionは内容の版を表し、上記4軸の代用にはしない。状態が未記載の既存項目は、移行中の既定として `draft / draft / not_started / unverified` と扱い、事実確認後に更新する。`decision_status` は4軸に混ぜず、必要な項目だけ `open / decided / deferred` の任意台帳フィールドとして管理する。

## 現在の文書

| ファイル | 内容 | `requirement_status` | `document_status` | `implementation_status` | `verification_status` |
| --- | --- | --- | --- | --- | --- |
| `01-要求仕様書-v1.0.md` | 全体構想・要求仕様 | approved（v1.0） | approved | partial（現行PoC） | unverified（全受入は未実施） |
| `02-補充仕様-ギャップと追加要件.md` | 非Analyticsのギャップと、Analytics正本への移行記録 | draft（v1.1） | draft | partial | unverified |
| `03-分析・解析基盤仕様.md` | Analyticsの唯一の詳細正本 | draft（v1.1） | draft | partial | unverified（ANA-AC-01〜17） |
| `ai-first-webmcp.md` | 読者向け比較メディアと WebMCP の Phase 0 契約 | approved（Phase 0） | approved | partial（Phase 1 スキーマと公開ゲート） | unverified |
| `data-model-gap.md` | 運営者ドメインと読者ドメインの差分 | approved（Phase 0 分析） | approved | partial | unverified |
| `completion-criteria.md` | Phase 0 完了条件の検証分解 | approved（Phase 0） | approved | not_started | unverified |
| `04-二層構造統合仕様.md` | プラットフォーム層とブログ層の統合ルール5条・WebMCP確定契約・禁止依存 | approved（v1.0） | approved | not_started | unverified |
| `05-文章作成メソッド仕様.md` | 文章作成メソッド・文体規則・雛形・事実と推論・ペルソナ差分・重複対策・QC-01〜17 | approved（v1.0） | approved | not_started | unverified |
| `06-サイトブループリント-記事構成テンプレート.md` | SiteBlueprint / ArticleTemplate のパラメータ定義とウィザード接続 | approved（v1.0） | approved | not_started | unverified |
| `07-生成基盤設計.md` | プロンプト・スキル8種・サブエージェント6種・評価セット50件・ローンチ基準 | approved（v1.0） | approved | not_started | unverified |
| `08-仕様の未修正点.md` | 完全性判定で挙がった4件（3件未解消 / 1件解消済み）とその解除条件 | 記録（2026-08-17 実地確認） | — | — | verified |
| `09-UIテーマ仕様.md` | 配色 × 明暗の 2 軸モデル・配色の増やし方・コントラスト下限（UI-AC-01〜10） | approved（v1.0） | approved | implemented | pass（7件）/ unverified（3件） |
| `10-テスト戦略仕様.md` | テスト 7 種・層別カバレッジ・数字を偽らない規律・テストの変更容易性（TST-AC-01〜13） | approved（v1.0） | approved | partial | unverified |
| `11-CI-CD・品質ゲート仕様.md` | 検査/公開/構造変更の3本立て・閾値の一元管理・秘密情報・品質ゲート（CI-AC-01〜11） | approved（v1.0） | approved | partial | unverified |
| `12-改善要望フィードバック仕様.md` | 右下の改善ボタン・画面の写しと黒塗り・一覧と詳細・払い出し・Claude Code 連携と鍵（FB-AC-01〜24） | approved（v1.0） | approved | not_started | unverified |

## As-Is / To-Be 要約

| 観点 | As-Is（現行） | To-Be（本仕様） |
| --- | --- | --- |
| 要求管理 | `01`の構想に`02`・`03`の補充が加わり、同じAnalytics要件が複数箇所に残る。Phase 0 の読者面契約は別ファイルに残る | 関心ごとに正本を一つにし、他文書は要約と参照だけを持つ。読者面は `ai-first-webmcp.md`、発信者面は `01`、計測は `03` |
| 実装投影 | `system-spec`と実装はPoCの到達点を含み、要求の完成形と一致しない箇所がある | `docs/spec`でTo-Be契約を決め、`system-spec`へ実装可能な形で投影する |
| 状態表示 | 文書全体の「確定／ドラフト」が要求・文書・実装・検証を兼ねる | 4軸で未承認・古い文書・未実装・未検証を混同しない |
| Analytics | クリック、成果、KPIの契約が`01`〜`03`に分散する | 詳細は`03`へ集約し、`01`・`02`は目的、境界、移行記録のみ保持する |
| 読者ドメイン | Phase 0 で比較メディア契約とギャップ分析が入り、Phase 1 で読者テーブルと公開ゲートが実装された | 読者面の詳細は `ai-first-webmcp.md`、スキーマ差分は `data-model-gap.md`。運営者3テーブルとは混ぜない |

## 読み順と更新順

読み順は `01`（全体像）→ `02`（補充と未決事項）→ `03`（Analytics詳細）→ `ai-first-webmcp.md`（読者面）→ `data-model-gap.md` / `completion-criteria.md`（Phase 0 差分と検査）→ `system-spec`（実装投影）とする。

更新は次の順序を守る。

1. 変更の関心と正本を特定し、As-Isの実装・既存仕様・未決事項を確認する
2. 正本だけで要求、用語、状態、受け入れ条件を更新する
3. 参照元の要約と移行記録を同期する（詳細本文を複製しない）
4. `system-spec`、機械可読派生物、実装をこの順で投影する
5. 矛盾なし・漏れなし・整合性あり・依存関係整合を検証し、4軸状態と証拠を更新する

## 未決事項

- 非Analyticsの未決事項は `02` §9 に集約する
- Analyticsの既定値と変更可能範囲は `03` を正本とする。アトリビューション既定はlast-click、インサイト優先度重みはWorkspaceで変更可能
