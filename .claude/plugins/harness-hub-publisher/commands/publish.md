---
name: publish
description: skills-package を Harness Hub へ publish する。ローカル pre-check → Device Flow 認証 → Hub 検査 → (web_app のみ) wrangler デプロイまでを一括実行したいときに使う。
kind: command
version: 0.1.0
owner: harness maintainers
source: plugins/harness-hub-publisher/commands/publish.md
argument-hint: "--package-dir <dir> --hub-url <url> --tenant-slug <slug> --project-id <id> --target <skill|web_app> --visibility <private|workspace> --origin <origin> [--wrangler-config <path>]"
allowed-tools: [Skill]
disable-model-invocation: false
---

# /publish

skills-package を Harness Hub へ publish します。本 command 自体は業務ロジックを持たず、
Skill `run-publisher-publish` を呼び出すだけです。実処理は全て `apps/publisher`
(`@harness-hub/publisher` の CLI) が行います — package 収集・manifest 補完・
ローカル pre-check・OAuth Device Authorization Flow (RFC 8628) による認証・Hub への
アップロード/検査依頼・(target=web_app の場合のみ) wrangler CLI 経由の Cloudflare デプロイの
順に進みます。

## 使い方

```
/publish --package-dir ./my-skill --hub-url https://hub.example.com --tenant-slug acme --project-id proj_123 --target skill --visibility workspace --origin https://cli.harness-hub.example.com
```

引数はそのまま `run-publisher-publish` Skill (→ `apps/publisher` CLI の `publish` サブコマンド) へ渡されます。

- `--package-dir`: publish 対象ディレクトリ
- `--hub-url` / `--tenant-slug` / `--origin`: Hub 接続情報 (`--origin` は CSRF 対策の許可済み Origin)
- `--project-id` / `--target` / `--visibility`: 公開先プロジェクトと公開種別
- `--wrangler-config`: `--target web_app` のときのみ必須 (wrangler 設定ファイルへのパス)

初回実行時はブラウザで認可 URL が開き、承認後に自動的にポーリングが完了します。
2 回目以降は保存済みの refresh token (OS 資格情報域) から自動的に再認証します。
