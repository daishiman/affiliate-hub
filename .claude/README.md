# .claude/ — HarnessHub プラグインの取り込み

HarnessHub (`/Users/dm/dev/dev/個人開発/HarnessHub`) の `plugins/` を affiliate-hub に
ベンダリングし、ローカルマーケットプレイス `harness-hub` として Claude Code に登録している。

## 構成

| パス | 役割 |
|---|---|
| `.claude/plugins/<name>/` | プラグイン実体 (18個)。HarnessHub の git 追跡ファイルのみ |
| `.claude/plugins/.sync-state.json` | どの HarnessHub コミットから引いたかの記録 |
| `.claude-plugin/marketplace.json` | マーケットプレイス定義。**手で編集しない**(自動生成) |
| `.claude/settings.json` | マーケットプレイス登録 + プラグイン有効化 |
| `.claude/scripts/sync-plugins.sh` | HarnessHub から再同期する |
| `.claude/scripts/gen-marketplace.py` | 各 `plugin.json` から marketplace.json を再生成 |

`marketplace.json` の `source` は `directory` 型かつ相対パス `./` なので、Claude Code は
プロジェクトルート基準で解決する。`~/.claude/plugins/cache/` へのコピーは発生せず、
**`.claude/plugins/` のファイルがそのまま実体として使われる**。書き換えれば即反映される。

## 更新のしかた

```bash
# HarnessHub 側の最新を全部取り込む
./.claude/scripts/sync-plugins.sh

# 特定のプラグインだけ
./.claude/scripts/sync-plugins.sh dev-graph harness-creator

# 何が変わるか見るだけ
./.claude/scripts/sync-plugins.sh --dry-run

# HarnessHub の場所が違うマシンで
HARNESS_HUB=/path/to/HarnessHub ./.claude/scripts/sync-plugins.sh
```

同期後は Claude Code の再起動 (または `/plugin` からの reload) で反映される。

`.claude/plugins/` 配下を直接いじった状態で同期すると、その変更は上書きで消える。
同期スクリプトは git 追跡済みの変更を検出して既定でスキップし、対話端末なら確認を求める。
上書きしてよいなら `--force`。ローカルの改善を残したいなら、先に HarnessHub 側へ還元する。

## 動作確認済みの内容

```
claude plugin validate .claude-plugin/marketplace.json   # ✔ passed (警告57件は HarnessHub 側 plugin.json の未知フィールド)
claude plugin validate .claude/plugins/<name>            # 23件すべて ✔ passed
claude plugin details dev-graph@harness-hub              # 解決・コンポーネント列挙 OK
```

プロジェクト外のディレクトリからは `harness-hub` は解決されない (プロジェクト限定で正しく閉じている)。

## 有効化しているプラグイン

**18個すべて有効**。常時 ~12.9k トークン。
重い順に harness-creator (35 skills, ~2.8k)、slide-report-generator (~1.7k)、
skill-intake (~1.4k)、extract-system-blueprint (~1.2k)、dev-graph (~1.1k)。
軽い順は skill-governance-* の7個で各 ~90。

コンテキストを削りたくなったら `.claude/settings.json` の `enabledPlugins` を `false` にするか、
`/plugin` から個別に切る。skill 数に比例するので、落とすなら harness-creator の効果が最大。

### 削除した plugin

affiliate-hub では使わないため、以下5個は取り込み対象から外した (HarnessHub 側には残っている)。

`company-master` / `contract-generator` / `mf-kessai-invoice-check` / `notion-gmail-send` / `ubm-goal-setting`

同期スクリプトの `EXCLUDED` に列挙してあり、全同期しても復活しない。明示指定するとエラーで止まる。
戻したくなったら `EXCLUDED` から外して同期する。

`contract-generator` の削除で `harness-creator` の3 skill (`run-template-sync`,
`run-contract-finalize`, `run-contract-generate`) が dangling symlink になった。
実体が contract-generator 側にホストされていたため。同期スクリプトは毎回 dangling symlink を
検出して除去するので、harness-creator は 38 → **35 skills** で安定する。

`depends_on` を持つのは `plugin-dev-planner` と `prompt-creator` (どちらも harness-creator 依存) の2つだけ。
この3つはセットで扱う。各プラグインの `run-skill-feedback` は harness-creator への symlink だが、
ファイルとして実体があるので harness-creator を無効にしても壊れない。

### 有効化後に実測したこと

- 23個すべて有効な状態で Bash ツールを使うセッションを走らせて、
  hook エラーなし・新規ファイル生成なし・git 差分なし (所要 17秒)
- `.dev-graph/config.json` への直書き → `dev-graph` の `guard-graph-schema.py` が PreToolUse でブロック
- `echo japanpost-da-api. --print-unsafe` → `company-master` の `hook-guard-secret.py` がブロック
- 上記2件はどちらもセッション経由での発火。宣言だけでなく実行時に効いていることを確認済み

## 同期対象に含まれないもの

HarnessHub 側で `.gitignore` されている生成物は引かない。とくに
`slide-report-generator/vendor/` の `playwright-browsers` (486MB) と `node_modules` (177MB)。
これらが要る場合は HarnessHub 側で `pnpm install` / `playwright install` して使う。

追跡ファイルのみで 2,382 ファイル / 39MB。
