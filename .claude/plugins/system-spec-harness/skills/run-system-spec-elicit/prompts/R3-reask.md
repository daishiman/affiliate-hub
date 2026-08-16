# Prompt: R3-reask

> 7 層プロンプト。未確定セルを再質問する責務。1 invocation の 5 loop 到達時は未完了状態と next_question を保存し resumable な結果を返す。未収集セルを完了扱いしない。

## メタ

| key | value |
|---|---|
| name | reask |
| skill | run-system-spec-elicit |
| responsibility | R3-reask (未確定セル再質問 + resume 保存) |
| layers_covered | [L1, L2, L3, L4, L5, L6, L7] |
| output_schema | references/spec-state-contract.md (hearing_progress) |
| reproducible | true |

## Layer 1: 基本定義層 (不変原則)

### 1.1 不変ルール
- 未収集セルを完了扱いしない (`complete=true` は未収集0のときだけ)。
- 5 loop (per-invocation chunk limit) 到達で未収集が残れば `complete=false`・`next_question` 非 null を保存し resumable に返す。
- 状態書込は writer の一経路のみ。
- 再質問で新しい利用者入力を得ていない場合、AI 生成の回答・要約・判断を `user-dialogue` / `written-requirements` や新規 approval にすり替えない。書面根拠を再利用するときは、指定 path/section 内に実在する逐語 `answer` とその UTF-8 SHA-256 を維持する。
- 再回答で `confirm` する turn も R2 と同じ `design_applications[]`（具体原則の採否・章固有理由・trade-off）を回答原文と分離して持つ。
- **required-info 順序ゲート**: resume ごとに `references/required-info-catalog.json` を Read し直し、required-info validator の実出力 `collection_order` を再質問順の正本にする。保存済み `next_question` が未完了の依存を飛び越える場合はそのまま提示せず、先行 item の質問を優先する。`screen-information-priority` は常に `frontend-arch` より先に完了させる。

### 1.2 倫理ガード
- 未回答を勝手に確定/対象外へ埋めない。

## Layer 2: ドメイン層 (本質ロジック)

### 2.1 責務 (Single Responsibility)
- 担当: 未確定セルの再質問と、chunk 上限到達時の状態保存 (resume)。
- 非担当: 初期化 (R1)、新規セルの一次ヒアリング設計 (R2)、reopen (R4)。

### 2.2 ドメインルール
- `next_question` は最初の未収集セル (カテゴリ順→platform 正順) の質問。writer が決定論導出する。
- 既に確定/対象外のセルは再質問対象にしない。
- **質問の中立性 (qa-196-f)**: 選択肢がある再質問は、全選択肢のコスト、節ごとの分量、語調・情緒価を対称にする。問いより前に利用者が未決定の評価的結論を置かず、AI が予期する案を先頭に固定せず、断定・前提埋め込み型の framing を避ける。自分に有利・不利のどちら向きの非対称も同じ厳しさで検査し、生の質問文・全選択肢・提示順序を `approval_log` に逐語で残す。「反映しない (現状維持)」が成立する場合は対称な選択肢として含める。
- **画面情報設計の再質問**: `screen-information-priority` が未完了なら、UI 有無を先に確定する。UI ありは主要画面ごとの利用者ロール・主タスク・熟練度・端末・利用頻度・データ量・比較/一括操作・誤操作コスト・visual device 方針の不足項目だけを1論点ずつ再質問し、9項目の明示確認まで `frontend-arch` を質問・確定しない。UI なしは理由付き N/A と該当 UI-UX/frontend セルの理由付き `対象外` を記録し、以後は非 block とする。

### 2.3 入力契約
| field | type | required | 説明 |
|---|---|---|---|
| spec_state | path | yes | 現在の spec-state.json (未収集残あり) |
| answers | turns | no | 追加回答 (resume 継続時) |

### 2.4 出力契約
- 更新後 `spec-state.json`。`hearing_progress = {loop_count, next_question, complete}`。

## Layer 3: インフラ層

### 3.1 参照リソース
| id | path | when_to_read |
|---|---|---|
| required_info_catalog | references/required-info-catalog.json | resume 開始時・再質問順と block 条件の再導出時 |
| question_bank | references/elicit-question-bank.md | 再質問設計時 |
| contract | references/spec-state-contract.md | hearing_progress 形状の確認時 |

### 3.2 外部ツール
- `Bash`: 再質問順取得 `python3 $CLAUDE_PLUGIN_ROOT/scripts/validate-knowledge-graph.py --profile required-info --input $CLAUDE_PLUGIN_ROOT/skills/run-system-spec-elicit/references/required-info-catalog.json` (exit0 の JSON `collection_order` を使用)
- `Bash`: `python3 scripts/apply-spec-transition.py chunk --state spec-state.json --turns <turns.json> --max-loops 5`

## Layer 4: 共通ポリシー

### 4.1 失敗時挙動
- 5 loop 到達で未達 → 未完了として保存し呼出元へ resumable に返す (次 invocation で `--resume`)。

### 4.2 最大反復
- 1 invocation 最大 5 loop。累積は invocation を跨いで継続 (状態を保存)。

### 4.3 観測
- 各 invocation 末に `validate-coverage-matrix.py` (loop) が exit0 を確認。

### 4.4 セキュリティ
- 秘匿情報を保存しない。

## Layer 5: エージェント層 (l5-contract v2.0.0)

### 5.1 担当 agent
- run-system-spec-elicit の R3 局面 (inline)。

### 5.2 ゴール定義
- 目的: 未確定セルを潰しつつ、chunk 上限で安全に中断・再開できる状態を保つ。
- 背景: 長い往復を 1 invocation で回すとコンテキストが枯渇する。per-invocation chunk limit で分割し状態を永続化する。
- 達成ゴール: 未収集0に到達するか、5 loop 到達時に `complete=false`・`next_question` 非 null で保存されている。

### 5.3 完了チェックリスト (停止条件)
- [ ] 回答済みの再質問対象セルが根拠付きで更新されている
- [ ] 新しい利用者入力が無い場合に AI 生成回答や新規 approval を作っておらず、書面 source-index は指定 section の逐語原文とその SHA-256 を保っている
- [ ] `confirm` した turn に具体的な `design_applications[]` が記録されている
- [ ] 未収集0なら `complete=true`・`next_question=null`
- [ ] 未収集残なら `complete=false`・`next_question` 非 null を保存 (resumable)
- [ ] 未収集セルを確定/完了扱いしていない
- [ ] 選択式の再質問が qa-196-f の 8 規律を満たし、質問文・全選択肢・提示順序が approval_log に逐語で残っている
- [ ] required-info validator が exit0 で、再質問が `collection_order` の依存順を飛び越えていない
- [ ] `screen-information-priority` は UI ありなら不足分を含む9項目と明示確認、UI なしなら理由付き N/A が記録され、`frontend-arch` より先に完了している
- [ ] `validate-coverage-matrix.py` (loop) が exit0

### 5.4 実行方式
- 固定手順を持たない。状況に応じて必要な再質問を都度設計し、5.3 の全停止条件を満たす再開可能stateを保持する。

## Layer 6: オーケストレーション

### 6.1 上位接続
- 呼び出し元: run-system-spec-elicit。前段: R2-interview。resume 時に自己継続。

### 6.2 並列性
- 逐次 (状態依存)。

## Layer 7: UI / 提示

### 7.1 提示形式
- 再開時は保存済み `next_question` を required-info の `collection_order` と照合する。依存順が正しければ提示し、`screen-information-priority` 未完了のまま `frontend-arch` を指す場合は画面情報設計の不足質問を優先する。

### 7.2 言語
- 日本語 (JSON キー/platform id は英語)。

---

## 出力指示

resume の最初に `references/required-info-catalog.json` を Read し、required-info validator が exit0 で返す `collection_order` と保存済み `next_question` を照合する。`screen-information-priority` 未完了なら保存済み `next_question` より優先し、UI ありは主要画面ごとの9項目の不足分を1論点ずつ再質問して明示確認まで `frontend-arch` を確定しない。UI なしは理由付き N/A と該当セルの理由付き `対象外` を記録し、以後は非 block とする。その後、未確定セルへ再質問し、`confirm` する回答には C04 deep card または doctrine anchor の具体原則を回答へ適用した結果（非適用ならその理由）を `design_applications[]` として回答原文とは分離し、turn 列にまとめて `python3 scripts/apply-spec-transition.py chunk --state spec-state.json --turns <turns.json> --max-loops 5` で反映する。選択式の再質問は qa-196-f の中立性規律を適用し、生の質問文・全選択肢・提示順序を `approval_log` に逐語で残す。新しい利用者入力が無いのに AI 生成回答・AI 要約・新規 approval を追加しない。書面入力を根拠にするなら、指定 path/section に実在する逐語 `answer` とその UTF-8 `source.sha256` だけを使い、直接支持できなければ未収集のまま残す。5 loop 到達で未収集が残れば `hearing_progress.complete=false`・`next_question` 非 null が保存されていることを確認し、resumable に返す。未収集0なら `complete=true` を確認する。余計な前置き・思考過程出力は禁止。
