# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## このタスクの目的と、導入で得られる価値

### 技術的な詳細 (エンジニア向け)
- **目的 (何をするか)**: 管理画面を単一用途画面へ再編し、共通コンポーネント化と投稿状態の可視化によって、複数ブログ・複数SNSへの展開作業を迷いなく完了できるようにする
- **到達状態 (Goal)**: 全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、X/Facebook等の新SNSをプロバイダ追加のみで拡張できる構成になっている

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・0 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-UIUX-OVERHAUL-P01`、`SYS-UIUX-OVERHAUL-P02`、`SYS-UIUX-OVERHAUL-P03`、`SYS-UIUX-OVERHAUL-P04`、`SYS-UIUX-OVERHAUL-P05`、`SYS-UIUX-OVERHAUL-P06`、`SYS-UIUX-OVERHAUL-P07`、`SYS-UIUX-OVERHAUL-P08`、`SYS-UIUX-OVERHAUL-P09`、`SYS-UIUX-OVERHAUL-P10`、`SYS-UIUX-OVERHAUL-P11`、`SYS-UIUX-OVERHAUL-P12`、`SYS-UIUX-OVERHAUL-P13`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-UIUX-OVERHAUL-P01` None

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-UIUX-OVERHAUL-P02` None

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-UIUX-OVERHAUL-P03` None

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-UIUX-OVERHAUL-P04` None

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-UIUX-OVERHAUL-P05` None

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-UIUX-OVERHAUL-P06` None

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-UIUX-OVERHAUL-P07` None

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-UIUX-OVERHAUL-P08` None

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-UIUX-OVERHAUL-P09` None

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-UIUX-OVERHAUL-P10` None

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-UIUX-OVERHAUL-P11` None

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-UIUX-OVERHAUL-P12` None

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-UIUX-OVERHAUL-P13` None

