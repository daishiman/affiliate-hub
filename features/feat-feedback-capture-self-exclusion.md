---
graph_node_id: "feat-feedback-capture-self-exclusion"
artifact_kind: "feature"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "operations"
tags: ["feedback","capture","ui"]
priority: "high"
start_date: "2026-08-30"
target_date: null
iteration: null
title: "改善要望の写しから送信 UI 自身を外す（撮影中だけ自動で隠す）"
owners: ["daishiman"]
created_at: "2026-08-30T03:37:16Z"
updated_at: "2026-08-30T13:34:38.306257Z"
status: "active"
depends_on: ["feat-improvement-feedback"]
related_nodes: []
resource_scope: ["src/presentation/ui/patterns","tests/e2e","tests/ui","docs/spec/12-改善要望フィードバック仕様.md","docs/spec/feat-feedback-capture-self-exclusion","docs/requirements/feat-feedback-capture-self-exclusion-implementation-requirements.md","features/feat-feedback-capture-self-exclusion.md","features/feat-feedback-capture-self-exclusion.context.json","tasks/feat-feedback-capture-self-exclusion",".dev-graph/handoff",".dev-graph/published/feature-package-feat-feedback-capture-self-exclusion",".dev-graph/state/graph.json","system-spec/frontend.md"]
purpose: "改善要望に添える画面の写しから、送信モーダルと起動ボタン自身を外し、利用者が本当に伝えたい箇所が写るようにする"
goal: "改善ボタンを押して撮られた写しに送信 UI が 1 画素も写らず、撮り直しでも同じ規則が効き、写しが撮れない環境でも送信 UI が待たずに開く"
mvp_alignment: {"background":"送信モーダルが画面の中央を占有した状態で写しが撮られるため、伝えたい箇所が隠れて要望が成立しない","mvp_fit":"direct","purpose":"改善要望を写しで伝える経路を、実際に伝わる状態にする","rationale":"写しが被写体を隠している間は、改善要望そのものが機能していない"}
scope_in: ["撮影開始 (getDisplayMedia 呼出) と送信 UI の可視化を別の時点へ分ける","写しの取得が確定するまで送信モーダルを描かない","右下固定の起動ボタンを写しの対象から外す","撮り直し (再撮影) 経路にも同じ規則を効かせる","写しが撮れない・拒否・非対応のときは待たずに送信 UI を開く退避経路","data-floating-overlay 属性を写し除外と重なり監査の共通の手掛かりにする","属性の付与漏れを拾う検査"]
scope_out: ["改善要望フィードバック機能そのものの無効化","起動ボタンの撤去","写しの書き込み (手書き/四角/矢印/文字/黒塗り) の仕様変更","一覧・詳細・払い出し経路の変更","写し以外の添付手段の追加"]
acceptance: ["改善ボタンから撮られた写しに、送信モーダルと右下固定の起動ボタンが 1 画素も含まれない","「撮り直す」で取り直した写しにも同じ除外規則が効く","写しの取得が拒否・非対応・失敗のとき、送信 UI は待たずに開き、待ちが無限に伸びない","押した勢い (transient activation) を失わず、許可の窓が出る","写しの確定後、撮影中に隠した要素が元の状態へ戻り、隠れたまま残らない","data-floating-overlay=\"true\" が写し除外と重なり監査 (tests/e2e/app-routes.spec.ts) の同一の手掛かりとして使われている","属性の付与漏れがある浮遊要素を検査が失敗として拾う"]
architecture_refs: ["arch-two-layer-platform"]
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "features/feat-feedback-capture-self-exclusion.md"
template_id: "feature"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/generations/feature-package-feat-feedback-capture-self-exclusion/892cd5611c443a5f90b97047a9542489c44be963ff4d775c30b640e7aca40b7d/plan-findings.json"}
source_lineage: {"imported_at":"2026-08-30T03:37:16Z","origin_kind":"system-spec-harness","source_digest":"b93d1aea10645fc18c39e5bd209cbb90ebd6e494bf493d263e3d9e1112a36217","source_path":"system-spec/frontend.md","source_plugin":"system-spec-harness","source_version":"0.1.0"}
classification_confidence: 0.95
classification_reason: "system-spec frontend×web 確定質疑 qa-frontend-web-capture-self-occlusion を作業単位として登録"
classification_candidates: [{"artifact_kind":"feature","candidate_path":"features/feat-feedback-capture-self-exclusion.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-0d2q","github_mirror":null,"linked_at":"2026-08-30T04:17:10Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":null,"status":"open"}
implementation_readiness: {"checked_at":"2026-08-30T03:45:47Z","missing_sections":[],"status":"complete"}
---

# 目的

改善要望に添える画面の写しから、送信モーダルと起動ボタン自身を外し、
利用者が本当に伝えたい箇所が写るようにする。

規範は `system-spec/frontend.md` の確定質疑 `qa-frontend-web-capture-self-occlusion`
（2026-08-30 利用者ヒアリング。選択された対処は「撮影中だけ自動で隠す」）。
既存の受入条件は `docs/spec/12-改善要望フィードバック仕様.md` の FB-AC-09
（写しが不完全なときの扱い）に隣接するが、**写しに自分自身が写り込む**ことは
FB-AC 群のどこにも書かれていない。本 feature がその欠けを埋める。

## 到達状態

改善ボタンを押して撮られた写しに送信 UI が 1 画素も写らず、
撮り直しでも同じ規則が効き、写しが撮れない環境でも送信 UI が待たずに開く。

当初は `src/presentation/ui/patterns/feedback-button.tsx` の `onClick` が
`setPendingShot(captureScreen())` と `setOpen(true)` を同じ出来事の中で行い、
`drawImage` の時点でモーダルが既に描かれうる構成だった。
現在は `captureScreen()` を押下イベント内で即時に開始し、
`openWhenShotSettles` が写しの確定または失敗後にモーダルを開く形へ分離している。
**押した勢い (transient activation) を要するのは `getDisplayMedia` の呼出だけで、
モーダルの描画は要さない。**

ただし、ローカル Chromium での実画素 probe は OS の画面収録境界により
`NotReadableError: Could not start video source` で停止した。DOM 上の退避・復元と実行順序の検査はあるが、
実際のキャプチャ画素での A1 観測は未完了のため、受入完了とは扱わない。

## スコープ

含む:

- 撮影開始 (`getDisplayMedia` 呼出) と送信 UI の可視化を別の時点へ分ける
- 写しの取得が確定するまで送信モーダルを描かない
- 右下固定の起動ボタンを写しの対象から外す
- 撮り直し (再撮影) 経路にも同じ規則を効かせる
- 写しが撮れない・拒否・非対応のときは待たずに送信 UI を開く退避経路
- `data-floating-overlay` 属性を写し除外と重なり監査の共通の手掛かりにする
- 属性の付与漏れを拾う検査

含まない:

- 改善要望フィードバック機能そのものの無効化
- 起動ボタンの撤去
- 写しの書き込み（手書き / 四角 / 矢印 / 文字 / 黒塗り）の仕様変更
- 一覧・詳細・払い出し経路の変更
- 写し以外の添付手段の追加

## 受入

- [ ] 改善ボタンから撮られた写しに、送信モーダルと右下固定の起動ボタンが 1 画素も含まれない
- [x] 「撮り直す」で取り直した写しにも同じ除外規則が効く
- [x] 写しの取得が拒否・非対応・失敗のとき、送信 UI は待たずに開き、待ちが無限に伸びない
- [x] 押した勢い (transient activation) を失わず、許可の窓が出る
- [x] 写しの確定後、撮影中に隠した要素が元の状態へ戻り、隠れたまま残らない
- [x] `data-floating-overlay="true"` が写し除外と重なり監査 (`tests/e2e/app-routes.spec.ts`) の同一の手掛かりとして使われている
- [x] 属性の付与漏れがある浮遊要素を検査が失敗として拾う

## 適用する設計原則（正本: system-spec/frontend.md）

- **自己観測する UI は、観測の対象から自分自身を外す**（観測器を被写体に含めない）。
  写しの用途は「利用者が伝えたい箇所」の提示であり、送信 UI 自身はその情報を 1 ビットも運ばない。
  - トレードオフ: モーダルの出現が写しの確定まで遅れる。撮れない環境では即座に開く経路を残す。
  - トレードオフ: 「押した瞬間に開く」という既存の設計意図を意図的に変える。理由をコード側にも残す。
- **本文の上に浮く操作は、記録・監査の対象になるときだけ自分を名乗り、それ以外では退く**。
  `data-floating-overlay` の名乗りと、写しからの退避を同じ属性系で扱う。
  - トレードオフ: 将来の浮遊要素が属性を付け忘れると写り込みが再発する。検査で拾う。

## アーキテクチャ参照

- `architecture_refs`: `arch-two-layer-platform`

## 機能間依存

- `depends_on`: `feat-improvement-feedback`
- 依存理由: 本 feature は既存の改善要望フィードバック（起動ボタン・送信モーダル・写しの取得）の上に載る変更であり、
  その UI が存在しない状態では受入条件を観測できない。

## Handoff

- per-feature planning: ready 時に system-dev-planner (`run-system-dev-plan`) を `--feature-id feat-feedback-capture-self-exclusion` と `--feature-context features/feat-feedback-capture-self-exclusion.context.json` で起動する
- 生成物: P01..P13 exact 13 executable task specs + 13-node intra-feature DAG
- 登録先: 全 task を `parent_feature=feat-feedback-capture-self-exclusion` / 同一 `feature_package_id` で C02 経由 atomic 登録（expected/applied=13 必須）
- 完了 rollup: exact 13 全 done かつ P07/P10/P11 の evidence が上記受入を満たす場合だけ done
