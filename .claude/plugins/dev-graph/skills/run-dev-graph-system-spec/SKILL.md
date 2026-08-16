---
name: run-dev-graph-system-spec
description: system-spec-harness の正規フローで仕様を作りたいとき、確定した仕様・architecture を source lineage 付きで dev-graph に取り込みたいときに使う。
version: 0.2.1
owner: harness maintainers
source: plugin-plans/dev-graph/component-inventory.json#C19
kind: run
prefix: run
hierarchy: L1
user-invocable: true
argument-hint: "[--repo-root PATH] [--resume]"
allowed-tools: [Read, Bash, Skill, Agent, AskUserQuestion]
script_refs: [../../scripts/resolve-repo-context.py, ../../scripts/validate-system-spec-resume.py, ../../scripts/validate-system-spec-boundary.py, ../../scripts/build-system-spec-resume-import.py, ../../scripts/build-system-spec-import.py, ../../scripts/validate-graph-schema.py, ../../scripts/validate-evidence-refs.py, ../../scripts/validate-source-digest.py, ../../scripts/validate-system-spec-evaluator-completion.py]
schema_refs: [../../schemas/graph-node.schema.json]
responsibility_refs:
  - prompts/R0-context.md
  - prompts/R1-preflight.md
  - prompts/R2-delegate.md
  - prompts/R3-import.md
responsibilities:
  - id: R0-context
    name: context
    prompt_required: true
    summary: "C24で呼出しrepoのsystem_spec rootを解決し、symlink元や別repoのsystem-specを読まないcontainmentを検証する"
  - id: R1-preflight
    name: preflight
    prompt_required: true
    summary: "system-spec-harness versionが>=0.1.0 <1.0.0でrequired 4 entry pointsを持つことを確認し、不一致/未導入ならfallbackせず診断付きfail-closedにする"
  - id: R2-delegate
    name: delegate
    prompt_required: true
    summary: "digest-bound PASS receipt が current なら検証して再利用し、不在/stale 時だけ elicit→必要時doc-fetch→compile→evaluatorを引用実行する"
  - id: R3-import
    name: import
    prompt_required: true
    summary: "確定system-spec章をC02経由で登録しsource_lineage(origin_kind/plugin/path/version/digest/imported_at)、confirmation=confirmed、evaluator evidenceを保持する"
combinators:
  - with-goal-seek
  - with-feedback-contract
goal_seek:
  engine: inline
  fork: subagent
  max_loops: 5
completeness_exempt:
  - "manifest: goal_seek.engine=inline が未達 checklist から実行局面を都度選ぶため、固定 phase の workflow-manifest.json は適用外。停止条件と配線は本文 ## ゴールシーク実行を正本とする。"
feedback_contract:
  max_iterations: 3
  criteria:
    - id: IN1
      loop_scope: inner
      text: "system-spec-harnessのcoverage/source citation gateとdev-graph schema gateがすべてexit0になる"
      verify_by: script
    - id: OUT1
      loop_scope: outer
      text: "仕様書/architecture要求がsystem-spec-harness成果物をsource lineage付きで引用し、同等ヒアリング/compileロジックがdev-graph内に複製されていないことを受入テストが確認する"
      verify_by: live-trial
---

# run-dev-graph-system-spec

## Purpose & Output Contract

- 入力: C24 で caller repo 内に固定した `system-spec/`、system-spec-harness manifest/entry points、任意の resume state。
- 出力: confirmed specification/architecture node、C02 import report、version/digest/imported_at を含む source lineage。
- 完了条件: system-spec-harness の required 4 entry points が存在し、coverage/source-citation/evaluator gate の digest-bound PASS が current で、dev-graph 内の同等生成ロジック複製が0である。

本 skill は仕様生成ロジックを持たない。system-spec-harness を起動し、確定成果物の検証と C02 取込だけを担う。

1. C24 で caller repo の `system-spec/` を解決し、plugin source/別 repo の content を拒否する。
2. `plugins/system-spec-harness/.claude-plugin/plugin.json` の name/version が `>=0.1.0 <1.0.0`、かつ `references/package-contract.json#entry_points.skills` が `run-system-spec-elicit`, `run-system-spec-doc-fetch`, `run-system-spec-compile`, `assign-system-spec-completeness-evaluator` を持つことを確認する。公式manifestへharness専用キーを混在させず、不在/不一致は fallback を実装せず停止する。
3. `system-spec/resume-receipt.json` がある場合は `validate-system-spec-resume.py` で plugin version・required entry points・3 gate・artifact digest を検証する。exit 0 なら upstream 成果物を再生成せず R3 へ進む。不在/stale の場合だけ Skill 呼出しで elicit → 必要時 doc-fetch → compile → completeness evaluator を順に委譲し、新しい receipt を得る。resume 検証失敗を無視した import は禁止する。
   resume 経路は判断分岐が無いため `build-system-spec-resume-import.py --repo-root <root>` 1 コマンドへ集約し、R0/R2/R3 の validator・C02 upsert・goal-seek evidence を決定論的に完了させる。この経路では `Agent` fork と upstream `Skill` 呼出しを行わない。runner は `system-spec-resume-closure/v1` report と checklist evidence を出力し、post-run gate は transcript 内の runner stdout と report の同一性を検証する。
   build 経路の `context: fork` evaluator は、Skill 起動結果の完全な `agentId` と一致する native `task-notification` (`status=completed`、完全 response あり) まで待ち、起動応答だけを receipt にしない。foreground の待機は1回30秒以内の有限操作に限定し、loop/sentinel wait で通知 delivery を塞がない。evaluator を `TaskStop` せず、outer session が report を代筆しない。
4. confirmed 章と evaluator PASS だけを C02 に渡し、`source_lineage={origin_kind,plugin,path,version,digest,imported_at}`, confirmation evidence, readiness を specification/architecture node に保存する。R3 の adapter は contract の node shape だけを組み立て、本文は caller repository の対応 `source_artifact` からそのまま取得する。製品固有の本文テンプレートを持たない。この source body の verbatim import (素材の取込み) は、elicitation/compile の処理ロジックを dev-graph へ再実装する「複製」には含めない。取込み元本文と node body の一致は、`source_digest` が示す成果物を忠実に参照した証拠として扱う。

出力は import report (`system-spec/index.md`, imported node ids, lineage, confirmation_status, readiness)。feature は `architecture_refs` で参照し、内容を複製しない。1 feature→13 task は system-dev-planner の責務であり本 skill は扱わない。

## ゴールシーク実行

### ゴール (Goal)

仕様書・アーキテクチャをplugins/system-spec-harness/の正規フローで構築し、出典・確定状態・上位目的traceを保ったままdev-graphのspecification/architectureノードへ取り込んだ状態になっている

### 目的・背景 (Why)

system-spec-harnessが既に持つヒアリング、カテゴリ×platform matrix、公式出典、確定章保護、独立完成度評価を複製せず引用し、dev-graphはグラフ登録とlineage維持だけを担うため。本skillが取り込むarchitecture/specificationノードはfeature.architecture_refsから参照されfeatureのアーキテクチャ文脈を成す (複製せずlineage参照のみ・MM-12)

### 完了チェックリスト

- [ ] system_spec content root が caller repo 内で repository_id/common-dir と一致する
- [ ] system-spec-harness が version `>=0.1.0 <1.0.0` と required 4 entry points を満たす
- [ ] resume receipt が current なら upstream 4 Skill の再実行 0 件、不在/stale なら elicit/条件付き doc-fetch/compile/evaluator が system-spec-harness Skill 経由だけで実行される
- [ ] coverage/source-citation/evaluator gate が全て PASS である
- [ ] live trial の build 経路では `validate-system-spec-evaluator-completion.py --transcript <transcript.jsonl>` が exit 0 (完全 agentId の完了通知が C02 import より先、TaskStop/outer report 代筆/foreground blocking wait が0件)。resume 経路では同 command に `--resume-report <fixture-repo>/eval-log/run-dev-graph-system-spec-resume-report.json` を加え、upstream Skill/Agent/direct upsert が0件、deterministic runner が1件、digest-bound receipt と C02/lineage/evidence 全 step が exit 0 である
- [ ] C02 登録 node の source_lineage/confirmation/evaluator evidence/readiness が欠落0である
- [ ] `validate-source-digest.py --progress <progress.json>` が exit 0 (各登録 node の source_digest が自 source_path の実 sha256 と一致することを script の exit code で担保)
- [ ] `validate-evidence-refs.py --progress <progress.json>` が exit 0 (本 run 登録 node の evidence_ref dangling 0件を script の exit code で担保)
- [ ] dev-graph 内に同等 elicitation/compile logic の複製が0件である

### ゴールシークループ

frontmatter の `goal_seek.engine: inline` / `fork: subagent` / `max_loops: 5` を実行契約とする。固定手順は使わず、未達 checklist と担当 `prompts/*.md` からその周回の操作を都度生成する。各周回で inner criterion を検証し、完了後は outer criterion の live trial/content review を最大 `feedback_contract.max_iterations=3` 周で評価する。

### ゴールシーク配線

- 開始時に C24 `resolve-repo-context.py --mode write` の JSON receipt を得て、`repo_root` が `content_roots.repository` の realpath と一致する場合だけ `DEV_GRAPH_ROOT=<receipt.repo_root>` に固定する。cwd から再解決しない。
- 元のゴールを `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-goal-spec.json` へ、各 checklist の status/evidence を `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-progress.json` へ記録する。R3 で C02 登録・更新した node id は progress.json の `registered_this_run` 配列へ都度追記する (下記 evidence ゲートの入力になる)。resume live trial の transcript gate は session 終了後にしか実行できないため runner 内では `pending-external` とし、post-run validator の exit 0 を最終 authority にする。
- 未達 responsibility を担当する `prompts/<R-id>.md` を読み、`Agent` で分離 context に fork する。ユーザー判断が必要な境界だけ `AskUserQuestion` を使う。
- 各周回末に `$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-intermediate.jsonl` へ `original_goal`、`original_goal_hash`、`current_goal_snapshot`、`delta_from_original`、`merged_directive_for_next`、`drift_signal` を append-only で記録する。次周回は直前の `merged_directive_for_next` を必須入力にする。
- 5周到達時に未達が残れば完了扱いせず、progress と blocker を親へ handoff する。全 checklist と `feedback_contract.criteria` が PASS のときだけ完了する。

### ゴールシーク検証

各周回後に次の検査を実行し、中間成果物の欠落・goal drift・hash 不一致を fail-closed にする。

```bash
python3 - "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-goal-spec.json" "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-intermediate.jsonl" <<'PY'
import hashlib, json, sys
goal = json.load(open(sys.argv[1], encoding='utf-8'))
rows = [json.loads(line) for line in open(sys.argv[2], encoding='utf-8') if line.strip()]
required_keys = {'original_goal','original_goal_hash','current_goal_snapshot','delta_from_original','merged_directive_for_next','drift_signal'}
expected = hashlib.sha256(goal['original_goal'].encode('utf-8')).hexdigest()
assert rows, 'intermediate.jsonl is empty'
for row in rows:
    assert required_keys <= row.keys(), required_keys - row.keys()
    assert row['original_goal'] == goal['original_goal']
    assert row['original_goal_hash'] == expected
PY
```

続けて **evidence_ref 実在ゲート**を同じ検証フローで実行する。R3 完了条件の「本 run 登録 node の dangling 0 件」は、この script の exit code だけを根拠とする (散文 checklist の自己申告は根拠にしない)。script が progress.json の `registered_this_run` を読み、既存 dangling を `evidence_ref_audit` へ自動転記するため、報告の握り潰しも構造的に起きない。

```bash
python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/validate-evidence-refs.py" \
  --repo-root "$DEV_GRAPH_ROOT" \
  --progress "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-progress.json"
# exit 2 (本 run 登録分に dangling) なら周回を fail 扱いにし、当該 node を修正して再登録するまで完了しない。

python3 "${CLAUDE_PLUGIN_ROOT:-plugins/dev-graph}/scripts/validate-source-digest.py" \
  --repo-root "$DEV_GRAPH_ROOT" \
  --progress "$DEV_GRAPH_ROOT/eval-log/run-dev-graph-system-spec-progress.json"
# exit 2 (source_digest が自 source_path の実 sha256 と不一致=他 file 流用) なら周回を fail 扱いにし、
# 各 node の source_digest を自 source_path から計算し直して再登録するまで完了しない。
```

## Criteria acceptance

- `criteria:IN1`: system-spec-harnessのcoverage/source citation gateとdev-graph schema gateが全てexit0である。
- `criteria:OUT1`: 確定成果物をsource lineage付きで引用し、同等のelicitation/compileロジックは複製0件、登録はC02経由だけにする。

## Gotchas

- system-spec-harness 不在や version/entry-point 不一致時に、簡易 fallback を dev-graph 内へ実装しない。
- plugin source 側や別 repo の `system-spec/` を読まず、C24 receipt の caller repo だけを content authority にする。
- evaluator PASS と confirmed の両方が揃わない章を C02 へ登録しない。
- completeness evaluator の fork が completed になる前に R3 へ進まない。fork の停止・失敗時に outer session が `completeness-report.json` を Write/Edit して PASS を代筆しない。
- live trial の完了境界は `validate-system-spec-evaluator-completion.py` の経路別 transcript 検査で閉じる。build は Skill 起動結果の完全 `agentId` と一致する native completion、resume は current receipt と deterministic runner report/stdout の一致を authority にする。resume で evaluator fork を要求したり direct upsert を許可したりしない。Write/Edit の代筆判定は実 target path だけを検査し、status evidence 本文に report path が現れるだけでは違反にしない。
- feature に仕様本文を複製せず、`architecture_refs` と source lineage で参照する。
- node body の source-derived verbatim import と、elicitation/compile 実行ロジックの複製を混同しない。前者は R3 の必須出力、後者だけが OUT1 の禁止対象である。
