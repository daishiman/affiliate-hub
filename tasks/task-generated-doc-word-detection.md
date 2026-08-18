---
graph_node_id: "task-generated-doc-word-detection"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","tools","docs"]
priority: "medium"
start_date: "2026-08-19"
target_date: null
iteration: null
title: "生成物かどうかを語の出現で決めているので、その語を書かない生成物は見落とす"
owners: ["daishiman"]
created_at: "2026-08-19T01:20:00Z"
updated_at: "2026-08-19T01:20:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests"]
purpose: null
goal: null
mvp_alignment: {"background":"generated-docs.test.ts の一覧検査が、docs/product/*.md に「生成物の指紋」という文字列が含まれるかどうかで生成物を判定している","mvp_fit":"enabling","purpose":"生成物の一覧を、語の出現ではなく生成側の事実から決める","rationale":"語で判定すると、その語を書かない生成物は静かに対象から漏れる。誤検出は打った人が気づくが、見落としは誰も気づかない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-generated-doc-word-detection.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-19T01:20:00Z","origin_kind":"manual","source_digest":null,"source_path":"tests/architecture/generated-docs.test.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "2026-08-19 に説明文へ語を書いただけで赤くなったことから見つかった、判定方法の弱さ"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-generated-doc-word-detection.md","confidence":0.9}]
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

**生成物の一覧を、語の出現ではなく生成側の事実から決める。**

## 背景

**その語を書かない生成物は、対象から漏れる。**

`tests/architecture/generated-docs.test.ts` の「指紋を焼いている文書が、増えても減っても
気づける」は、`docs/product/*.md` を全部読んで**特定の文字列が含まれるか**だけで
生成物かどうかを判定している。含まれていれば生成物、含まれていなければ生成物ではない。

つまり **5 枚目の生成物を作る人が、たまたま別の言い回しをすれば、この検査は静かに
見送る**。一覧に載らないので「増えても減っても気づける」も効かない。
**見ているつもりの範囲が、実際より狭い。**

これは残課題 78 に並べた 3 つの形のうち **1 つ目（回している数と、当てている中身は別）**
そのものである。`docs/product/*.md` を全部回しているので、当たっている範囲も
広く見える。実際に当たっているのは「その語を書いた文書」だけである。

**逆向き（誤検出）は害が小さい。** 2026-08-19 に、生成物について説明した文章へ
その語を書いただけで赤くなった。これは**打った本人がその場で気づく**。
一方の見落としは、**誰も気づかない**。順番を取り違えて「文言を工夫すれば済む」と
読まないこと。

## 入力と前提条件

- `tests/architecture/generated-docs.test.ts`（一覧の検査と、`writeFileSync` の検査）
- `scripts/lib/generated-doc.mjs`（指紋を焼く道具。`PREFIX` に語が定義されている）
- 現在の一覧は 8 枚（B: スクリプトが毎回上書きする 4 枚 / A: テストが生成結果と比べる 4 枚）

**もう 1 枚の網は既にある。** 同じファイルの「`docs/` の生成物を `writeFileSync` で
直接書いている場所が無い」が、道具を通らない書き込みを止める。
ただしこれは**書き方**を見ており、**一覧に載っているか**は見ていない。
`writeGeneratedDoc` を正しく使って新しい 1 枚を足した場合、
その 1 枚が `STAMPED` に載っていなくても、どちらの検査も落ちない。

## 出力と成果物

一覧の判定を、**生成側が知っている事実**から作る。候補（決め打ちではない）:

- `scripts/lib/generated-doc.mjs` が書いた先を**記録に残し**、その記録と `STAMPED` を
  突き合わせる。書いた側が正本になるので、語の言い回しに依らない
- 指紋の行を**構造として読む**（`inspectStamped` が既に持っている）。
  文字列の包含ではなく、**指紋として妥当な行があるか**で判定する。
  これなら説明文にその語を書いても当たらない（誤検出も同時に消える）
- 生成物であることを、文書の側ではなく**生成する側の一覧**（スクリプトの登録表）で持つ

2 つ目が最も安く、見落としと誤検出の両方に効く。

## 依存関係

無し。残課題 78 と同じ族だが、独立に着手できる。

## 実装対象

- `tests/architecture/generated-docs.test.ts`（一覧の検査）
- `scripts/lib/generated-doc.mjs`（判定に使える関数を出す場合）

## Write scope と競合制約

`tests/architecture/` と `scripts/lib/`。
**`docs/product/` の生成物 8 枚には触らない**（触ると指紋が合わなくなる）。

## GitHub publication

`local_only`。

## 実行手順

1. **見落としを再現する。** 一時的に 9 枚目の生成物を作り、
   指紋は焼くが説明文にはその語を書かない状態にして、検査が緑のままであることを見る
2. 判定を作り直す（候補は「出力と成果物」に 3 つ）
3. 手順 1 をもう一度やり、**今度は赤になる**ことを見る
4. 誤検出の側も測る。説明文にその語を書いた文書を用意し、**緑のまま**であることを見る
5. 一時的に作った 9 枚目は、scratchpad へ複製を取ったうえで元に戻す

## 受入条件

- 手順 1 と 3 の差が実測で示されていること（見落としが塞がったこと）
- 手順 4 で、説明文に語を書いても赤くならないこと（誤検出が消えたこと）
- 現在の 8 枚が、変更後も全部一覧に載ること

## 検証方法

**両方向を測る。** 片方だけだと、誤検出を消すために判定を緩めて
見落としを増やす、という直し方が通ってしまう。

壊す前に scratchpad へ複製を取り、後始末は複製からの書き戻しだけで行う
（`docs/architecture/testing-architecture.md` §5-2）。

## リスクとロールバック

判定を作り直すと、**いま一覧に載っている 8 枚のどれかが落ちる**可能性がある。
落ちたら、それは新しい判定の穴ではなく**その 1 枚の焼き方が他と違う**ということなので、
一覧から外さずに焼き方を揃える。

## リスク: 誤検出だけを直して閉じること（この課題で最も起きやすい失敗）

- **文言を言い換えて緑にするのは、この課題の対象ではない。** 2026-08-19 に
  実際にそうやって緑に戻したが、それは目の前の赤を消しただけで、
  **見落としの側は 1 ミリも動いていない**。
- 判定から語を消して「何も見ない」ようにするのも違う。
  それは誤検出も見落としも同時に増やす。

## Handoff

塞いだのは見落としの側か、誤検出の側か、両方かを書く。
手順 1（見落としの再現）を通したかどうかを必ず書く。

## 規範

- `docs/product/backlog.md` 項目 81（この課題の要約）
- `docs/product/backlog.md` 項目 78（3 つの形。この課題は 1 つ目）
- `docs/architecture/testing-architecture.md` §5-2（赤を測るときの後始末）

## やらないこと

- `docs/product/` の生成物に手を入れること
- 一覧（`STAMPED`）を手で増やして済ませること。
  それは今日の 8 枚を守るだけで、**9 枚目を足す人には効かない**
