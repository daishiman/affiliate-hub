# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## このタスクの目的と、導入で得られる価値

### 技術的な詳細 (エンジニア向け)
- **目的 (何をするか)**: 読者がトップページに来た瞬間に「何のブログで、何が読めて、次にどこへ行けばよいか」を迷わず掴めるようにし、参照ブログの情報階層だけを抽象化して独自の構成へ翻訳する
- **到達状態 (Goal)**: トップページが おすすめ記事 → 最新/人気の切り替え → カテゴリーから探す → 記事一覧への導線 の順で構成され、各記事がサムネイル・カテゴリー・公開日時付きカードで並び、ヘッダーはスクロール中も追従してヘッダー内から検索を起動でき、フッターに運営者情報・法務ページ・RSS の7導線が揃い、JavaScript が無効でも全導線が機能する状態になっている

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・12 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-BLOG-TOP-PAGE-COMPOSITION-P01`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P01` None

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P02` None

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P03` None

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P04` None

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P05` None

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P06` None

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P07` None

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P08` None

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P09` None

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P10` None

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P11` None

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P12` None

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-BLOG-TOP-PAGE-COMPOSITION-P13` None

