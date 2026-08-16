# spec-state.json 契約 (plugin 共有データ契約 / SSOT)

`run-system-spec-elicit` が生成・更新するヒアリング状態ファイル。C01/C03/C11/C12 が同一形状を前提にする。**状態書込は `scripts/apply-spec-transition.py` の一経路のみ**が行う (単一 transition writer)。

## 正本位置 (canonical location・SSOT)

`spec-state.json` の正本は **`$CLAUDE_PROJECT_DIR/system-spec/spec-state.json`** の 1 経路のみ。commands (C05/C06)・writer (`apply-spec-transition.py`)・consumer (C03/C11/C13) はこの単一の正本パスを読み書きする。取得資料の記録ファイル `fetched-references.json` も同ディレクトリ配下 **`$CLAUDE_PROJECT_DIR/system-spec/fetched-references.json`** に置く。生成物 (章 Markdown・index) も同じ `system-spec/` に集約するため、`plugin.json` の `permissions.filesystem: $CLAUDE_PROJECT_DIR/system-spec/**` が正本・生成物・記録の全てを被覆する (F4: 追加 permission 不要)。

- **暗黙前提の禁止**: 「cwd 直下」「repo root 直下」「配下を rglob で探索」などの位置前提を各 component が独自に持ってはならない。位置は本節の正本パスに一意固定する。
- **判定ソースの一意性**: C11 保護 hook (`guard-confirmed-chapter-overwrite.py`) は判定ソースとしてこの正本パスのみを読む。配下 rglob フォールバックは持たない。これにより同梱 fixture (`skills/run-system-spec-compile/fixtures/spec-state.json` など、別の確定セルを含むテストデータ) を判定ソースへ誤って拾う交差汚染が構造的に発生しない。
- **正本の書換防御**: 正本 `spec-state.json` への直接書換 (Write/Edit/Bash) は hook が遮断し、変更は単一 writer 経由 (根拠付き R4-reopen) のみ許す。別位置に存在する同名 `spec-state.json` (fixture 等) は正本でないため保護対象外 (遮断しない)。

## 形状

```json
{
  "schema_version": "1.1",
  "design_application_contract_version": "1.0",
  "categories": [{"id": "database", "label": "データベース"}],
  "platforms": ["web", "mobile", "tablet", "desktop-windows", "desktop-linux", "desktop-macos"],
  "matrix": {
    "<category_id>": {
      "<platform_id>": {"state": "確定", "qa_ref": "qa-001", "serves_goals": ["G1"]},
      "<platform_id>": {"state": "対象外", "reason": "..."},
      "<platform_id>": {"state": "対象外", "approval_ref": "appr-001"},
      "<platform_id>": {"state": "未収集"}
    }
  },
  "qa_log": [{"id": "qa-001", "question": "...", "answer": "...", "source": {"kind": "user-dialogue"}, "design_applications": [{"knowledge_ref": "ddd.md#Bounded Context", "principle": "Bounded Context", "applicability": "applied", "rationale": "...", "tradeoffs": ["..."]}]}],
  "approval_log": [{"id": "appr-001", "note": "..."}],
  "reopen_log": [{"category": "database", "platform": "web", "reason": "...", "from": "確定", "discarded": {"qa_ref": "qa-001", "serves_goals": ["G1"]}}],
  "category_aggregate": {"<category_id>": "確定|収集中|未着手|対象外"},
  "targets": [{"target_id": "react"}],
  "requirements_foundation": {
    "essential_purpose": "", "background": "",
    "goals": [{"id": "G1", "text": "..."}],
    "objectives": [{"id": "O1", "text": "...", "measure": "..."}],
    "success_criteria": [], "stakeholders": [],
    "scope": {"in": [], "out": []}, "constraints": [],
    "concrete_intents": [{"id": "I1", "text": "...", "serves": ["G1"]}],
    "confirmed": false
  },
  "decisions": [],
  "knowledge_candidates": [],
  "hearing_progress": {"loop_count": 0, "next_question": null, "complete": false, "max_loops": 5}
}
```

`max_loops` は `chunk` 実行後だけ存在する任意 field で、直近 invocation に実際に指定された上限を保持する。`bootstrap` / `init` 直後には存在しない。

## canonical platform id (6・必須行)

`web` / `mobile` / `tablet` / `desktop-windows` / `desktop-linux` / `desktop-macos`。全カテゴリ行にこの6 platform が全存在する (対象外は理由付き)。別名 platform id を作らない。

## cell state (loop 中は3値)

| state | 付帯 | 意味 |
|---|---|---|
| `未収集` | なし、または `reopened_from` / `reopen_reason` | 未ヒアリング。最終時は0にする。付帯 field は `reopen` で確定から戻したセルだけに付く。 |
| `対象外` | `reason` か `approval_ref` | 当該カテゴリ×platform は対象外 (理由必須)。 |
| `確定` | `qa_ref` (qa_log 参照) | 要件が確定。質疑ログ entry を参照。 |

`reopen` は確定セルを未収集へ置換する前に、存在する `qa_ref` / `serves_goals` / `serves_intents` を `reopen_log[].discarded` へ退避する。これにより、再確認中も以前の根拠と上位概念トレースを追跡できる。

## category_aggregate 真理値表 (4値・導出のみ)

| 行のセル集合 | 集約 |
|---|---|
| 全セル未収集 | 未着手 |
| 全セル対象外 | 対象外 |
| 未収集混在 (一部のみ未収集) | 収集中 |
| それ以外で未収集0 | 確定 |

`category_aggregate` は writer が真理値表から再計算する。手書き代入は契約違反。

## カテゴリ初期集合の正本

カテゴリの初期集合は C04 `../../ref-system-design-knowledge/references/system-category-taxonomy.json` を Read して得る (prompt へ直書き禁止)。ヒアリングでカテゴリの拡張発見・除外 (理由付き) ができる。

## targets (取得対象一覧) と set-targets op

`targets[]` は外部技術ドキュメントの取得対象一覧で、C02 (`run-system-spec-doc-fetch`) の取得対象と C13 (`validate-source-citation.py`) の全件突合、C03 (`compile-spec-doc.py`) の章割当に使う共有データである。

- **形状**: 各要素は `{"target_id": "<id>"[, "category": "<category_id>"]}`。`target_id` 必須・重複禁止、`category` 任意 (指定時は該当章へ出典を割り当てる)。
- **単一 writer**: `targets[]` も `scripts/apply-spec-transition.py` の `set-targets` op が唯一の書込経路。`init` は空配列で初期化するだけで、対象は `set-targets` で追加する。

```bash
# JSON 配列文字列 or ファイルパス ([...] / {"targets": [...]}) を受け付ける
python3 scripts/apply-spec-transition.py set-targets --state spec-state.json \
  --targets '[{"target_id": "react", "category": "frontend"}, {"target_id": "postgres", "category": "database"}]'
```

- 取得対象が無いプロジェクトは `targets` を空のままにしてよい。その場合 C13 は「targets 空 かつ references 空 = 出典対象なし」で exit0 となり、コンパイル動線を詰まらせない。

## requirements_foundation (上位概念・要件 C9) と serves_goals / set-foundation op

`requirements_foundation` は、カテゴリ×platform の技術マトリクス収集の**手前**で確定する上位概念 (要件定義書の憲法)。ここがブレると、マトリクスをいくら網羅しても「本当にやりたいこと」から乖離する (spec drift) ため、最初に・しっかり抽出して固定し、各技術決定をここへ `serves_goals` でトレース (anchor) する。C01 の新責務 **R0-foundation** が `set-foundation` op で確定し、C03 (`compile-spec-doc.py`) が `00-requirements-definition.md` を先頭章として明示する。

- **要素 (U1-U9)**: `essential_purpose`(U1 本質的目的) / `background`(U2 背景) / `goals`(U3 ゴール `{id,text}`) / `objectives`(U4 目標 `{id,text,measure}`) / `success_criteria`(U5) / `stakeholders`(U6) / `scope`(U7 `{in,out}`) / `constraints`(U8) / `concrete_intents`(U9 `{id,text,serves:[goal_id]}`) / `confirmed`。
- **単一 writer**: `requirements_foundation` の書込は `set-foundation` op が唯一の経路。`init` は空 (`empty_foundation`) で初期化するだけ。goals は `id` 必須・重複禁止、`concrete_intents.serves` は実在 goal id を指す (dangling 拒否)。
- **確定条件**: `confirmed: true` を要求するときは U1-U9 の全項目が値を持つか、該当しない項目が `{"status":"not_applicable","reason":"..."}` で理由付き明示されていること。空のまま確認済みにできない。さらに writer と `--require-foundation` は各 U に対応する canonical id `qa-foundation-u1`〜`qa-foundation-u9` の 1論点 `qa_log` entry を機械的に要求する。対話 entry は `source:{"kind":"user-dialogue"}`、書面 entry は `source:{"kind":"written-requirements","path":"<relative-path>","section":"<section>","sha256":"<sha256(answer UTF-8 bytes)>"}` とし、質問にも path/section、`answer` には指定 section に実在する対応原文の逐語 excerpt を残す。承認ログだけ・AI 要約だけ・AI が生成した entry 自身の digest を一次根拠にしてはならない。新しい利用者入力が無い再質問で新規 approval を作ってはならない。未確定なら途中保存として空でも保存できる。
- **serves_goals (トレース)**: 各 `確定` セルは `serves_goals: ["G1", ...]` でどの上位概念 (ゴール) に資するかを明示する。`confirm` op に `serves_goals` を同時付与するか、確定後に `set-serves` op で additive に付与する。`set-serves` は `state=確定` を変えないため確定巻き戻し防御には抵触しない。
- **approval_ref (承認記録へのトレース)**: `対象外` セルは `exclude` op で `approval_ref` を持てるが、`確定` セルには対応経路が無く、「回答本文は明示承認を根拠に引用しているのに、セルから承認記録へ機械追跡できない」状態が生じていた (F-0025)。確定セル限定の後付け annotation である **`set-approval` op** で `approval_ref` を additive に付与する。`set-serves` と同型で `state=確定` を変えないため確定巻き戻し防御には抵触しない。writer は `approval_log` に実在する id だけを受理する (dangling 拒否)。`chunk` で同 turn に `approval_id` を持つ場合は省略でき、その turn の承認 id が自動で紐づく。

```bash
# 上位概念 U1-U9 を確定 (JSON 文字列 or ファイルパス)
python3 scripts/apply-spec-transition.py set-foundation --state spec-state.json \
  --foundation '{"essential_purpose":"...","background":"...","goals":[{"id":"G1","text":"..."}],"confirmed":true}'
# 確定セルへ serves_goals を付与 (トレース)
python3 scripts/apply-spec-transition.py apply --state spec-state.json \
  --op '{"action":"set-serves","category":"database","platform":"web","serves_goals":["G1"]}'
# 確定セルへ approval_ref を付与 (承認記録へのトレース)
python3 scripts/apply-spec-transition.py apply --state spec-state.json \
  --op '{"action":"set-approval","category":"database","platform":"web","approval_ref":"appr-040"}'
```

### 書面要件の source-index

利用者が `requirements-brief.md` のような書面を渡したとき、内容を AI の回答として再表現して foundation を確定してはならない。`chunk` は `ops: []` の turn でも `qa_log` を append-only で追記できるため、U1-U9 を canonical id ごとに 1論点ずつ索引化してから `set-foundation` を実行する。writer は `source.kind`、書面なら安全な相対 path・非空 section・`answer` 原文と一致する SHA-256・質問中の path/section まで fail-closed で検証する。ここでいう `answer` 原文は指定した source path/section に実在する逐語 excerpt であり、writer が検査する digest 一致だけで「AI が書いた answer が利用者原文に実在する」ことまで証明した扱いにはしない。R6 監査は参照元書面と照合する。

```json
[
  {
    "qa_id": "qa-foundation-u1",
    "question": "書面入力 requirements-brief.md §1 の U1 (本質的目的) は何か",
    "answer": "利用者が渡した当該 section の原文",
    "source": {
      "kind": "written-requirements",
      "path": "requirements-brief.md",
      "section": "§1",
      "sha256": "<sha256(answer)>"
    },
    "ops": []
  }
]
```

この index は既存 `qa_log` の逐語を上書きせず、原文・入力位置・原文ハッシュを監査へ渡す。対話で得た U も同じ id を使い、`source:{"kind":"user-dialogue"}` を付ける。1つの entry に U1-U9 や複数の技術判断を束ねることは writer と `R6-audit-hearing` の誘導・遡及性監査で FAIL とする。

## R0→R1 bootstrap 契約

上位概念をマトリクスより先に確定できるよう、最初に state envelope を生成する。`init --state` は bootstrap 済みの `requirements_foundation` / `decisions` / `targets` / logs を保持して taxonomy の matrix だけを初期化する。

`init --state` は matrix 未着手の bootstrap state 専用である。確定セルを含む state を渡すと、reopen 記録なしで全セルを未収集へ戻してしまうため writer は fail-closed（不明・不整合なら安全側に停止）で拒否する。既存 taxonomy の拡張は `add-category`、確定セルの再確認は `reopen` を使う。

```bash
python3 scripts/apply-spec-transition.py bootstrap --out spec-state.json
python3 scripts/apply-spec-transition.py set-foundation --state spec-state.json --foundation foundation.json
python3 scripts/apply-spec-transition.py init --taxonomy taxonomy.json --state spec-state.json --out spec-state.json
```

## decisions (意思決定支援) と set-decision op

ユーザーが決めきれない論点を、2-3件の無料/低コスト候補を含む比較、最新一次情報に基づくAI推奨、ユーザー確認へ分離して記録する。AI推奨だけで `confirmed` にしてはならない。

- `status`: `needs_guidance` / `recommended_pending_confirmation` / `confirmed`。
- `options`: 2-3件で、最低1件は `cost_model.category=free|low-cost`。各要素は `id` / `label` / `cost_model` / `free_tier_limits` / `goal_fit` / `security_fit` / `pros` / `cons` / `risks` / `lock_in` / `ops_burden` / `evidence_refs` を持つ。`evidence_refs` は公式 `https` URL の非空配列。
- `cost_model`: `category` (`free|low-cost|paid|unknown`) / `amount` (free=0、low-cost/paid=正数、unknownのみnull可) / `currency` / `billing_period` / `tco` を持つ。ライセンス料金だけでなく構築・運用・移行・撤退費を `tco` に明示する。
- `recommendation`: 推奨を提示した状態では `option_id` / `rationale` / `comparison_basis` / `caveats` / `confidence` / `latest_checked_at` が必須。`comparison_basis` は `goal_fit` / `tco` / `security` / `operations` / `lock_in` の全軸を持つ。`caveats` は非空配列、`latest_checked_at` は RFC3339、`option_id` は options 内を指す。
- `serves_goals`: 非空で実在する U3 goal id を指す。
- `user_decision`: `confirmed` のときだけ必須。`{"option_id":"...","confirmed_at":"<RFC3339>"[,"note":"..."]}`。AI推奨 (`recommended_pending_confirmation`) はユーザー確認ではない。

```json
{
  "id": "D1",
  "question": "認証基盤をどれにするか",
  "status": "recommended_pending_confirmation",
  "options": [
    {
      "id":"managed-free", "label":"無料枠のあるmanaged認証",
      "cost_model":{"category":"free","amount":0,"currency":"JPY","billing_period":"month","tco":"無料枠内は月額0円、超過後は従量課金"},
      "free_tier_limits":"月間利用者上限あり", "goal_fit":"短期導入に適合",
      "security_fit":"managed更新とMFAで要件を満たす", "pros":["運用負荷が低い"],
      "cons":["上限超過時課金"], "risks":["価格改定"], "lock_in":"中", "ops_burden":"低",
      "evidence_refs":["https://vendor.example/pricing"]
    },
    {
      "id":"self-hosted", "label":"OSS self-hosted",
      "cost_model":{"category":"low-cost","amount":1000,"currency":"JPY","billing_period":"month","tco":"基盤費に保守工数を加算"},
      "free_tier_limits":"機能制限なし", "goal_fit":"内製運用できる場合に適合",
      "security_fit":"脆弱性更新を期限内に内製適用できる場合に適合", "pros":["移行自由度"],
      "cons":["保守が必要"], "risks":["脆弱性対応遅延"], "lock_in":"低", "ops_burden":"高",
      "evidence_refs":["https://project.example/docs"]
    }
  ],
  "recommendation": {
    "option_id":"managed-free", "rationale":"制約下で目的適合と総費用の均衡が最良",
    "comparison_basis":{"goal_fit":"短期導入に適合","tco":"無料枠内で最小","security":"managed更新を利用","operations":"保守負荷が低い","lock_in":"中程度を許容"},
    "caveats":["無料枠上限を監視"], "confidence":"medium", "latest_checked_at":"2026-07-11T00:00:00Z"
  },
  "serves_goals": ["G1"],
  "user_decision": null
}
```

```bash
python3 scripts/apply-spec-transition.py set-decision --state spec-state.json --decision decision.json
```

## KNOWLEDGE_CANDIDATES_EXTENSION_C — seed 外 knowledge lifecycle

`knowledge_candidates[]` は、固定seedに無い知識をproject-localに発見し、C02の公式一次資料確認を経て深いカードへ育てる領域である。書込は `set-knowledge-candidate` のみが行う。

- 必須共通項目: stable kebab-case `id` / stable `topic` / `status` / `problem` / 実在goalを指す`serves_goals` / `source_refs`。
- 状態は `discovered → qualified → deepened → promoted` の一段階前進のみ。同じstatusでの追記は許すが、巻き戻し・飛び級・topic変更は禁止。
- `qualified` 以降: `source_refs[]` は `{url, official_or_primary:true, checked_at}` を持ち、URLはHTTPS。qualification担当はC02 (`run-system-spec-doc-fetch`)。
- `deepened` 以降: `card` がC04 deep-cardの必須意味項目 (`purpose/background/problems/core_concepts/applies_when/does_not_apply_when/tradeoffs/failure_modes/goal_contribution/primary_sources/freshness`) を全て持つ。
- `promoted`: 保守担当の承認・curated配置を指す `curation_ref` が必須。自動昇格しない。

```json
{
  "id": "offline-first-conflict-resolution",
  "topic": "offline-first conflict resolution",
  "status": "qualified",
  "problem": "複数端末のオフライン更新競合を解決する必要がある",
  "serves_goals": ["G1"],
  "source_refs": [
    {
      "url": "https://www.rfc-editor.org/rfc/rfc6902",
      "official_or_primary": true,
      "checked_at": "2026-07-11T00:00:00Z"
    }
  ]
}
```

```bash
python3 scripts/apply-spec-transition.py set-knowledge-candidate \
  --state spec-state.json --candidate knowledge-candidate.json
```

## hearing_progress の意味論 (SSOT)

`hearing_progress` は goal-seek chunk の **中断/再開状態** を表す record。writer (`scripts/apply-spec-transition.py`) 以外は書かない。

> **不変則 (HarnessHub-d15)**: `complete` / `next_question` は state 全体の不変則である。matrix を書き換える全経路 (`init` / `add-category` / `apply` / `chunk`) は、終了時に未収集セル数から両 field を再同期する。writer 経由の state で「未収集セルが残るのに `complete=true`」は正常状態として発生しない。最終判定の正本は引き続き `validate-coverage-matrix.py --require-complete` とする。

| field | 型 | 意味 | 更新する経路 |
|---|---|---|---|
| `loop_count` | int | **直近 1 invocation (chunk) で適用した turn 数**。累計ではない。 | `chunk` / `bootstrap`・`init` |
| `max_loops` | int (任意) | 直近 `chunk` invocation に実際に指定された上限。監査は 5 をハードコードせず、この実値を使う。 | `chunk` |
| `next_question` | string \| null | 未収集が残ればカテゴリ順・platform 正順の次質問、未収集0なら `null`。 | matrix を書き換える全経路 |
| `complete` | bool | 未収集0なら `true`、1件以上なら `false`。 | matrix を書き換える全経路 |

- **累計ではない (loop_count)**: `run_chunk` はループ開始前に `loop_count = 0` を明示代入する。よって「通算で何 loop 回したか」は spec-state に保持しない。履歴の正本は `qa_log` / `reopen_log` の追記であり、`loop_count` を進捗率の分子に使わない (分母となる総 loop 数は事前に決まらない)。進捗は matrix の未収集セル数で測る。
- **全 matrix writer が再同期する**: `apply` で最後の未収集セルを埋めた場合も、`reopen` や `add-category` で未収集を増やした場合も、`complete` / `next_question` は同じ invocation の終了前に更新される。旧仕様の 2 マーカー除外 (`reopened_from` / `category_aggregate=未着手`) は不要であり、監査で適用しない。
- **早期停止監査**: 未収集が残るのに `complete=true` なら、writer 非経由の直接編集か state 破損として `FAIL` にする。loop 上限は `max_loops` があればその実値を使い、固定値 5 で判定しない。
- **`complete=true` かつ `loop_count=0` になる経路**: 未収集0の state に対して **適用 turn 数が 0 になる `chunk`** を実行した場合に限る。具体的には (a) `turns` が空配列、(b) `max_loops <= 0` (`--max-loops 0` および負値。argparse に下限検証がないため CLI から到達可能で、`processed >= max_loops` が初回反復で真になる) のいずれかで、`processed=0` のまま `unresolved==0` により `complete=true` が書かれる。`apply` だけではこの組合せに到達しない。
- **resume 契約**: `complete=false` かつ `next_question` 非 null が resumable な中断状態。この 2 field から再開する `--resume` は **skill/command の引数** (`commands/spec-hearing-start.md`) であって writer の CLI flag ではない (writer 側は state を読み直して `chunk` を継続するだけ)。`loop_count` は再開後の chunk で 0 から数え直す。

## qa_log の論点分離 (1 entry = 1 論点)

`qa_log` entry は監査 (C06) が「どの決定がどの往復に接地するか」を検証する単位であるため、**1 entry に 1 論点** を原則とする。

- 複数論点を 1 entry へ束ねると、後段で論点ごとの中立性・遡及性を分離検証できない (C06 2026-07-17 の qa-014 指摘がこの型)。
- 既登録 entry の `question` / `answer` は **逐語のまま改変しない** (writer は既存 `id` を上書きしない)。束ねが後から判明した場合は、既存 entry を編集せず **分離索引を新規 entry として追記** し、そこから元 entry を参照する (前例: qa-047 の再登録・qa-049 の逐語補記)。
- **追記の実行経路と副作用**: qa_log 専用の op は存在しない。`apply_turn` は turn に `qa_id` があれば **`ops` の有無にかかわらず** entry を追記する (同 `id` が既存なら追記しない)。したがって通常の `confirm` turn も qa_log を残す。一方 `apply --op` は turn に `qa_id` を載せられないため、**qa_log を追記できるのは `chunk --turns` 経路だけ**である。matrix を動かさずに索引だけ追記したいときは `{"qa_id": "...", "question": "...", "answer": "...", "ops": []}` (セル op 空) の turn を渡す。ただしこの経路も `loop_count` を 0 から数え直し `complete` / `next_question` を再計算する (`run_chunk` の副作用) ため、matrix を動かさない索引追記でも `hearing_progress` が書き換わる点を承知して使うこと。

### design_applications（回答原文と設計解釈の分離）

セルを `confirm` する qa entry は、C04 deep card または doctrine anchor の具体原則が当該回答へどう効いたかを `design_applications[]` に記録する。これは利用者の発言を改変しないため `answer` へ混ぜず、compiler が章固有の適用根拠を描画するための設計解釈として分離する。

- `knowledge_ref`: deep card path + section、または doctrine concern/authority を指す非空文字列。
- `principle`: 採否を判断した具体原則名。単なる「設計知識」「上記原則」は不可。
- `applicability`: `applied` / `not_applicable`。非適用も隠さず、理由を残す。
- `rationale`: 確定回答に即した章固有の採否理由。全章同一の定型文は禁止。
- `tradeoffs`: 採用費用、非採用時の損失、再評価条件などを最低1件持つ非空文字列配列。

writer は上記形状を検証して qa entry に保存する。新規 state は `schema_version: "1.1"` と `design_application_contract_version: "1.0"` を持ち、`validate-coverage-matrix.py --require-complete` が確定セルから参照される全 qa entry の非空・形状と provenance の完全一致を fail-closed に再検査する。marker の無い旧 `schema_version: "1.0"` state は読み取りだけ可能で、writer の更新操作は fail-closed に拒否する。再開時は R1 の `init --state` を明示実行し、matrix を未収集へ戻して 1.1 へ移行する。この schema 境界が legacy 免除の終了条件であり、1.1 以降で marker 欠落を許さない。移行済み state に一時的な `legacy_exempt: true` と非空 `legacy_exempt_reason` が残った場合に限り、`set-qa-design-applications` が既存の question / answer / source を維持したまま検証済み `design_applications` を追記し、`design_application_provenance={"mode":"legacy_backfill","writer":"set-qa-design-applications"}` を残して旧免除 metadata を除去する。provenance の無い既存解釈は対話経路として保護し、legacy 表示の後付けを拒否する。完了済み legacy backfill の同一 payload 再適用のみ冪等に受け入れ、異なる既存解釈または provenance の上書きは拒否する。C03 は `unrecorded` (解釈欠落) / `dialogue` (対話時解釈) / `legacy_backfill` (事後補完) の3経路を描画し、C05 は unrecorded を未記録 finding とし、backfill は対話時解釈と区別して回答との適合を再照合する。存在確認だけで `design_knowledge_reflection` を緑化させない。

## 単一 transition writer 契約

`scripts/apply-spec-transition.py` のみが matrix / logs / aggregate / hearing_progress / targets / requirements_foundation を書き換える。

- **確定巻き戻し拒否**: `確定` セルへの `confirm` / `exclude` は `TransitionError`。Bash/script 経由でも拒否。
- **R4-reopen 経由のみ確定変更**: `確定` を動かせるのは `reopen` (要 reason) だけ。`未収集` へ戻し `reopen_log` に根拠を残す。
- **goal-seek chunk**: `chunk` は 1 invocation で最大 `max_loops` turn を適用し、その実値を `hearing_progress.max_loops` に保存する。未収集が残れば `complete=false`・`next_question` 非 null、未収集0なら `complete=true` とする。後続の `reopen` / `add-category` / `apply` も同じ不変則へ再同期する。
- **set-targets**: `targets[]` の唯一の書込経路 (上記「targets と set-targets op」)。
- **set-foundation / set-serves / set-approval / set-decision / set-knowledge-candidate / set-qa-design-applications**: `requirements_foundation`、確定セルの `serves_goals`、確定セルの `approval_ref`、`decisions[]`、`knowledge_candidates[]`、既存 qa の設計解釈の唯一の書込経路。`set-serves` / `set-approval` は確定セル限定、`set-qa-design-applications` は既存 qa 限定の additive annotation で、いずれも確定セルの `state` や Q&A 原文を変えない。

## 検証 (deterministic gate)

- loop 中: `python3 $CLAUDE_PLUGIN_ROOT/scripts/validate-coverage-matrix.py --matrix spec-state.json` (exit0)。
- 最終: 同コマンド `--require-complete` (未収集0 必須, exit0)。
