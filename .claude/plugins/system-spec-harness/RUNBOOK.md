# system-spec-harness Runbook

## Purpose
システム構築 (Web/モバイル/タブレット/デスクトップ横断) の仕様情報を往復ヒアリングで漏れなく収集し、章立て複数 Markdown + index の仕様書ドキュメントセットへまとめるハーネスの運用手順。

## Entry Points
- `/spec-hearing-start [--resume] [--status]` — 往復ヒアリングを起動 (C09→C01)。`--status` は収集マトリクス充足状況のみ表示。
- `/spec-compile [--out-dir DIR]` — 収集済み仕様を章立て仕様書へコンパイルし (C10→C03)、完了後に完成度評価 (C05) を自動連鎖。
- Skill: `run-system-spec-elicit` / `run-system-spec-doc-fetch` / `run-system-spec-compile` / `ref-system-design-knowledge` / `assign-system-spec-completeness-evaluator`。

## Environment
- Python 標準ライブラリのみ (.sh/.js 新規禁止・scripts 内 yaml import 禁止)。
- スクリプト起動は repo-root cwd 前提、skill 資産は self-relative 参照。
- 中間成果物: `spec-state.json` (収集マトリクス+質疑ログ) / `fetched-references.json` (出典記録) / `system-spec/*.md` + `index.md` (仕様書ドキュメントセット)。
- 最新公式ドキュメント取得は WebSearch/WebFetch のみ (MCP 連携は将来拡張・GAP-MCP-DOCFETCH)。

## Write Protection
- `spec-state.json` の確定状態は C01/C03 所有の単一 transition writer のみが変更する。
- 確定済み章 (`system-spec/` 章 frontmatter `status: confirmed`) への Write/Edit/Bash は `hooks/guard-confirmed-chapter-overwrite.py` (PreToolUse・fail-closed exit2) が補助防御で遮断する。
- 確定セルの再オープンは C01 R4-reopen 経由のみ。再オープン状態のセル対応章は hook が通す。

## Verification
- 収集マトリクス網羅性 (C7): `python3 scripts/validate-coverage-matrix.py --matrix spec-state.json [--require-complete]`。
  - 孤立質疑の後継申告: `--require-declared-qa-supersession` を足すと、正本のどこからも引かれていない `qa_log` entry に `superseded_by` の申告を要求する。**孤立を禁じる検査ではない。**質疑を作り直せば古い方は引かれなくなる (正しい経過) ので、置き換えなのか接地忘れなのかを機械が区別できる形で残させる。申告は `python3 skills/run-system-spec-elicit/scripts/apply-spec-transition.py supersede-qa --state spec-state.json --qa-id <古い id> --by <後継 id>`。
  - **同名プラグインの多重登録 (2026-08-25 実測・未解決):** `catalog:` の名乗りを足した動機そのもの。実測で **4 コピー・2 版**が同時に存在し、どれが読まれるかが解決順序任せだった。
    - `harness-local` (`~/.claude/settings.json`) → `~/.claude/plugins/cache/harness-local/system-spec-harness/0.1.11` および marketplace 実体。カタログ `sha256:f1caabbd14ab` / 12 items (`context-of-use`・`information-priority` が現行)。hooks は PreToolUse のみ。
    - `harness-hub` (プロジェクトの `.claude/settings.json`) → **main リポジトリ** `~/dev/dev/個人開発/affiliate-hub`。カタログ `sha256:e8e9e1308efd` / 11 items (`screen-information-priority` へ統合)。hooks に `record-audit-fork.py` の PostToolUse / SubagentStop を持つ。
    - 帰結 1: `eval-log/system-spec-harness/audit-fork-ledger.jsonl` がどこにも生成されない。**台帳の不在は、記録漏れではなく PostToolUse を持たない側が名前衝突に勝った証拠である。**`aggregate-completeness.py --report` は独立監査の帰属を裏取りできず必ず FAIL する。
    - 帰結 2: `harness-hub` が指すのは main リポジトリであって **worktree ではない**。したがって worktree 上の未コミット修正は、明示パスで起動したときしか効かない。skill / agent / hook 経由の起動は別コピーを読む。
    - **これが C07 の「誤検出」の正体である。**C07 は古いカタログを読まされていた。読解の誤りではなく、解決先が二つあったこと自体が誤りだった。設定の変更は harness 側の権限を越えるため、ここには事実だけを残す。
  - カタログ domain の勘定先: `--require-catalog-domain-coverage` を足すと、必須情報カタログの `in_scope_domains` に対して「それを数えるカテゴリ行」が在ることを要求する。**照合はもともと片側からしか行われていなかった** — `--require-counted-required-info` は matrix の側からカタログを引くので、カタログに在って matrix に行が無い domain の item は一度も参照されずに消える。未収集 0・全確定で緑になっても、その domain は誰にも数えられていない。ここでも禁じるのではなく名乗らせる: 行を作る / `excluded_categories` で対象外と宣言する / カタログの `na_domains` で非該当と宣言する、のいずれかを選ばなかったことだけを違反とする。**2026-08-25 時点の正本はこの検査で落ちる**: `api` が `in_scope_domains` に在り `api-contract` (degrade) を持つが、matrix に `api` 行が無く宣言も無い。3 つの選択肢のどれも事実に合わない (API は作るので対象外でも非該当でもなく、行を作ると 8 カテゴリ設計が変わる) ため、**宣言の仕方は設計判断として利用者へ差し戻してある**。degrade だったのは運であって設計ではない。block の item が同じ位置に置かれたら黙って消える。
  - 判定に使ったカタログの身元: カタログを読む検査 (`--require-counted-required-info` / `--require-catalog-domain-coverage`) が走ると、ゲートは `catalog: <解決パス> (sha256:xxxxxxxxxxxx)` を 1 行名乗る。**同じ名前のハーネスが複数箇所に在りうるため**である。実測 2026-08-25: 独立監査 C07 が `~/dev/dev/個人開発/harness/marketplaces/local/plugins/system-spec-harness` の古いコピー (catalog mtime 08-12) を読み、worktree に install されている `.claude/plugins/system-spec-harness` (mtime 08-24) との差に気付かなかった。旧コピーには `context-of-use` / `information-priority` が実在し、新しい側では `screen-information-priority` に統合されている。**C07 の観察は古い正本に対しては全て正しく、誤っていたのは読解ではなく入力の同一性だった** (一度は「捏造」と判断されかけた)。判定を突き合わせるときは、まずこの行を突き合わせること。カタログや scripts は `$CLAUDE_PLUGIN_ROOT` から解決し、絶対パスで別コピーを開かない。
  - カテゴリ行を立てない宣言: `apply-spec-transition.py declare-excluded-category --state spec-state.json --category <domain> --reason <どこで数えているか>`。**検査は「宣言せよ」と言うのに、宣言する道具が無かった** (`set-qa-source` を足したときと同じ形の欠落)。`excluded_categories` は schema 上 object (`{category_id: reason}`) で、writer はその形で書く。**「対象外」は「作らない」ではなく「このカテゴリ行を立てない」である** — `api` を対象外と宣言しても API を実装しない意味にはならない。誤読を招くので `--reason` を必須にし、その必須情報をどこで数えているのかを書かせる。既に別の理由が立っている宣言は上書きしない (黙って書き換えると経緯が消え、最初からそう宣言していたように見える)。
  - 質疑の由来の名乗り: `python3 skills/run-system-spec-elicit/scripts/apply-spec-transition.py set-qa-source --state spec-state.json --qa-id <id> --reason <なぜ対話由来と言えるか>`。`qa_log[].source` は**任意欄ではない** — 作成時は `apply` / `chunk` が `source.kind` (`user-dialogue` | `written-requirements`) を要求する。名乗りが任意だった時代に入った entry だけをこの writer が直す。受け付けるのは `user-dialogue` の名乗りのみで、書面由来は `set-qa-written-up` が原文の path/section と digest まで要求する (**名乗りだけで『書面に書いてある』と言える口は作らない**)。`user-dialogue` は裏取りではなく、**裏取りが存在しないことの宣言**である。
  - 章にしか無い散文の居場所: `python3 skills/run-system-spec-elicit/scripts/apply-spec-transition.py set-chapter-note --state spec-state.json --category <章> --heading <見出し> --body-file <本文ファイル> --reason <なぜ正本へ入れるか>`。章は正本の純関数なので、正本に無い散文は compile のたび消える。節の引き継ぎ (`--on-handwritten preserve`) は `##` 単位でしか効かず、生成節の内側 (`###` 以下) に書かれた散文は**原理上守れない**。守るのではなく、消えようのない場所へ移す。利用者の逐語 (`qa_log[].answer`) へは足さない — 後から気づいた突き合わせをそこへ足すと、利用者が言っていないことが利用者の声の顔で残る。本文は `--body-file` でしか渡せない (引数へ直に書かせると写し間違いが正本に入る)。
- 出典記録 (C5): `python3 scripts/validate-source-citation.py --targets <targets.json> --references fetched-references.json --repo-root <project-root>`。各 record の `evidence_ref` を repo 内に解決し `evidence_sha256` まで突合する。
- 知識グラフ / doctrine / 必須情報 (C13-C16): `python3 scripts/validate-knowledge-graph.py --profile knowledge|required-info|doctrine|cross`。各 profile は循環・dangling・写像・domain 被覆を fail-closed 検証する。
- 独立監査: `system-spec-hearing-auditor` (聞き漏れ/誘導/早期停止) / `system-spec-matrix-auditor` (マトリクス状態) / `system-spec-doc-freshness-auditor` (公式サイト再照合)。
- 完成度評価: `assign-system-spec-completeness-evaluator` が3観点 (網羅性/設計知識反映/出典) で PASS/FAIL 判定。
- テスト: `python3 -m pytest plugins/system-spec-harness/tests -q`。

## Acceptance Evidence
- 受入観点 (C1-C16) の plugin 内正本は `docs/evidence.md` (C1-C16 受入 Matrix) と `EVALS.json`。計画側正本 `plugin-plans/system-spec-harness/phase-07-acceptance-criteria.md` は repo-only (配布物には含まれず単独 install 環境では非解決)。
- 6周超サンプル対話で5周目に状態保存+resume が働くこと (C3)。
- 生成仕様書がカテゴリ別収集状態 (未着手/収集中/確定/対象外+理由) を各章に明示すること (C1)。

## Recovery
- ヒアリング中断: `/spec-hearing-start --resume` で `hearing_progress` から再開。
- マトリクス不整合: validate-coverage-matrix.py の VIOLATION を解消してから再コンパイル。
- 誤った確定: C01 R4-reopen で根拠付き再オープンしてから修正 (直接編集は hook が拒否)。
- 改善要望: `/run-skill-feedback system-spec-harness` で投入。

## Governance Operations

### knowledge_candidates の curated 昇格手順
project-local な `knowledge_candidates[]` (C01 `spec-state.json`) を C04 の curated catalog へ昇格させる運用。形状と status 遷移の正本は `skills/ref-system-design-knowledge/references/open-world-knowledge-lifecycle.md` と C01 `references/spec-state-contract.md`。
- **承認者 (approver)**: C04 curated catalog の保守担当。候補の起票者 (C01/C02 実行者) 自身は承認できない (proposer≠approver)。
- **昇格トリガ**: candidate が `deepened` に到達し、汎用性 (複数 project へ再利用可能)・既存カード非重複・deep-card 必須意味項目充足・一次/公式資料あり・freshness policy ありの 5 条件を全て満たしたとき。`set-knowledge-candidate` で `status:"promoted"` へ進める際に `curation_ref` (承認記録と curated 配置先) を必須付与する。自動昇格は禁止。
- **棚卸し周期**: 四半期ごと (次回 2026-10-11)、および `card.freshness.review_by` 到来時・破壊的変更/標準改訂/security advisory/vendor EOL/価格改定の即時トリガ時。棚卸しで未確認の候補は `stale` と明示し、最新推奨の根拠に使わない。重複候補は新設せず既存 curated カードへ統合する。

### 初回実運用後の EVALS 再評価 (baseline 更新)
`EVALS.json` の各 `evaluations[]` は現在 `verdict:"baseline"` (build 直後の初期宣言・findings 空)。
- **トリガ**: 初回の実 `/spec-compile` 実行 (実プロジェクトでの初回コンパイル+C05 完成度評価) 完了後。
- **手順**: C05 が返した観点別スコアと総合判定を、対応する skill の `evaluations[]` エントリへ実測 verdict (`pass`/`fail`) と findings で追記し、`baseline` 行はそのまま履歴として残す (上書きしない)。`docs/evidence.md` の C1-C16 受入 Matrix の状態列と齟齬がないか照合する。
- **期限**: 初回実運用から 2 週間以内、遅くとも 2026-08-11 までに baseline を実測 verdict へ更新する。未実施の間は EVALS の合否は build 時点の baseline であり実運用の受入根拠にしない。
