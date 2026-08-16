---
date: 2026-07-22
trigger_event: PostToolUse
tool: Skill
severity: medium
capability: skill-invoke
---

## observation

`assign-system-spec-completeness-evaluator` skill を `--spec-dir system-spec --output system-spec/completeness-report.json` で実行するよう指示を受け、生成済み仕様書セット (`system-spec/*.md`)・`spec-state.json`・`fetched-references.json` を 6 観点で評価し、fail-closed(判定不能や

## hypothesis

(自動記録: 失敗パターンを検出。根本原因は要 human triage)

## proposed_action

- 当該 capability に対する rubric 強化 / validator 追加を検討
- 再現条件を別 issue に起票
