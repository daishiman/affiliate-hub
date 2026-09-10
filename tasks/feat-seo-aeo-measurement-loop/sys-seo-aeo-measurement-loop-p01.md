---
graph_node_id: "SYS-SEO-AEO-MEASUREMENT-LOOP-P01"
artifact_kind: "task"
artifact_subtypes: []
project_id: "feature-package-feat-seo-aeo-measurement-loop"
domain: "documentation"
tags: ["p01","feat-seo-aeo-measurement-loop","seo-aeo"]
priority: null
start_date: null
target_date: null
iteration: null
title: "3データ源SEO/AEO計測ループの要件ベースライン (自動反映・可逆性・対象範囲の非機能要件を含む)"
owners: ["daishiman"]
created_at: "2026-09-04T05:19:32Z"
updated_at: "2026-09-10T09:00:00Z"
status: "active"
depends_on: []
related_nodes: ["arch-system-spec-overview","arch-two-layer-platform"]
resource_scope: ["docs/spec/feat-seo-aeo-measurement-loop/requirements.md"]
purpose: "サイト内静的解析・Search Console連携・AI被引用チェックの3データ源とその自動反映ループについて、feature受入A1-A8と、system-spec由来の非機能要件NFR1-9を1件も欠落・改変させずに要件定義書へ確定し、以降全phaseの固定入力にする。"
goal: "サイト内静的解析・Search Console連携・AI被引用チェックの3データ源とその自動反映ループについて、feature受入A1-A8と、system-spec由来の非機能要件NFR1-9を1件も欠落・改変させずに要件定義書へ確定し、以降全phaseの固定入力にする。"
scope_in: ["Produced artifacts: docs/spec/feat-seo-aeo-measurement-loop/requirements.md","Consumed artifacts: features/feat-seo-aeo-measurement-loop.md, features/feat-seo-aeo-measurement-loop.context.json, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md","Write scope/touches: docs/spec/feat-seo-aeo-measurement-loop/requirements.md"]
scope_out: ["アフィリエイト成果のイベント計測・アトリビューション・KPI (feat-analytics-insight)","JSON-LD / llms.txt / sitemap.xml / robots.txt の生成そのもの (feat-blog-ui-builder)","有料広告の効果測定、外部 SEO SaaS の利用","差分記録・1 操作での復元・同一確定単位での通知のいずれかを欠く反映、版競合時の上書き (読み出した版と現在の版が違うときは書かずに保留する)、新規記事の外部公開と予約投稿の承認省略 (この経路の承認免除の対象外)","検索エンジンへの順位操作を目的とした手法"]
acceptance: ["Automated commands: `python3 \"/Users/dm/dev/dev/個人開発/harness/marketplaces/local/plugins/system-dev-planner/scripts/validate-system-plan.py\" --repo-root . --staging .dev-graph/staging/feature-package-feat-seo-aeo-measurement-loop`","Required evidence:"]
architecture_refs: ["arch-system-spec-overview","arch-two-layer-platform"]
parent_feature: "feat-seo-aeo-measurement-loop"
feature_package_id: "feature-package/feat-seo-aeo-measurement-loop"
phase_ref: "P01"
file_path: "tasks/feat-seo-aeo-measurement-loop/sys-seo-aeo-measurement-loop-p01.md"
template_id: "task"
template_version: "1.0.0"
confirmation_status: "confirmed"
evaluation_status: "pass"
confirmation_evidence: {"evaluated_digest":"46209e547af534e49404d69ee60347cc4e61a4351d2310c497f51b36ee745eda","evaluator":"system-dev-plan-evaluator","evidence_ref":".dev-graph/published/feature-package-feat-seo-aeo-measurement-loop/plan-findings.json"}
source_lineage: {"imported_at":"2026-09-04T05:19:32Z","origin_kind":"system-dev-planner","source_digest":"46209e547af534e49404d69ee60347cc4e61a4351d2310c497f51b36ee745eda","source_path":".dev-graph/published/feature-package-feat-seo-aeo-measurement-loop/task-specs/phase-01-requirements.md","source_plugin":"system-dev-planner","source_version":"0.1.0"}
classification_confidence: 1.0
classification_reason: "feat-seo-aeo-measurement-loopのP01 lifecycle責務への確定写像"
classification_candidates: [{"artifact_kind":"task","candidate_path":"tasks/feat-seo-aeo-measurement-loop/sys-seo-aeo-measurement-loop-p01.md","confidence":1.0}]
issue_linkage: null
tracker_binding: "beads"
beads_linkage: {"bd_issue_id":"ah-nfhh","github_mirror":null,"linked_at":"2026-09-04T07:34:12Z","sync_state":"linked"}
github_publication: {"labels":[],"milestone":null,"mode":"local_only","project_aliases":[]}
github_project_linkages: []
pull_request_linkages: []
execution_contexts: []
completion_evidence: {"completed_at":null,"evidence_refs":[],"policy":"linked_pr_merged_all","reconciled_at":null,"source":null,"status":"in_progress"}
implementation_readiness: {"checked_at":"2026-09-04T03:19:00Z","missing_sections":[],"status":"complete"}
---

# System task overlay: 3データ源SEO/AEO計測ループの要件ベースライン (自動反映・可逆性・対象範囲の非機能要件を含む)

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-aeo-measurement-loop
- owners: ["daishiman"]
- tags: ["p01", "feat-seo-aeo-measurement-loop", "seo-aeo"]
- related_nodes: ["arch-system-spec-overview", "arch-two-layer-platform"]
- parent_feature: feat-seo-aeo-measurement-loop
- phase_ref: P01
- classification: confidence=1.0; reason=feat-seo-aeo-measurement-loopのP01 lifecycle責務への確定写像; candidate=tasks/feat-seo-aeo-measurement-loop/sys-seo-aeo-measurement-loop-p01.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

サイト内静的解析・Search Console連携・AI被引用チェックの3データ源とその自動反映ループについて、feature受入A1-A8と、system-spec由来の非機能要件NFR1-9を1件も欠落・改変させずに要件定義書へ確定し、以降全phaseの固定入力にする。

## 背景

SEO/AEOの良し悪しを推測ではなく自前の計測(サイト内静的解析・Google Search Console連携・AI検索での被引用チェック)で判断し、その結果をブログの構成へ戻す。system-spec/maintenance-ops.md qa-ops-web-aeo-auto-apply-v6 と system-spec/backend.md qa-backend-web-aeo-analysis-pipeline-v6 により、2026-09-03の独立監査C06指摘を受けた対等提示で利用者選択が (a) 事前の許諾を要する運用 から (b) 機械が自動で反映し事後通知 へ確定変更された。旧決定 qa-ops-web-aeo-proposal-review-v5 は差し替え済みで現行の確定内容ではないため、本taskでは (b) への反転だけを要件として明文化する。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-aeo-measurement-loop, arch-system-spec-overview, arch-two-layer-platform
- Entry gate: depends_onの全taskがdoneまたはclosed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: N/A: reason=本phaseは要件定義書のみを作成し画面変更を行わない
- Backend: applicable; change=3データ源・突合・自動反映・停止制御・停止検出の機能要件をNFR1-9として確定する
- API: N/A: reason=API契約設計はP02で行う
- Data: N/A: reason=データモデル設計はP02で行う
- Infrastructure: N/A: reason=Cron Trigger等の配置設計はP02/P13で行う
- Security: applicable; control=資格情報境界(NFR8)と反映根拠限定(NFR5)を要件として明文化する
- Quality: applicable; tests/gates=A1-A8とNFR1-9をP04テスト設計の入力として確定する
- Documentation: applicable; docs=docs/spec/feat-seo-aeo-measurement-loop/requirements.md を正本として作成する
- Operations: applicable; runbook/monitoring=停止検出(NFR6)と費用上限(NFR9)の運用要件を確定する

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md, system-spec/ui-ux.md
- Deploy unit/environment: cloudflare-workers-opennext-app。3データ源の収集・突合・自動反映はWorkers上のCron TriggerとD1に持つ
- Compatibility/migration/backfill: 既存のsrc/domain/seo, src/application/seo (ai-search-audit.ts, structured-data.ts等) との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: docs/spec/feat-seo-aeo-measurement-loop/requirements.md
- Consumed artifacts: features/feat-seo-aeo-measurement-loop.md, features/feat-seo-aeo-measurement-loop.context.json, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md
- Write scope/touches: docs/spec/feat-seo-aeo-measurement-loop/requirements.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-SEO-AEO-MEASUREMENT-LOOP-P01を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-SEO-AEO-MEASUREMENT-LOOP-P01として割り当てる
- Worktree lease: 実装開始前にSYS-SEO-AEO-MEASUREMENT-LOOP-P01をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- アフィリエイト成果のイベント計測・アトリビューション・KPI (feat-analytics-insight)
- JSON-LD / llms.txt / sitemap.xml / robots.txt の生成そのもの (feat-blog-ui-builder)
- 有料広告の効果測定、外部 SEO SaaS の利用
- 差分記録・1 操作での復元・同一確定単位での通知のいずれかを欠く反映、版競合時の上書き (読み出した版と現在の版が違うときは書かずに保留する)、新規記事の外部公開と予約投稿の承認省略 (この経路の承認免除の対象外)
- 検索エンジンへの順位操作を目的とした手法

## テスト戦略

- テストレベル選定: 単体は突合ロジック・境界時刻判定(NFR2)・反映根拠の型的限定(NFR5)・停止検出の閾値判定(NFR6)・効果判定の保留状態遷移(NFR7)の純粋関数を検証する。結合はD1永続化(所見・反映ログ・系統別最終収集時刻)とCron Triggerハンドラの境界を検証する。E2Eは管理画面の停止/再開トグル・反映履歴・1操作revertを検証する。境界値は記事作成時刻が導入時刻と一致する境界・被引用チェック実行上限到達・系統別停止検出の閾値直前直後を検証する。回帰は既存src/domain/seo, src/application/seoとの後方互換を保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らず、自動反映エンジンの可逆性経路(スナップショット→反映→差分記録→revert)は対象関数100%網羅を要求する。
- 層別方針: Frontendは可視ラベルとアクセシブル名によるbehavior検証、Backendは収集・突合・自動反映のunit/integration契約、InfrastructureはCron Trigger起動条件のIaC静的検証とdevelopment smokeを使う。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、操作結果・状態・契約・反映記録の内容を検証する。

## Verification and evidence

- Automated commands: `python3 "/Users/dm/dev/dev/個人開発/harness/marketplaces/local/plugins/system-dev-planner/scripts/validate-system-plan.py" --repo-root . --staging .dev-graph/staging/feature-package-feat-seo-aeo-measurement-loop`
- Required evidence:
  - docs/spec/feat-seo-aeo-measurement-loop/requirements.md
- Acceptance state: P01: features/feat-seo-aeo-measurement-loop.md の受入 A1〜A8 (frontmatter canonical) と、system-spec/maintenance-ops.md qa-ops-web-aeo-auto-apply-v6 系および system-spec/backend.md qa-backend-web-aeo-analysis-pipeline-v6 由来の非機能要件 NFR1〜NFR9 (可逆性・対象範囲・事後通知・停止可能性・根拠系統限定・停止検出・効果判定遅延・秘密情報境界・費用上限) を1件も欠落・改変なく要件定義書へ転記し、以降のP02〜P13が参照する固定ベースラインとして確定する。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: サイト内静的解析・Search Console連携・AI被引用チェックの3データ源とその自動反映ループについて、feature受入A1-A8と、system-spec由来の非機能要件NFR1-9を1件も欠落・改変させずに要件定義書へ確定し、以降全phaseの固定入力にする。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、スコープ外を入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: SYS-SEO-AEO-MEASUREMENT-LOOP-P01の成果物をwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P01のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P01: features/feat-seo-aeo-measurement-loop.md の受入 A1〜A8 (frontmatter canonical) と、system-spec/maintenance-ops.md qa-ops-web-aeo-auto-apply-v6 系および system-spec/backend.md qa-backend-web-aeo-analysis-pipeline-v6 由来の非機能要件 NFR1〜NFR9 (可逆性・対象範囲・事後通知・停止可能性・根拠系統限定・停止検出・効果判定遅延・秘密情報境界・費用上限) を1件も欠落・改変なく要件定義書へ転記し、以降のP02〜P13が参照する固定ベースラインとして確定する。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-seo-aeo-measurement-loop
- Phase doc: references/system-plan-phase-names.md#P01
- Dependencies: なし (P01: featureからの起点)

## feature受入対応表 (A1-A8)

- A1: 3データ源がそれぞれ単独で実行でき、1つが失敗しても他の結果が失われない
- A2: 静的解析が公開HTMLからtitle/description/canonical/OGP/JSON-LD/見出し/内部リンク/画像altと寸法を抽出し、規則違反をページ単位で列挙する
- A3: Search Consoleの資格情報がサーバー環境変数からのみ読まれ、リポジトリ・管理画面・ログのいずれにも現れないことを機械検査で確認できる
- A4: 被引用チェックの実行件数に上限を設定でき、上限到達時は記録して停止する
- A5: 3データ源の結果が同じページ識別子で突合され、ページ別に一覧・推移表示できる
- A6: 作成日時を問わず全ての記事 (作成日時が不明な記事を含む) へ改善が機械により反映され、反映の事実・変更前後の差分・時刻が記録されて、反映と同じ確定単位で運営者へ通知される。反映前の関門は置かない。反映は記事 1 件を単位に、記事更新・変更前後の差分記録・所見の反映済みの印を同一確定単位で保存し、途中で失敗したら 1 つも変えない
- A7: 自動反映が公開HTMLへ出たことを次回の静的解析で確認でき、記録された反映を1操作で取り消すと反映前の状態に戻る。自動反映は運営画面から停止でき、停止中も3データ源の収集と課題の提示は続く
- A8: 定期実行が失敗したとき失敗した回と理由が記録され、次回の実行を妨げない

## 非機能要件対応表 (NFR1-9, system-spec由来)

- NFR1 (可逆性): 自動反映は変更前の状態を必ず先に記録し、記録が取れなければ書き換えを実行しない。反映は差分として記録され1操作で元へ戻せる。この3つが揃わない反映経路を実装として持たない (system-spec/maintenance-ops.md 接地根拠 qa-neutral-application-mode-v6)。
- NFR2 (対象範囲): 自動反映の対象は作成日時を問わず全ての記事とし、作成日時が不明な記事も含める。時刻による境界は引かない。範囲で守らないぶん、記事 1 件を単位とした同一確定単位での保存と、読み出した版との一致検査が安全性の必須条件になる。本文・題名・画像を含む全要素が対象で、要素の種類では線を引かない (system-spec/maintenance-ops.md 接地根拠 qa-neutral-auto-scope-v6、qa-seo-apply-target-scope-20260910、qa-seo-apply-approval-mode-20260910)。
- NFR3 (事後通知): 何をいつなぜ変えたかを運営者へ通知する。通知は可逆性の担保ではなく気づきの手段として扱い、通知を見逃しても後から変更の一覧を辿れる面を用意する。
- NFR4 (停止可能性): 自動反映は運営画面から止められる。止めた状態でも所見の収集と提示は続く。止めた事実と再開した事実も記録に残し、止まっている状態を運営画面の入口に出し続ける。
- NFR5 (根拠系統の限定): 自動反映の根拠にできるのは再現する系統①(サイト内静的解析)だけとし、系統②(Search Console)と系統③(AI検索被引用)は反映後に何が動いたかを見る材料に留める。人が事前に根拠の弱さを見て止める経路(旧qa-ops-web-aeo-proposal-review-v5)は差し替え済みで自動反映には止める人がいないため、型の側で限る (system-spec/backend.md qa-backend-web-aeo-analysis-pipeline-v6)。
- NFR6 (停止の検出): 系統ごとに最後に収集できた時刻を保持し、想定間隔(系統①=記事保存時/系統②=日次/系統③=公開時と週次)を超えて更新されない系統を運営画面で名指しする。閾値は系統ごとに持つ。検出は収集とは別の契機で走らせ、同じ失敗で両方が止まらないようにする。自動反映が止まった場合は未反映の所見が増え続ける状態として検出する。
- NFR7 (効果判定の遅延): 反映の直後に実績を見て効果が無かったと判定しない。反映の記録に実行時刻を持たせ、判定してよい時期まで保留の状態で保つ。判定済みと未判定を混ぜない。同じ記事へ短い間隔で繰り返し反映せず、記事ごとに次の反映まで間隔を空ける。同じ記事の所見はまとめて1回の反映にする。
- NFR8 (秘密情報境界): Search ConsoleとAI検索の資格情報は運営者がCloudflareの画面またはwranglerから登録し、リポジトリ・環境変数ファイル・コマンド引数・ログのいずれにも現れない。機械の側から鍵を書き出す経路を持たない。系統①は外部依存が無いため鍵が未登録でも自動反映は成立する。
- NFR9 (費用上限): 被引用チェックは実行件数の上限を設定でき、上限到達時は記録して停止する (system-spec/backend.md 章の注記「被引用チェックの費用が比例する量」)。
