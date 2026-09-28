---
graph_node_id: "task-spec-doctrine-anchor-asvs-target"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "specification"
tags: ["system-spec","follow-up"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "doctrine anchor 11 concern が全て条項引用不可のまま (ASVS 本体が targets に無い)"
owners: ["daishiman"]
created_at: "2026-09-06T00:00:00Z"
updated_at: "2026-09-06T02:20:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-spec-apple-hig-citation-state-stale"]
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"doctrine anchor 11 concern (8 章) の全てが条項引用不可で、Apple HIG / OWASP ASVS / Clean Architecture のいずれも authority 本体の条項を引いた確定セル要件を持たない","mvp_fit":"deferred","purpose":"上流指針を『要約を引いた』ではなく『条項を引いた』状態にする","rationale":"要約はあとから照合できない。どの要件がこの決定を支えているかを誰も言えない状態が残る"}
scope_in: ["ASVS 本体を targets[] へ追加し C02 で取得する","取得後に C03 で authentication / security concern を available へ反転させる"]
scope_out: ["書籍由来 (Clean Architecture) を無理に引用可能へ反転させること","非公式のミラー・要約サイトを出典に使うこと","新しい Beads issue を起票すること (ah-ejn と二重管理になる)"]
acceptance: ["ASVS 本体が targets[] に在り、取得証跡が残っている","authentication / security concern が条項番号付きで引けている","Clean Architecture の『反転先が無い』記録が消えていない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-spec-doctrine-anchor-asvs-target.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":null,"origin_kind":"manual","source_digest":null,"source_path":null,"source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "ah-ejn (doctrine anchor 条項引用) の実行計画として起こした仕様書。専用 Beads issue は作らず ah-ejn を追跡先とする"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-spec-doctrine-anchor-asvs-target.md","confidence":0.9}]
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

上流指針を「要約を引いた」ではなく「条項を引いた」状態にする。

## 追跡先（新規起票しない理由）

**この課題の Beads 上の追跡先は既存の `ah-ejn`（doctrine anchor が定型 1 文だけで、
要件文へ条項が引かれていない）である。** 本仕様書は ah-ejn を置き換えるものではなく、
ah-ejn が「取得手段が無い」として保留した状態を、authority ごとに切り分けた実行計画である。
新しい issue は作らない。着手するときは ah-ejn を開き直し、本書を実行計画として読む。

ah-ejn には無く本書が足しているのは 1 点だけ:
**3 つの authority を同じ壁として扱わない**という区別（下記「入力と前提条件」）。

## 背景

doctrine anchor の 11 concern（8 章）が全て「条項引用不可」になっている。
Apple HIG / OWASP ASVS / Clean Architecture のどれについても、
**authority 本体の条項を引いた確定セル要件が 1 件も無い。**

理由と反転条件は章の中に書いてあるので、隠れてはいない。
ただし現状の反映は「導く上流原則」の要約止まりで、
「ASVS の第何章の第何要件がこの決定を支えているか」は誰も言えない。
要約は、あとから照合できない。

## 入力と前提条件

- 入力: `system-spec/auth.md:42-50`、`system-spec/backend.md:201-208`、`system-spec/ui-ux.md:357-365`
- 前提: 3 つの authority は性質が違う。**同じ扱いにしない**
  - OWASP ASVS: 章番号と要件番号を持つ公式配布文書がある → 取得して引ける
  - Apple HIG: 別 task（`task-spec-apple-hig-citation-state-stale`）が扱う
  - Clean Architecture: **書籍**。公式に取得できる条項が無い。反転先が存在しない

## 出力と成果物

- `targets[]` に ASVS 本体を追加し、C02（doc-fetch）で取得する
- 取得後に C03 で authentication / security concern を `available` へ反転させる
- 書籍由来（Clean Architecture）は反転先が無いことを `reason_class` として**保持したまま**にする

## 依存関係

- `depends_on`: なし
- 注意: 章が動くので、`task-spec-apple-hig-citation-state-stale` と同じ回にまとめると
  C05 の再評価が 1 回で済む

## なぜ「全部引けるようにする」を目標にしないのか

書籍は取得できない。取得できないものを未達として残し続けると、
この検査は永久に赤いままになり、赤いことが情報を持たなくなる。
**引けないことを理由付きで記録する**のが、書籍側の完了形である。

## 実装対象

- Frontend: N/A
- Backend/API: N/A
- Database/Data: N/A
- Infrastructure: N/A
- Security/Privacy: doctrine anchor の authentication / security concern（引用の裏付けを持たせる）
- Documentation: `system-spec/auth.md`・`system-spec/backend.md`・`system-spec/ui-ux.md`（**C03 の生成経由**）

## Write scope と競合制約

- `touches`: system-spec/
- 排他資源: `system-spec/fetched-references.json`、`system-spec/spec-state.json` の `targets[]`
- 並列実行条件: 章を書く task・完成度評価を走らせる task と同時に走らせない
- branch: `devgraph/task-spec-doctrine-anchor-asvs-target`
- worktree lease: 実装前に `graph_node_id` を claim し、終了時に release する
- completion projection: feature branch は pending event のみ記録し、既定ブランチ側の reconcile が done を書く

## 実行手順

1. ASVS の公式配布文書（章番号・要件番号を持つもの）の URL を確定する
2. `targets[]` へ追加し、C02 を実行して取得証跡を残す
3. C03 を再実行し、authentication / security concern の引用状態を採り直す
4. Clean Architecture 側は `reason_class` が残っていることを確かめる（消さない）
5. C05 を再実行し、finding の文言が現状と合っているかを見る

## 受入条件

- [ ] ASVS 本体が `targets[]` に在り、取得証跡が残っている
- [ ] authentication / security concern が条項番号付きで引けている
- [ ] Clean Architecture の「反転先が無い」記録が消えていない
- [ ] C05 再評価で、この finding が「全 11 件が引用不可」とは言わなくなる

## 検証方法

- 自動検証: `aggregate-completeness.py`（上記 task と同じコマンド）
- 手動検証: `auth.md` の doctrine anchor 欄に条項番号が入っているかを読む
- 証跡: C05 の findings 一覧、`system-spec/fetched-references.json`

## リスクとロールバック

- リスク: 公式でない配布物（要約サイト・ミラー）を掴むと、出典検査が通っても中身が保証されない
- ロールバック: `git revert`

## GitHub publication

`local_only`。github.enabled=false のため completion policy は manual、
ローカルの決着は `bd-bridge.py --op close --reason ...` で書く。

## Handoff

実装 route: human。**tracker は `ah-ejn`**（本書には専用の Beads issue が無い。意図的である）。
`task-spec-apple-hig-citation-state-stale`（`ah-1igm`）と同じ回にまとめると、
C03 の再実行と C05 の再評価が 1 回で済む。完了時は `docs/product/backlog.md` の状態欄を更新する。

なお ah-ejn が止まった壁のうち、**節見出しの取得は権限で断られたまま**である。
本書はその壁を迂回しない。ASVS 本体の取得が許可された時点で初めて実行できる。

## 規範

`system-spec/completeness-report.json` の `findings`（severity=medium、bucket=design_knowledge_reflection/C15）
