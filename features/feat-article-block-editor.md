---
graph_node_id: "feat-article-block-editor"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["editor","wysiwyg","prose-node","r2-upload","admin"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "記事を出来上がりの見た目のまま編集できるブロックエディター"
owners: ["daishiman"]
created_at: "2026-09-05T03:05:03.225569Z"
updated_at: "2026-09-05T03:37:29.087868Z"
status: "draft"
depends_on: ["feat-blog-composition-visibility"]
related_nodes: []
resource_scope: ["src","drizzle","tests","worker-entry.js","docs/spec","system-spec"]
purpose: "管理画面の記事編集を、記法の生テキストが見える入力欄の集まりから、出来上がりの見た目のまま編集できるブロックエディターへ変え、記事を構成する全ての情報を編集面から扱えるようにする"
goal: "編集面と公開ページが同一の描画部品を通り、節 (見出し2 固定) と本文断片 (見出し3/4) の 2 層が UI 上で見分けられ、どの編集操作でも見出しレベルが動かず、19 種の断片 (コードブロック・商品カード・並列画像・表・色付き文字を含む) が `/` から挿入・編集・公開でき、商品と画像が手入力ではなく検索選択と直接アップロードで入る状態になっている"
scope_in: ["編集面の WYSIWYG 化 — 記法の生テキストを編集面へ出さず、編集面と公開ページが同一の描画部品を通る (UIUX-REQ-005〜007, FRONT-REQ-005)","節 (外側・見出し2 固定) と本文断片 (内側・見出し3/4) の 2 層を UI で見せ、編集操作で見出しレベルが動かないようにする (FRONT-REQ-006〜008, UIUX-ACC-005〜007)","本文断片カタログを現行 10 種から 19 種へ拡張する (コードブロック・商品カード・並列画像・表・色付き文字を含む) (BE-PROSE-01〜03)","商品カードを商品検索結果からの選択で挿入し、商品 id の手入力欄を無くす (BE-PRODUCT-01, UIUX-ACC-008)","画像を Cloudflare R2 へブラウザから直接アップロードし、URL の手入力欄を無くす。参照状態の正本は Editorial 側の D1 が持つ (BE-IMAGE-01, DB-IMAGE-01〜03, INF-IMG-01)","保存形式の往復保全 — 拡張 Markdown 文字列と断片木の相互変換が情報を落とさない (BE-PROSE-02〜03)","描画時の許可リスト絞り込みと投稿内容の無害化 (SEC-REQ-006〜009, SEC-ACC-006)","参照されなくなった画像の回収と、現行記事の移行手順 (OPS-REQ-008〜010)"]
scope_out: ["記事本文の AI 生成 (feat-ai-content-studio)","SEO/AEO の構造化データ導出と公開時点検 (feat-seo-aeo-gap-closure)","公開ページ側の読者導線・目次・サイドバー配置 (feat-reference-blog-admin-ux)","管理画面全体の単一用途画面再編 (feat-uiux-overhaul)","複数媒体向け原稿の生成ハーネス (feat-editorial-workflow)","複数人の同時編集と競合解決 (単独編集を前提とする)","記事のバージョン履歴 UI と差分表示","商品データそのものの取込・更新 (feat-blog-ui-builder が持つ)"]
acceptance: ["編集面に記法の生テキスト (``` や ** や表のパイプ) が現れず、全ての断片が出来上がりの見た目で表示・編集できる","節の見出しは常に見出し2、断片の見出しは見出し3/4 に固定され、挿入・移動・削除・貼り付けのいずれでもレベルが動かない","19 種の断片すべてを `/` から挿入でき、編集でき、公開ページで編集面と同じ見た目で表示される","商品カードは検索結果からの選択でのみ挿入でき、商品 id の手入力欄が存在しない","画像はブラウザから R2 へ直接アップロードでき、URL の手入力欄が存在しない","公開ページの描画が許可リストで絞られ、許可外の断片・属性・スタイルが出力されない","現行 10 種の断片で書かれた既存記事が壊れずに読み込め、保存し直しても内容が変わらない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-article-block-editor.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-09-05T00:00:00Z","origin_kind":"generated","source_digest":"7f419a85768a0e12a1f864dffb46c01a57d889a0823f0f3aa0733b8f868ce69e","source_path":"system-spec/ui-ux.md","source_plugin":"dev-graph","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "2026-09-05 の R4-reopen で ui-ux/frontend/backend/infrastructure/security × web を再確定した「編集面の WYSIWYG 化・2 層の可視化・断片 10→19 種・R2 直接アップロード」に対応する macro feature。既存 34 feature に同等のものが無いことを graph.json 全走査で確認済み。"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-article-block-editor.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-05T00:00:00Z","missing_sections":[],"status":"complete"}
---

# 目的

管理画面の記事編集を、記法の生テキストが見える入力欄の集まりから、出来上がりの見た目のまま編集できるブロックエディターへ変え、記事を構成する全ての情報を編集面から扱えるようにする

## 到達状態

編集面と公開ページが同一の描画部品を通り、節 (見出し2 固定) と本文断片 (見出し3/4) の 2 層が UI 上で見分けられ、どの編集操作でも見出しレベルが動かず、19 種の断片 (コードブロック・商品カード・並列画像・表・色付き文字を含む) が `/` から挿入・編集・公開でき、商品と画像が手入力ではなく検索選択と直接アップロードで入る状態になっている

## スコープ

### スコープ内

- 編集面の WYSIWYG 化 — 記法の生テキストを編集面へ出さず、編集面と公開ページが同一の描画部品を通る (UIUX-REQ-005〜007, FRONT-REQ-005)
- 節 (外側・見出し2 固定) と本文断片 (内側・見出し3/4) の 2 層を UI で見せ、編集操作で見出しレベルが動かないようにする (FRONT-REQ-006〜008, UIUX-ACC-005〜007)
- 本文断片カタログを現行 10 種から 19 種へ拡張する (コードブロック・商品カード・並列画像・表・色付き文字を含む) (BE-PROSE-01〜03)
- 商品カードを商品検索結果からの選択で挿入し、商品 id の手入力欄を無くす (BE-PRODUCT-01, UIUX-ACC-008)
- 画像を Cloudflare R2 へブラウザから直接アップロードし、URL の手入力欄を無くす。参照状態の正本は Editorial 側の D1 が持つ (BE-IMAGE-01, DB-IMAGE-01〜03, INF-IMG-01)
- 保存形式の往復保全 — 拡張 Markdown 文字列と断片木の相互変換が情報を落とさない (BE-PROSE-02〜03)
- 描画時の許可リスト絞り込みと投稿内容の無害化 (SEC-REQ-006〜009, SEC-ACC-006)
- 参照されなくなった画像の回収と、現行記事の移行手順 (OPS-REQ-008〜010)

### スコープ外

- 記事本文の AI 生成 (feat-ai-content-studio)
- SEO/AEO の構造化データ導出と公開時点検 (feat-seo-aeo-gap-closure)
- 公開ページ側の読者導線・目次・サイドバー配置 (feat-reference-blog-admin-ux)
- 管理画面全体の単一用途画面再編 (feat-uiux-overhaul)
- 複数媒体向け原稿の生成ハーネス (feat-editorial-workflow)
- 複数人の同時編集と競合解決 (単独編集を前提とする)
- 記事のバージョン履歴 UI と差分表示
- 商品データそのものの取込・更新 (feat-blog-ui-builder が持つ)

## 受入

- [ ] 編集面に記法の生テキスト (``` や ** や表のパイプ) が現れず、全ての断片が出来上がりの見た目で表示・編集できる
- [ ] 節の見出しは常に見出し2、断片の見出しは見出し3/4 に固定され、挿入・移動・削除・貼り付けのいずれでもレベルが動かない
- [ ] 19 種の断片すべてを `/` から挿入でき、編集でき、公開ページで編集面と同じ見た目で表示される
- [ ] 商品カードは検索結果からの選択でのみ挿入でき、商品 id の手入力欄が存在しない
- [ ] 画像はブラウザから R2 へ直接アップロードでき、URL の手入力欄が存在しない
- [ ] 公開ページの描画が許可リストで絞られ、許可外の断片・属性・スタイルが出力されない
- [ ] 現行 10 種の断片で書かれた既存記事が壊れずに読み込め、保存し直しても内容が変わらない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`, `arch-two-layer-platform`
- 仕様章: `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/backend.md`, `system-spec/database.md`, `system-spec/infrastructure.md`, `system-spec/security.md`, `system-spec/maintenance-ops.md`
- 要件 ID: UIUX-REQ-005〜007 / UIUX-ACC-005〜008 / FRONT-REQ-005〜008 / BE-PROSE-01〜03 / BE-PRODUCT-01 / BE-IMAGE-01 / DB-IMAGE-01〜03 / INF-IMG-01 / SEC-REQ-006〜009 / SEC-ACC-006 / OPS-REQ-008〜010
- 仕様本文の正本は `system-spec/` 配下。ここには複製しない。

## 機能間依存

- `depends_on`: `feat-blog-composition-visibility`
- 依存理由: 本 feature は記事本文の断片モデル (`src/domain/blogops/prose-node.ts`) と公開側の描画経路 (`src/presentation/prose/`) の上に、編集面をその同じ描画経路へ載せ替える。その土台一式は feat-blog-composition-visibility が持つ。

## 現状との差 (この feature が埋めるもの)

2026-09-05 時点の実装を実測した結果:

- `src/domain/blogops/prose-node.ts` の `ProseNode` は 10 種 (paragraph / heading / bullet-list / ordered-list / quote / callout / product-card / comparison-table / image / divider)。仕様が要求するのは 19 種。
- `src/presentation/prose/prose-editor.tsx` は入力欄の集まりで、WYSIWYG ではない。商品は `pc_...` を、画像は `/media/... または https://...` を利用者が手で打つ欄がある。これは UIUX-ACC-008 (URL の手入力欄が存在しない・商品は検索結果からの選択のみ) に正面から反する。

つまり「今それが全然反映されていない」は実装側の事実であり、本 feature の存在理由である。

## Handoff

- per-feature planning: `run-system-dev-plan --feature-id feat-article-block-editor --feature-context features/feat-article-block-editor.context.json` を起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-article-block-editor` と同一 `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)。
