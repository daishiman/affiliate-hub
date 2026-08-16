---
name: run-publisher-publish
description: skills-package を Harness Hub へ publish したいとき、apps/publisher CLI (Device Flow 認証・pre-check・wrangler デプロイ) を実行したいときに使う。
disable-model-invocation: false
user-invocable: true
argument-hint: "--package-dir <dir> --hub-url <url> --tenant-slug <slug> --project-id <id> --target <skill|web_app> --visibility <private|workspace> --origin <origin> [--wrangler-config <path>]"
arguments: [package-dir, hub-url, tenant-slug, project-id, target, visibility, origin, wrangler-config]
allowed-tools:
  - Bash(bash *)
kind: run
prefix: run
effect: external-mutation
owner: harness maintainers
since: 2026-08-02
version: 0.1.0
source: docs/features/feat-publisher-plugin/design-review-notes.md
combinators:
  - with-feedback-contract
responsibility_refs:
  - scripts/run-publisher-publish.sh
  - ../../../../apps/publisher/src/cli/publish-command.ts
schema_refs:
  - ../../../../packages/schemas/publisher-plugin/index.ts
completeness_exempt:
  - "manifest: 単一scriptがPublisher CLIへ引数と終了codeをそのまま委譲する1段階runで、分岐phaseを持たない。"
script_refs:
  - scripts/run-publisher-publish.sh
feedback_contract:
  max_iterations: 3
  criteria:
    - id: IN1
      loop_scope: inner
      text: "薄い shell wrapper が package 収集・認証・Hub API・Wrangler の業務ロジックを再実装せず、apps/publisher/bin/harness-publisher.mjs の publish サブコマンドへ引数と終了コードをそのまま委譲する。pt5-plugin-surface-structure.test.ts と plugin-package-check が通る"
      verify_by: test
    - id: IN2
      loop_scope: inner
      text: "必要な引数と web_app 時の wrangler-config 要件が command・Skill・CLI の間で一致し、不足時は近似実行せず CLI が非0で停止する。validate-frontmatter.py と CLI の unit test が通る"
      verify_by: lint
    - id: OUT1
      loop_scope: outer
      text: "利用者が publish の副作用、Device Flow の人手認可、OS 資格情報域、実サービス E2E が未完であることを誤解せず、command→Skill→CLI の一方向責務境界を追跡できる"
      verify_by: elegant-review
    - id: OUT2
      loop_scope: outer
      text: "配布 plugin と apps/publisher の接続が二重実装や秘密情報の平文保存を導入せず、pre-check と Hub 検査を同じ packages/inspection owner に委譲している"
      verify_by: evaluator
---

# run-publisher-publish

## Purpose & Output Contract

- **目的**: skills-packageまたはweb appを、共通Publisher CLIの検査・認証・公開経路でHarness Hubへpublishする。
- **入力**: package directory、Hub/tenant/project、target、visibility、originとweb app時のWrangler設定。
- **出力**: Publisher CLIの公開結果と終了code。Skill側で成功扱いや応答変換を追加しない。
- **完了条件**: CLIのpublish subcommandへ全引数を一度だけ渡し、成功または具体的な非0エラーを返す。
- **境界**: package収集、Device Flow、Hub API、pre-check、Wrangler処理はPublisher CLIだけをownerとする。

`apps/publisher` (`@harness-hub/publisher`) の CLI を実行し、skills-package を Harness Hub へ
publish します。本 skill は `scripts/run-publisher-publish.sh` を呼ぶだけの薄いラッパーで、
package 収集・manifest 補完・pre-check・Device Flow 認証・wrangler 実行のいずれの業務ロジックも
ここには実装しません (AD-1: 実装の唯一の owner は `apps/publisher/src/`)。

## 実行

```bash
bash "$CLAUDE_PLUGIN_ROOT/skills/run-publisher-publish/scripts/run-publisher-publish.sh" \
  --package-dir <dir> --hub-url <url> --tenant-slug <slug> \
  --project-id <id> --target <skill|web_app> --visibility <private|workspace> --origin <origin> \
  [--wrangler-config <path>]
```

引数は全てそのまま `apps/publisher` の CLI (`publish` サブコマンド) へ渡されます。
終了コードも CLI の戻り値をそのまま返します (0: 成功、非 0: 失敗)。

Claude Codeでは`CLAUDE_PLUGIN_ROOT`、Codexでは選択したSkillの実体directoryを基準にscriptを絶対pathへ
解決します。scriptは`HARNESS_HUB_PUBLISHER_BIN`で指定したcheckoutのbin、PATH上の`harness-publisher`、
monorepo内のlocal binをこの順で解決し、見つからなければ非0で停止します。

## 前提

- HarnessHub checkout内のbinを使う場合はリポジトリ直下で `pnpm install` 済みであること (`apps/publisher` は `node_modules` の
  workspace link 経由で `@harness-hub/schemas` / `@harness-hub/inspection` を解決する)
- `--target web_app` を指定する場合は `--wrangler-config` が必須 (未指定だと CLI がエラーで停止する)

## Gotchas

- publishは外部変更を伴います。対象project・visibility・package directoryを実行前に確認します。
- `--target web_app`ではWranglerによるCloudflare配備も実行され、Device Flowのブラウザ承認が必要です。
- CLI解決失敗を別実装へfallbackしません。`HARNESS_HUB_PUBLISHER_BIN`には信頼するcheckoutの絶対pathだけを設定します。
