# live-trial task 契約 lint ルール

正本契約: `issues/sys-c19-live-trial-task-fixture-contract-drift-20260726.md`
(`HarnessHub-768b`)。

## 背景

live-trial の `task.md` は template の placeholder を埋めて作る。scenario 固有の入力前提が
template に無かったため、過去の成功 task を複製した結果、fixture は brief 1 file だけなのに
「確定成果物は事前配置済み・正規フロー再実行禁止」とする矛盾が C19 で発生した。

lint は次の3正本を同じ経路で突合する。

1. fixture 形状: `tests/fixtures/live_trial_shapes/shape_*.py` の `TASK_CONTRACT`
2. scenario: `tests/fixtures/live-trial-positive-scenarios.json`
3. task 指示: `eval-log/<plugin>/<skill>/live-trial/<run-id>/task.md`

## 二層検査

- 層A: premise block の `contract-digest` を fixture と scenario から再導出して一致を強制する。
- 層B: marker のない既存 task も args、entry point、旧前提、観測条件を自然文から検査する。

## Rule ID

| Rule | 意味 |
| --- | --- |
| LT-001 | scenario が task に無い |
| LT-002 | scenario が正本に無い |
| LT-003 | fixture 配置入力への言及が無い |
| LT-004 | fixture 非配置成果物を事前配置済みと主張する |
| LT-005 | 正規フロー再実行を禁じる旧前提がある |
| LT-006 | Skill args が template と違う |
| LT-007 | required entry point の記載が無い |
| LT-008 | entry point を Skill 経由で呼ぶ要求が無い |
| LT-009 | required observation の被覆が無い |
| LT-010 | observation keyword と observation の件数が違う |
| LT-011 | premise digest が正本と違う |
| LT-012 | task contract の required fragment が無い |
| LT-013 | task contract の forbidden fragment がある |
| LT-014 | `--all` の採用 run に task が無い |

## Exit code

- `0`: 違反なし
- `1`: 正本欠落などで検査不能
- `2`: 契約違反を検出（fail-closed）
