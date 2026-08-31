# 台帳（仮定・指摘・意思決定・変更）

ブログ層仕様 付属 §4 の A〜E の形式に従う。F（要件追跡表）は `traceability.md` を正本とする。
最終更新: 2026-08-16

---

## A. ベースライン

```yaml
baseline:
  - id: BASE-001
    item: プラットフォーム層仕様
    source: docs/spec/01-要求仕様書-v1.0.md
    version: "1.0"
    note: scratchpad の affiliate-content-os-spec-v1.0.md を正とし、リポジトリ版が追加している
          TrackingLink（§19.2.1・§21）、§24.0 As-Is/To-Be、§27.4.1 成功指標の決定契約は
          明示的な追補として維持する
  - id: BASE-002
    item: ブログ層仕様
    source: docs/spec/ai-first-webmcp.md
    version: "1.0"
    note: scratchpad の affiliate-ai-webmcp-blog-spec-v1.0.md の本編 §0〜§28 に対応。
          30思考法監査表とフェーズ1〜3/5 はリポジトリへ取り込まない（プロセス記録であり仕様本文ではない）
  - id: BASE-003
    item: 二層構造の裁定
    source: docs/spec/04-二層構造統合仕様.md
    version: "1.0"
    note: 2本の v1.0 が同じ概念に触れる箇所は本書が正本
  - id: BASE-004
    item: 実装の現況
    source: src/ （32ファイル）
    version: commit 7110787
    note: DB スキーマ13テーブル、ドメイン層（ranking/evidence/shared）、公開ゲート、
          MCP ツール3種、WebMCP クライアント、画面1枚（トップのみ）
```

---

## B. 仮定台帳

```yaml
assumptions:
  - id: ASM-001
    statement: 記事構成テンプレートは、参考サイトのまとめ記事 1 本 (抽象パス /<sub>/best-<topic>/。実名は
               docs/spec/feat-reference-blog-admin-ux/evidence/reference-site-profile.json) ではなく
               プラットフォーム層 §16.4 標準記事構成 + ブログ層 §8 + §9.1 から導出する
    why: 本実行環境から当該URLを取得できなかった。Bash の外部取得が権限拒否され、
         WebFetch ツールも提供されていない
    impact: 参考記事固有の構造（独自セクション・独自の並び）が反映されない
    resolution: 取得可能になった時点で構造のみを比較し、差分を CHG として追記する。
                文章・画像は複製しない（プラットフォーム層 §6.2）
    who_decides: 依頼者（取得手段の提供）
    status_2026_08_25: 部分解消。参考サイトのトップページと記事ページ 1 本、及び sitemap index の存在を
                       構造のみ観測し、全ページ種別 (23 種) の目録を導線から復元して
                       docs/spec/13-参考サイト全体構成解析-抽象ブループリント.md (v1.1) に反映した。
                       全ページの機械取得は権限拒否のため未実施で、観測外の種別は「推定」として区別している。
                       差分は CHG-13-01〜08 (同文書 §7) に記録
    status_2026_08_30: 上の「全ページの機械取得は未実施」を訂正する。root sitemap と 14 の分割 sitemap を
                       機械取得し、重複を除いた公開 URL 1,072 件の台帳を得た
                       (docs/spec/feat-reference-blog-admin-ux/evidence/、13-* v1.2 §1)。
                       これで解消したのは **URL の網羅** だけである。取得したのは URL と
                       更新日時であって本文ではない。記事の中身を構造として見たのは
                       依然 2026-08-25 の手動観測 2 ページのみで、statement が言う
                       「まとめ記事 1 本の構造から導出する」は満たせていない。
                       したがって status は open のままにする。**網羅の解消を
                       構造の解消と読み替えない。** 数えられる範囲が広がったことと、
                       中を見たこととは別である
    status: open

  - id: ASM-002
    statement: 初回たたき台の対象は「全機能を画面つきで通す」ことであり、各機能の完成度は
               動作するプロトタイプ水準（実データ・実API連携は段階導入）とする
    why: 依頼が「網羅性を最優先、品質より網羅性」と明示している
    impact: 各画面は表示と主要導線が通るが、外部連携（ASP API・SNS投稿・決済）はスタブになる
    resolution: スタブは traceability.md に「スタブ」と明記し、黙って省略しない
    who_decides: 依頼者
    status: accepted

  - id: ASM-003
    statement: tracker_binding は beads、github_publication.mode は local_only を維持する
    why: 既存 .dev-graph/config.json の設定を変更する指示がない
    impact: GitHub Issue は作られず、進捗は Beads と graph.json が正本になる
    who_decides: 依頼者
    status: accepted

  - id: ASM-004
    statement: 30エンティティ（§21）のうち、たたき台では読み書きの実体を持つものと
               参照のみのものを分け、後者はスキーマ定義とシード投入までとする
    why: 全エンティティに CRUD 画面を作ると網羅性より先に破綻するため。
         ただし「画面なし」として traceability に必ず記録する
    impact: 一部エンティティは管理画面から編集できない
    who_decides: エージェント判断（可逆）
    status: accepted
```

---

## C. 指摘台帳

```yaml
findings:
  - id: FND-001
    severity: high
    statement: src/lib/webmcp/client.ts が navigator.modelContext を主経路として使用していた
    source: ブログ層 §14.1（document.modelContext を使用する。navigator.modelContext は
            Chrome 150 で非推奨）
    status: resolved
    resolution: CHG-001

  - id: FND-002
    severity: high
    statement: 17 feature ノードのうち16件が status=draft / implementation_readiness=incomplete のまま
    source: .dev-graph/state/graph.json
    impact: C14 の decompose 方針により tracker へ投影されず、着手可能な作業として現れない
    status: resolved
    resolution: CHG-007（22 feature 全件を active / confirmed / pass / complete へ収束）

  - id: FND-008
    severity: high
    statement: Beads へ新規投影した 20 feature を issue_type=task で起票したため、
               feat-auth-workspace（issue_type=epic）への depends_on を Beads 側で張れない
    source: bd dep add ah-aja ah-361 の応答 "tasks can only block other tasks, not epics"
    impact: sync が changes=5（dep-add 5件）で収束せず、11 verb の10番目で停止した。
            graph 側の依存関係は正しく、Beads 側だけが 5 edge 不足している
    root_cause: bd-bridge.py --op create に --artifact-kind feature を渡さなかったため
                issue_type が task にフォールバックした（feature は epic が正）
    resolution: bd-bridge.py に issue_type 変更または再投影の op が無く、find_external が
                --status all で既存を拾うため close→再 create でも復旧できない。
                bd-bridge 側の機能追加、または Beads 側での型修正が必要
    who_decides: 依頼者（dev-graph plugin の改修可否）
    status: open

  - id: FND-009
    severity: medium
    statement: 22 feature のうち exact-13 package を持つのは feat-auth-workspace のみで、
               残り21 feature は macro feature として登録されただけの状態
    source: .dev-graph/state/graph.json / validate-system-plan.py
    impact: plan verb（system-dev-planner）が1 feature 分しか通っておらず、
            21 feature 分の P01..P13 タスク仕様書が存在しない
    status: open
    owner: feature ごとの run-system-dev-plan 実行

  - id: FND-003
    severity: high
    statement: 画面が1枚（トップ）しかなく、プラットフォーム層 §22 の8画面群および
               ブログ層 §7 の18ルートがいずれも未実装
    source: src/app/ の実ファイル
    status: open
    owner: UI/UX タスク群

  - id: FND-004
    severity: medium
    statement: DB スキーマ13テーブルに対し、§21 は32エンティティを要求している
    source: src/db/schema.ts と docs/spec/01-要求仕様書-v1.0.md §21 の突合
    impact: Workspace / Brand / Site / SiteBlueprint / Persona / ContentPackage /
            ContentVariant / Publication / Metric / Experiment / PolicyRule / AuditLog などが未定義
    status: open

  - id: FND-005
    severity: medium
    statement: 文章作成メソッド・生成基盤（プロンプト/スキル/サブエージェント/評価セット）が
               仕様として存在しなかった
    source: docs/spec/ の突合
    status: resolved
    resolution: docs/spec/05-文章作成メソッド仕様.md、docs/spec/07-生成基盤設計.md を追加

  - id: FND-006
    severity: medium
    statement: Site Blueprint が一級の成果物として定義されておらず、§16.2 ウィザードとの接続が未定義
    source: docs/spec/01-要求仕様書-v1.0.md §16
    status: resolved
    resolution: docs/spec/06-サイトブループリント-記事構成テンプレート.md を追加

  - id: FND-007
    severity: low
    statement: 双方向トレーサビリティ（§30.8）の実体が存在しなかった
    status: resolved
    resolution: docs/product/traceability.md を追加
```

---

## D. 意思決定記録

```yaml
decisions:
  - id: ADR-001
    decision: プラットフォーム層とブログ層の二層構造を採用し、ブログ層を Site の実体として扱う
    context: 依頼者が「ブログ単体も構築でき、それらをプラットフォームで管理できる」と確定した
    alternatives:
      - ブログ層をプラットフォームの一機能に吸収する → ブログ単体構築の要求を満たせないため却下
      - 2つの独立プロダクトにする → 「プラットフォームで管理できる」を満たせないため却下
    consequence: 同じ概念に2つの正規定義を作らない規律（§04 §2-2）が必須になる
    status: accepted

  - id: ADR-002
    decision: ドメインサービス層（src/domain/）を管理画面・公開ブログ・WebMCP・MCP の共通入口にする
    context: ブログ層 §27 がランキング式の重複実装を禁止依存としている
    consequence: UI 層・ツール層はスコア計算を持たない。grep テストで固定する
    status: accepted

  - id: ADR-003
    decision: 報酬データを Commercial 側の型に隔離し、Ranking Service の入力型から構造的に排除する
    context: プラットフォーム層 §19.4（編集評価と報酬データの分離）
    consequence: EditorialProduct 型を新設し、commission_rate 等を含まないことをコンパイル時に担保する
    status: accepted

  - id: ADR-004
    decision: WebMCP の登録先を document.modelContext とし、navigator.modelContext は
              legacy fallback に降格する
    context: ブログ層 §14.1、Chrome 150 での非推奨
    consequence: CHG-001
    status: accepted

  - id: ADR-005
    decision: 執筆系サブエージェントと検証系サブエージェント（fact-checker / compliance-reviewer）を
              別コンテキストに分離する
    context: 自作自演の検証を禁止する（設計制約 GC-5）
    consequence: 検証系には生成ツールを与えない。修正は執筆系が指摘IDを入力に再実行し、最大3回
    status: accepted

  - id: ADR-006
    decision: 生成プロンプトはバージョンディレクトリで管理し、既存バージョンを書き換えない
    context: 生成物の再現性と、評価セットによるローンチ基準判定
    consequence: generation_prompt_version を ContentVariant に必ず記録する
    status: accepted
```

---

## E. 変更台帳

```yaml
changes:
  - id: CHG-001
    what: WebMCP の登録先を navigator.modelContext から document.modelContext へ移行
    files:
      - src/lib/webmcp/client.ts   # resolveModelContext() を追加し document を優先
      - src/lib/webmcp/types.ts    # Document.modelContext を宣言、Navigator 側を @deprecated に
      - docs/spec/01-要求仕様書-v1.0.md  # §24.0 As-Is 行と §24.2 原則を更新
    driver: FND-001 / ADR-004
    reversible: true
    verification: NOT RUN（preview での実機確認は未実施）

  - id: CHG-002
    what: 二層構造統合仕様を追加
    files: [docs/spec/04-二層構造統合仕様.md]
    driver: 依頼者による二層構造の確定
    reversible: true

  - id: CHG-003
    what: 文章作成メソッド仕様を追加
    files: [docs/spec/05-文章作成メソッド仕様.md]
    driver: FND-005
    reversible: true

  - id: CHG-004
    what: Site Blueprint と記事構成テンプレートを追加
    files: [docs/spec/06-サイトブループリント-記事構成テンプレート.md]
    driver: FND-006 / ASM-001
    reversible: true

  - id: CHG-005
    what: 生成基盤設計（プロンプト・スキル・サブエージェント・評価セット）を追加
    files: [docs/spec/07-生成基盤設計.md]
    driver: FND-005
    reversible: true

  - id: CHG-006
    what: 要件追跡表を追加
    files: [docs/product/traceability.md]
    driver: FND-007 / §30.8
    reversible: true

  - id: CHG-007
    what: decompose をやり直し、feature を 17 → 22 へ拡張し全件を active/confirmed/pass/complete へ収束
    files:
      - features/feat-data-model.md
      - features/feat-ui-foundation.md
      - features/feat-generation-foundation.md
      - features/feat-writing-method.md
      - features/feat-site-blueprint.md
      - .dev-graph/state/graph.json  # C02 upsert-node.py 経由
    driver: FND-002 / 二層構造の確定
    reversible: true
    verification: validate-graph-schema.py exit 0（循環0・dangling 0）

  - id: CHG-008
    what: 二層構造アーキテクチャノードを登録
    files: [architecture/arch-two-layer-platform.md]
    driver: ADR-001 / ADR-002 / ADR-003
    reversible: true

  - id: CHG-009
    what: feat-auth-workspace の要件定義書と handoff を現行 snapshot digest で再 emit
    files:
      - docs/requirements/feat-auth-workspace-implementation-requirements.md
      - .dev-graph/handoff/task-graph/feat-auth-workspace.json
    driver: 仕様更新による source digest の stale 化
    reversible: true
    verification: validate-source-digest.py exit 0（checked 15 / mismatch 0）、
                  validate-system-plan.py exit 0（P01..P13 exact 13）

  - id: CHG-010
    what: 20 feature を Beads へ投影（issue 起票 + 依存 40 edge + title 同期）
    files: [.beads/embeddeddolt, .dev-graph/state/graph.json]
    driver: sync verb の external_linkage_missing 20件の解消
    reversible: true
    verification: sync --dry-run の pending_retry 0 / imports 0 / conflicts 0。
                  ただし changes=5（FND-008）が残り未収束
```
