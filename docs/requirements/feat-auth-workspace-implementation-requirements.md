# 実装要件定義書: feat-auth-workspace (認証とWorkspace/Brand基盤)

> 本書は dev-graph `requirements` verb が確定仕様 (system-spec) と昇格済み feature execution package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:9ae48414b8ff8b489ce13db626f0c01c578cd7f7d884f14e74e4165776c62fdb`
- graph revision: 113
- feature package: `feature-package/feat-auth-workspace`
- promoted generation digest: `sha256:35483f66bb1988fc2b3ede65937a16e41d29637c455a092e3fa463c0c90fbb0c`
- handoff target: `task-graph`
- emitted_at: 2026-08-16T14:00:00Z

## 目的と到達状態

- 目的: 利用者が自分のテナントとブランド設定の中だけで安全に作業できる土台をつくる
- 到達状態: Google ログインでサインインし、Workspace と Brand を作成でき、全データが workspace_id で分離され、ロールに応じた操作制限が効いている

## スコープ

スコープ内:

- Better Auth + Google OAuth
- Workspace / Brand の作成と切替
- ブランド設定 (色・ロゴ・表示名・運営会社・編集方針・禁止表現・標準CTA・標準免責・言語・タイムゾーン)
- ロールと権限 (§25)
- 全テーブルへの workspace_id 付与とテナント分離 (§26.4)

スコープ外:

- 外部プラットフォームのアカウント接続
- 課金
- SSO / SCIM

## 受入条件 (feature)

- [x] 未ログインで管理画面を開くとログイン画面へ遷移する（ローカル受入。Workers 実 HTTP は未検証）
- [x] 別 Workspace のデータが一覧・詳細・API のいずれからも取得できない
- [x] ブランド設定の標準CTAと標準免責が記事生成の既定値として渡る（ブランド 1 件時）
- [x] 権限のないロールが公開操作を実行すると 403 になる

## アーキテクチャ参照

- `arch-system-spec-overview` (architecture/system-spec-overview.md) — 確定 system-spec 8章の実装投影。本書は本文を複製せず参照する。

## readiness matrix

| node | kind | confirmation | evaluation | readiness | missing sections |
|---|---|---|---|---|---|
| `arch-system-spec-overview` | architecture | confirmed | pass | complete | なし |
| `feat-auth-workspace` | feature | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P01` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P02` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P03` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P04` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P05` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P06` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P07` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P08` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P09` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P10` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P11` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P12` | task | confirmed | pass | complete | なし |
| `SYS-AUTH-WORKSPACE-P13` | task | confirmed | pass | complete | なし |

missing sections 合計: 0 件。remediation owner: なし (全 gate PASS)。

## 実行タスク (exact 13)

| phase | node | title | 成果物パス |
|---|---|---|---|
| P01 | `SYS-AUTH-WORKSPACE-P01` | 認証/Workspace 基盤の要求ベースライン確定 | `tasks/feat-auth-workspace/sys-auth-workspace-p01.md` |
| P02 | `SYS-AUTH-WORKSPACE-P02` | 認証/Workspace/Brand/RBAC アーキテクチャ設計 | `tasks/feat-auth-workspace/sys-auth-workspace-p02.md` |
| P03 | `SYS-AUTH-WORKSPACE-P03` | アーキテクチャ独立設計レビュー | `tasks/feat-auth-workspace/sys-auth-workspace-p03.md` |
| P04 | `SYS-AUTH-WORKSPACE-P04` | 受け入れ条件に基づくテストファースト設計 | `tasks/feat-auth-workspace/sys-auth-workspace-p04.md` |
| P05 | `SYS-AUTH-WORKSPACE-P05` | Better Auth・Workspace・RBAC 実装 | `tasks/feat-auth-workspace/sys-auth-workspace-p05.md` |
| P06 | `SYS-AUTH-WORKSPACE-P06` | 認証/Workspace/RBAC テスト実行 | `tasks/feat-auth-workspace/sys-auth-workspace-p06.md` |
| P07 | `SYS-AUTH-WORKSPACE-P07` | feat-auth-workspace 受け入れ判定 | `tasks/feat-auth-workspace/sys-auth-workspace-p07.md` |
| P08 | `SYS-AUTH-WORKSPACE-P08` | workspace_id 移行とスキーマ整備 | `tasks/feat-auth-workspace/sys-auth-workspace-p08.md` |
| P09 | `SYS-AUTH-WORKSPACE-P09` | 品質・セキュリティ・運用保証 | `tasks/feat-auth-workspace/sys-auth-workspace-p09.md` |
| P10 | `SYS-AUTH-WORKSPACE-P10` | 独立最終レビュー | `tasks/feat-auth-workspace/sys-auth-workspace-p10.md` |
| P11 | `SYS-AUTH-WORKSPACE-P11` | 再現可能な証跡取得 | `tasks/feat-auth-workspace/sys-auth-workspace-p11.md` |
| P12 | `SYS-AUTH-WORKSPACE-P12` | ドキュメント・ランブック・引き継ぎ | `tasks/feat-auth-workspace/sys-auth-workspace-p12.md` |
| P13 | `SYS-AUTH-WORKSPACE-P13` | リリース/デプロイとクローズアウト | `tasks/feat-auth-workspace/sys-auth-workspace-p13.md` |

## gate 実行結果

| gate | command | 結果 |
|---|---|---|
| C11 graph schema | `validate-graph-schema.py` | exit 0 / valid=true / violations 0 |
| C02 saved state | graph node の readiness/evaluation/confirmation | complete / pass / confirmed (closure 15 node) |
| source digest | `validate-source-digest.py --registered <closure 15>` | exit 0 / checked 15 / mismatch 0 |
| exact-13 package | `validate-system-plan.py --feature-package feature-package/feat-auth-workspace` | exit 0 / status pass / violations 0 |

## handoff

- target: `task-graph` build
- handoff package: `.dev-graph/handoff/task-graph/feat-auth-workspace.json`
- 実装コード生成: 0 件 (本書と handoff package のみ)

## 二層構造との関係 (再emit時の追記)

- 本 feature はプラットフォーム層の基盤であり、ブログ層 (Site の実体) のテナント境界も本 feature の `workspace_id` 束縛に従う
- アーキテクチャ正本は `architecture/arch-two-layer-platform.md`、裁定文書は `docs/spec/04-二層構造統合仕様.md`
- 権限10ロールの判定は `src/domain/shared/authz.ts` の単一関数へ集約し、画面側は判定結果だけを使う
