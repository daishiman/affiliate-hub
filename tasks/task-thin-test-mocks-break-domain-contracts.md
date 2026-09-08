---
graph_node_id: "task-thin-test-mocks-break-domain-contracts"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "quality"
tags: ["tests","quality"]
priority: "medium"
start_date: "2026-09-08"
target_date: null
iteration: null
title: "痩せたテストモックが型必須フィールドを欠いたまま as never で通っている"
owners: ["daishiman"]
created_at: "2026-09-08T00:00:00Z"
updated_at: "2026-09-08T12:52:05Z"
status: "done"
depends_on: []
related_nodes: []
resource_scope: ["tests"]
purpose: null
goal: null
mvp_alignment: {"background":"2026-09-08、article-page-prose.test.tsx の SiteFrame モックが blueprint: { name } だけを渡していた。SiteBlueprint は theme と categories を必須で持つ。thumbnailContextOf が theme を読むようになった瞬間、画面の描画そのものが 'Cannot read properties of undefined (reading brandTheme)' で落ち、テストの主題である Prose の描画すら測れなくなった。tests/ 全体では as never が 180 箇所ある","mvp_fit":"enabling","purpose":"実装が正しく前へ進んだ日に、テストが主題と無関係な場所で落ちるのを止める","rationale":"as never は型検査を完全に無効化するので、契約破りがコンパイル時に見えない。壊れるのは実装が前へ進んだ日で、壊れ方が主題と無関係なため原因の特定に時間がかかる"}
scope_in: []
scope_out: []
acceptance: ["ドメイン型を as never / as unknown as で偽装している箇所が洗い出され、ブラウザ API のモック (MediaStream, CanvasRenderingContext2D 等) と区別されている","tests/support/factories.ts が正本を引くファクトリを提供し、痩せたモックがそれに置き換わっている","blueprint: {} as never のように「その経路は読まない」ことの表明として残す箇所には、その意図がコメントで書かれている"]
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-thin-test-mocks-break-domain-contracts.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"c174b75ed0b6296d171b3796d80d4cda2edf506ed4b59fb5ac6db0902fdf898a","evaluator":"final-review","evidence_ref":"docs/spec/feat-blog-top-page-composition/final-review.md"}
source_lineage: {"imported_at":"2026-09-08T00:00:00Z","origin_kind":"manual","source_digest":null,"source_path":"tests/ui/article-page-prose.test.tsx","source_plugin":null,"source_version":null}
classification_confidence: 0.95
classification_reason: "article-page-prose の実害から一般化した、テスト側の型契約の穴を 1 件の作業として立てた"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-thin-test-mocks-break-domain-contracts.md","confidence":0.95}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-t1df","github_mirror":null,"linked_at":"2026-09-08T12:12:48Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":"2026-09-08T12:52:05Z","evidence_refs":["tests/support/factories.ts","docs/spec/feat-blog-top-page-composition/final-review.md"],"policy":"manual","reconciled_at":"2026-09-08T12:52:05Z","source":"manual","status":"done"}
implementation_readiness: {"checked_at":"2026-09-08T20:35:00Z","missing_sections":[],"status":"complete"}
---

# 目的

実装が正しく前へ進んだ日に、テストが**主題と無関係な場所で**落ちるのを止める。

## 背景

2026-09-08、`tests/ui/article-page-prose.test.tsx` の 7 件が一斉に赤くなった。落ちたのは
Prose の描画ではなく、その手前の `view-model.ts:165` である:

```
TypeError: Cannot read properties of undefined (reading 'brandTheme')
```

原因は SiteFrame のモックが `blueprint: { name: "机まわり研究室" }` だけを渡していたこと。
`SiteBlueprint` 型は `theme: ThemeTokens` と `categories: readonly CategoryPlan[]` を**必須**で
持つ。関連記事のカードが図版を組むのに `thumbnailContextOf(blueprint)` で `theme.brandTheme` と
`categories` を引くようになった瞬間、画面の描画そのものが落ち、この検査の主題である
Prose の描画すら測れなくなった。

実装は正しい。破っていたのはモックの側で、`as never` / 部分オブジェクトが型検査を
無効化していたため、契約破りがコンパイル時に見えなかった。

`tests/` 全体で `as never` は 180 箇所、`as unknown as` を含めると 215 箇所ある。

## この作業の境目

**すべてを消すのではない。** ブラウザ API のモック (`MediaStream`, `CanvasRenderingContext2D`,
`ImageBitmap` など) は `as unknown as` が正当な用途で、実装が触るメソッドだけを持たせる
のが正しい。問題は**ドメイン型**を痩せた形で偽装している箇所だけである。

`blueprint: {} as never` のような書き方も、それ自体は誤りではない。「この経路は blueprint を
読まない」ことの表明として機能しうる。読むようになった日に落ちるのは想定内である。
ただし**その意図が書かれていない**と、次の読み手には手抜きと区別がつかない。

## 入力と前提条件

- `tests/support/factories.ts` (既存のテストファクトリ)
- `src/domain/authoring/site-blueprint.ts` の `DEFAULT_THEME` (正本の既定テーマ)
- `as never` 180 箇所 / `as unknown as` を含め 215 箇所の一覧

## 出力と成果物

- ドメイン型を偽装している箇所の一覧 (ブラウザ API のモックと区別したもの)
- `tests/support/factories.ts` へ追加した、正本を引くファクトリ
- 置き換え後のテスト

## 依存関係

なし。単独で進められる。

## 実装対象

- `tests/support/factories.ts`
- ドメイン型を痩せた形で偽装している各テストファイル

## Write scope と競合制約

`tests/` 配下のみ。`src/` は触らない。**実装を変えてテストに合わせない** —— 今回の一件で
正しかったのは実装の側である。

## 実行手順

1. `as never` / `as unknown as` の全箇所を、偽装している型で分類する。
2. ブラウザ API のモックを除外する。
3. 残ったドメイン型の偽装について、正本を引くファクトリを `factories.ts` へ足す。
4. 痩せたモックをファクトリへ置き換える。
5. 表明として残す `as never` には、なぜ読まない経路なのかをコメントで書く。

## 受入条件

- ドメイン型を `as never` / `as unknown as` で偽装している箇所が洗い出され、ブラウザ API の
  モックと区別されている。
- `tests/support/factories.ts` が正本を引くファクトリを提供し、痩せたモックがそれに
  置き換わっている。
- 表明として残す箇所には、その意図がコメントで書かれている。

## 検証方法

`npx vitest run` の全件緑と `npx tsc --noEmit` の exit 0。加えて、置き換えた箇所について
「実装側が必須フィールドを 1 つ増やしたとき、テストがコンパイル時に落ちる」ことを
1 件で実際に確かめる。

## リスクとロールバック

ファクトリが太りすぎると、テストが「何を固定していて何を可変にしているか」を読めなくなる。
既定値を持つファクトリ + 上書き引数の形にし、テストの主題に関わる値だけを明示的に渡す。

## GitHub publication

`local_only`。外部へ出さない。

## Handoff

完了時に本 node を close する。参照先として、置き換え箇所の一覧を残す。

## 規範

**実装をテストに合わせない。** 実装が型で表明している契約を、テストが型の外から破って
いるのがこの問題の形である。直すのは常にテストの側。

## やらないこと

- ブラウザ API のモックからの `as unknown as` の除去
- `as never` の一律禁止 lint ルールの追加 (正当な用途があるため)
- 実装側の型を緩めること
