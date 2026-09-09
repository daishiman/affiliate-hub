# 実装要件定義書: feat-site-scoped-authoring-ia

> 本書は dev-graph `requirements` verb が確定済み feature node と promoted exact-13 package から導出した実装要件であり、
> 実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

| 項目 | 値 |
|---|---|
| graph snapshot digest | `sha256:8f8cefbd7948ca2a8a0d30286381fad75962fef5d6274d2ce7c51d13cefa49ba` |
| graph revision | 667 |
| scope digest | `sha256:ac2764f6cbb9e12df582572f67eef516bb370a5ded522bf551e8df27e6751f81` |
| feature package | `feature-package/feat-site-scoped-authoring-ia` |
| promoted generation digest | `sha256:1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf` |
| promoted generation path | `.dev-graph/published/generations/feature-package-feat-site-scoped-authoring-ia/1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf` |
| handoff target | `task-graph` |
| quality choice | standard (gate 全通過を完了条件とする) |
| emitted_at | 2026-09-08T00:00:00Z |

## この feature の位置

**目的**: 作業の対象物ごとに画面を束ね、いまどのブログの決め事を見ているかを画面が示す状態にして、管理画面の認知負荷を下げる

**ゴール**: 読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている

記事ごとに散っていた管理画面を、作業の対象物 (ブログ・記事・読者・商品・配信) ごとに束ね直す。
読者像と書き方の決め事は現在 feature 横断の位置にあり、どのブログの決め事を見ているのかが画面から分からない。
本 feature はその所属を `/admin/sites/[site]/` 配下へ移し、旧 URL を転送で受け、入口の数を対象物の数まで畳む。
画面そのものの新設と指標の集計は上流 feature が正本を持ち、本 feature は所属・転送・束ね直し・ラベル適用だけを担う。

## 実装範囲

- 記事の旧入口 /admin/content/* を、feat-blog-scoped-admin-console が置いた /admin/sites/[site]/ 配下の記事画面へ転送で受ける (記事画面そのものの新設・配置は同 feature が正本)
- 読者像 (/admin/personas/*) を /admin/sites/[site]/ 配下へ所属替えし、旧 URL を転送で受ける
- 書き方の決め事 (/admin/writing/*) を /admin/sites/[site]/ 配下へ所属替えし、旧 URL を転送で受ける
- 93 本ある管理ルートを作業の対象物 (ブログ・記事・読者・商品・配信) で束ね、入口の数を対象物の数まで減らす
- feat-reference-blog-admin-ux が定めた日本語の動詞ラベルの規則を、束ね直した各入口へ適用する (規則そのものは同 feature が正本)
- ブログをまたいで書き方の決め事を揃えるための、共通の雛形から複製する経路
- よく使う画面への近道 (階層が 1 段深くなることの相殺)
- feat-reference-blog-admin-ux が定めた危険操作の分離と直接編集の規則を、所属替えした画面と束ね直した入口へ適用する (規則そのものは同 feature が正本)
- site セグメントが解決できないときの notFound と、他ブログの内容を出さないこと
- ブログを特定できない旧 URL からのブログ選択への誘導
- feat-blog-scoped-admin-console が定めた既存指標 (site_daily_metrics / article_daily_metrics) の提示順序の規則を、所属替えした読者像・書き方の決め事の画面と束ね直した入口へ適用する (提示順序そのものの規則は同 feature が正本)

## 範囲外

- 新しい指標や集計を作ること (指標の正本は feat-blog-metrics-rollup)
- /admin/sites/[site]/ 配下の各画面そのものの新設 (feat-blog-scoped-admin-console)
- 記事画面そのものの新設・配置 (feat-blog-scoped-admin-console が正本。本 feature が記事について担うのは旧 /admin/content/* からの転送だけ)
- ブログの作成・削除そのもの (feat-blog-ops-crud)
- 読者面のデザイン (feat-blog-ui-builder / feat-reader-surface)
- 権限モデルの新設 (既存 workspace 権限を使う)
- 管理画面の UX 規則そのものの策定 (1 画面 1 目的・日本語の動詞ラベル・進行開示・直接編集・危険操作の分離・次にすべきことの明示) — feat-reference-blog-admin-ux が正本
- 既存指標の提示順序そのものの規則の策定 (feat-blog-scoped-admin-console が正本。feat-blog-metrics-rollup も同 feature を正本と名指している)

範囲外の項目は「やらない」ではなく「ここではやらない」を意味する。括弧内の feature が正本を持つ。

## 上流依存とアーキテクチャ文脈

| 種別 | node | 役割 |
|---|---|---|
| 依存 feature | `feat-blog-scoped-admin-console` | /admin/sites/[site]/ 配下の各画面と既存指標の提示順序の正本。本 feature は転送とラベル適用だけを担う |
| 依存 feature | `feat-blog-metrics-rollup` | 指標 (site_daily_metrics / article_daily_metrics) の正本。本 feature は読むだけで新設しない |
| 依存 feature | `feat-blog-ops-crud` | ブログの作成・削除の正本。本 feature は入口の束ね直しだけを担う |
| 依存 feature | `feat-reference-blog-admin-ux` | 動詞ラベル・危険操作の分離・直接編集の規則の正本。本 feature は規則を適用する側 |
| architecture | `arch-system-spec-overview` | システム全体の確定仕様。管理ルートの現況 (93 本) と二層構成の前提を持つ |
| architecture | `arch-two-layer-platform` | 運営面 (/admin) と読者面 (/s) の二層境界。所属替え後も読者面へ影響しない根拠 |
| architecture | `arch-blog-operations-console` | ブログ運営コンソールの構造。入口の束ね直しが従う対象物の区切り |

## 受入条件トレーサビリティ

導出規則 (再実行可能): base=[P01,P04,P05,P06,P07,P11]。受入条件本文の語で加算する: 転送/所属替え/配下/束ね/畳/近道/雛形/複製/契約/規則→P02、旧/重複/既存/移行→P08、確認/危険/権限/notFound/出ない/クリック数/アクセシビリティ→P09、名前/ラベル/手順/説明/文言→P12、配信/公開面/リリース→P13。加算後に昇順で一意化する。 (語彙は本 feature の受入条件と exact-13 の phase title から取る。P03/P10 は全受入を横断するレビュー phase なので個別加算しない。)

| ID | 受入条件 | confirmed source | 主 phase |
|---|---|---|---|
| A1 | 読者像・書き方の決め事の各画面が /admin/sites/[site]/ 配下に存在する (記事画面の存在は feat-blog-scoped-admin-console の受入で判定する) | `feature:feat-site-scoped-authoring-ia#acceptance[0]` | P01, P02, P04, P05, P06, P07, P11 |
| A2 | /admin/content/*・/admin/personas/*・/admin/writing/* へのアクセスが、ブログを特定できる場合は対応する /admin/sites/[site]/... へ転送される | `feature:feat-site-scoped-authoring-ia#acceptance[1]` | P01, P02, P04, P05, P06, P07, P11 |
| A3 | ブログを特定できない旧 URL へのアクセスがブログ選択へ送られる | `feature:feat-site-scoped-authoring-ia#acceptance[2]` | P01, P04, P05, P06, P07, P08, P11 |
| A4 | site セグメントが解決できないとき notFound になり、他ブログの内容が出ない | `feature:feat-site-scoped-authoring-ia#acceptance[3]` | P01, P04, P05, P06, P07, P09, P11 |
| A5 | 管理画面の一段目の入口が、作業の対象物の数まで畳まれている | `feature:feat-site-scoped-authoring-ia#acceptance[4]` | P01, P02, P04, P05, P06, P07, P11 |
| A6 | 一段目の各入口の名前が feat-reference-blog-admin-ux の動詞ラベル規則に従い、初見の運営者がラベル一覧だけを見て各入口でできることを言い当てる正答率が、同 feature の受入と同じ 90% 以上である | `feature:feat-site-scoped-authoring-ia#acceptance[5]` | P01, P02, P04, P05, P06, P07, P11, P12 |
| A7 | 書き方の決め事を共通の雛形から複製する経路が存在する | `feature:feat-site-scoped-authoring-ia#acceptance[6]` | P01, P02, P04, P05, P06, P07, P11 |
| A8 | よく使う画面への近道が存在し、その近道を使った到達クリック数が、束ね直す前の構成での同じ画面への到達クリック数以下である | `feature:feat-site-scoped-authoring-ia#acceptance[7]` | P01, P02, P04, P05, P06, P07, P09, P11 |
| A9 | ブログ設定・ドメイン・公開の各操作に確認が挟まり、下書きの編集には挟まらない (分岐の規則は feat-reference-blog-admin-ux に従う) | `feature:feat-site-scoped-authoring-ia#acceptance[8]` | P01, P02, P04, P05, P06, P07, P09, P11 |
| A10 | 所属替えした画面と束ね直した入口に出る結果一覧とグラフが、既存の site_daily_metrics / article_daily_metrics だけを読み、新しい集計表を追加していない (提示順序そのものの妥当性は feat-blog-scoped-admin-console の受入で判定する) | `feature:feat-site-scoped-authoring-ia#acceptance[9]` | P01, P02, P04, P05, P06, P07, P08, P11 |

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-SITE-SCOPED-AUTHORING-IA-P01` | サイト所属型オーサリングIAの要求ベースライン確定 | — |
| P02 | `SYS-SITE-SCOPED-AUTHORING-IA-P02` | 転送契約・所属替え契約・入口束ね直し契約・近道契約・雛形複製契約の設計 | P01 |
| P03 | `SYS-SITE-SCOPED-AUTHORING-IA-P03` | 設計レビューと転送網羅性・越境防止・ラベル整合性の独立検証 | P02 |
| P04 | `SYS-SITE-SCOPED-AUTHORING-IA-P04` | 受入10件に対応するテスト設計 | P03 |
| P05 | `SYS-SITE-SCOPED-AUTHORING-IA-P05` | 所属替え・転送・入口束ね直し・近道・雛形複製の実装 | P04 |
| P06 | `SYS-SITE-SCOPED-AUTHORING-IA-P06` | テスト全量実行と回帰0件の確認 | P05 |
| P07 | `SYS-SITE-SCOPED-AUTHORING-IA-P07` | 受入10件の受け入れ判定 | P06 |
| P08 | `SYS-SITE-SCOPED-AUTHORING-IA-P08` | 旧入口の重複実装解消と転送シェルへの一本化 | P05 |
| P09 | `SYS-SITE-SCOPED-AUTHORING-IA-P09` | 品質保証とアクセシビリティ・危険操作分離の非機能検査 | P08 |
| P10 | `SYS-SITE-SCOPED-AUTHORING-IA-P10` | 最終レビューと残課題の確定 | P09 |
| P11 | `SYS-SITE-SCOPED-AUTHORING-IA-P11` | 受入・品質証跡の集約と検証可能性の確保 | P07, P09 |
| P12 | `SYS-SITE-SCOPED-AUTHORING-IA-P12` | 所属替え・束ね直しの運用規則と運用手順の文書化 | P10, P11 |
| P13 | `SYS-SITE-SCOPED-AUTHORING-IA-P13` | 開発環境へのリリースとsystem-specへの書き戻し | P12 |

## readiness matrix

| gate | 結果 |
|---|---|
| C11 graph schema | exit 0 / violations 0 |
| source digest | exit 0 / checked 17 / mismatch 0 |
| C02 saved state | closure 17 件すべて confirmed / pass / readiness complete |
| validate-system-plan | exit 0 / contract 1.3.0 / P01..P13 exact-13 |
| verdict | **ready** |

## task-graph build への制約

- exact-13 の phase 集合を増減しない。14 件目の追加や 12 件への縮約は契約違反とする。
- 実装対象は promoted generation `sha256:1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf` の task spec 本文であり、本書はその索引である。
- 新しい集計表・新しい指標を作らない。A10 の通り既存 `site_daily_metrics` / `article_daily_metrics` だけを読む。
- `/admin/sites/[site]/` 配下の画面そのものの新設は `feat-blog-scoped-admin-console` の担当であり、
  本 feature の実装は所属替え・転送・入口の束ね直し・近道・雛形複製に限る。
- 動詞ラベル・危険操作の分離の規則は `feat-reference-blog-admin-ux` を参照し、規則そのものを本 feature で再定義しない。
- `src/app/admin/sites/[site]/` と `src/components/admin/` は `feat-blog-scoped-admin-console` と
  ディレクトリ単位で重なる。並行実装時は同一 path への同時書込を避ける (schedule verb の resource_scope 判定で扱う)。

## handoff

- target: `task-graph`
- handoff package: `.dev-graph/handoff/task-graph/feat-site-scoped-authoring-ia.json`
- readiness: `.dev-graph/handoff/requirements-readiness-feat-site-scoped-authoring-ia.json`
- scope: `.dev-graph/handoff/requirements-scope-feat-site-scoped-authoring-ia.json`
- trace: `.dev-graph/handoff/requirements-trace-feat-site-scoped-authoring-ia.json`
- implementation code generated by this verb: 0
