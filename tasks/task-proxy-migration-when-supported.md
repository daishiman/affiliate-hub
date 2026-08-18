---
graph_node_id: "task-proxy-migration-when-supported"
artifact_kind: "task"
artifact_subtypes: []
project_id: "affiliate-hub"
domain: "platform"
tags: ["platform","nextjs","cloudflare"]
priority: "low"
start_date: null
target_date: null
iteration: null
title: "入口の門を proxy.ts へ移す(OpenNext が Node middleware を受け取れたら)"
owners: ["daishiman"]
created_at: "2026-08-18T06:35:00Z"
updated_at: "2026-08-18T06:35:00Z"
status: "draft"
depends_on: []
related_nodes: []
resource_scope: ["src"]
purpose: null
goal: null
mvp_alignment: {"background":"Next.js 16 は middleware を proxy.ts へ改名し、旧名を非推奨にした。proxy.ts は Node の実行環境固定で、@opennextjs/cloudflare 1.20.2 は Node middleware を受け取れずビルドが止まる(実際に止めて確かめた)。Next.js 自身の移行案内も『edge で動かしたいなら middleware を使い続けよ』と書いている","mvp_fit":"enabling","purpose":"OpenNext が Node middleware を受け取れるようになったら、src/middleware.ts を src/proxy.ts へ移す","rationale":"いまの middleware.ts は放置ではなく、動く唯一の置き場所である。移せる合図は pnpm run preview のビルドが proxy.ts のまま通ること。判定は entry-gate.ts に分けてあるので、移すのは配線だけで済む"}
scope_in: []
scope_out: []
acceptance: []
architecture_refs: []
parent_feature: null
feature_package_id: null
phase_ref: null
file_path: "tasks/task-proxy-migration-when-supported.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "draft"
evaluation_status: "pending"
confirmation_evidence: {"evaluated_digest":null,"evaluator":null,"evidence_ref":null}
source_lineage: {"imported_at":"2026-08-18T06:35:00Z","origin_kind":"manual","source_digest":null,"source_path":"src/middleware.ts","source_plugin":null,"source_version":null}
classification_confidence: 0.9
classification_reason: "Next.js 16 の改名先(proxy.ts)を Cloudflare 側がまだ受け取れない"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/task-proxy-migration-when-supported.md","confidence":0.9}]
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

**入口の門を `src/middleware.ts` から `src/proxy.ts` へ移す。**
移せるのは、Cloudflare 側（`@opennextjs/cloudflare`）が Node middleware を
受け取れるようになった日である。

## 背景

Next.js 16 はこの仕組みを `proxy.ts` へ改名し、旧名を非推奨にした。
ところが `proxy.ts` は **Node の実行環境固定**で、`edge` を選べない。

> The `edge` runtime is **NOT** supported in `proxy`. The `proxy` runtime is `nodejs`,
> and it cannot be configured. If you want to continue using the `edge` runtime,
> keep using `middleware`.
> （`node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`）

一方 `@opennextjs/cloudflare` 1.20.2（2026-08-18 時点の最新）は
`dist/cli/build/build.js:67` で Node middleware を見つけると
`Node.js middleware is not currently supported` で `process.exit(1)` する。
**実際に `src/proxy.ts` で 1 度ビルドを止めて確かめた。**

つまり Cloudflare の上では、いま `middleware.ts`（edge）しか選べない。
**これは古いまま放置しているのではなく、動く唯一の置き場所である。**

## 入力と前提条件

移せる合図は 1 つだけ。`src/proxy.ts` のまま `pnpm run preview` のビルドが通ること。
`@opennextjs/cloudflare` の更新時に確かめる。

## 出力と成果物

1. `src/middleware.ts` → `src/proxy.ts`（export 名も `proxy` へ）
2. `tests/architecture/open-doors.test.ts` の門ファイル検出は**両方の名前を見る**ままにする
3. `src/proxy.ts` 冒頭の「なぜこの名前か」の記録を、移行後の事実へ書き換える

## 依存関係

なし（`@opennextjs/cloudflare` 側の対応待ち）。

## 実装対象

- `src/middleware.ts`
- `tests/architecture/open-doors.test.ts`

## Write scope と競合制約

`src/`、`tests/architecture/`。判定（`src/infrastructure/identity/entry-gate.ts`）は
触らない。移すのは配線だけで済むように分けてある。

## GitHub publication

`local_only`。

## 実行手順

1. `@opennextjs/cloudflare` を上げ、`src/proxy.ts` へ改名してビルドを通す
2. `pnpm run preview` で、通行証なしの `/admin` が `/signin` へ戻ることを実測する
3. ファイル冒頭の記録を、移行後の事実へ書き換える

## 受入条件

- `pnpm run preview` のビルドが通る
- 通行証なしの管理画面が `/signin` へ戻る（改名前と同じ実測が取れる）
- 台帳の「画面を一括で守る門」が `src/proxy.ts` を指す

## 検証方法

`pnpm run preview`（`localhost:8788`）へ、通行証なし・でたらめな通行証の両方で入る。
`pnpm run verify` の 11 門が緑であること。

## リスクとロールバック

改名だけで守りが外れる可能性がある（`config.matcher` の書き方が変わる場合）。
**台帳の「開いている扉」の数が改名の前後で変わらないこと**を確かめる。
戻すのは `git revert` で足りる。

## Handoff

急ぐ課題ではない。**非推奨のまま動いていることを黙って忘れない**ための記録である。

## 規範

- `src/middleware.ts` 冒頭（なぜ非推奨の名前なのか）
- `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`
