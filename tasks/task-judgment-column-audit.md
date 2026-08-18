---
graph_node_id: "task-judgment-column-audit"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","traceability","tests"]
priority: "high"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "守っていないものを、守ったと書いてある — 要件表の判定欄を全件点検する"
owners: ["daishiman"]
created_at: "2026-08-19T00:00:00Z"
updated_at: "2026-08-19T00:00:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"必須テスト種別の宣言を進める中で、見た 2 群のうち 2 群で判定欄と実物のずれが出た（REQ-W03/W04 と REQ-TM04）","mvp_fit":"enabling","purpose":"判定欄の記述を、実測の引用へ置き換える","rationale":"率が 100%（分母 2 / 分子 2）なので、3 件目を待つのは分母が増えるのを待つことにしかならない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-judgment-column-audit.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"docs/product/traceability.md","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "2026-08-19 に必須テスト種別の宣言作業から見つかった、判定欄と実物のずれ"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-judgment-column-audit.md","confidence":0.9}]
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

**要件表の判定欄に書かれている「〜をテストで固定」を、実測で裏を取った記述へ置き換える。**
裏が取れなかったものは、判定欄から落とす。

## 背景

**守っていないものを、守ったと書いてある。**

必須テスト種別の宣言を進める中で、`docs/product/traceability.md` の判定欄が
実物と食い違う例が出た。見た 2 群のうち **2 群で出ている**。
分母が 2、分子が 2 である。率が 100% のときに「もう 1 件出たら着手する」は、
分母が増えるのを待っているだけで、判断の先送りにしかならない。

**見つかった 2 例は、危なさの質が違う。**

| 例 | 判定欄の記述 | 実際 | 見つけやすさ |
|---|---|---|---|
| `REQ-W03` / `REQ-W04` | 「〜をテストで固定」 | **検査が存在しなかった** | 探せば「無い」と分かる |
| `REQ-TM04` | 「〜をテストで固定」 | **検査は存在するが、別のことを見ていた** | **分かりにくい** |

**後者のほうが見つけにくい。** 前者は名前を頼りに探して空振りすれば、
無いことが分かる。後者は**名前が挙がっている**ので、
ファイルを開いた時点で「確かめた」気になれる。
中で何を当てているかまで読まないと、ずれに気づけない。

判定欄は、次に読む人が「ここは守られている」と判断する根拠になる。
根拠が嘘だと、**その要件を守る検査を消しても、誰も気づかない**。

## 入力と前提条件

- `docs/product/traceability.md`（判定欄の正本）
- 各群の要件表と、そこから参照されているテストファイル
- 2026-08-19 時点で確認済みの群: W（2 件のずれ）、TM（1 件のずれ）、E（ずれ無し）

**E 群ではずれが 1 件も無かった。** つまり「全部が嘘」ではない。
だから一括で判定欄を消すのではなく、1 件ずつ確かめる作業になる。

## 出力と成果物

判定欄の記述を、次の 3 つのどれかに揃える。

1. **実測の引用**（どのファイルの何が、どう当てているか）
2. **未着手であることの明示**（「この要件を固定する検査は無い」）
3. **検査はあるが別のことを見ている**ことの明示（何を見ていて、何を見ていないか）

## 依存関係

必須テスト種別の宣言作業（各群）と並行して進められるが、
**同じファイル（`traceability.md`）を触る**ため、同時には動かさない。

## 実装対象

- `docs/product/traceability.md`（判定欄）
- ずれが見つかった要件について、**検査そのものを足す**場合は該当のテストファイル

## Write scope と競合制約

`docs/product/traceability.md` と `tests/`。
**群ごとの宣言作業と同じコミットで判定欄を直す**のが原則なので、
この課題は「残った分の総点検」を担当する。

## 実行手順

1. 群を 1 つ選ぶ
2. その群の判定欄の記述を 1 行ずつ読む
3. 記述が指す検査を**開いて、中で何を当てているか読む**
   （名前が挙がっていることを、当たっている理由にしない）
4. ずれていたら、記述を実測へ置き換える。同じコミットで直す
5. 群ごとに「何件見て、何件ずれていたか」を記録する

## 受入条件

- 全群の判定欄について、手順 3（中身を読む）まで通したこと
- ずれの件数を群ごとに記録したこと。**0 件だった群も記録する**
  （見ていないことと、見てずれが無かったことは違う）
- ずれを直したコミットが、判定欄と検査の両方を含むこと

## 検証方法

**判定欄が指す検査を壊して、赤になることを見る。**
記述が「〜を固定」と言うなら、その〜を壊せば赤くなるはずである。
緑のままなら、記述は嘘である。

壊す前に scratchpad へ複製を取り、後始末は複製からの書き戻しだけで行う。
`git checkout --` / `git restore` / `git clean` を後始末に使わない
（測定で壊した分と、まだコミットしていない正当な作業を区別しないため）。

## リスクとロールバック

判定欄を実測へ置き換えると、**「守られている」と読めていた要件が減って見える**。
数が減ったことを理由に記述を戻さない。減ったのではなく、
**元から守られていなかったものが見えるようになった**だけである。

## リスク: 名前が挙がっていることで確かめた気になること

`REQ-TM04` がこの形だった。ファイル名が判定欄に書いてあると、
開くまでもなく「対応がある」と読めてしまう。
**開いて、中で何を当てているかを読むところまでを 1 件と数える。**

### 名前が近い検査があると、開いただけでは足りない

**3 例目（`REQ-TS01`）が、点検する人がいちばん取りこぼす形である。**

判定欄には「土台自身は `tests/architecture/` の契約検査で
『各テストが自前で組み立てていないこと』を見る」と書いてあった。
探すと `tests/architecture/test-honesty.test.ts`（テストの誠実さ）が実在する。
**名前が近いので、見つけた時点で「ある」と読める。**

中を読むと、見ているのは**テストが何かを確かめているか**
（空のテスト・`.skip`・`.only`・呼ばれた回数だけの確認）であって、
**何を使って組み立てたか**ではない。判定欄が言う検査は存在しない。

つまり **`TM04` 型（検査はあるが別のことを見ている）に見えて、
中を読むと `W03` 型（検査が存在しない）だった。**
名前で当たりを付けると、この 2 つは見分けられない。

**確かめ方**: その群のファイルの `describe` を**全部**読む。
1 つ見つけて止めない。近い名前は、探している検査が無いときほど見つかる
（近い領域には、必ず何か別の検査が置いてあるため）。

## GitHub publication

`local_only`。

## Handoff

見た群の数と、群ごとのずれの件数を伝える。
「全部確認しました」ではなく、**どこまで見て、何が残っているか**を書く。

## 規範

- `docs/product/backlog.md` 項目 80（この課題の要約）
- `docs/product/backlog.md` 項目 78（失敗の族の記録。この課題は族の 1 つ）
- `docs/product/required-test-types.md`（宣言表。判定欄と対になる）

## やらないこと

- 判定欄をまとめて消して「未確認」に揃えること。
  それは嘘を消すが、**守られている要件の情報も一緒に消える**
- ずれを見つけたときに、記述だけ直して検査を足さないこと。
  記述を正しくするのは最低限で、**要件が守られていない事実は残る**。
  その場で足せないなら残課題へ回し、判定欄にそう書く
