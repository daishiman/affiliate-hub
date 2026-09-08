# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## このタスクの目的と、導入で得られる価値

### 技術的な詳細 (エンジニア向け)
- **目的 (何をするか)**: SEO と AEO の良し悪しを推測ではなく自前の計測で判断し、その結果をブログの構成へ戻せるようにする
- **到達状態 (Goal)**: サイト内静的解析・Google Search Console 連携・AI 検索での被引用チェックの 3 つの自前データ源が定期的に走り、ページ単位の課題と改善案が管理画面に出て、導入後に作られた記事へは機械が自動で反映して事後通知し、どの反映も差分として記録され 1 操作で取り消せる状態になっている

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・16 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-SEO-AEO-MEASUREMENT-LOOP-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P01` None

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P02` None

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P03` None

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P04` None

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P05` None

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P06` None

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P07` None

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P08` None

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P09` None

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P10` None

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P11` None

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P12` None

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-SEO-AEO-MEASUREMENT-LOOP-P13` None

