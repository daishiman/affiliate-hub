# task-progress (live 実行状態・派生ビュー)

> `project-task-status.py` 生成の派生ビュー。構造の正本は `task-graph.json`、状態の正本は build dir の `task-state.json`。手書き編集しない (再生成で上書き)。build 異常終了時は最後の 投影時点のスナップショットで stale の可能性がある (最新は再投影で得る)。

- 凡例: ✓=done / ▶=running / ✗=blocked / ☐=pending / ⏳=未処理の発見タスク (外ループ待ち)
- 完了率: **0%** (0/13)
- 状態内訳: done=0 / running=0 / blocked=0 / pending=13
- route-report 数: 0

## このタスクの目的と、導入で得られる価値

### 技術的な詳細 (エンジニア向け)
- **本質的な問題・課題**: 利用者要望『サイトごとに記事を管理したり、情報を管理したり、読者像や書き方の決め事などを管理するべきところを、全体で構成する形になっている』『どこで何をするのか直感的にわからないため、この辺を整えてください』への対応。管理ルートが 93 本あり、入口が作業の単位ではなく機能の単位で並んでいるため、目的の画面に辿り着く前にどれが自分の作業かを判断する手間が挟まっている (system-spec/ui-ux.md #740)。
- **目的 (何をするか)**: 作業の対象物ごとに画面を束ね、いまどのブログの決め事を見ているかを画面が示す状態にして、管理画面の認知負荷を下げる
- **背景・前提**:
  - 利用者要望『サイトごとに記事を管理したり、情報を管理したり、読者像や書き方の決め事などを管理するべきところを、全体で構成する形になっている』『どこで何をするのか直感的にわからないため、この辺を整えてください』への対応。
  - 管理ルートが 93 本あり、入口が作業の単位ではなく機能の単位で並んでいるため、目的の画面に辿り着く前にどれが自分の作業かを判断する手間が挟まっている (system-spec/ui-ux.md #740)。
  - 受け皿である /admin/sites/[site]/ 階層と記事画面そのものは feat-blog-scoped-admin-console が正本として新設・配置するため、本 feature はその配下へ読者像 (/admin/personas/*) と書き方の決め事 (/admin/writing/*) を所属替えし、記事については旧 /admin/content/* からの転送だけを担う。
  - 動詞ラベル・危険操作の分離・直接編集の UX 規則そのものは feat-reference-blog-admin-ux が正本であり、本 feature はそれを適用する側に回る。
  - 指標の提示順序の規則は feat-blog-scoped-admin-console が正本、数値の正本は feat-blog-metrics-rollup の site_daily_metrics / article_daily_metrics であり、本 feature は新しい指標や集計表を作らない。
  - ブログ実体そのものは feat-blog-ops-crud が持つ。
- **到達状態 (Goal)**: 読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている

## タスクの依存関係 (何が何に依存して進むか)
> 全 13 タスク・14 依存エッジ。各フェーズの詳細は下記チェックリスト、完全な関係は HTML レポートを参照。
- 起点タスク (依存なしで最初に着手可能): `SYS-SITE-SCOPED-AUTHORING-IA-P01`

## P01
> 🎯 何のため: 何を作るか — 要件と作業方針を固める
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P01` None

## P02
> 🎯 何のため: どう作るか — 構成・データ・依存を設計する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P02` None

## P03
> 🎯 何のため: 設計を独立レビューで検証する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P03` None

## P04
> 🎯 何のため: 検証方法 (テスト) を先に設計する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P04` None

## P05
> 🎯 何のため: 各部品を実際に作る (実装)
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P05` None

## P06
> 🎯 何のため: 作った部品を動かして検証する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P06` None

## P07
> 🎯 何のため: 合格ライン (受け入れ基準) を定める
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P07` None

## P08
> 🎯 何のため: 重複を整理し保守しやすくする
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P08` None

## P09
> 🎯 何のため: 全体の品質ゲートを通す
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P09` None

## P10
> 🎯 何のため: 最終レビューで仕上がりを確認する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P10` None

## P11
> 🎯 何のため: 検証した証拠を残す
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P11` None

## P12
> 🎯 何のため: 使い方・導入手順を文書化する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P12` None

## P13
> 🎯 何のため: リリースしてよいか判定する
- ☐ `SYS-SITE-SCOPED-AUTHORING-IA-P13` None

