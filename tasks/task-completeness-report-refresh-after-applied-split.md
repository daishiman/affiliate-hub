---
graph_node_id: "task-completeness-report-refresh-after-applied-split"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["system-spec","quality"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "完成度評価レポートを、適用メモ分割後の入力で取り直す"
owners: ["daishiman"]
created_at: "2026-09-08T00:00:00Z"
updated_at: "2026-09-08T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["system-spec"]
purpose: null
goal: null
mvp_alignment: {"background":"ah-bq7h で applied/*.md を 8 本足し章 8 本を再生成したため inputs.sha256 が動いた (163 -> 171 件・追加 8 / 変化 8 / 削除 0)","mvp_fit":"enabling","purpose":"完成度評価の PASS が、いまの system-spec について言われたものであるようにする","rationale":"指紋を手で書き換えれば緑にはなるが、それは評価していないものを評価済みに見せる行為で、この検査が塞いでいる穴そのもの"}
scope_in: []
scope_out: []
acceptance: ["aggregate-completeness.py --report system-spec/completeness-report.json --spec-root . が整合違反 0 件で通る","inputs.sha256 は evaluator が書いたものであり、手書きの書き換えを含まない"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-completeness-report-refresh-after-applied-split.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-09-08T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"system-spec/completeness-report.json","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "ah-bq7h の分割が完成度レポートの入力指紋を動かしたので、取り直しを 1 件の作業として立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-completeness-report-refresh-after-applied-split.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: null
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"manual","reconciled_at":null,"source":"manual","status":"open"}
implementation_readiness: {"checked_at":null,"missing_sections":[],"status":"incomplete"}
---

# 目的

完成度評価の PASS が、いまの `system-spec/` について言われたものであるようにする。

## 背景

ah-bq7h で章から「本章での適用」を `system-spec/applied/<cat>.md` へ切り出した。
`spec_input_inventory` は `system-spec/**/*.md` を rglob するので、新しい 8 ファイルと
再生成された章 8 本が入力集合へ入り、`completeness-report.json` の `inputs.sha256` が
現状と食い違うようになった (163 → 171 件・追加 8 / 変化 8 / 削除 0)。差分は今回の分割
そのものだけで、他の入力は 1 つも動いていない。

`aggregate-completeness.py --spec-root .` は次を返す:

```
VIOLATION: inputs.sha256 がいまの入力と不一致 (レポート ee9f755e… / いま 25b7e9a6… / いまの件数 171)
```

これは壊れているのではなく、設計どおりに鳴っている。レポートの verdict は評価した時点の
入力について下されたもので、入力が変わった以上、いまの `system-spec/` について何も言って
いない。その事実が黙って隠れないようにするための検査である
(`task-spec-gap-harness-input-inventory` が塞いだ穴がこれ)。

## なぜこれを落とすのか

**指紋を手で書き換えないこと。** `inputs` 節は完成度 evaluator の成果物である。数字だけを
現状へ合わせれば検査は緑になるが、それは「評価していないものを評価済みに見せる」ことで、
この検査が塞いでいる穴そのものへ戻る。取り直すには evaluator を回す (裏取り fork を伴う)。

## 入力と前提条件

- `system-spec/completeness-report.json` (現行・verdict と gaps を含む)
- `system-spec/` の現在の入力集合 171 件
- `eval-log/system-spec-harness/audit-fork-ledger.jsonl` (append-only・手書き禁止)

## 出力と成果物

- evaluator が書き直した `system-spec/completeness-report.json` (`inputs` が 171 件を名乗る)
- 裏取り fork の台帳追記 (hook が書く。人は書かない)

## 依存関係

- ah-bq7h (適用メモの分割) が先に閉じていること。入力集合が動いている最中に取り直すと、
  取り直した指紋がまたすぐ古くなる。

## 実装対象

- `assign-system-spec-completeness-evaluator` skill の実行
- 生成物としての `system-spec/completeness-report.json`

## Write scope と競合制約

`system-spec/completeness-report.json` のみ。章本文・`spec-state.json`・台帳は触らない。

## 実行手順

1. `assign-system-spec-completeness-evaluator` を起動する。
2. 裏取り fork を実行させる (fork には name を渡さない)。
3. `aggregate-completeness.py --report … --spec-root .` で整合を確かめる。

## 受入条件

- `aggregate-completeness.py --report system-spec/completeness-report.json --spec-root .` が
  整合違反 0 件で通る。
- `inputs.sha256` は evaluator が書いたもので、手書きの書き換えを含まない。

## 検証方法

`aggregate-completeness.py` の exit と VIOLATION 件数。加えて `inputs.file_count == 171`。

## リスクとロールバック

取り直した結果が PASS でなくなる可能性はある。**そのときは verdict を戻さず、出た指摘を
落とす。**分割は内容を 1 行も落としていない (行集合比較で欠落 0 を実測済み) ので、意味層の
指摘が新たに出るなら、それは分割前から在ったものが見えただけである。

## GitHub publication

`local_only`。外部へ出さない。

## Handoff

完了時は本 node を close し、`system-spec/completeness-report.json` の新しい verdict を
参照先として残す。

## 規範

evaluator の成果物を人が書かない。台帳を人が書かない。

## やらないこと

- `inputs.sha256` の手書き更新
- verdict の書き換え
- 章本文の再編集 (guard で塞がれている。変えるなら reopen → C03 compile)
