# System task overlay: feature受入 A1-A8 の検証

## Machine-readable registration fields

- feature_package_id: feature-package/feat-seo-aeo-measurement-loop
- owners: ["daishiman"]
- tags: ["p07", "feat-seo-aeo-measurement-loop", "seo-aeo"]
- related_nodes: ["arch-system-spec-overview", "arch-two-layer-platform"]
- parent_feature: feat-seo-aeo-measurement-loop
- phase_ref: P07
- classification: confidence=1.0; reason=feat-seo-aeo-measurement-loopのP07 lifecycle責務への確定写像; candidate=tasks/feat-seo-aeo-measurement-loop/sys-seo-aeo-measurement-loop-p07.md
- tracker_binding_intent: beads
- github_publication: mode=local_only; project_aliases=[]; labels=[]; milestone=null
- pr_completion_policy: linked_pr_merged_all
- branch_policy: one-task-one-branch + worktree lease required + default-branch reconciliation + assignment_owner=dev-graph-scheduler

## 目的

features/feat-seo-aeo-measurement-loop.md の受入A1-A8を実装済みシステムに対して検証する。

## 背景

features/feat-seo-aeo-measurement-loop.md の受入A1-A8を実装済みシステムに対して検証し、featureのdone判定材料にする。

## 前提条件

- Required spec/architecture/phase/task nodes: feat-seo-aeo-measurement-loop, arch-system-spec-overview, arch-two-layer-platform, SYS-SEO-AEO-MEASUREMENT-LOOP-P06
- Entry gate: depends_onの全taskがdoneまたはclosed
- Source pin: system-spec-harness v0.1.0 / run-system-spec-compile / assign-system-spec-completeness-evaluator
- Repository context: repo_identity=github:daishiman/affiliate-hub; root_resolution_source=explicit-cli; config=.dev-graph/config.json

## Workstream applicability

- Frontend: applicable; change=管理画面での受入シナリオを実施する
- Backend: applicable; change=A1-A8のバックエンド挙動を検証する
- API: applicable; contract=A3(資格情報非露出)を機械検査で確認する
- Data: applicable; migration=A5(突合)の実データ確認を行う
- Infrastructure: applicable; IaC/deploy=A8(定期実行失敗記録)を確認する
- Security: applicable; control=A3を再確認する
- Quality: applicable; tests/gates=A1-A8全件PASSを記録する
- Documentation: applicable; docs=docs/spec/feat-seo-aeo-measurement-loop/acceptance.md を作成する
- Operations: applicable; runbook/monitoring=A7(停止/再開)の運用確認を行う

## Architecture and deploy unit

- Architecture decisions: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md, system-spec/ui-ux.md
- Deploy unit/environment: cloudflare-workers-opennext-app。3データ源の収集・突合・自動反映はWorkers上のCron TriggerとD1に持つ
- Compatibility/migration/backfill: 既存のsrc/domain/seo, src/application/seo (ai-search-audit.ts, structured-data.ts等) との後方互換を保ち、破壊的移行はP08のdry-runとrollback証跡なしに実行しない

## 成果物

- Produced artifacts: docs/spec/feat-seo-aeo-measurement-loop/acceptance.md
- Consumed artifacts: features/feat-seo-aeo-measurement-loop.md, features/feat-seo-aeo-measurement-loop.context.json, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md, SYS-SEO-AEO-MEASUREMENT-LOOP-P06
- Write scope/touches: docs/spec/feat-seo-aeo-measurement-loop/acceptance.md

## Tracker publication and completion

- Tracker binding intent: beads
- Publication mode: local_only
- Project aliases / labels / milestone: N/A: beads bindingではGitHub Projectsを更新しない
- PR completion policy: linked_pr_merged_all
- PR body contract: Beads issue参照とdev-graph graph_node_id=SYS-SEO-AEO-MEASUREMENT-LOOP-P07を記載し、target branchはdevとする
- Ownership boundary: system-dev-plannerはintentを宣言し、dev-graphが起票・依存・完了収束を所有する

## Branch and worktree execution

- Branch: dev-graph登録後にC15がdevgraph/SYS-SEO-AEO-MEASUREMENT-LOOP-P07として割り当てる
- Worktree lease: 実装開始前にSYS-SEO-AEO-MEASUREMENT-LOOP-P07をclaimし、heartbeatとreleaseをlease契約どおり行う
- Parallel safety: depends_on完了、write_scopeとactive leaseの非重複を確認する
- Completion projection: feature branchはpending eventだけを残し、default branch reconciliationでdurable doneを確定する

## スコープ外

- アフィリエイト成果のイベント計測・アトリビューション・KPI (feat-analytics-insight)
- JSON-LD / llms.txt / sitemap.xml / robots.txt の生成そのもの (feat-blog-ui-builder)
- 有料広告の効果測定、外部 SEO SaaS の利用
- この仕組みの導入前から公開されている記事の自動書き換え (所見の提示に留める)、変更前の状態を記録せず取り消せない反映
- 検索エンジンへの順位操作を目的とした手法

## テスト戦略

- テストレベル選定: 単体は突合ロジック・境界時刻判定(NFR2)・反映根拠の型的限定(NFR5)・停止検出の閾値判定(NFR6)・効果判定の保留状態遷移(NFR7)の純粋関数を検証する。結合はD1永続化(所見・反映ログ・系統別最終収集時刻)とCron Triggerハンドラの境界を検証する。E2Eは管理画面の停止/再開トグル・反映履歴・1操作revertを検証する。境界値は記事作成時刻が導入時刻と一致する境界・被引用チェック実行上限到達・系統別停止検出の閾値直前直後を検証する。回帰は既存src/domain/seo, src/application/seoとの後方互換を保つ。
- カバレッジ目標: 新規または変更するapplication codeは既定80%を下回らず、自動反映エンジンの可逆性経路(スナップショット→反映→差分記録→revert)は対象関数100%網羅を要求する。
- 層別方針: Frontendは可視ラベルとアクセシブル名によるbehavior検証、Backendは収集・突合・自動反映のunit/integration契約、InfrastructureはCron Trigger起動条件のIaC静的検証とdevelopment smokeを使う。
- 保守性制約: pixel位置依存とDOM構造依存のassertを禁止し、操作結果・状態・契約・反映記録の内容を検証する。

## Verification and evidence

- Automated commands: `python3 "/Users/dm/dev/dev/個人開発/harness/marketplaces/local/plugins/system-dev-planner/scripts/validate-system-plan.py" --repo-root . --staging .dev-graph/staging/feature-package-feat-seo-aeo-measurement-loop`
- Automated commands: `pnpm test`
- Required evidence:
  - docs/spec/feat-seo-aeo-measurement-loop/acceptance.md
- Acceptance state: P07: features/feat-seo-aeo-measurement-loop.md の受入A1〜A8を実装済みシステムに対して1件ずつ検証し、全件成立をacceptance evidenceとして記録する。

## Inner goal-seek execution loop

- Methodology contract: system-task-goal-seek/v1
- Goal: features/feat-seo-aeo-measurement-loop.md の受入A1-A8を実装済みシステムに対して検証する。
- Generic execution prompt: feature goal、当phaseの目的、depends_on成果物、write_scope、スコープ外を入力し、手段を固定せず観測可能なacceptanceを満たす成果物を作る
- Rubric: 当task acceptance、既定80% coverage、回帰0、required evidence、write_scope厳守の全項目
- Feedback loop: 実装と独立した評価へ渡し、findingを次周のpromptへ反映してrubric verdict=PASSまで反復する。上限到達時はfail-closedで前phaseへ差し戻す
- P13 spec/architecture writeback: N/A: P13が所有する。

## Rollout and rollback

- Rollout: SYS-SEO-AEO-MEASUREMENT-LOOP-P07の成果物をwrite_scope内へ適用し、検証PASS後に依存する次phaseへ渡す
- Rollback trigger and steps: P07のrubric verdictがFAILのまま上限へ到達した場合、write_scope内の当phase変更を戻し、直前のpromoted generationへ復帰する

## Handoff

- Executor: system build route。dev-graph登録とworktree claim後に実行する
- Ready when: confirmed、evaluation pass、implementation readiness complete、promoted digest、dev-graph exact-13 registrationが揃う
- Completion condition: P07: features/feat-seo-aeo-measurement-loop.md の受入A1〜A8を実装済みシステムに対して1件ずつ検証し、全件成立をacceptance evidenceとして記録する。

## 参照情報

- System specification: system-spec/index.md, system-spec/00-requirements-definition.md, system-spec/ui-ux.md, system-spec/backend.md, system-spec/maintenance-ops.md, system-spec/database.md
- Architecture: architecture/system-spec-overview.md, architecture/arch-two-layer-platform.md
- Feature: feat-seo-aeo-measurement-loop
- Phase doc: references/system-plan-phase-names.md#P07
- Dependencies: SYS-SEO-AEO-MEASUREMENT-LOOP-P06

## feature受入対応表 (A1-A8)

- A1: 3データ源がそれぞれ単独で実行でき、1つが失敗しても他の結果が失われない
- A2: 静的解析が公開HTMLからtitle/description/canonical/OGP/JSON-LD/見出し/内部リンク/画像altと寸法を抽出し、規則違反をページ単位で列挙する
- A3: Search Consoleの資格情報がサーバー環境変数からのみ読まれ、リポジトリ・管理画面・ログのいずれにも現れないことを機械検査で確認できる
- A4: 被引用チェックの実行件数に上限を設定でき、上限到達時は記録して停止する
- A5: 3データ源の結果が同じページ識別子で突合され、ページ別に一覧・推移表示できる
- A6: 導入後に作成された記事へ改善が自動で反映され、反映の事実・変更前後の差分・時刻が記録されて運営者へ通知される。導入前から公開されている記事は自動反映されず所見として提示されるに留まる
- A7: 自動反映が公開HTMLへ出たことを次回の静的解析で確認でき、記録された反映を1操作で取り消すと反映前の状態に戻る。自動反映は運営画面から停止でき、停止中も3データ源の収集と課題の提示は続く
- A8: 定期実行が失敗したとき失敗した回と理由が記録され、次回の実行を妨げない

## 非機能要件対応表 (NFR1-9, system-spec由来)

- NFR1 (可逆性): 自動反映は変更前の状態を必ず先に記録し、記録が取れなければ書き換えを実行しない。反映は差分として記録され1操作で元へ戻せる。この3つが揃わない反映経路を実装として持たない (system-spec/maintenance-ops.md 接地根拠 qa-neutral-application-mode-v6)。
- NFR2 (時間範囲限定): 自動反映の対象はこの仕組みの導入後に作成された記事に限る。この境界は記事の作成時刻という機械が判定できる値で引き、運用の心がけに委ねない。範囲内では本文・題名・画像を含む全要素が対象で、要素の種類では線を引かない (system-spec/maintenance-ops.md 接地根拠 qa-neutral-auto-scope-v6)。
- NFR3 (事後通知): 何をいつなぜ変えたかを運営者へ通知する。通知は可逆性の担保ではなく気づきの手段として扱い、通知を見逃しても後から変更の一覧を辿れる面を用意する。
- NFR4 (停止可能性): 自動反映は運営画面から止められる。止めた状態でも所見の収集と提示は続く。止めた事実と再開した事実も記録に残し、止まっている状態を運営画面の入口に出し続ける。
- NFR5 (根拠系統の限定): 自動反映の根拠にできるのは再現する系統①(サイト内静的解析)だけとし、系統②(Search Console)と系統③(AI検索被引用)は反映後に何が動いたかを見る材料に留める。人が事前に根拠の弱さを見て止める経路(旧qa-ops-web-aeo-proposal-review-v5)は差し替え済みで自動反映には止める人がいないため、型の側で限る (system-spec/backend.md qa-backend-web-aeo-analysis-pipeline-v6)。
- NFR6 (停止の検出): 系統ごとに最後に収集できた時刻を保持し、想定間隔(系統①=記事保存時/系統②=日次/系統③=公開時と週次)を超えて更新されない系統を運営画面で名指しする。閾値は系統ごとに持つ。検出は収集とは別の契機で走らせ、同じ失敗で両方が止まらないようにする。自動反映が止まった場合は未反映の所見が増え続ける状態として検出する。
- NFR7 (効果判定の遅延): 反映の直後に実績を見て効果が無かったと判定しない。反映の記録に実行時刻を持たせ、判定してよい時期まで保留の状態で保つ。判定済みと未判定を混ぜない。同じ記事へ短い間隔で繰り返し反映せず、記事ごとに次の反映まで間隔を空ける。同じ記事の所見はまとめて1回の反映にする。
- NFR8 (秘密情報境界): Search ConsoleとAI検索の資格情報は運営者がCloudflareの画面またはwranglerから登録し、リポジトリ・環境変数ファイル・コマンド引数・ログのいずれにも現れない。機械の側から鍵を書き出す経路を持たない。系統①は外部依存が無いため鍵が未登録でも自動反映は成立する。
- NFR9 (費用上限): 被引用チェックは実行件数の上限を設定でき、上限到達時は記録して停止する (system-spec/backend.md 章の注記「被引用チェックの費用が比例する量」)。
