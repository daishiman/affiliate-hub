---
date: 2026-07-22
trigger_event: PostToolUse
tool: Skill
severity: medium
capability: skill-invoke
---

## observation

| REG-001 | high | `scripts/validate-build-trace.py` が exit 2。`system-spec-harness` に `build-evidence/*/build-trace.json` が無くゲートを実行できない。fail-closed で未達扱い。ただし**系全体の問題**で、22 plugin 中 build-trace を持つのは `ubm-goal-setting` と `dev-graph` の 2 つだけ 

## hypothesis

(自動記録: 失敗パターンを検出。根本原因は要 human triage)

## proposed_action

- 当該 capability に対する rubric 強化 / validator 追加を検討
- 再現条件を別 issue に起票
