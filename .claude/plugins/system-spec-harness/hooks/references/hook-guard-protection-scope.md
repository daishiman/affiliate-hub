# guard-confirmed-chapter-overwrite: 保護スコープの設計と境界定義

> `guard-confirmed-chapter-overwrite.py` (PreToolUse: Write|Edit|Bash) が **何を守り・何を守らないか** の正本。
> hook 本体のコメント (「境界定義: references/hook-guard-protection-scope.md」) と回帰テストが本書を参照する。

> **同 plugin の姉妹 hook**: `record-audit-fork.py` (PostToolUse: `Task|Agent`、matching tool call ごとに 1 回) は保護 hook ではなく **証跡 writer**。
> 監査 sub-agent への fork を append-only 台帳へ記録し、completeness-report の auditor 帰属を自己申告から
> 切り離す。責務・限界は § 6 を参照。

## 0. 位置づけ (defense-in-depth)

- 本 hook は要件 C11 の **二重化 (補助防御)**。仕様状態遷移の正本防御は C01 (`apply-spec-transition.py` の単一 transition writer) と C03 (compile) が担う。
- writer は「確定セルの直接変更を拒否・R4-reopen (要 reason) 経由のみ確定を動かす」を機械強制する。hook はその結果 confirmed になった成果物の **事後的な上書き/巻き戻し** を、writer を経由しない直接書換から守る後段の層。
- 従って hook は「唯一のセキュリティ境界」ではない。**表層文字列回避 (adversarial evasion) は設計上許容**し、狙うのは *エージェントによる偶発的上書き* の防止。

## 1. 保護すべき対象 = 「source-of-truth ∧ 非再生成」

| 対象 | 保護 | 根拠 |
|---|---|---|
| 正本 `system-spec/spec-state.json` (確定セルを含む) | ✅ | 状態遷移の SSOT。直接書換は確定巻き戻しの温床 |
| status:confirmed 章 (全対応セル終端・非 reopen) | ✅ | 確定仕様の実体。compile 再生成可能だが確定内容の無断改変を防ぐ |
| 憲法章 `00-requirements-definition.md` (foundation confirmed 時) | ✅ | requirements_foundation (U1-U9) を正本とする確定物。spec_cells を持たないが a5w.2 で保護 |
| 詳細正本 `docs/*-spec.md` (backend/frontend/infrastructure/security-spec.md・実在時) | ✅ Bash のみ | 手動維持・非再生成正本。**Bash 書込 (clobber/glob sweep) を遮断・Edit/Write ツール authoring は許可**。system-spec/ 外だが a5w.1 で保護 |
| 記録・生成物 (`fetched-references.json` / `index.md` / `completeness-report.json` / `completeness-findings.json`) | ❌ EXEMPT | 正規 writer が都度全上書きするのが正常動作。監査経路不要 |
| docs/ の overview 文書 (`screen-inventory.md` 等・非 `-spec.md`) / `docs/features/**` / `docs/mockups/**` | ❌ | 詳細正本でない / feature 成果物。誤爆回避で通す |
| draft 章 / 新規章 / 確定セルなき spec-state | ❌ | 未確定。誤爆回避優先で通す |

判定ソースは `<root>/system-spec/spec-state.json` の 1 経路のみ (rglob 探索なし=fixture 交差汚染を構造排除)。

## 2. 判定原則 (a5w.1 以降): 「参照」ではなく「書込先」で判定する

### 2.1 是正前の欠陥 (branch2/3 の参照↔書込 conflation)

旧実装は「確定物がコマンド文字列に現れる (`refs_spec_state` / `.md` トークン)」ことを書込指標と混同していた。結果、**確定物を read するだけのコマンドが遮断される** 過剰遮断が多発した:

- `wc -l system-spec/*.md > /tmp/x` / `grep -l x system-spec/*.md > /tmp/x` (read + 安全な redirect)
- `rm -rf $SCRATCH && python3 compile.py --spec system-spec/spec-state.json --out-dir $SCRATCH`
  (spec-state は `--spec` の **read arg**、mutation の対象は scratch)
- `cp system-spec/spec-state.json /tmp/backup` (spec-state は cp の **source**)
- validator (`--matrix system-spec/spec-state.json`) を別 segment の mutation と併記した場合

### 2.2 是正 (write-target モデル)

`_write_target_tokens(cmd)` が **実際に書き込む/削除する先だけ** を抽出する:

1. **変数一段解決**: `VAR=value` 代入を集め、`$VAR`/`${VAR}` を書込先トークンで解決する (`F=…/spec-state.json; echo x > $F` は spec-state へ還元して遮断)。
2. **segment 別 mutation 宛先**: `&&`/`;`/`|` で分割し、各 segment のツール別に宛先だけを取る — cp/mv/install/ln は最終 file arg、tee/rm/truncate は対象 file 群、dd は `of=`、sed は `-i` 時のみ対象 file。**source・読取 arg・option は除外**。
3. **redirect 先**: `>`/`>>` の対象 (既存 `_redirect_targets`。`/dev/null`・`2>&1` は除外)。
4. **inline python**: `open('X','w'|'a'|'x')` の X。

遮断は「抽出した書込先が 正本 spec-state / 確定章 のとき」に限る。静的に確定できない書込先 (未解決変数・glob) が **保護領域を指す** 場合のみ安全側で遮断 (`cp /tmp/a system-spec/*.md` 等)。

副産物として、旧 KnownGap の変数分割回避 (`P=sys; Q=tem-spec; echo x > $P$Q/spec-state.json`) は変数解決で `system-spec/spec-state.json` に還元され **FN が解消** した。

## 3. 既知の残存ギャップ (FN・二重化補助ゆえ許容)

- **引数経由 writer**: `python3 apply-spec-transition.py --out system-spec/spec-state.json` は書込指標 (redirect/mutation/inline-open) を持たず素通り。書込は正規 writer 自身なので実害はない。
- **nested-shell + 変数 mutation**: `env -i F=<spec-state> sh -c 'cp x $F'` は mutation が `-c` の引用文字列内にあり segment 先頭 tool 検出が wrapper に阻まれ宛先を抽出できない。現実の偶発上書き経路ではない。
- **inline python の write_text/複雑式**: `open(...,'w')` 以外の書込先は静的抽出できないため、py_write かつ書込先不明かつ保護対象を参照する場合の **保護参照フォールバック** で安全側に倒す (CLI script 起動 `python3 x.py` は `_PY_WRITE` 非該当ゆえ発火せず、compile 等の FP を招かない)。

## 4. 実装済み (a5w.1/a5w.2) と未実装 (follow-up)

**実装済み (a5w.1 残)**:
- **docs/*-spec.md の保護**: `docs/{backend,frontend,infrastructure,security}-spec.md` は手動維持・再生成 writer を持たない詳細正本。**Bash 書込 (redirect/mutation の clobber、docs/ 直下 glob の sweep) を遮断し、Edit/Write ツールでの意図的 authoring は許可**する非対称保護。concrete は実在時のみ保護 (新規作成は妨げない=確定章と一貫)。docs/ 直下でも `-spec.md` でない overview や `docs/features/**` は対象外。

**実装済み (a5w.2)**:
- **MultiEdit 対応**: matcher を `Write|Edit|MultiEdit|Bash` へ拡張 (`hooks/hooks.json` を正本とし `scripts/build-claude-settings.py` で `.claude/settings.json` を再生成)。`decide()` が MultiEdit を Write/Edit と同格に処理する。従来 MultiEdit は matcher 非対象で確定章を素通り改変できた FN を解消。
- **憲法章 (要件定義書) 保護**: `00-requirements-definition.md` (category:requirements-definition・spec_cells 無) は従来「対応セル不明」で通していたが、`requirements_foundation.confirmed=true` のとき確定物として保護する。foundation 未確定 (draft) 時は誤爆回避で通す。

**実装済み (提案1: 明示レジストリ化)**:
- **保護対象レジストリ `_PROTECTION_RULES`**: concrete な書込先に対する保護判定を単一の宣言テーブルへ集約した (id / matcher / scope / reason)。`scope="all"` (spec-state・確定/憲法章) と `scope="bash"` (docs/*-spec.md=Bash のみ・Edit 許可) を宣言で表し、`_match_protection(token, root, bash=…)` が参照する。`bash_decision` の散在した if 判定を置換し、保護対象を 1 箇所で discoverable にした。契約は `TestProtectionRegistry` が固定。
  - 注: Write/Edit/MultiEdit 経路 (`decide()`) は realpath 一致 + 確定セル有無 + frontmatter + F3 fail-closed というより厳密な条件を持つため、レジストリの `scope="all"` 対象を「同等に保護する」形で残置し、完全な単一関数化はしていない (保護対象の宣言は共有・判定精度は経路別)。

**未実装 (follow-up)**:
- **姉妹 hook `plugins/dev-graph/hooks/guard-graph-schema.py` の同種 conflation**: コマンド文字列に `rm ... *.md` 等が現れると (書込対象でなくても) 破壊操作と誤検知する。本 hook で採った write-target モデルの横展開候補。

- **`guard-graph-schema.py` の tool-path 保護 (graph authority への C02 迂回書換)**: 従来 guard は Bash の command 文字列しか見ておらず、Write/Edit ツールや interpreter 本文経由の書換は素通りだった。`.dev-graph/state`・`config.json`・`graph-node.schema.json` を C02 の atomic writer を経由せず直接書換えると、registration receipt を手書きしたうえで python one-liner で digest を後から一致させ C02 を迂回できた (2026-07-21 live-trial r7 で実際に突破)。これを塞ぐため保護次元を 2 つ追加した。(a) matcher を `Bash` から `Bash|Write|Edit|MultiEdit|NotebookEdit` へ拡張し、`FILE_WRITING_TOOLS` の `file_path`/`notebook_path` が graph authority (`GRAPH_AUTHORITY_PATH` = `.dev-graph/state`・`config.json`・`graph-node.schema.json`) を指すなら exit2。(b) Bash 経路でも interpreter 本文の `open(path,'w')` を `INTERPRETER_WRITE` 正規表現で検出し、path が graph authority なら exit2。対象は authority に限定し `templates/`・`cache/`・`tmp/` は init が正当に書くため除外する (広く取ると `cp plugins/dev-graph/templates .dev-graph/templates` まで止まる)。authority 判定は `context_ok()` の subprocess 起動より手前に置き、hook timeout (10s) による fail-open の窓を塞ぐ。契約は `plugins/dev-graph/tests/test_semantic_contract_boundaries_c10_c11_c24.py` 系が固定する。

## 5. 検証

- 回帰テスト `tests/test_guard_confirmed_chapter_overwrite.py` (47 件): MUST_BLOCK / MUST_PASS (2.1 の FP 群を含む) / KNOWN_GAP。
- 実行: `python3 -m unittest discover -s plugins/system-spec-harness/hooks/tests -p "test_*.py"`
- e2e: 実 compile/validator コマンド → exit0、`echo x > spec-state.json` / `sed -i … security.md` → exit2 を確認済み。

## 6. 姉妹 hook `record-audit-fork.py` (PostToolUse: Task|Agent) — per-call 証跡 writer

### 6.1 位置づけ (保護ではなく証跡)

`guard-*` が「書かせない」層なのに対し、本 hook は「**書き残す**」層。何もブロックせず (exit 0 always)、
監査 sub-agent への fork (起動ツール名はハーネス世代で `Task` または `Agent`) が完了した事実だけを
append-only の JSONL 台帳へ追記する。台帳へは観測名をそのまま書く (正規化しない)。

現行 hook 契約では PostToolUse は **matching tool call ごとに 1 回**発火し、payload top-level の
`tool_use_id` と、その call の `tool_input` / `tool_response` を渡す。同じ assistant message から複数の
tool call を parallel dispatch した場合も batch 全体を 1 回で渡すのではなく、call ごとの PostToolUse が
それぞれ並行発火する。batch 全体を扱う別ライフサイクルは PostToolBatch であり、本 writer の入力契約と
混同しない。

解決する欠陥: `assign-system-spec-completeness-evaluator` の評価レポートは観点ごとに `auditor`
(例 `matrix_coverage` → `system-spec-matrix-auditor`) を宣言するが、これは **評価者自身が書く文字列** で
あって fork の実在を示さない。独立監査を 1 件も起動しない実行でも「独立 auditor が PASS を出した」と
名乗るレポートを生成でき、`aggregate-completeness.py --report` は exit 0 で通っていた。レポート digest は
graph node の `confirmation_evidence.evaluated_digest` として confirmed の根拠になるため、fail-closed の
証跡連鎖に「帰属だけ検証されない」穴が残っていた。

なぜ hook でなければならないか: 監査 agent (`system-spec-{matrix,hearing,doc-freshness}-auditor`) は
`tools: Read[, Bash]` のみで **Write を持たない**。自力ではディスク上に痕跡を残せないので、
「モデルが書けない層」である harness 側 (hook) が記録するしかない。

### 6.2 記録するもの / しないもの

| 項目 | 記録 | 根拠 |
|---|---|---|
| `subagent_type` が本 plugin 同梱 agent (`agents/*.md` の stem)、または `system-spec-harness:<stem>` の `Task` | ✅ | pinned plugin の実 payload は qualified 名。本 plugin qualifier のみ受理して stem へ正規化し、レジストリ追加に自動追従する |
| それ以外の `Task` (他 plugin の agent・汎用 agent) | ❌ | 台帳の肥大化を避ける。帰属検証に使わない |
| `session_id` / `ts` / `cwd` / `prompt`・call 全体の `tool_response` の sha256 / `AUDIT_VERDICT` enum | ✅ | response 本文を保存せず判定忠実性を突合する最小メタ |
| schema 1.2 の top-level `tool_use_id` / `verdict_state` | ✅ | parallel call を含む dispatch の同一性と、verdict の `resolved` / `absent` / `pending` / `ambiguous` を下流で fail-closed 照合する |
| `prompt` 本文 / `tool_response` 本文 | ❌ | 機微情報を台帳へ持ち込まない |

schema 1.2 の `response_sha256` は **当該 PostToolUse に渡された call 全体の `tool_response`** を
canonical JSON 化した digest である。nested `tool_use_id` block を探索して response の一部だけへ scope
した digest ではない。`audit_verdict` は同じ per-call `tool_response` の応答本文 key (`content` /
`output` / `result` / `response` / `message`) 配下だけを走査する。各 text block の最終非空行を候補とし、
canonical `AUDIT_VERDICT` marker の候補が **ちょうど 1 件**のときだけ記録する。0 件は未確定、複数件は
曖昧として fail-closed に扱う。fork prompt や応答後 metadata (`agentId` / `status` / usage) を内包しても、
prompt 内の説明用 marker や metadata 文字列を応答本文と混同しない。

現行 `Agent` は top-level `tool_use_id` が非空かつ `tool_response.status=completed` の場合だけ
schema 1.2 の verdict を確定する。ID 欠落は schema 1.1 へ downgrade せず記録対象外とし、
`async_launched`・失敗・status 欠落は本文に marker があっても `verdict_state=pending` / verdict=null とする。
旧 `Task` は status 欠落を互換受理するが、status が明示された場合は `completed` 以外を未完了として扱う。
schema 1.1 の ID 無し互換は旧 `Task` payload にだけ適用する。

consumer / `audit_delegations[]` receipt は schema 1.2 の行に対し、従来の
`session_id` / `tool_name` / `subagent_type` / `response_sha256` / `audit_verdict` に加えて
`tool_use_id` を全一致で照合し、`verdict_state=resolved` だけを完成した監査として受理する。
schema 1.1 の既存行は `tool_use_id` を持たない legacy 互換として従来キーで照合できるが、1.2 の
ID 欠落・不一致を 1.1 扱いへ downgrade してはならない。

台帳位置: `<CLAUDE_PROJECT_DIR>/eval-log/system-spec-harness/audit-fork-ledger.jsonl`
(env `SYSTEM_SPEC_AUDIT_FORK_LEDGER` で上書き可。consumer 側 `aggregate-completeness.py` と同一規則)。

### 6.3 既知の限界 (正直な境界)

- 台帳は同一 response digest の `AUDIT_VERDICT` と receipt `verdict` の一致を検査できるため、
  **実監査の FAIL を PASS へ書き換えることは拒否する**。監査 prompt が実質を伴うか、根拠が妥当かは
  意味層 (content-review / human) の責務である。
- hook が無効化された環境では台帳が空になる。その場合 consumer は fail-closed で「帰属未接地」の
  violation を出す (緑にはならない = 安全側)。
- background / 非同期 launch の「起動受理」response は監査の最終応答ではない。`AUDIT_VERDICT` が
  未確定の `pending` / `absent` 行を completion receipt に使わず、最終応答を得られる foreground 実行へ戻す。
- parallel call の schema 1.2 対応は defensive hardening と canary 検証の対象であり、正式 evaluator
  運用の parallel 許可を意味しない。fresh live-trial で 3 fork 全ての per-call 台帳行、ID / digest /
  verdict 照合、最終 receipt 生成を実証するまでは **1 message = 1 foreground fork** の直列運用を維持する。
- guard hook と同じく **表層的な adversarial evasion は設計上許容**する。狙いは「fork を省略した実行が
  独立監査を名乗って機械層を通過する」という現実に観測された失敗の遮断。

### 6.4 検証

- 回帰テスト `tests/test_record_audit_fork.py`。
- consumer 側の突合テストは
  `skills/assign-system-spec-completeness-evaluator/tests/test_audit_fork_attribution.py`、
  集約・CLI 側は `tests/test_aggregate_completeness.py`。共通 fixture は
  `tests/completeness_test_support.py` に置き、責務別テストを 500 行以下に保つ。
- unit / fixture の parallel 対応 PASS は defensive hardening の証跡であり、正式運用の直列 gate を
  解除しない。解除には current hook runtime による fresh live-trial 証跡を別途要求する。
