---
name: run-skill-feedback
description: 既存スキルへの「こう直してほしい」要望を収集して Notion 改善要望 DB にプッシュしたいとき、利用者発端のフィードバックループを起動したいときに使う。
triggers:
  - "スキルや機能を改善したいとき"
  - "プラグイン・スキルへの要望や不満があるとき"
disable-model-invocation: true
user-invocable: true
argument-hint: "[plugin?] [skill-name?]"
arguments: [plugin, skill_name]
arguments-optional: [plugin, skill_name]
allowed-tools:
  - Read
  - Bash(python3 *)
  - Bash(security *)
  - Agent
  - Grep
  - Glob
kind: run
prefix: run
effect: external-mutation
owner: team-platform
since: 2026-05-25
version: 0.1.0
combinators:
  - with-goal-seek
  - with-feedback-contract
goal_seek:
  engine: inline
  spec: eval-log/goal-spec.json
  progress: eval-log/run-skill-feedback-progress.json
  intermediate: eval-log/run-skill-feedback-intermediate.jsonl
  max_loops: 5
  fork: subagent
reference_refs:
  - plugins/harness-creator/skills/run-build-skill/references/goal-seek-paradigm.md
schema_refs:
  # behavior closure の解決は「plugins/ 始まりのみ repo root、他は skill dir 相対」。
  # repo root 直下の doc/ は相対で辿る (本 skill は各 plugin へ symlink 配備されるが
  # closure 計算前に実体パスへ resolve されるため、この相対は常に harness-creator 起点)。
  - ../../../../doc/notion-schema/skill-list.schema.json
  - ../../../../doc/notion-schema/improvement-request.schema.json
  - plugins/harness-creator/skills/run-build-skill/schemas/goal-seek-loop.schema.json
responsibility_refs:
  # 本 skill は scripts/ を持たず repo root の scripts/ を正本とする (symlink 配備のため)
  - ../../../../scripts/notion-submit-improvement.py
  - ../../../../scripts/lint-feedback-protocol.py
  - workflow-manifest.json
script_refs:
  - ../../../../scripts/notion-submit-improvement.py
  - plugins/harness-creator/scripts/notion_config.py
  - ../../../../scripts/lint-feedback-protocol.py
source: doc/ClaudeCodeスキルの設計書/
source-tier: internal
last-audited: 2026-05-25
audit-trigger: on-change
manifest: workflow-manifest.json
completeness_exempt:
  - "prompts: 対話手順は doc/notion-schema/skill-list.schema.json#feedback_protocol 正本 (Notion §7 と同一) から本文に展開している (初見実行の自己完結性のため)。整合は scripts/lint-feedback-protocol.py で protocol hash・同定フロー・対話項目・発火条件を検証。prompt-creator の R-id 単位 7 層プロンプトは適用外 (二重定義禁止 [[project_ssot_dedup_mechanism]])。"
feedback_contract: # per-skill 評価基準(SSOT=scripts/feedback_contract_ssot.py)。content-review verdict の criteria_evaluated と突合
  max_iterations: 3
  criteria:
    - id: IN1
      loop_scope: inner
      text: 発火条件と同定フローと対話項目が skill-list.schema.json の feedback_protocol を唯一の正本として派生し lint-feedback-protocol が SKILL.md と派生物の整合を exit0 で通過する
      verify_by: lint
    - id: IN2
      loop_scope: inner
      text: token と DB ID は notion_config の require_or_skip / get_db_id 経由でのみ解決され、解決順は Key Rules 4 の単一正本に従い Claude の応答や log や context に一切露出しない
      verify_by: lint
    - id: IN3
      loop_scope: inner
      text: 対象プラグインがスキル一覧 DB 未登録の場合は notion-submit-improvement.py が投入前に find_plugin_page で検出し exit 2 で中断するため孤児レコードが生成されない
      verify_by: script
    - id: OUT1
      loop_scope: outer
      text: 目的逆算の同定フローが省略されず利用者がプラグイン名やスキル名を知らない前提で目的ヒアリングと現状仕様提示を経て対象スキルが正しく同定され文脈ズレ要望を防ぐ設計になっている
      verify_by: elegant-review
    - id: OUT2
      loop_scope: outer
      text: 利用者発端のフィードバックループが摩擦最小で起動でき収集した構造化要望が improvement-request schema 準拠で時系列ログ性質(重複除去を AI 判定しない)を保つ妥当な対話設計である
      verify_by: evaluator
---

# run-skill-feedback

> **配布注記**: 本 skill の `script_refs` / `schema_refs` は repo-root 配置 (`scripts/`, `doc/notion-schema/`) に依存する。distribution: repo-bundled 前提 (単独配布非対応)。

## Purpose & Output Contract

利用者が既存スキルに対して「こう直してほしい」と感じた瞬間に発火し、構造化フィードバックを Notion 改善要望 DB へ N:1 relation 付きでプッシュする。スキル一覧の `未対応要望数` rollup が自動更新され、優先度判断シグナルになる。

**責務境界**: 本 skill の責務は「要望の**収集**と優先度シグナル化」まで。収集した要望を実際の改善 (plugin-dev-planner の改善計画 → harness 再構築) へ繋ぐのは**人間ブリッジ** (`plugins/harness-creator/references/feedback-to-improvement-runbook.md` Stage 2-3)。本 skill も `未対応要望数` rollup も改善着手を自動発火しない (fail-open 回避のため Notion は機械 SSOT にしない設計)。

**前提**: 利用者はプラグイン名・スキル名を知らない。「何をしようとしていたか」という目的から逆算して対象を同定してから要望を収集する。

## 発火条件 (SSOT)

発火条件・対話項目・状態遷移は `doc/notion-schema/skill-list.schema.json` の `feedback_protocol` を唯一の正本 (SSOT) とする。本 SKILL.md / `scripts/notion-upsert-plugin.py` / Notion スキル一覧ページ本文 §7 の三者は全てこの正本から派生する。`scripts/lint-feedback-protocol.py` は protocol 全体の hash・同定手順・fallback・対話項目・発火条件を機械検証し、正本変更時の派生物の更新漏れを停止する。

<!-- feedback_protocol_sha256: aca90c807796ddee7d71a56436281586516cfa65501438606bd89f95f5730d0d -->
<!-- required_intake_fields: 要望タイトル|要望種別|やってほしいこと -->
<!-- optional_intake_fields: 対象スキル名|背景・困っていること|優先度|重要度|関連 PR/コミット URL -->

具体的な発火条件 (schema `feedback_protocol.firing_conditions` 抜粋):
- プラグインを使って「ここが分かりにくい」と感じた
- 「こう直してほしい」「この挙動はバグでは」と思った
- プロンプト出力品質に不満 / ドキュメントの誤記を見つけた
- 新機能・挙動変更の要望が浮かんだ

発火条件の追加・変更は **schema を編集 → lint 通過 → 派生物 (triggers / SKILL.md / 本文) を同期** の順で行うこと。

**入力**:
- `plugin` (任意): 対象プラグイン名。省略時は identification_step で目的から逆算して同定する
- `skill_name` (任意): プラグイン内の個別スキル名。省略時も identification_step で同定する

**出力**: Notion 改善要望 DB の新規ページ 1 件 (URL を返す)

**冪等性**: 改善要望はタイトルが重複しても別レコードとして扱う(時系列ログとしての性質)。重複除去は人手で実施。

## Key Rules

1. **SSOT 厳守**: 発火条件・同定フロー・対話項目は `doc/notion-schema/skill-list.schema.json` の `feedback_protocol` を唯一の正本とし、本 SKILL.md / スクリプト / Notion 本文の三者は派生のみ。
2. **目的逆算同定を必ず先行させる**: `plugin` 引数があっても identification_step を省略しない。目的確認と現状仕様の提示を経てから要望収集へ進むこと (孤児・文脈ズレ防止)。
3. **対象プラグイン存在確認必須**: スキル一覧 DB に未登録なら `python3 scripts/notion-upsert-plugin.py --plugin <plugin>` を案内して中断 (孤児レコード防止)。
4. **設定/認証の解決順 (SSOT)**: `plugins/harness-creator/scripts/notion_config.py` が一元管理する。設定ファイルは `NOTION_CONFIG_PATH` > repo-root `.notion-config.json` > plugin-root `.notion-config.json` > plugin-root `notion-config.fixed.json`、DB ID はキー別 env > 選択済み設定、token は `INTAKE_ALLOW_ENV_TOKEN=1` 時の `NOTION_TOKEN` > Keychain (それ以外は Keychain のみ) の順。他の節で順序を再定義せず、`require_or_skip()` / `get_db_id()` を経由し、token / DB ID をコンテキストに乗せない。
5. **重複除去は人手**: 時系列ログ性質を保つため AI は重複判定せず投入する。
6. **people 型は UI で人手追加**: API 経由でメール宛指定不可のため起票者/担当者は完了通知時に案内。

## ゴールシーク実行

固定手順は書かず、ゴール+チェックリストへ向け都度手順を生成・反復する。正本: `../run-build-skill/references/goal-seek-paradigm.md`。

### ゴール (Goal)

利用者の「こう直してほしい」要望が、`doc/notion-schema/improvement-request.schema.json` 準拠の構造化フィードバックとして Notion 改善要望 DB にプッシュされ、スキル一覧 DB の `未対応要望数` rollup が更新され、起票完了通知 (ページ URL + 人手追加項目案内) がユーザーに返された状態になっている。

### 目的・背景 (Why)

利用者発端のフィードバックループを摩擦最小で起動するため。要望は時系列ログとして 1:N で集約し、優先度判断シグナル (`未対応要望数` rollup) に直結させる。固定手順では「対象プラグイン未登録」「token 未設定」などの実行時文脈に脆いため、未達条件を局面カタログから都度埋める。

### 完了チェックリスト (Checklist)

- [ ] 「どんな作業をしていたか」をユーザーに聞き、目的から対象プラグイン・スキルを同定済み
- [ ] 同定したスキルの SKILL.md を Read し、現状仕様をユーザーに提示して文脈確認済み
- [ ] `feedback_protocol` の必須項目 (要望タイトル / 要望種別 / やってほしいこと) が収集済み。任意項目は利用者が示した値だけ保持し、未指定の優先度・重要度は中を使用
- [ ] 対象プラグインがスキル一覧 DB に登録済み (未登録なら投入スクリプトが POST 前に exit 2 で中断)
- [ ] Notion 改善要望 DB に 1 ページが新規作成され URL が取得できている
- [ ] スキル一覧 DB との N:1 relation が貼られ `未対応要望数` rollup が増分している
- [ ] 完了通知に「起票者・担当者は Notion UI で人手追加」案内が含まれている
- [ ] token / DB ID は Key Rules 4 の正本解決経路 (`notion_config.require_or_skip()` / `get_db_id()`) で取得し、context に露出していない

### ゴールシークループ

正本 6 ステップ (現状評価→手順生成→実行→検証→Anchor Step→反復) に従う。Anchor Step では各周回末に中間成果物スナップショットを eval-log に記録し、`original_goal` からのドリフトを検知する。本スキル固有差分: schema 準拠の対話はゴール推定の追加質問ではなく、収集自体に必要なユーザー入力として `feedback_protocol` どおり実行する。未達評価の単位はチェックリスト項目。投入失敗 (404/401/schema 違反) 時は原因を `feedback_protocol` SSOT に照らして特定し再実行。下記局面は順序固定ではなく未達条件から都度選ぶ。

### ゴールシーク配線

- **engine**: `inline` を明示し、本 Skill 内の AI 推論で未達項目をまとめて消費する。`task-graph` の 1 周回 1 item 制約は適用しないため、8項目の checklist と `max_loops: 5` は両立する。
- **goal-spec**: `eval-log/goal-spec.json` があれば読み、無ければ直近依頼と確定済み対話から `goal` を推定する。
- **周回状態**: `eval-log/run-skill-feedback-progress.json` に `iteration` / checklist の `{id,text,status}` / `open_issues` / `status` / `original_goal_hash` を記録する。
- **中間成果物**: 各周回末に `eval-log/run-skill-feedback-intermediate.jsonl` へ `iteration` / `original_goal` / `current_goal_snapshot` / `delta_from_original` / `merged_directive_for_next` / `drift_signal` を append し、次周回は直前の `original_goal` と `merged_directive_for_next` を必ず読む。
- **コンテキスト分離**: 親は schema で必要なユーザー対話を取り次ぎ、ゴールシークループ本体は常に `Agent` で SubAgent へ fork する。本 Skill は後続 Capability を自動起動しない終端の収集処理なので、親には最終 Notion URL とチェックリスト要約だけを返し、下流 handoff ファイルは生成しない。
- **打ち切り**: `goal_seek.max_loops` 到達でも未達なら残項目を `open_issues` に記録し、human review へ差し戻す。
- **ドリフト検知**: 各周回末に `required_keys = {"iteration","original_goal","current_goal_snapshot","delta_from_original","merged_directive_for_next","drift_signal"}` を検査し、`hashlib.sha256` で `original_goal` を再計算して progress の `original_goal_hash` と比較する。不一致なら `anchor_mutation` を `open_issues` に記録し停止する。

## 局面カタログ (順序は都度判断)

### 対象スキルの同定 (目的ヒアリング)

ユーザーはプラグイン名・スキル名を知らない前提で、以下の順で進める。

**Step 1 — 目的を聞く**

まず自由形式で一言聞く:

> 「どんな作業をしているときに、どんなことを感じましたか？」
>
> （例: 契約書を作ろうとしたら途中で止まった / スキルを作ろうとしたら出力がおかしかった）

**Step 2 — 全スキルを収集してマッチング**

`Glob` で `plugins/*/skills/*/SKILL.md` を列挙し、各ファイルの frontmatter から `name` と `description` だけを `Read` して候補一覧を作る。

ユーザーの回答のキーワード（動詞・対象物・症状）とスキルの description を照合し、候補を 1〜3 件に絞る。

**Step 3 — 候補を提示して確認**

候補が 1 件の場合:
> 「○○（〜〜するためのスキル）のことでしょうか？」

候補が複数の場合:
> 「以下のどれに当てはまりますか？
> 1. ○○ — 〜〜するためのスキル
> 2. △△ — 〜〜するためのスキル」

確定したら `plugin` と `skill_name` を内部で設定する。絞れない場合は全スキル一覧を要約して選ばせる。対象プラグインを確定できなければ投入を中断し、Step 1 の追加ヒアリングへ戻る。

**Step 4 — 対象スキルの現状仕様を提示**

`Read` で `plugins/<plugin>/skills/<skill_name>/SKILL.md` を開く。

Purpose & Output Contract を 2〜3 行に要約してユーザーへ提示:

> 「現在の仕様: 〜〜するためのスキルです。この仕様についての要望ですか？」

ユーザーが「違う」と言ったら Step 1 に戻る。

### 要望収集 (対話)

同定完了後、schema の **対象スキル名** は identification_step の確定値から自動設定する。利用者が既に示した値は聞き直さず、以下の未充足項目だけを収集して構造化する:

1. **要望タイトル** (30字目安、何を直したいかを1行で)
2. **要望種別**: `バグ` / `機能追加` / `プロンプト改善` / `ドキュメント` / `挙動変更` の中から1つ
3. **やってほしいこと**: "こう直してほしい" を一段落で — 現状仕様と対比させて聞くと明確になる
4. **背景・困っていること** (任意): なぜそれが必要か
5. **優先度** (任意): `高` / `中` / `低` (未指定は中)
6. **重要度** (任意): `高` / `中` / `低` (未指定は中)
7. **関連 PR/コミット URL** (任意)

### 投入内容の事前確認 (--dry-run)

```bash
# 送信せず、組み立てた投入内容だけを表示して確認する
python3 scripts/notion-submit-improvement.py --plugin <plugin> --dry-run \
  --title "<title>" --type <type> --desire "<desire>"
```

`--dry-run` は Notion へ一切アクセスせず引数を印字して終了する。**スキル一覧 DB の登録有無は確認しない**
(存在確認は投入時に行われる。下記「孤児レコードの防止」を参照)。

### 孤児レコードの防止

対象プラグインの存在確認は投入時に `find_plugin_page` が行い、スキル一覧 DB に未登録なら
要望を作成せず exit 2 で中断する (fail-closed)。中断メッセージが出た場合は
`python3 scripts/notion-upsert-plugin.py --plugin <plugin>` を先に実行する旨を案内する。

### 改善要望投入

```bash
python3 scripts/notion-submit-improvement.py \
  --plugin "<plugin>" --skill-name "<skill_name>" \
  --title "<title>" --type "<type>" \
  --desire "<desire>" --background "<background>" \
  --priority "<priority>" --importance "<importance>" \
  --pr-url "<pr-url>"
```

token / DB ID は Key Rules 4 の正本解決経路に従い `notion-submit-improvement.py` 内で自動解決する。解決できなければ fail-closed で exit 2 とし、利用者へ理由を通知する。

### 完了通知

投入された Notion ページ URL を提示し、起票者・担当者プロパティは Notion UI 側で人手追加するよう案内 (people 型は API 経由でメール宛指定不可のため)。

## Gotchas

1. **identification_step を省略しない**: `plugin` 引数が渡されていても、目的確認と現状仕様提示を必ず実施する。省略すると「文脈ズレのフィードバック」や「誤ったスキルへの紐付け」が発生する。
2. **孤児レコード禁止**: 対象プラグインがスキル一覧 DB 未登録のまま要望だけ投入しない。これは投入時の `find_plugin_page` → exit 2 で機械的に担保される (`--dry-run` は Notion を見ないので存在確認にはならない)。
3. **token / DB ID を context に乗せない**: Key Rules 4 の正本解決経路を再定義せず、`notion_config.require_or_skip()` / `get_db_id()` で取得して Claude の応答や log に出力しない。
4. **重複除去を AI 判定しない**: 似た要望でも別レコードとして投入する (時系列ログ性質を破壊しない)。
5. **people 型を API で埋めない**: 起票者・担当者は UI 側案内のみ。API でメール宛指定はサポート外。
6. **発火条件・同定フロー追加は schema 経由**: `feedback_protocol` 直接編集 → lint 通過 → 派生物同期の順。SKILL.md / triggers の先行編集禁止。
7. **rollup 更新は Notion 側非同期**: 完了通知時に「rollup は数秒〜数分遅延あり」と添える。

## Additional Resources

- 上流: 利用者の口頭・Slack・PR コメントなど任意の発火源
- 下流 (人間ブリッジ): スキル一覧 DB の `未対応要望数` rollup は**人間の優先度判断シグナル**。着手要望を改善計画へ橋渡しする手順は `plugins/harness-creator/references/feedback-to-improvement-runbook.md` (E3 人間ブリッジ = Stage 2→3→6)。**本 skill / rollup は改善着手を自動発火せず、`/skill-improve` も Notion / rollup を読まない** (機械の自動 read-back は goal-spec 制約6 で意図的に回避)。
- スキーマ正本: `doc/notion-schema/improvement-request.schema.json`
- 物理スクリプト: `scripts/notion-submit-improvement.py`
- 設定ローダー: `plugins/harness-creator/scripts/notion_config.py`（token/DB ID 解決 SSOT）
- 1:1 で生成元を辿りたい場合は `紐づくヒアリングシート` → `Skillヒアリングシート` DB
