---
graph_node_id: "feat-site-scoped-authoring-ia"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "ui-ux"
tags: ["admin","site-scoped","information-architecture","navigation","cognitive-load"]
priority: "high"
start_date: "2026-09-08"
target_date: null
iteration: null
title: "記事・読者像・書き方の決め事のブログ配下への所属替えと、管理入口の束ね直し"
owners: ["daishiman"]
created_at: "2026-09-08T00:00:00Z"
updated_at: "2026-09-09T00:00:00Z"
status: "active"
depends_on: ["feat-blog-scoped-admin-console","feat-blog-metrics-rollup","feat-blog-ops-crud","feat-reference-blog-admin-ux"]
related_nodes: ["spec-system-spec-index","arch-blog-operations-console","feat-blog-scoped-admin-console","feat-reference-blog-admin-ux"]
resource_scope: ["src/app/admin/sites/[site]/","src/app/admin/content/","src/app/admin/personas/","src/app/admin/writing/","src/app/admin/layout.tsx","src/app/admin/page.tsx","src/components/admin/","system-spec","features/feat-site-scoped-authoring-ia.context.json"]
purpose: "作業の対象物ごとに画面を束ね、いまどのブログの決め事を見ているかを画面が示す状態にして、管理画面の認知負荷を下げる"
goal: "読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている"
scope_in: ["記事の旧入口 /admin/content/* を、feat-blog-scoped-admin-console が置いた /admin/sites/[site]/ 配下の記事画面へ転送で受ける (記事画面そのものの新設・配置は同 feature が正本)","読者像 (/admin/personas/*) を /admin/sites/[site]/ 配下へ所属替えし、旧 URL を転送で受ける","書き方の決め事 (/admin/writing/*) を /admin/sites/[site]/ 配下へ所属替えし、旧 URL を転送で受ける","93 本ある管理ルートを作業の対象物 (ブログ・記事・読者・商品・配信) で束ね、入口の数を対象物の数まで減らす","feat-reference-blog-admin-ux が定めた日本語の動詞ラベルの規則を、束ね直した各入口へ適用する (規則そのものは同 feature が正本)","ブログをまたいで書き方の決め事を揃えるための、共通の雛形から複製する経路","よく使う画面への近道 (階層が 1 段深くなることの相殺)","feat-reference-blog-admin-ux が定めた危険操作の分離と直接編集の規則を、所属替えした画面と束ね直した入口へ適用する (規則そのものは同 feature が正本)","site セグメントが解決できないときの notFound と、他ブログの内容を出さないこと","ブログを特定できない旧 URL からのブログ選択への誘導","feat-blog-scoped-admin-console が定めた既存指標 (site_daily_metrics / article_daily_metrics) の提示順序の規則を、所属替えした読者像・書き方の決め事の画面と束ね直した入口へ適用する (提示順序そのものの規則は同 feature が正本)"]
scope_out: ["新しい指標や集計を作ること (指標の正本は feat-blog-metrics-rollup)","/admin/sites/[site]/ 配下の各画面そのものの新設 (feat-blog-scoped-admin-console)","記事画面そのものの新設・配置 (feat-blog-scoped-admin-console が正本。本 feature が記事について担うのは旧 /admin/content/* からの転送だけ)","ブログの作成・削除そのもの (feat-blog-ops-crud)","読者面のデザイン (feat-blog-ui-builder / feat-reader-surface)","権限モデルの新設 (既存 workspace 権限を使う)","管理画面の UX 規則そのものの策定 (1 画面 1 目的・日本語の動詞ラベル・進行開示・直接編集・危険操作の分離・次にすべきことの明示) — feat-reference-blog-admin-ux が正本","既存指標の提示順序そのものの規則の策定 (feat-blog-scoped-admin-console が正本。feat-blog-metrics-rollup も同 feature を正本と名指している)"]
acceptance: ["読者像・書き方の決め事の各画面が /admin/sites/[site]/ 配下に存在する (記事画面の存在は feat-blog-scoped-admin-console の受入で判定する)","/admin/content/*・/admin/personas/*・/admin/writing/* へのアクセスが、ブログを特定できる場合は対応する /admin/sites/[site]/... へ転送される","ブログを特定できない旧 URL へのアクセスがブログ選択へ送られる","site セグメントが解決できないとき notFound になり、他ブログの内容が出ない","管理画面の一段目の入口が、作業の対象物の数まで畳まれている","一段目の各入口の名前が feat-reference-blog-admin-ux の動詞ラベル規則に従い、初見の運営者がラベル一覧だけを見て各入口でできることを言い当てる正答率が、同 feature の受入と同じ 90% 以上である","書き方の決め事を共通の雛形から複製する経路が存在する","よく使う画面への近道が存在し、その近道を使った到達クリック数が、束ね直す前の構成での同じ画面への到達クリック数以下である","ブログ設定・ドメイン・公開の各操作に確認が挟まり、下書きの編集には挟まらない (分岐の規則は feat-reference-blog-admin-ux に従う)","所属替えした画面と束ね直した入口に出る結果一覧とグラフが、既存の site_daily_metrics / article_daily_metrics だけを読み、新しい集計表を追加していない (提示順序そのものの妥当性は feat-blog-scoped-admin-console の受入で判定する)"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform","arch-blog-operations-console"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-site-scoped-authoring-ia.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-site-scoped-authoring-ia/1745278db655636ebaf4f2b62d966284b27410ff4e8228ddf3d2ed20509a9daf/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-08T03:20:00Z","origin_kind":"generated","source_digest":"fd3b80fd19353ff6568fd24dbc57037e98d76d4c43605a343aee2bfd0683e976","source_path":"system-spec/index.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "確定質疑 qa-uiux-web-site-scoped-authoring-ia / qa-frontend-web-site-scoped-route-ownership を lineage 参照。利用者要望『サイトごとに記事を管理したり、情報を管理したり、読者像や書き方の決め事などを管理するべきところを、全体で構成する形になっている』『どこで何をするのか直感的にわからないため、この辺を整えてください』への対応"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-site-scoped-authoring-ia.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-ro3w","github_mirror":null,"linked_at":"2026-09-08T05:32:24Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-08T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

作業の対象物ごとに画面を束ね、いまどのブログの決め事を見ているかを画面が示す状態にして、管理画面の認知負荷を下げる

## 到達状態

読者像と書き方の決め事が /admin/sites/[site]/ 配下に属し、93 本ある管理ルートが作業の対象物 (ブログ・記事・読者・商品・配信) の数まで畳まれ、各入口の名前から何ができるかが分かり、/admin/content/* と /admin/personas/* と /admin/writing/* が転送で受けられている状態になっている

## スコープ

スコープ内:

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

スコープ外:

- 新しい指標や集計を作ること (指標の正本は feat-blog-metrics-rollup)
- /admin/sites/[site]/ 配下の各画面そのものの新設 (feat-blog-scoped-admin-console)
- 記事画面そのものの新設・配置 (feat-blog-scoped-admin-console が正本。本 feature が記事について担うのは旧 /admin/content/* からの転送だけ)
- ブログの作成・削除そのもの (feat-blog-ops-crud)
- 読者面のデザイン (feat-blog-ui-builder / feat-reader-surface)
- 権限モデルの新設 (既存 workspace 権限を使う)
- 既存指標の提示順序そのものの規則の策定 (feat-blog-scoped-admin-console が正本。feat-blog-metrics-rollup も同 feature を正本と名指している)
- 管理画面の UX 規則そのものの策定 (1 画面 1 目的・日本語の動詞ラベル・進行開示・直接編集・危険操作の分離・次にすべきことの明示) — feat-reference-blog-admin-ux が正本

## 受入

判定の正本は `docs/spec/feat-site-scoped-authoring-ia/acceptance-report.md`。
**10 件のうち 7 件 PASS / 2 件 PARTIAL (A2・A8) / 1 件 BLOCKED (A6)。**

- [x] **A1** 読者像・書き方の決め事の各画面が /admin/sites/[site]/ 配下に存在する (記事画面の存在は feat-blog-scoped-admin-console の受入で判定する)
- [ ] **A2 (PARTIAL)** /admin/content/*・/admin/personas/*・/admin/writing/* へのアクセスが、ブログを特定できる場合は対応する /admin/sites/[site]/... へ転送される — personas 4 本と writing 1 本の計 5 本は転送済み。**`/admin/content/*` は転送していない**。行き先の `/admin/sites/[site]/articles` は本 feature の scope_out (正本は feat-blog-scoped-admin-console) で、着手時点で存在しない。受け皿の無い先へ転送すると現状より確実に壊れる。理由は `redirect-map-draft.json` の `not_redirected` に記録済み
- [x] **A3** ブログを特定できない旧 URL へのアクセスがブログ選択へ送られる
- [x] **A4** site セグメントが解決できないとき notFound になり、他ブログの内容が出ない
- [x] **A5** 管理画面の一段目の入口が、作業の対象物の数まで畳まれている (5 群: ブログ・記事・読者・商品・配信)
- [ ] **A6 (BLOCKED)** 一段目の各入口の名前が feat-reference-blog-admin-ux の動詞ラベル規則に従い、初見の運営者がラベル一覧だけを見て各入口でできることを言い当てる正答率が、同 feature の受入と同じ 90% 以上である — **外部参加者 0 名のため測定できていない**。代替の自動検査で緑に見せていない。再開条件は `final-review.md` §4
- [x] **A7** 書き方の決め事を共通の雛形から複製する経路が存在する
- [ ] **A8 (PARTIAL)** よく使う画面への近道が存在し、その近道を使った到達クリック数が、束ね直す前の構成での同じ画面への到達クリック数以下である — 近道は存在し、旧入口をそのまま近道に流用してクリック数は増えていない。**「以下である」ことの実測は A6 と同じ理由で未実施**
- [x] **A9** ブログ設定・ドメイン・公開の各操作に確認が挟まり、下書きの編集には挟まらない (分岐の規則は feat-reference-blog-admin-ux に従う。本 feature の新設画面の危険操作は 0 件)
- [x] **A10** 所属替えした画面と束ね直した入口に出る結果一覧とグラフが、既存の site_daily_metrics / article_daily_metrics だけを読み、新しい集計表を追加していない (提示順序そのものの妥当性は feat-blog-scoped-admin-console の受入で判定する)

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`
- `architecture_refs`: `arch-two-layer-platform`
- `architecture_refs`: `arch-blog-operations-console`
- 関連ノード: `spec-system-spec-index`、`arch-blog-operations-console`、`feat-blog-scoped-admin-console`、`feat-reference-blog-admin-ux`

## 機能間依存

- `depends_on`: `feat-blog-scoped-admin-console`
- `depends_on`: `feat-blog-metrics-rollup`
- `depends_on`: `feat-blog-ops-crud`
- `depends_on`: `feat-reference-blog-admin-ux`
- 依存理由: 所属替えの受け皿である /admin/sites/[site]/ の階層と各画面は feat-blog-scoped-admin-console が作る。受け皿が無いところへ読者像・書き方の決め事を移せない。記事画面については同 feature が新設と配置の正本であり、本 feature が担うのは旧 /admin/content/* からの転送だけである。提示設計が並べ替える指標の正本は feat-blog-metrics-rollup の site_daily_metrics / article_daily_metrics であり、数字が先に無いと並び順が決まらない。ブログ実体そのものは feat-blog-ops-crud が持つ。入口の名前の付け方・危険操作の分離・直接編集の使い分けという管理画面の UX 規則は feat-reference-blog-admin-ux が正本であり、本 feature はその規則を新しい入口と所属替えした画面へ適用する側に回る。規則を二重に定義しない。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-site-scoped-authoring-ia` と repo-relative `--feature-context features/feat-site-scoped-authoring-ia.context.json` で起動する。人間の手動 `/system-dev-plan` 実行結果も同じ登録経路で受理する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を同一 `parent_feature=feat-site-scoped-authoring-ia` / `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13 必須)。
- 分解方針: 読者像・書き方の決め事の所属替え、記事を含む旧入口からの転送、入口の束ね直しと動詞ラベル、共通雛形からの複製経路、近道、誤操作コストによる確認の分岐、site 未解決時の notFound、既存指標の提示設計を P01..P13 へ分解する。evidence は一段目の入口数が対象物の数まで減ったことと、新しい集計表が増えていないことを示すこと。
- 完了 rollup: exact 13 が全て done かつ受入 10 件を evidence が満たした場合だけ本 feature を done にする。

## 実装状況 (2026-09-09)

P01..P13 の 13 phase を全て実行した。Beads は `ah-ro3w.1`..`.13` に対応する。

**`status` を `active` のまま置く。** 受入 10 件のうち A6 が BLOCKED、A2/A8 が PARTIAL で、
`done` にすると「測っていない 1 件」と「受け皿待ちの 1 件」が完了の中に埋まる。
epic `ah-ro3w` も同じ理由で開いたままにしている。

| 残っていること | なぜ本 feature の中で閉じられないか | 再開条件 |
|---|---|---|
| A6 動詞ラベルの正答率 90% | 初見の運営者が要る。実装で代替できない | 外部参加者を集める |
| A8 到達クリック数の実測 | 同上 (比較対象が束ね直す前の構成) | 同上 |
| `/admin/content/*` の転送 | 行き先 `/admin/sites/[site]/articles` が本 feature の scope_out | `feat-blog-scoped-admin-console` が記事画面を置く |

`/admin/content/*` は転送しないと決めた後も横断ボードとして生きている。
受け皿が立った時点で**残すか畳むかを別途決める**。自動で転送へ倒さない。

- 仕様反映の受領書: `docs/spec/feat-site-scoped-authoring-ia/spec-reflection-receipt.md`
- 受入判定: `docs/spec/feat-site-scoped-authoring-ia/acceptance-report.md`
- 残課題の全量: `docs/spec/feat-site-scoped-authoring-ia/final-review.md`
