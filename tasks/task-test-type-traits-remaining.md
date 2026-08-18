---
graph_node_id: "task-test-type-traits-remaining"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","security"]
priority: "medium"
start_date: null
target_date: null
iteration: null
title: "どの性質からも指されていないテスト種別 7 つを性質へ結ぶ（ssrf / decision-table / contract / infra-config / db-migration / audit-log / property）"
owners: ["daishiman"]
created_at: "2026-08-18T08:30:00Z"
updated_at: "2026-08-18T08:30:00Z"
status: "draft"
depends_on: []
related_nodes: ["task-test-type-trait-for-secrets"]
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"ah-0ip で secrets は片付いた（has-secret を語彙へ足し、REQ-SEC10 を宣言し、リポジトリに秘密が載っていないかを毎回読む検査を書いた）。同じ食い違いが 7 種別に残っている","mvp_fit":"enabling","purpose":"種別の一覧にあるだけで一度も要求されない種別を無くす","rationale":"どの性質からも指されない種別は、書かなくても検査が緑になる。いま印が付いているのは書いた人の善意によるもので、次に書かれる保証が無い"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-test-type-traits-remaining.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T08:30:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/required-test-types.md","source_plugin":null,"source_version":null}
classification_confidence: 0.85
classification_reason: "ah-0ip の手順 6「指されない種別が他にも残るなら、その一覧と理由を §4 に書く」で洗い出した 7 件を切り出したもの（初出は 5 件。contract と infra-config の数え漏れを 2026-08-18 に訂正）"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-test-type-traits-remaining.md","confidence":0.85}]
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

`TEST_TYPES` に名前があるのに、**どの性質からも要求されていない**種別を無くす。
残っているのは 7 つ（`ssrf` / `decision-table` / `contract` / `infra-config` /
`db-migration` / `audit-log` / `property`）。

**最初に数えたときは 5 つと書いたが、数え漏れがあった。**
`REQUIRED_TEST_TYPES` が要求する 12 種別（＋実測から導く `mutation`）を
`tests/` で実際に使われている 19 種別から引くと 7 つ残る。
`contract` と `infra-config` が抜けていた（2026-08-18 に訂正）。

## 背景

`REQUIRED_TEST_TYPES` は要件の**性質**から必要な**種別**を引く表である。
ここから指されていない種別は、**一度も要求されない**。
印としては使われていても、書かなくてよいものとして扱われる——
つまり現在それらの検査が存在するのは、書いた人の善意によるものであって、
次に同じ性質の要件が増えたときに書かれる保証が無い。

`ah-0ip` で `secrets` を片付けた。`has-secret` を語彙へ足し、`REQ-SEC10` を宣言し、
`tests/architecture/secrets-not-in-repo.test.ts` を新しく書いた。
そのとき効いた手順が「**足す前に数える**」で、これを 7 件でも守る。

現状（2026-08-18 の実測）と見立ては `docs/product/required-test-types.md` §4 の表にある。

| 種別 | 印を持つファイル | 性質にするなら対象は |
| --- | --- | --- |
| `audit-log` | 5 | 記録を残す書き込みの入口（21 件） |
| `ssrf` | 2 | 外部へ自分で取りに行く経路 |
| `decision-table` | 4 | 入力の組合せで結果が分かれる判定 |
| `contract` | 3 | 3 つの入口（REST / MCP / WebMCP）を持つ要件 |
| `infra-config` | 3 | 実行環境の設定に依存する要件 |
| `db-migration` | 2 | スキーマを持つ要件 |
| `property` | 5 | 手法であって性質ではない（そもそも結べるか要検討） |

## 入力と前提条件

- `quality-gates.config.mjs` の `REQUIRED_TEST_TYPES`（性質 9 つ）/ `TEST_TYPES`（34 種別）
- `docs/product/required-test-types.md` §4 の表
- 宣言済みは 37 件、未宣言は 204 件（上限も 204）

## 出力と成果物

- 7 種別のそれぞれについて、**性質へ結んだ**か、**結ばない理由を書いた**かのどちらか
- 上限（`TEST_TYPES_MAX_UNDECLARED` / `TEST_TYPES_MAX_EXCLUSIONS`）は減るか据え置き

## 依存関係

`ah-0ip`（`has-secret` の追加）が先。同じ表を触るため。

## 実装対象

- `quality-gates.config.mjs`（語彙）
- `docs/product/required-test-types.md`（宣言表と §4）
- `tests/`（新しい性質が要求する種別の実体）

## Write scope と競合制約

`quality-gates.config.mjs` と `docs/product/required-test-types.md`。
語彙を足すと**既存 37 件の判定が変わり得る**ため、
同じファイルを触る宣言作業（残課題 45 の続き）と同時に進めない。

## GitHub publication

`local_only`。

## 実行手順

**1 種別ずつやる。まとめてやらない。** 順番は `ssrf` → `decision-table` →
`contract` → `infra-config` → `db-migration` → `audit-log` → `property`
（対象が狭い順。`property` は最後に、そもそも性質へ結べるかの判断から入る）。

各種別について:

1. 語彙を足す前に、**いま宣言済みの要件のうち何件がその性質に当たるか**を数える
2. 当たった要件に、その種別の**実体があるか**を 1 件ずつ見る（印の有無ではなく中身）
3. 実体が無ければ書く。あるなら `@types` を足す
4. 性質を `REQUIRED_TEST_TYPES` へ足す
5. 判定が緑になったら、**印を 1 つ外して赤になることを実測する**

## 受入条件

- `node scripts/required-test-types.mjs` が緑
- 足した性質が要求する種別について、印を外すと**赤になる**（実測する）
- 上限が増えていない
- 語彙を足したことで既存の宣言が赤になったものが 0 件
- 結ばないと決めた種別は、その理由が `docs/product/required-test-types.md` §4 にある

## 検証方法

`node scripts/required-test-types.mjs` で緑を確認したあと、
**印を 1 つ外して赤になることを実際に見る**（緑だけでは、門が効いているか分からない）。
確認したら印を戻し、`pnpm run verify` で他の門を巻き込んでいないことを見る。

## リスクとロールバック

**いちばん危ないのは、語彙を足したことで既存の要件が静かに赤になり、
それを消すために上限を上げること。** 上限は減る方向にしか動かさない。
既存が赤になったら、上限ではなく**足りない検査を書く**か、
理由つき除外（こちらにも上限がある）で受け止める。

`audit-log` は対象が広い（書き込みの入口 21 件）ので、
足した瞬間に宣言表へ載っていない要件まで巻き込みやすい。**最後の方に回す。**

戻すときは `REQUIRED_TEST_TYPES` の追加行を消すだけでよい。

## Handoff

`property` は種別の一覧に入っているが、**手法であって要件の性質ではない**。
「性質テストを書くべき要件」を機械で言い当てられないので、
無理に性質を作ると、当たった要件が全部除外理由を書くことになる。
その場合は**結ばないと決めて理由を書く**のが正解で、これは逃げではない。
逃げになるのは、結ばないまま理由も書かず一覧に名前だけ残すこと。

## 規範

- `docs/spec/10-テスト戦略仕様.md` §14
- `docs/product/required-test-types.md` §4「まだどの性質からも指されていない種別」
- `quality-gates.config.mjs`（語彙と上限の正本）
