# 実装要件定義書: feat-uiux-overhaul (管理画面 UI/UX 全面改善)

> 本書は dev-graph `requirements` verb が確定仕様 (system-spec) と昇格済み feature execution package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:8b83b484e066f4549a279fd25675cca5b648fcd1a89a9415f469a8ae94f6fe78`
- graph revision: 268
- feature package: `feature-package/feat-uiux-overhaul`
- promoted generation digest: `sha256:3c9e340b6675b9d0b51c5a8b14331885611cb6e7f9129f16eb853231a3a7fbf0`
- handoff target: `task-graph`
- emitted_at: 2026-08-21T12:45:00Z

## 目的と到達状態

- 目的: 管理画面を単一用途画面へ再編し、共通コンポーネント化と投稿状態の可視化によって、複数ブログ・複数SNSへの展開作業を迷いなく完了できるようにする
- 到達状態: 全画面が単一用途に分割され、管理対象に基本管理機能(一覧・新規作成・編集・削除)とそのAPIが揃い、カード間隔・文章量・サイドバーが最適化され、各サイト・SNSへの投稿状態が画面へ反映され、1商品から複数ブログへコンセプト別文章を作成でき、X/Facebook等の新SNSをプロバイダ追加のみで拡張できる構成になっている

## スコープ

スコープ内:

- 単一用途画面への分割 (1画面1タスクの画面再編と遷移設計)
- 基本管理機能: ブログ・記事・商品・SNS投稿の一覧/新規作成/編集/削除と対応API
- カード間隔・文章量の最適化 (密度・余白・要約量の規則化)
- サイドバーの整理 (用途別グルーピング・現在地表示・各項目のアイコン表示・アイコンクリックでの開閉)
- 認知負荷の最小化 (タスク遂行に不要な情報・文章の非表示、直感的に操作だけで完了できる画面設計)
- 全画面の見直し (既存画面の単一用途化・状態表現の統一適用)
- 各サイト・SNSへの投稿部分の画面反映 (投稿状態の一覧・詳細表示とAPI)
- マルチSNS構成 (X/Facebook等へ追加実装のみで拡張できるプロバイダ抽象)
- 1商品→複数ブログのコンセプト別文章作成UI
- UI共通コンポーネント化 (重複ハードコーディングの排除・共有部品への集約)
- ブログ別コンポーネント作成仕様 (新規ブログ構築時のブログ固有コンポーネント scaffold)

スコープ外:

- 認証・Workspace基盤 (feat-auth-workspace)
- 記事生成エンジン本体 (feat-ai-content-studio)
- SNS実配信・外部API接続の実行系 (feat-distribution-hub)
- 文章品質規則そのもの (feat-writing-method)
- 読者向け公開面 (feat-reader-surface)

## 受入条件 (feature)

- 各管理画面が単一用途で、1画面に複数の主要タスクが混在しない
- 管理対象 (ブログ・記事・商品・SNS投稿) 全てに一覧・新規作成・編集・削除の操作と対応APIが存在する
- 各サイト・SNSへの投稿状態が管理画面の一覧・詳細に反映される
- 新しいSNSの追加がプロバイダ実装の追加のみで完了し、既存画面の改修を要しない
- 1商品から複数ブログへコンセプト別の文章を作成する導線が動作する
- 同等UIの重複実装が0件で、共通部品は共有コンポーネント経由で使用される
- 新規ブログ構築時にブログ別コンポーネント一式が仕様どおり scaffold される
- カード間隔・文章量・サイドバー構成が規則として文書化され全画面へ適用されている
- サイドバーの全項目にアイコンが付き、アイコンクリックで折りたたみ/展開が切り替わり、折りたたみ時もアイコンで項目を識別できる
- 各画面の表示情報がタスク遂行に必要な項目のみに絞られ、不要な文章・説明が非表示になっている (認知負荷の低減)

## アーキテクチャ参照

- `arch-two-layer-platform` (architecture/arch-two-layer-platform.md)

- 仕様正本 (複製せず lineage 参照): `system-spec/ui-ux.md`, `system-spec/frontend.md`, `system-spec/backend.md`

## readiness matrix

| node | kind | confirmation | evaluation | readiness | missing sections |
|---|---|---|---|---|---|
| `arch-two-layer-platform` | architecture | confirmed | pass | complete | なし |
| `feat-uiux-overhaul` | feature | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P01` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P02` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P03` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P04` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P05` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P06` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P07` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P08` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P09` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P10` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P11` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P12` | task | confirmed | pass | complete | なし |
| `SYS-UIUX-OVERHAUL-P13` | task | confirmed | pass | complete | なし |

missing sections 合計: 0 件。remediation owner: なし (全 gate PASS)。

## 実行タスク (exact 13)

| phase | node | title | 成果物パス |
|---|---|---|---|
| P01 | `SYS-UIUX-OVERHAUL-P01` | 管理画面 UI/UX 全面改善の要求ベースライン確定 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p01.md` |
| P02 | `SYS-UIUX-OVERHAUL-P02` | 単一用途画面・共通コンポーネント・マルチSNS抽象の設計 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p02.md` |
| P03 | `SYS-UIUX-OVERHAUL-P03` | 設計レビューと認知負荷・重複排除の独立検証 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p03.md` |
| P04 | `SYS-UIUX-OVERHAUL-P04` | 受入10件に対応するテスト設計 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p04.md` |
| P05 | `SYS-UIUX-OVERHAUL-P05` | 単一用途画面・共通コンポーネント・管理API・マルチSNSの実装 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p05.md` |
| P06 | `SYS-UIUX-OVERHAUL-P06` | テスト実行と回帰0件の確認 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p06.md` |
| P07 | `SYS-UIUX-OVERHAUL-P07` | 受入10件の受け入れ判定 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p07.md` |
| P08 | `SYS-UIUX-OVERHAUL-P08` | 既存画面の共通部品への移行と重複実装の解消 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p08.md` |
| P09 | `SYS-UIUX-OVERHAUL-P09` | 品質保証と非機能検査 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p09.md` |
| P10 | `SYS-UIUX-OVERHAUL-P10` | 最終レビューと残課題の確定 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p10.md` |
| P11 | `SYS-UIUX-OVERHAUL-P11` | 証跡の集約と検証可能性の確保 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p11.md` |
| P12 | `SYS-UIUX-OVERHAUL-P12` | 規則の文書化と運用手順の整備 | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p12.md` |
| P13 | `SYS-UIUX-OVERHAUL-P13` | リリースと仕様への書き戻し | `tasks/feat-uiux-overhaul/sys-uiux-overhaul-p13.md` |

## 機能内依存 (前方 DAG)

| phase | depends_on |
|---|---|
| P01 | なし |
| P02 | SYS-UIUX-OVERHAUL-P01 |
| P03 | SYS-UIUX-OVERHAUL-P02 |
| P04 | SYS-UIUX-OVERHAUL-P03 |
| P05 | SYS-UIUX-OVERHAUL-P04 |
| P06 | SYS-UIUX-OVERHAUL-P05 |
| P07 | SYS-UIUX-OVERHAUL-P06 |
| P08 | SYS-UIUX-OVERHAUL-P05 |
| P09 | SYS-UIUX-OVERHAUL-P08 |
| P10 | SYS-UIUX-OVERHAUL-P09 |
| P11 | SYS-UIUX-OVERHAUL-P07, SYS-UIUX-OVERHAUL-P09 |
| P12 | SYS-UIUX-OVERHAUL-P10, SYS-UIUX-OVERHAUL-P11 |
| P13 | SYS-UIUX-OVERHAUL-P12 |

## gate 実行結果

| gate | command | 結果 |
|---|---|---|
| C11 graph schema | `validate-graph-schema.py --graph .dev-graph/state/graph.json --repo-root .` | exit 0 / valid=true / violations 0 |
| C02 saved state | graph node の confirmation/evaluation/readiness | confirmed / pass / complete (closure 15 node) |
| source digest | 登録 node の `source_lineage.source_digest` と昇格 digest の突合 | checked 13 / mismatch 0 |
| exact-13 package | `validate-system-plan.py --repo-root . --staging .dev-graph/published/feature-package-feat-uiux-overhaul` | exit 0 / status pass / violations 0 |

## handoff

- target: `task-graph` build
- handoff package: `.dev-graph/handoff/task-graph/feat-uiux-overhaul.json`
- 実装コード生成: 0 件 (本書と handoff package のみ)

## 実装着手時の不変条件

- 共通部品の正本は `src/presentation/ui/` (primitives / patterns / templates / tokens)。同等 UI の重複実装は P08 で 0 件へ収束させる
- 管理routeの正本は `src/presentation/ui/admin-route-metadata.ts`。`ADMIN_NAV` / `ADMIN_NAV_GROUPS` / パンくず / テストroute表はそこから派生し、画面側で個別に組まない
- SNS 追加はプロバイダ実装の追加のみで完了し、既存画面の改修を要しない (受入条件 4)
- 画面に出す情報は P01 の `docs/spec/feat-uiux-overhaul/information-priority-map.json` に従い、残す/落とす/加工するを機械可読に固定する
