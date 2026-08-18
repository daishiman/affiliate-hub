---
graph_node_id: "task-generated-doc-handwrite"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["quality","testing","docs"]
priority: "medium"
start_date: "2026-08-18"
target_date: null
iteration: null
title: "「手で書き換えない」と書いてある文書に手で書いても、内容が合っていれば緑になる"
owners: ["daishiman"]
created_at: "2026-08-18T13:20:00Z"
updated_at: "2026-08-18T22:55:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["docs","tests","scripts"]
purpose: null
goal: null
mvp_alignment: {"background":"機械が作る文書 8 枚のうち、テストが比較する 4 枚は内容が一致する手書きを検出せず、スクリプトが上書きする 4 枚は手書きを赤にせず黙って消す","mvp_fit":"enabling","purpose":"文書が本当に生成物であることを、8 枚に共通の 1 つの仕掛けで保証する","rationale":"検査の名前から読まれる問い（手で書いていないこと）と実際に答えている問い（古くないこと）がずれており、そのずれは順番でしか露見しない"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-generated-doc-handwrite.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T13:20:00Z","origin_kind":"manual","source_digest":null,"source_path":"tests/architecture/open-doors.test.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "2026-08-18 に open-doors.md へ手で書いた事故から見つかった、生成物の保証の穴"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-generated-doc-handwrite.md","confidence":0.9}]
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

**「このファイルは機械が作る。手で書き換えない」と頭に書いてある文書が、
本当に生成物であること**を機械で保証する。いまは保証されていない。

## 背景

2026-08-18 に、`docs/product/open-doors.md` へ段落を手で書いた。
文書の 3 行目に「このファイルは `tests/architecture/open-doors.test.ts` が作る。
手で書き換えない」と書いてあるのに、である。

このときは `pnpm run verify` が赤になって捕まった。しかしそれは**順番のおかげ**だった。
正本（テスト側の生成配列）を直す前に打ったから、生成結果と食い違って赤になった。
先に正本を直してから同じ手書きをしていれば、内容が一致するので**通っていた**。

つまりこの検査が実際に答えている問いは「**この文書は古くないか**」であって、
「**この文書は手で書かれていないか**」ではない。名前（「台帳ファイルが実際の状態と
一致している」）は正しく前者を言っているが、文書の頭には後者が書いてある。
読む人はこの 2 つを同じものとして受け取る。

**再現するかどうかが順番で決まる検査は、次に同じことをする人を捕まえない。**

## 入力と前提条件

同じ形の文書が何枚あるかを数え上げた（2026-08-18 実測）。**8 枚**ある。
`docs/product/traceability.md` は**入力側の正本**（`scripts/traceability.mjs` が
読むだけで書かない）なので、この 8 枚には入らない。

### A. テストが生成結果と比較する（古ければ赤になる）— 4 枚

| 文書 | 作っているもの | 更新の仕方 |
|---|---|---|
| `docs/product/open-doors.md` | `tests/architecture/open-doors.test.ts` | `UPDATE_OPEN_DOORS=1` |
| `docs/product/stub-ledger.md` | `tests/infrastructure/stub-ledger.test.ts` | `UPDATE_STUB_LEDGER=1` |
| `docs/product/event-ledger.md` | `tests/domain/domain-events.test.ts` | `UPDATE_EVENT_LEDGER=1` |
| `docs/product/eval-ledger.md` | `tests/evals/generation-eval-set.test.ts` | `UPDATE_EVAL_LEDGER=1` |

この 4 枚は**内容が一致する手書きを検出しない**。上に書いた穴がそのまま当てはまる。

### B. スクリプトが毎回上書きする（赤にならない）— 4 枚

| 文書 | 上書きしているもの |
|---|---|
| `docs/product/port-wiring-report.md` | `scripts/port-wiring.mjs` |
| `docs/product/required-test-types-report.md` | `scripts/required-test-types.mjs` |
| `docs/product/test-traceability.md` | `scripts/traceability.mjs` |
| `docs/product/coverage.md`（末尾の囲みだけ） | `scripts/coverage-report.mjs` |

**B のほうが危ない。** こちらは手書きを赤にしない。`pnpm run verify` を打った
瞬間に**黙って消える**。書いた本人は verify が緑なのを見て、書いたものが残っていると
思う。既に何度も踏んでいる形（**消えたことは緑として現れる**）そのものである。

A と B は性質が違うので、**1 枚ずつ直す話ではなく、生成物であることを
どう保証するかという 1 つの問い**として扱う。

### 同じ形が、この作業場所で 3 度出ている

**消えたことは緑として現れる。** B が危ないのはこの形だからで、
これは今回が初めてではない。3 件並べる。1 件ずつ見ると「たまたま」に見えるが、
並べると足りていないものの形が見える。

| いつ・どこ | 何が消えると緑になるか | いま何で止まっているか |
|---|---|---|
| `src/application/audit.ts` | `deps.auditLog.append()` の呼び出しを共通の補助関数へ**引き上げる**と、`scripts/port-wiring.mjs` は同じファイルの中しか辿らないので、記録を書いている入口が全部「記録していない」に化ける | **検査ではなく、ファイル冒頭の注意書き。**畳めば消えると分かったので畳まなかった。次に読む人が注意書きを読まずに整理すれば、同じことが起きる |
| `quality-gates.config.mjs` の `AUDIT_ACTIONS_MIN_EMITTED` | 記録の語の見張りは上限だけだったので、**語ごと消せば緑**になった。「出していた語まで一緒に消えた」ことに気づけない | 下限（20）を張った。**これは実際に塞いだ 1 件** |
| `docs/product/` の B の 4 枚（この課題） | 手で書いた行が `pnpm run verify` の実行で**黙って消える**。verify は緑のまま | **何も止めていない** |

3 度出たなら、個別の不注意ではない。**「無くなったこと」を検出する仕掛けが、
この作業場所には構造的に足りていない。**上限（増えたら落ちる）は揃っているが、
下限や指紋のような「減った・消えた」を捕まえるものは、
気づいた人がその都度 1 つずつ足している状態である。

この課題で B を直すときは、**この 3 件目を塞ぐだけでなく、
同じ形が 4 度目に出たときに捕まる置き方**になっているかを見ること。

## 出力と成果物

8 枚すべてについて、**手で書いた内容が「気づかれずに残る」も「気づかれずに消える」も
起きない**状態にする。直し方は着手時に決める。いま思いついている案を、
決め打ちではなく候補として残す。

- 生成物に**指紋を焼き付ける**（生成元の内容から作った短いハッシュを末尾に書き、
  検査は指紋と中身の一致を見る）。手で 1 文字書けば指紋が合わなくなるので、
  内容が一致していても捕まる。`scripts/spec-freshness.mjs` が既に同じ考え方
  （入力の指紋を焼く）を使っているので、揃えられる可能性がある
- B の 4 枚を A の形（比較して赤にする）へ寄せる。上書きをやめれば黙って消えない
- 文書の頭の文言を実態に合わせる（「手で書き換えない」ではなく
  「手で書いても消える／古くなると赤になる」と書く）。これは**最後の手段**で、
  保証を作れないときにだけ採る

## 依存関係

無し。どの課題とも独立に着手できる。

## 実装対象

- A の 4 枚を作っているテスト（`tests/architecture/open-doors.test.ts` ほか 3 本）
- B の 4 枚を上書きしているスクリプト（`scripts/port-wiring.mjs` ほか 3 本）
- 8 枚の文書そのもの（頭の文言を実態に合わせる場合）
- `scripts/spec-freshness.mjs`（指紋の焼き付け方を揃える場合の参照先）

## Write scope と競合制約

`docs/product/` の 8 枚、`tests/architecture/` `tests/infrastructure/` `tests/domain/`
`tests/evals/` の生成側 4 本、`scripts/` の 4 本。

**これらの文書は他の課題も更新する**（残課題を書けば `backlog.md`、宣言を足せば
`required-test-types-report.md` が動く）。生成の仕組みを変えている最中に
別の課題が同じ文書を再生成すると、どちらの変更が正しいか読めなくなる。
**この課題の着手中は、8 枚を書き換える別の課題を同時に進めない。**

## GitHub publication

`local_only`。

## 実行手順

1. A の 4 枚のうち 1 枚で、**先に正本を直してから同じ内容を手で書き**、
   `pnpm run verify` が緑のままであることを実測する（穴の再現）
2. B の 4 枚のうち 1 枚で、手で 1 行書き、**打つ前にその行があることを見てから**
   `pnpm run verify` を打ち、**打った後にその行が消えていることを見る**
   （こちらの穴の再現）。
   **なぜ前後 2 回見るのか**: B の穴は「赤くなること」ではなく
   「**緑のまま無くなること**」なので、verify の結果だけを見ても何も起きない。
   前後でファイルを比べて初めて、消えたことが見える。
   **1 回しか見ないと、この穴は再現できたのに再現できなかったように見える。**
3. 直し方を決める（候補は「出力と成果物」に 3 つ書いた）
4. 8 枚へ適用する
5. 1 と 2 をもう一度やり、今度は**赤になる**ことを実測する

## 受入条件

- 8 枚それぞれについて、手書きが**どう検出されるか**が 1 行で言えること
- 検出できない枚数が 0 であること。0 にできない枚数が残るなら、
  残した理由と、その文書の頭の文言が実態と合っていることを確かめること
- 手順 1 と 2 の再現が、直したあとは**両方とも赤になる**こと

## 検証方法

**印を外して赤を実測する。** 1 枚でよいので、生成物へ手で 1 文字書いて
`pnpm run verify` が終了コード 1 で落ちることを見る。戻して緑になることも確認する。

**B の 4 枚では、`verify` を打つ前と後の両方でファイルを見る。**
B の穴は「赤くなること」ではなく「**緑のまま無くなること**」なので、
verify の結果だけを見ても何も起きない。前後で比べて初めて消えたことが見える。
**1 回しか見ないと、再現できたのに再現できなかったように見える。**
A の 4 枚は赤で分かるので 1 回でよい。**手順を分ける理由がこれである。**

実測しないまま「守れている」と書かない。**この課題は「検査が答えている問いと
読まれる問いのずれ」を直すものなので、直したあとに同じずれを作ると意味が無い。**

## リスクとロールバック

生成の仕組みに触るため、**間違えると 8 枚すべてが同時に赤になる**。
1 枚で試してから広げる。戻すときは生成側の変更を戻し、
`UPDATE_*=1` と各スクリプトで文書を作り直す。

## リスク: 文言を直して終わりにすること（この課題で最も起きやすい失敗）

- **頭の文言を「手で書いても消えます」に書き換えるだけで閉じない。**
  それは危なさの説明を正確にしただけで、**手書きが残る／消えることは変わらない**。
  文言の修正は保証を作れないと分かったときの最後の手段であり、最初の手ではない。
- **B の 4 枚を「上書きされるから問題ない」と読まない。** 上書きは修復ではなく
  **消去**である。書いた本人は verify が緑なのを見て、残っていると思う。
- 枚数が 8 から減ったことを成果にしない。**対象から外して減らすのは 1 行でできる。**

## Handoff

直せなかった枚数と、その理由を数で伝える。
「全部直した」と書く前に、手順 5 の実測を通したかどうかを書く。

## 規範

- `tests/architecture/open-doors.test.ts`（穴が見つかった検査）
- `scripts/spec-freshness.mjs`（入力の指紋を焼く既存のやり方）
- `src/application/audit.ts` 冒頭（同じ形の 1 件目。畳めば消えることが書いてある）
- `quality-gates.config.mjs` の `AUDIT_ACTIONS_MIN_EMITTED`（同じ形の 2 件目。塞いだ例）
- 残課題リスト 項目 78

## やらないこと

- `docs/product/traceability.md` を対象に含めること（入力側の正本であり生成物ではない）
- 8 枚の内容そのものの見直し。ここで扱うのは**生成物であることの保証**だけ
