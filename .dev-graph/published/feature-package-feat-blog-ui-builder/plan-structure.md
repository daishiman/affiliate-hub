# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## このタスクの目的と、導入で得られる価値

### 技術的な詳細 (エンジニア向け)
- **目的 (何をするか)**: ブログごとにテンプレートと配色を選び、公開面・作成・保存・管理一覧のどの面でも「どのブログにどのアフィリエイトが載っているか」を迷わず把握できるブログ UI を提供する
- **到達状態 (Goal)**: テンプレートから新規ブログを作成でき、配色をブログ既定とページ単位で選べ、ヘッダー・サイドバー・フッターが常時表示され、運営者情報・全カテゴリー・サイトポリシー・プライバシーポリシー・特定商取引法に基づく表記・お問い合わせの固定ページと図解・比較などの表現ブロックを構築でき、公開面/作成/保存/管理一覧の各面でブログ×アフィリエイトの配置が一覧・逆引きできる状態になっている

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・0 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-BLOG-UI-BUILDER-P01`、`SYS-BLOG-UI-BUILDER-P02`、`SYS-BLOG-UI-BUILDER-P03`、`SYS-BLOG-UI-BUILDER-P04`、`SYS-BLOG-UI-BUILDER-P05`、`SYS-BLOG-UI-BUILDER-P06`、`SYS-BLOG-UI-BUILDER-P07`、`SYS-BLOG-UI-BUILDER-P08`、`SYS-BLOG-UI-BUILDER-P09`、`SYS-BLOG-UI-BUILDER-P10`、`SYS-BLOG-UI-BUILDER-P11`、`SYS-BLOG-UI-BUILDER-P12`、`SYS-BLOG-UI-BUILDER-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-BLOG-UI-BUILDER-P01` None

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-BLOG-UI-BUILDER-P02` None

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-BLOG-UI-BUILDER-P03` None

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-BLOG-UI-BUILDER-P04` None

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-BLOG-UI-BUILDER-P05` None

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-BLOG-UI-BUILDER-P06` None

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-BLOG-UI-BUILDER-P07` None

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-BLOG-UI-BUILDER-P08` None

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-BLOG-UI-BUILDER-P09` None

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-BLOG-UI-BUILDER-P10` None

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-BLOG-UI-BUILDER-P11` None

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-BLOG-UI-BUILDER-P12` None

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-BLOG-UI-BUILDER-P13` None

