# Live-trial task premise contract

## 目的

`run-dev-graph-system-spec` の live-trial では、fixture（試験用に隔離した小さな
repository）が最初から持つ入力と、被験セッションへ渡す `task.md` の前提を一致させる。
人が過去 run の task を複製しても、古い前提を機械的に検出して fail-closed
（検査できない状態を合格にしない）にする。

正本 issue は
`issues/sys-c19-live-trial-task-fixture-contract-drift-20260726.md`
（Beads: `HarnessHub-768b`）である。

## 中学生向けの説明

理科の実験で「机の上には水だけ置いてある」のに、説明書へ「完成した薬品がもう置いて
ある」と書かれていたら、正しい実験はできない。この lint は、机の上に本当にある物と
説明書の内容を照合する係である。説明書が古ければ実験を始める前に止め、正しい前提文も
同じ契約から作れる。

## 正本と責務

| 正本 | 責務 |
|---|---|
| `live_trial_shapes/shape_system_spec.py` の `TASK_CONTRACT` | 配置入力、未配置成果物、必須 entry point、観測キーワード |
| `live-trial-positive-scenarios.json` | scenario ID、被験 skill、引数 template、fixture contract、必須観測 |
| `task.md` | 被験セッションへ実際に渡した指示 |
| `lint-live-trial-task-contract.py` | CLI、前提節生成、対象列挙、JSON report |
| `lib/live_trial_task_contract.py` | 正本読込、task 解析、契約照合 |

`TASK_CONTRACT.workflow_mode=reuse-confirmed` は、digest-bound PASS bundle を fixture に
置く bounded trial を表す。この mode では entry point は manifest 実在確認だけを行い、
nested Skill 呼出しを要求しない。scenario の `forbidden_invoked_skills`、時間/token 予算、
resume validator の三重ゲートで上流再生成を禁止する。`build` mode は従来どおり未配置
成果物を正規 entry point で生成する。

## 実行方法

最新の verdict 保有 run を検査する。

```bash
python3 plugins/dev-graph/scripts/lint-live-trial-task-contract.py \
  --repo-root . \
  --all
```

個別 task を検査する。

```bash
python3 plugins/dev-graph/scripts/lint-live-trial-task-contract.py \
  --repo-root . \
  --task eval-log/dev-graph/run-dev-graph-system-spec/live-trial/<run-id>/task.md
```

決定論的な前提 block を生成する。

```bash
python3 plugins/dev-graph/scripts/lint-live-trial-task-contract.py \
  --repo-root . \
  --emit-premise \
  --shape system-spec \
  --fixture-path <contained-fixture-repo>
```

終了コードは `0=違反なし`、`2=契約違反`、`1=検査不能` とする。`--all` の検査対象が
0 件になる場合も合格にしない。

## 検査境界

- `LT-001..012` が scenario 不明、配置物の記載漏れ、未配置成果物の事前配置主張、
  旧再実行禁止文、引数・被験 skill・entry point・観測条件・digest・task 実体の
  drift を検出する。
- plugin 修飾名は `run-dev-graph-system-spec` と
  `dev-graph:run-dev-graph-system-spec` の 2 形式だけを同一視する。他 plugin の同名
  skill は許可しない。
- `contract-digest` は fixture path のような run 固有値を含めず、scenario と
  `TASK_CONTRACT` の正規形だけから導出する。
- 過去の証跡は改変せず、marker の無い task も自然文検査で後方互換に確認する。

## 品質ゲート

- `python3 -m pytest -q plugins/dev-graph/tests/test_live_trial_task_contract.py`
- `python3 -m pytest -q plugins/dev-graph/tests`
- `python3 scripts/lint-doc-line-limit.py --repo-root .`
- `python3 scripts/validate-plugin-packages.py --repo-root .`
- `python3 scripts/lint-artifact-placement.py --repo-root .`

## 製品仕様との境界

この契約は dev-graph plugin 内部の live-trial 指示生成・検査だけを変更する。
Hub の API、データモデル、認証、画面、配備、SLO、system-spec-harness の正規 4
entry point 自体は変更しない。このため `system-spec/`、`specs/`、
`architecture/` へ新しい製品仕様を追加せず、仕様影響なしの判断と各層の確認結果は
`docs/features/feat-dev-pipeline-improvement/c19-task-contract-spec-reflection.md`
へ記録する。
