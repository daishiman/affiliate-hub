---
name: run-docs-sync
description: Claude CodeやCodexで作成したMarkdownをHarness Hub Docsへ同期するとき、外部repositoryの文書をtenant下書きへ反映する場合に使う。
triggers:
  - "Claude CodeやCodexで作成したMarkdownをHarness Hubへ反映したいとき"
  - "外部repositoryのドキュメントをDocs CMSへ同期したいとき"
disable-model-invocation: false
user-invocable: true
argument-hint: "--file <path> --repository-id <owner/repo> --hub-url <https-url> --tenant-slug <slug> --origin <origin> [--title <title>] [--source <slug>] [--root <dir>] [--force true]"
arguments: [file, repository-id, hub-url, tenant-slug, origin, title, source, root, force]
allowed-tools:
  - Bash(bash *)
kind: run
prefix: run
effect: external-mutation
owner: harness maintainers
since: 2026-08-12
version: 0.1.0
source: docs/features/feat-docs-cms/runbook.md
combinators:
  - with-feedback-contract
script_refs:
  - scripts/run-docs-sync.sh
responsibility_refs:
  - scripts/run-docs-sync.sh
  - ../../../../apps/publisher/src/cli/docs-command.ts
schema_refs:
  - ../../../../packages/schemas/docs-cms/contracts.ts
  - ../../../../packages/schemas/publisher-plugin/credential-record.ts
completeness_exempt:
  - "manifest: 単一scriptがPublisher CLIへ引数と終了codeをそのまま委譲する1段階runで、分岐phaseを持たない。"
feedback_contract:
  max_iterations: 3
  criteria:
    - id: IN1
      loop_scope: inner
      text: "外部repositoryのcwdからplugin実体pathを基準に薄いlauncherを起動でき、引数と終了codeをPublisher CLIへそのまま委譲する。"
      verify_by: test
    - id: IN2
      loop_scope: inner
      text: "CLIを解決できない場合や必須引数・入力fileが欠ける場合は、近似実行や成功偽装をせず非0で停止する。"
      verify_by: test
    - id: OUT1
      loop_scope: outer
      text: "Claude CodeまたはCodexから、固定API keyを渡さず最小権限のDevice Flowでtenant draftへ冪等かつ競合安全にMarkdownを同期できる。"
      verify_by: elegant-review
    - id: OUT2
      loop_scope: outer
      text: "Skill・command・Publisher CLI・Docs APIの責務が一方向で、認証・保存・同期処理の二重実装や配置依存がない。"
      verify_by: evaluator
---

# run-docs-sync

## Purpose & Output Contract

- **目的**: 外部repositoryで作成したMarkdownを、最小権限のDevice FlowでHarness Hubのtenant下書きへ同期する。
- **入力**: Markdown file、repository ID、Hub URL、tenant slug、許可originと任意のtitle/source/root/force。
- **出力**: Publisher CLIが返すdocument ID、同期結果（created/updated/unchanged）、revision。終了codeを加工しない。
- **完了条件**: 薄いlauncherからCLIへ到達し、同期成功を報告するか、入力・認証・競合・CLI解決失敗を非0で明示する。
- **境界**: Skillは認証、API呼出、同期キー、競合判定を実装せず、Publisher CLIだけをownerとする。

## 実行

pluginのinstall先を基準にした `skills/run-docs-sync/scripts/run-docs-sync.sh` へ、
受け取った引数を配列のまま渡します。scriptはPATH上の
`harness-publisher docs`、または`HARNESS_HUB_PUBLISHER_BIN`で明示されたHarnessHub checkoutのbinを
起動するだけで、Device Flow・API・競合判定を再実装しません。

```bash
bash "$CLAUDE_PLUGIN_ROOT/skills/run-docs-sync/scripts/run-docs-sync.sh" \
  --file <path> --repository-id <owner/repo> \
  --hub-url <https-url> --tenant-slug <slug> --origin <origin> [その他option]
```

Claude Codeでは`CLAUDE_PLUGIN_ROOT`がinstall済みpluginの絶対pathを指します。Codexでは選択した
Skillの実体directoryから`./scripts/run-docs-sync.sh`を絶対pathへ解決して実行します。利用者の
repositoryや現在directoryをplugin資産の探索起点にはしません。

Publisher CLIを解決できない場合は非0で停止します。`--force true`はHub側編集を確認して外部版へ戻す場合だけ
使用し、公開済み文書は確認用draftへ戻ることを利用者へ事前に伝えます。

## Gotchas

- `--force true`はHub側の編集を上書きし、公開済み文書も確認用draftへ戻すため、差分確認後だけ使います。
- 相対画像pathは本文に残りますが、v1は画像fileを送信しません。画像同期・common化・自動公開は対象外です。
- `HARNESS_HUB_PUBLISHER_BIN`には信頼するHarnessHub checkoutの絶対pathだけを設定します。
