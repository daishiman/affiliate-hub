---
graph_node_id: "task-thumbnail-body-first-image-markdown"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "backend"
tags: ["thumbnail","blogops","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "本文の先頭画像がサムネイル候補にならない (Markdown 記法を読んでいない)"
owners: ["daishiman"]
created_at: "2026-09-06T02:40:00Z"
updated_at: "2026-09-06T02:40:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-prose-image-cls-dimensions"]
resource_scope: ["src/domain/blogops"]
purpose: null
goal: null
mvp_alignment: {"background":"firstImageUrlInBody は <img src> だけを見るが、本文は拡張 Markdown で保存され画像は ![alt](src) になる。body_first_image は到達しない枝になっている","mvp_fit":"deferred","purpose":"「本文の先頭画像」をサムネイルに使う経路を、実際の保存形式で動くようにする","rationale":"選択肢として提示されているので運営者は「本文に画像を置けば表紙になる」と読む。読み方が正しいのに結果が伴わない"}
scope_in: ["firstImageUrlInBody が Markdown の画像記法も読む","<img> と Markdown が混在するときの優先順を固定する"]
scope_out: ["safeImageUrl の関門を緩めること","本文の保存形式を変えること"]
acceptance: ["Markdown で書かれた本文の先頭画像が body_first_image として選ばれる","寸法つき ![a](/x.png \"640x360\") でも src だけが取り出される","![a](javascript:...) は safeImageUrl を通って候補にならない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-thumbnail-body-first-image-markdown.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-a8bc の実装中に、本文の保存形式を確かめていて見つけた隣接の欠陥"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-thumbnail-body-first-image-markdown.md","confidence":0.9}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

「本文の先頭画像」をサムネイルに使う経路が、実際に使われている保存形式で動くようにする。

## 背景

`THUMBNAIL_SOURCES` は `uploaded` → `eyecatch` → `body_first_image` → `generated` の
順で候補を選ぶ (`src/domain/blogops/thumbnail.ts:167-175`)。しかし
`body_first_image` を取り出す `firstImageUrlInBody` (同 :197-200) が見ているのは
**`<img src="...">` という HTML の形だけ**である。

一方、本文の保存形式は拡張 Markdown の文字列で、画像は `![alt](src)` として保存される
(`src/domain/blogops/prose-format.ts` の `serializeProse`、`prose-editor.tsx:143`)。
`src` 全体を検索しても、Markdown の画像記法を読む箇所は `prose-format.ts` 以外に無い。

**したがって、本文エディタで書いた記事の画像は 1 枚も候補に上がらない。**
`body_first_image` は列挙にも画面の説明文 (「本文の先頭画像」) にも出ているのに、
到達しない枝になっている。運営者から見ると、記事に写真を貼ったのに表紙だけ
自動生成の代替図版のまま、という形で現れる。

**これは「動いていない」より悪い。**選択肢として提示されているので、
運営者は「本文に画像を置けば表紙になる」と読む。読み方が正しいのに結果が伴わない。

## 入力と前提条件

- 入力: `src/domain/blogops/thumbnail.ts` の `firstImageUrlInBody` / `safeImageUrl`
- 前提: **`safeImageUrl` の関門は外さない。**`javascript:` / `vbscript:` / `data:` を
  落とし、URL の形をしているかを見る検査は、記法が増えても 1 か所のままにする
- 前提: アイキャッチ欄は `<img>` でも生の URL でも入りうる。既存の 2 経路を壊さない

## 出力と成果物

- `firstImageUrlInBody` が Markdown の `![alt](src)` と `![alt](src "640x360")` も読む
- 見つけた URL は今までどおり `safeImageUrl` を通す
- `<img>` と Markdown が両方あるときの優先順（先に現れたほう）を決めて固定する

## 依存関係

- `depends_on`: なし。`task-prose-image-cls-dimensions` (ah-a8bc) は完了済みで、
  寸法つきの `![alt](src "WxH")` を読める必要がある点だけが関係する

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A: 保存形式は変えない。読み取りだけを直す
- Infrastructure: N/A
- Security/Privacy: `safeImageUrl` を必ず通す。記法が増えても関門は 1 か所に保つ
- Documentation: `THUMBNAIL_SOURCES` の説明が実態と合っていることを確かめる

## Write scope と競合制約

- `touches`: src/domain/blogops/ tests/domain/blogops/
- 排他資源: `src/domain/blogops/thumbnail.ts`
- 並列実行条件: サムネイル生成まわりの task と同時に走らせない
- branch: `devgraph/task-thumbnail-body-first-image-markdown`
- worktree lease: 実装前に `graph_node_id` を claim し、終了時に release する
- completion projection: feature branch は pending event のみ記録し、既定ブランチ側の reconcile が done を書く

## 実行手順

1. `![alt](src)` と `![alt](src "WxH")` の両方から `src` を取り出す読みを足す
2. `<img>` と Markdown のどちらが先に現れるかで決める（本文の順に従う）
3. 取り出した URL を `safeImageUrl` に通す。ここを迂回しない
4. 危ない URL を Markdown 記法で書いた場合も落ちることを検査で固定する

## 受入条件

- [ ] Markdown で書かれた本文の先頭画像が `body_first_image` として選ばれる
- [ ] 寸法つき (`![a](/x.png "640x360")`) でも `src` だけが取り出される
- [ ] `![a](javascript:...)` は候補にならない（`safeImageUrl` を通っている）
- [ ] `<img>` で書かれた既存の本文の挙動が変わらない

## 検証方法

- 自動検証: `npx vitest run tests/domain/blogops` と `npx tsc --noEmit`
- 手動検証: 本文に画像だけを置いた記事を作り、一覧の表紙が代替図版でないことを見る
- 証跡: `/admin/blog/articles` の一覧の見た目

## リスクとロールバック

- リスク: 関門を通さない読み取り経路を増やすと、そこだけが危ない URL を画面へ通す
- ロールバック: `git revert`

## GitHub publication

`local_only`。github.enabled=false のため completion policy は manual、
ローカルの決着は `bd-bridge.py --op close --reason ...` で書く。

## Handoff

実装 route: human。`task-prose-image-cls-dimensions` (ah-a8bc) の作業中に、
本文の保存形式を確かめていて見つけた。ah-a8bc の範囲ではないので分けてある。

## 規範

`src/domain/blogops/thumbnail.ts` の `THUMBNAIL_SOURCES` と `firstImageUrlInBody`
