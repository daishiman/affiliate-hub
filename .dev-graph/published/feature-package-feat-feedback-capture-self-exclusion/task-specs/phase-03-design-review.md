# System task overlay: 設計の独立レビューと退避経路の妥当性判定

## Machine-readable registration fields

- feature_package_id: feature-package/feat-feedback-capture-self-exclusion
- owners: ["daishiman"]
- tags: ["p03", "feat-feedback-capture-self-exclusion"]
- related_nodes: []
- parent_feature: feat-feedback-capture-self-exclusion
- phase_ref: P03
- classification: confidence=1.0; reason=feat-feedback-capture-self-exclusion の P03 lifecycle 責務への確定写像; candidate=tasks/feat-feedback-capture-self-exclusion/sys-fb-capture-exclusion-p03.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

P02 の設計を実装着手前に独立の観点で検査し、押した勢いの喪失・待ちの無限延長・隠したまま戻らない要素という三つの失敗様式が設計上塞がれていることを判定した状態を成立させる。

## 背景

撮影と描画の順序を入れ替える変更は、押した勢いを失って許可の窓が出なくなる、撮影が終わらず送信 UI が永久に開かない、撮影中に隠した要素が例外経路で戻らない、という失敗様式を新たに生む。実装前にこの三つを設計の側で塞いだと言えるかを、実装者と別の観点で確かめる。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-feedback-capture-self-exclusion, system-spec/frontend.md, system-spec/ui-ux.md, architecture/arch-two-layer-platform.md
- Entry gate: 直前 phase task の depends_on 完了 (intra-feature dependency)
- Source pin: system-spec-harness v0.1.0 (C08 source_pin) / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; 送信 UI の撮影経路を対象に読み解く
- Backend: N/A: reason=サーバ側の契約を変更しないため
- API: N/A: reason=API 契約を変更しないため
- Data: N/A: reason=永続データの形を変更しないため
- Infrastructure: N/A: reason=既存 cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2) のデプロイ単位を変えないため
- Security: applicable; 画面の写しに含まれる情報の範囲を扱う
- Quality: applicable; 受入7件を検証可能な形に保つ
- Documentation: applicable; 本 phase の成果物が文書である
- Operations: N/A: reason=運用手順は P12 が所有するため

## Architecture and deploy unit

- Architecture decisions: architecture/arch-two-layer-platform.md, system-spec/frontend.md, system-spec/ui-ux.md
- Deploy unit/environment: cloudflare-workers-opennext-app (Next.js 16 + OpenNext, Workers/D1/R2)
- Compatibility/migration/backfill: 既存の浮遊要素への属性付与の揃えは P08 が所有する

## 成果物

- Produced artifacts: docs/spec/feat-feedback-capture-self-exclusion/design-review-findings.md (三つの失敗様式に対する設計上の遮断根拠と残課題の判定)
- Consumed artifacts: features/feat-feedback-capture-self-exclusion.md, features/feat-feedback-capture-self-exclusion.context.json, system-spec/frontend.md, docs/spec/12-改善要望フィードバック仕様.md
- Write scope/touches: docs/spec/feat-feedback-capture-self-exclusion/design-review-findings.md

## Tracker publication and completion

> 本 spec は tracker_binding_intent と GitHub 公開 intent だけを宣言し、永続 binding の解決・起票・完了収束は dev-graph が所有する。

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: reason=beads binding では GitHub Projects 連携を行わない
- PR completion policy: linked_pr_merged_all
- PR body contract: Closes #issue (beads issue) + dev-graph graph_node_id=SYS-FB-CAPTURE-EXCLUSION-P03; PR の宛先は dev ブランチとする
- Ownership boundary: system-dev-planner は intent のみを宣言し、dev-graph が tracker mutation と reconciliation を行う

## Branch and worktree execution

- Branch: assigned after dev-graph registration by C15 as devgraph/SYS-FB-CAPTURE-EXCLUSION-P03; system-dev-planner は事前割当を行わない
- Worktree lease: claim SYS-FB-CAPTURE-EXCLUSION-P03 before implementation; heartbeat/release は dev-graph worktree lease 契約に従う
- Parallel safety: depends_on の完了 + resource_scope (feat-feedback-capture-self-exclusion 配下) と active lease が重複しないこと
- Completion projection: feature branch は pending event のみを記録し、default branch へのマージ後に done を確定する

## スコープ外

- feat-feedback-capture-self-exclusion の scope_out (改善要望フィードバック機能そのものの無効化・起動ボタンの撤去・写しの書き込み (手書き/四角/矢印/文字/黒塗り) の仕様変更・一覧/詳細/払い出し経路の変更・写し以外の添付手段の追加) に該当する変更
- 他 phase が所有する成果物への書き込み (write_scope 外への変更)

## テスト戦略

- テストレベル選定: 単体: 撮影と可視化の順序・退避経路・復元の振る舞いを単体で緑化する。結合: 改善ボタン押下から写しの確定・送信 UI 表示までの経路を結合で緑化する。境界値: 許可拒否・非対応環境・撮影失敗・撮り直しの各境界を緑化する。回帰: 既存 tests 配下の全スイートを失敗 0 件のまま維持する。
- カバレッジ目標: 既定 80% を新規実装コード (src/presentation/ui/patterns) に適用する。
- 層別方針: フロントエンド: 可視ラベルとアクセシブル名に基づく振る舞い検証で、撮影中の退避と復元を確かめる。
- 保守性制約: 画素位置依存・DOM 構造依存のテストを禁止し、可視ラベル・アクセシブル名・要素の可視状態など振る舞い検証に限定する。

## Verification and evidence

- Automated commands: `pnpm run typecheck`
- Automated commands: `python3 .claude/plugins/system-dev-planner/scripts/validate-system-plan.py --repo-root . --feature-package feature-package/feat-feedback-capture-self-exclusion`
- Required evidence: P03 の 成果物 section に記した produced artifacts のパス

## Inner goal-seek execution loop

- Methodology contract: `system-task-goal-seek/v1`
- Goal: P02 の設計を実装着手前に独立の観点で検査し、押した勢いの喪失・待ちの無限延長・隠したまま戻らない要素という三つの失敗様式が設計上塞がれていることを判定した状態を成立させる。
- Generic execution prompt: feat-feedback-capture-self-exclusion の goal (改善ボタンを押して撮られた写しに送信 UI が 1 画素も写らず、撮り直しでも同じ規則が効き、写しが撮れない環境でも送信 UI が待たずに開く) と本 task の 前提条件/成果物/write_scope/スコープ外 を渡し、実装手段は固定せず P03 の目的を満たす成果物を作らせる
- Rubric: 受け入れ条件 (本 task の acceptance)・カバレッジ目標 (既定 80%) green・既存テストの回帰 0 件・Required evidence の証跡取得・write_scope 内へのスコープ厳守、の 5 点をすべて満たすこと
- Feedback loop: 実装から独立評価 (P03/P09/P10 相当) へ渡し、finding を Generic execution prompt へ反映して再実行し、rubric verdict=PASS まで反復する。上限到達時は fail-closed で停止し前段 phase へ差し戻す
- P13 spec/architecture writeback: N/A: reason=P13 owns writeback

## Rollout and rollback

- Rollout: P03 の成果物を write_scope 内へ適用し、次 phase へ depends_on を通じて引き継ぐ
- Rollback trigger and steps: rubric verdict=FAIL のまま反復上限に到達した場合、P03 の write_scope 変更を revert し、直前の promoted generation の内容へ復帰する

## Handoff

- Executor: system build route (dev-graph 登録後の worktree claim 経由)
- Ready when: 受入7件に関わる評価が confirmed + evaluation pass + readiness complete + promoted digest + dev-graph registration complete

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/frontend.md, system-spec/ui-ux.md
- Architecture: architecture/arch-two-layer-platform.md
- Feature: feat-feedback-capture-self-exclusion
- Phase doc: system-plan-phase-names.md#P03
- Dependencies: SYS-FB-CAPTURE-EXCLUSION-P02
