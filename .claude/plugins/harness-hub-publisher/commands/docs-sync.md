---
name: docs-sync
description: Claude CodeやCodexで作成したMarkdownをHarness Hub Docsのtenant下書きへ安全に同期する。
kind: command
version: 0.1.0
owner: harness maintainers
source: plugins/harness-hub-publisher/commands/docs-sync.md
argument-hint: "--file <path> --repository-id <owner/repo> --hub-url <url> --tenant-slug <slug> --origin <origin> [--title <title>] [--source <slug>] [--root <dir>] [--force true]"
allowed-tools: [Skill]
disable-model-invocation: false
---

# /docs-sync

Marketplaceからinstallした場合の正式名は `/harness-hub-publisher:docs-sync` です。
plugin directoryを直接読み込む開発時は `/docs-sync` と表示される場合があります。

このセッションで作成・更新したMarkdownを、Harness HubのDocsへ反映します。
外部ツールへブラウザCookieや固定APIキーを渡さず、短命なDevice Flow tokenの
`docs:write` scopeだけを使います。

## 実行

1. `$ARGUMENTS` を `argument-hint` にある同名optionとして解析します。必須値が無ければ実行せず確認します。
2. Skill `run-docs-sync`へ、解析した値を同名optionのまま渡します。Skill内の薄いランチャーは
   `harness-publisher docs`を呼ぶだけです。文字列連結や`eval`は使いません。
   Claude Codeでは`$CLAUDE_PLUGIN_ROOT`、Codexでは選択したSkillの実体directoryを基準にscriptを
   絶対pathへ解決し、利用者repositoryのcwdを探索起点にしません。
   CLIがPATHに無い場合は、`HARNESS_HUB_PUBLISHER_BIN` にHarnessHub checkout内の
   `apps/publisher/bin/harness-publisher.mjs` の絶対pathを設定します。解決できなければ同期せず停止します。
3. Device Flowの認可URLを利用者へ示し、同期結果の `id / outcome / revision` を報告します。

`--file`の絶対pathや
利用者名はHubへ送られず、`--repository-id`とrepository相対pathのSHA-256だけが外部IDになります。

- 既存同期文書がHub側で編集されていた場合は安全側に停止します。
- 内容を確認して外部版で上書きするときだけ `--force true` を追加します。公開済み文書は確認用の下書きへ戻ります。
- 同じ内容の再送は重複文書を作らず `unchanged` になります。
- v1はMarkdown本文とタイトルだけです。画像同期、common文書、自動公開は行いません。
