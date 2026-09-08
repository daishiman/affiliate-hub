---
graph_node_id: "feat-article-block-editor"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "frontend"
tags: ["editor","wysiwyg","prose-node","worker-upload","admin"]
priority: "high"
start_date: null
target_date: null
iteration: null
title: "記事を出来上がりの見た目のまま編集できるブロックエディター"
owners: ["daishiman"]
created_at: "2026-09-05T03:05:03.225569Z"
updated_at: "2026-09-07T15:31:08Z"
status: "active"
depends_on: ["feat-blog-composition-visibility"]
related_nodes: []
resource_scope: ["src","drizzle","tests","worker-entry.js","docs/spec","system-spec"]
purpose: "管理画面の記事編集を、記法の生テキストが見える入力欄の集まりから、出来上がりの見た目のまま編集できるブロックエディターへ変え、記事を構成する全ての情報を編集面から扱えるようにする"
goal: "編集面と公開ページが同一の描画部品を通り、節 (見出し2 固定) と本文断片 (見出し3/4) の 2 層が UI 上で見分けられ、どの編集操作でも見出しレベルが動かず、19 種の断片 (コードブロック・商品カード・並列画像・表・色付き文字を含む) が `/` から挿入・編集・公開できる。商品は検索選択、画像は URL や object key の手入力・ブラウザ直接 PUT ではなく同一生成元の Worker API への添付で入り、Worker が認可・8 MiB 上限・実バイト形式を検査し、サーバー生成鍵で pending 予約→R2 put→ready 確定する状態になっている"
scope_in: ["編集面の WYSIWYG 化 — 記法の生テキストを編集面へ出さず、編集面と公開ページが同一の描画部品を通る (UIUX-REQ-005〜007, FRONT-REQ-005)","節 (外側・見出し2 固定) と本文断片 (内側・見出し3/4) の 2 層を UI で見せ、編集操作で見出しレベルが動かないようにする (FRONT-REQ-006〜008, UIUX-ACC-005〜007)","本文断片カタログを現行 10 種から 19 種へ拡張する (コードブロック・商品カード・並列画像・表・色付き文字を含む) (BE-PROSE-01〜03)","商品カードを商品検索結果からの選択で挿入し、商品 id の手入力欄を無くす (BE-PRODUCT-01, UIUX-ACC-008)","画像を同一生成元の認証済み Worker API へ送信し、Worker が編集権限・workspace/article 所属・8 MiB 上限・PNG/JPEG/WebP/GIF の実バイトと MIME 一致を検査し、サーバー生成鍵で pending 予約→R2 put→ready 確定する。URL・object key の手入力、署名付き URL、ブラウザから R2 への直接 PUT、R2 書込 CORS は採用しない。参照状態の正本は Editorial 側の D1 が持つ (BE-IMAGE-01, DB-IMAGE-01〜03, INF-IMG-01〜05, SEC-REQ-006〜008)","保存形式の往復保全 — 拡張 Markdown 文字列と断片木の相互変換が情報を落とさない (BE-PROSE-02〜03)","描画時の許可リスト絞り込みと投稿内容の無害化 (SEC-REQ-006〜009, SEC-ACC-006)","参照されなくなった画像の回収と、現行記事の移行手順 (OPS-REQ-008〜010)"]
scope_out: ["記事本文の AI 生成 (feat-ai-content-studio)","SEO/AEO の構造化データ導出と公開時点検 (feat-seo-aeo-gap-closure)","公開ページ側の読者導線・目次・サイドバー配置 (feat-reference-blog-admin-ux)","管理画面全体の単一用途画面再編 (feat-uiux-overhaul)","複数媒体向け原稿の生成ハーネス (feat-editorial-workflow)","複数人の同時編集と競合解決 (単独編集を前提とする)","記事のバージョン履歴 UI と差分表示","商品データそのものの取込・更新 (feat-blog-ui-builder が持つ)"]
acceptance: ["編集面に記法の生テキスト (``` や ** や表のパイプ) が現れず、全ての断片が出来上がりの見た目で表示・編集できる","節の見出しは常に見出し2、断片の見出しは見出し3/4 に固定され、挿入・移動・削除・貼り付けのいずれでもレベルが動かない","19 種の断片すべてを `/` から挿入でき、編集でき、公開ページで編集面と同じ見た目で表示される","商品カードは検索結果からの選択でのみ挿入でき、商品 id の手入力欄が存在しない","画像は URL・object key の手入力やブラウザから R2 への直接 PUT を使わず、同一生成元の Worker API から添付できる。8 MiB 超過、許可外形式、MIME/実バイト不一致は R2 保存前に理由付きで拒否され、成功時だけサーバー生成鍵の台帳が pending→ready になる","公開ページの描画が許可リストで絞られ、許可外の断片・属性・スタイルが出力されない","現行 10 種の断片で書かれた既存記事が壊れずに読み込め、保存し直しても内容が変わらない"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-article-block-editor.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-article-block-editor/bc3cd700e1abd0704bb23c844d1f3192ad0e1cc41f29a0cdf64007feece63627/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-07T14:07:47Z","origin_kind":"system-spec-harness","source_digest":"c8089536f8fa40067b561bb1be5a705bd4ccb77c83e163bbfe28bfa66f079670","source_path":"system-spec/ui-ux.md","source_plugin":"system-spec-harness","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "2026-09-07 の再検証で、画像送信契約を旧ブラウザ直接 PUT から同一生成元 Worker API へ改訂した既存 macro feature。別 feature を重複追加せず、この node と後続 P01〜P13 を再計画して契約を一本化する。"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-article-block-editor.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-09-07T14:20:00Z","missing_sections":[],"status":"complete"}
---

# 目的

管理画面の記事編集を、記法の生テキストが見える入力欄の集まりから、出来上がりの見た目のまま編集できるブロックエディターへ変え、記事を構成する全ての情報を編集面から扱えるようにする

## 到達状態

編集面と公開ページが同一の描画部品を通り、節 (見出し2 固定) と本文断片 (見出し3/4) の 2 層が UI 上で見分けられ、どの編集操作でも見出しレベルが動かず、19 種の断片 (コードブロック・商品カード・並列画像・表・色付き文字を含む) が `/` から挿入・編集・公開できる。商品は検索選択、画像は URL や object key の手入力・ブラウザ直接 PUT ではなく同一生成元の Worker API への添付で入り、Worker が認可・8 MiB 上限・実バイト形式を検査し、サーバー生成鍵で pending 予約→R2 put→ready 確定する状態になっている

## スコープ

### スコープ内

- 編集面の WYSIWYG 化 — 記法の生テキストを編集面へ出さず、編集面と公開ページが同一の描画部品を通る (UIUX-REQ-005〜007, FRONT-REQ-005)
- 節 (外側・見出し2 固定) と本文断片 (内側・見出し3/4) の 2 層を UI で見せ、編集操作で見出しレベルが動かないようにする (FRONT-REQ-006〜008, UIUX-ACC-005〜007)
- 本文断片カタログを現行 10 種から 19 種へ拡張する (コードブロック・商品カード・並列画像・表・色付き文字を含む) (BE-PROSE-01〜03)
- 商品カードを商品検索結果からの選択で挿入し、商品 id の手入力欄を無くす (BE-PRODUCT-01, UIUX-ACC-008)
- 画像を同一生成元の認証済み Worker API へ送信し、Worker が編集権限・workspace/article 所属・8 MiB 上限・PNG/JPEG/WebP/GIF の実バイトと MIME 一致を検査し、サーバー生成鍵で pending 予約→R2 put→ready 確定する。URL・object key の手入力、署名付き URL、ブラウザから R2 への直接 PUT、R2 書込 CORS は採用しない。参照状態の正本は Editorial 側の D1 が持つ (BE-IMAGE-01, DB-IMAGE-01〜03, INF-IMG-01〜05, SEC-REQ-006〜008)
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
- [ ] 画像は URL・object key の手入力やブラウザから R2 への直接 PUT を使わず、同一生成元の Worker API から添付できる。8 MiB 超過、許可外形式、MIME/実バイト不一致は R2 保存前に理由付きで拒否され、成功時だけサーバー生成鍵の台帳が pending→ready になる
- [ ] 公開ページの描画が許可リストで絞られ、許可外の断片・属性・スタイルが出力されない
- [ ] 現行 10 種の断片で書かれた既存記事が壊れずに読み込め、保存し直しても内容が変わらない

## アーキテクチャ参照

- `architecture_refs`: `arch-system-spec-overview`, `arch-two-layer-platform`
- 仕様章: `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/backend.md`, `system-spec/database.md`, `system-spec/infrastructure.md`, `system-spec/security.md`, `system-spec/maintenance-ops.md`
- 要件 ID: UIUX-REQ-005〜007 / UIUX-ACC-005〜008 / FRONT-REQ-005〜008 / BE-PROSE-01〜03 / BE-PRODUCT-01 / BE-IMAGE-01 / DB-IMAGE-01〜03 / INF-IMG-01〜05 / SEC-REQ-006〜009 / SEC-ACC-006 / OPS-REQ-008〜010
- 仕様本文の正本は `system-spec/` 配下。ここには複製しない。

## 機能間依存

- `depends_on`: `feat-blog-composition-visibility`
- 依存理由: 本 feature は記事本文の断片モデル (`src/domain/blogops/prose-node.ts`) と公開側の描画経路 (`src/presentation/prose/`) の上に、編集面をその同じ描画経路へ載せ替える。その土台一式は feat-blog-composition-visibility が持つ。

## 現状との差 (この feature が埋めるもの)

2026-09-07 時点の実装を実測した結果:

- `src/domain/blogops/prose-node.ts` の `ProseNode` は 19 種へ拡張済みで、保存形式の往復保全と公開側の許可リストは実装済み。今後の変更でこの単一モデルを分岐させない。
- 編集面は商品検索と Worker 経由の画像添付へ移行済み。残る課題は、旧計画にある presigned PUT/CORS/署名発行という別経路を新計画へ持ち込まず、現行実装・試験・運用契約を同一生成元 Worker API に一本化することである。

別の画像アップロード feature を追加せず、既存 feature と P01〜P13 を再計画することで重複を除く。

## Handoff

- per-feature planning: `run-system-dev-plan --feature-id feat-article-block-editor --feature-context features/feat-article-block-editor.context.json` を起動する。
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG。
- 登録先: 全 task を `parent_feature: feat-article-block-editor` と同一 `feature_package_id` で C02 経由 atomic 登録する (expected/applied=13)。
