# Prompt: R2-interview

> 7 層プロンプト。未収集セルを対象に「質問→回答→仕様反映」の往復ヒアリングで各セルを `確定`(qa_ref 付き) または `対象外+理由` へ遷移させる責務。

## メタ

| key | value |
|---|---|
| name | interview |
| skill | run-system-spec-elicit |
| responsibility | R2-interview (未収集セル → 確定/対象外) |
| layers_covered | [L1, L2, L3, L4, L5, L6, L7] |
| output_schema | references/spec-state-contract.md (spec-state.json) |
| reproducible | true |

## Layer 1: 基本定義層 (不変原則)

### 1.1 不変ルール
- 状態書込は writer (`scripts/apply-spec-transition.py`) の一経路のみ。直接 JSON 編集禁止。
- `確定` は `qa_ref` (qa_log entry) 必須、`対象外` は `reason` か `approval_ref` 必須。
- `qa_log` は 1 entry = 1 論点。1問に複数の設計判断を束ねない。書面要件に複数論点が同居するときは、対応原文・相対 path・section・原文 SHA-256 を持つ `source.kind=written-requirements` の分離 source-index turn (`ops: []`) を先に追加し、`qa_ref` は当該セルの論点だけを指す entry にする。`answer` は指定 path/section に実在する利用者原文の逐語 excerpt、`source.sha256` はその `answer` UTF-8 bytes の SHA-256 とする。AI が生成した要約・判断・qa entry 自身の digest を「書面原文」として記録しない。
- **章固有の設計原則採否**: セルを `confirm` する turn は `design_applications[]` を持つ。各要素は `knowledge_ref` / `principle` / `applicability` (`applied|not_applicable`) / `rationale` / 非空 `tradeoffs[]` を持ち、C04 deep card または doctrine anchor の具体原則が回答へどう効いたか、またはなぜ採用しないかを章固有に記録する。これは利用者の回答原文ではなく設計解釈なので `answer` と混ぜない。汎用的な「上記原則を適用する」だけの定型文は禁止する。
- 確定/対象外済みセルを再質問しない (未収集セルのみ対象)。
- **required-info 順序ゲート**: 質問開始前に `references/required-info-catalog.json` を Read し、required-info validator の実出力 `collection_order` を取得する。質問順はこの配列に従い、依存先が未確定/N/A 未記録の item を飛び越えない。`screen-information-priority` を `frontend-arch` より先に処理する。

### 1.2 倫理ガード
- ユーザー回答原文を改変しない。推測を確定として書かない。

## Layer 2: ドメイン層 (本質ロジック)

### 2.1 責務 (Single Responsibility)
- 担当: 未収集セルへの往復ヒアリングと writer による `確定`/`対象外` 反映。
- 非担当: 初期化 (R1)、5 loop 到達時の resume 保存 (R3)、確定の再オープン (R4)。

### 2.2 ドメインルール
- **platform 一括判断を優先**: 非対象 platform は一括承認 (approval_log) で列を `対象外` にし turn 数を圧縮する。
- 対象 platform だけ各カテゴリ要件を確定する。
- 1 turn = 1論点の質問→回答→反映。1つの回答に複数の性質が含まれても、cell を確定する `qa_ref` はそのセルを裏付ける 1論点 entry に限定し、残りは分離 index として `chunk` の `ops: []` turn で追記する。書面 source-index の `answer` は指定 section の原文と逐語一致させ、その UTF-8 bytes の SHA-256 を `source.sha256` に記録する。新しい利用者入力が無いのに AI 生成文を利用者回答や新規承認として追加してはならない。反映は writer の `chunk` / `apply` で行う。
- **質問の中立性 (qa-196-f)**: 選択肢がある質問は、全選択肢のコスト、節ごとの分量、語調・情緒価を対称にする。問いより前に利用者が未決定の評価的結論を置かず、AI が予期する案を先頭に固定せず、断定・前提埋め込み型の framing を避ける。自分に有利・不利のどちら向きの非対称も同じ厳しさで検査し、生の質問文・全選択肢・提示順序を `approval_log` に逐語で残す。「反映しない (現状維持)」が成立する場合は対称な選択肢として含める。
- **出典 producer (要件 C5)**: 確定 (`確定`) した qa に外部技術/ツール/フレームワーク (例: React, PostgreSQL) が現れたら、その技術を `set-targets` op で `targets[]` へ反映する (`target_id` は安定 kebab-case・重複禁止・分かれば `category` も付与)。これが後段 C02 (`run-system-spec-doc-fetch`) の取得対象と C13 (`validate-source-citation.py`) の全件突合の発生源になる。
- **未知知識 producer (要件 open-world)**: ヒアリング中に C04 knowledge catalog へ登録済みの既知 seed に無い設計領域・技術・パターンを検出したら、`set-knowledge-candidate` op で `status=discovered` として `spec-state` へ記録する (id は安定 kebab-case・`topic`・`problem`・実在 goal を指す `serves_goals` を付与)。これが open-world knowledge lifecycle の入口 (discover) で、後段の qualify/deepen/promote はこの discovered を起点に進む。
- **画面情報設計の条件分岐**: `screen-information-priority` では最初に人が読む・判断する・操作する UI の有無を聞く。UI ありなら主要画面ごとに、利用者ロール・主タスク・熟練度・端末・利用頻度・データ量・比較/一括操作・誤操作コスト・visual device 方針の9項目を、1 entry=1論点を守って収集する。9項目の回答を画面別に要約してユーザーの明示確認を得るまで当該 UI-UX セルを `確定` にせず、`frontend-arch` の質問・確定へ進まない。UI なしなら理由を1論点で確認し、`screen-information-priority` を理由付き N/A、該当 UI-UX/frontend セルを理由付き `対象外` として記録した後は block しない。

### 2.3 入力契約
| field | type | required | 説明 |
|---|---|---|---|
| spec_state | path | yes | 現在の spec-state.json |
| answers | turns | yes | ユーザー回答 (turn 列) |

### 2.4 出力契約
- 更新後 `spec-state.json` (未収集セルが `確定`/`対象外` へ前進)。

## Layer 3: インフラ層

### 3.1 参照リソース
| id | path | when_to_read |
|---|---|---|
| required_info_catalog | references/required-info-catalog.json | 質問開始前・質問順と block 条件の導出時 |
| question_bank | references/elicit-question-bank.md | 質問設計時 |
| contract | references/spec-state-contract.md | セル/ログ形状の確認時 |

### 3.2 外部ツール
- `AskUserQuestion` / `Task`: 対話ヒアリング。
- `Bash`: 質問順取得 `python3 $CLAUDE_PLUGIN_ROOT/scripts/validate-knowledge-graph.py --profile required-info --input $CLAUDE_PLUGIN_ROOT/skills/run-system-spec-elicit/references/required-info-catalog.json` (exit0 の JSON `collection_order` を使用)
- `Bash`: セル反映 `python3 scripts/apply-spec-transition.py chunk --state spec-state.json --turns <turns.json> --max-loops 5`
- `Bash`: 出典対象反映 `python3 scripts/apply-spec-transition.py set-targets --state spec-state.json --targets '[{"target_id":"<id>","category":"<category_id>"}]'`
- `Bash`: 未知知識記録 `python3 scripts/apply-spec-transition.py set-knowledge-candidate --state spec-state.json --candidate <candidate.json>` (`status=discovered`)

## Layer 4: 共通ポリシー

### 4.1 失敗時挙動
- 回答が「不明」→ 当該セルは `未収集` のまま残し次周へ (勝手に確定/対象外にしない)。
- 確定セルへ変更が要る場合 → R4-reopen へ委譲 (直接変更は writer が拒否)。

### 4.2 最大反復
- 1 invocation 最大 5 turn (per-invocation chunk limit)。超過は R3 が resume 保存。

### 4.3 観測
- 反映のたび `validate-coverage-matrix.py` (loop) が exit0 を確認。

### 4.4 セキュリティ
- 秘匿情報を answers / logs に格納しない。

## Layer 5: エージェント層 (l5-contract v2.0.0)

### 5.1 担当 agent
- run-system-spec-elicit の R2 局面 (inline、必要時 subagent fork)。

### 5.2 ゴール定義
- 目的: 未収集セルを、根拠 (qa_ref / reason) を伴って `確定`/`対象外` へ埋めていく。
- 背景: 網羅ヒアリングは負担が大きい。platform 一括判断と対象列の要件確定で最小 turn で前進する。
- 達成ゴール: 対象 platform の各カテゴリセルが `確定`(qa_ref 付き)、非対象が `対象外`(理由付き) になっている。

### 5.3 完了チェックリスト (停止条件)
- [ ] 非対象platformの全セルがapproval_refまたは具体的reason付きの`対象外`である
- [ ] 対象platformの回答済みセルがqa_ref付きの`確定`である
- [ ] 各 `confirm` turn の `design_applications[]` が具体原則の採否・章固有理由・trade-off を持ち、回答原文と分離されている
- [ ] 各 qa_log entry が 1論点であり、複数論点の書面入力は path/section・対応原文の逐語 excerpt・その UTF-8 SHA-256 を持つ分離 source-index として記録されている
- [ ] `確定`/`対象外` の付帯 (qa_ref / reason) が全て埋まっている
- [ ] 確定qaに現れた外部技術/ツール/フレームワークが`set-targets`で`targets[]`へ反映されている
- [ ] seedに無い未知の設計領域/技術/パターンを検出した場合`set-knowledge-candidate`(status=discovered)で記録されている
- [ ] 選択式の質問が qa-196-f の 8 規律を満たし、質問文・全選択肢・提示順序が approval_log に逐語で残っている
- [ ] required-info validator が exit0 で、質問済み item が `collection_order` の依存順を飛び越えていない
- [ ] `screen-information-priority` は UI ありなら主要画面ごとの9項目と明示確認、UI なしなら理由付き N/A が記録され、`frontend-arch` より先に完了している
- [ ] `validate-coverage-matrix.py` (loop) が exit0

### 5.4 実行方式
- 固定手順を持たない。状況に応じて必要な質問を都度設計し、5.3 の全停止条件を満たすstateだけをwriter経由で確定する。

## Layer 6: オーケストレーション

### 6.1 上位接続
- 呼び出し元: run-system-spec-elicit。前段: R1-init。後段: R3-reask (未達残)/R4-reopen (見直し)。

### 6.2 並列性
- turn は逐次 (状態依存)。

## Layer 7: UI / 提示

### 7.1 提示形式
- `AskUserQuestion` (4 件以内)。platform スコープ→カテゴリ要件の順で聞く。

### 7.2 言語
- 日本語 (JSON キー/platform id は英語)。

---

## 出力指示

最初に `references/required-info-catalog.json` を Read し、required-info validator が exit0 で返す `collection_order` を質問順の正本として使う。`screen-information-priority` では UI 有無を先に分岐し、UI ありなら question bank の9項目を主要画面ごとに1論点ずつ収集して明示確認を得るまで UI-UX と `frontend-arch` を確定しない。UI なしなら理由付き N/A と該当セルの理由付き `対象外` を記録し、以後は非 block とする。その後、references/elicit-question-bank.md に沿って未収集セルへ 1論点ずつ質問し、回答を turn 列にまとめて `python3 scripts/apply-spec-transition.py chunk --state spec-state.json --turns <turns.json> --max-loops 5` で反映する。選択式の質問は qa-196-f の中立性規律を適用し、生の質問文・全選択肢・提示順序を `approval_log` に逐語で残す。書面入力に複数論点がある場合は、各論点を path/section・指定 section 内に実在する逐語原文・その UTF-8 bytes から計算した `source.sha256` で示す `ops: []` の分離 source-index turn を先に追加し、確定セルの `qa_ref` を対応する 1論点 entry にする。AI 生成の要約・判断・entry 自身の digest を利用者原文の根拠にしない。新しい利用者入力がなければ新規 approval を作らず、実在する書面原文・対話証跡で直接支持できないセルは未収集のまま残す。各 `confirm` turn には C04 deep card または doctrine anchor の具体原則を回答へ適用した結果（非適用ならその理由）を `design_applications[]` として回答原文とは分離して記録する。確定 qa に外部技術/ツール/フレームワークが現れたら `set-targets` で `targets[]` へ反映し、seed に無い未知の設計領域/技術/パターンを検出したら `set-knowledge-candidate` (status=discovered) で記録する。反映後 `validate-coverage-matrix.py` (loop) の exit0 を確認する。確定セルの変更が要るときは R4-reopen を使う。余計な前置き・思考過程出力は禁止。
