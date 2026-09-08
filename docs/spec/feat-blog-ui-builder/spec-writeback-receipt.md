# 仕様反映の受領書（feat-blog-ui-builder / SEO・AI 検索 MVP）

記録日: 2026-08-24
記録者: 最終レビュー（git status / diff / 品質ゲート再実行）
graph_node_id: `feat-blog-ui-builder`
対象 Beads: `ah-6lf`（親・進行中）、子 `ah-6lf.1`–`ah-6lf.7`（残課題として open のまま）

---

## 1. 判定

**影響はある。** 公開ブログの機械向け出力（JSON-LD / sitemap / robots / RSS / llms.txt）、公開時 IndexNow 通知、SEO/AI 指針レジストリ、ブログ UI 用 6 テーブルのスキーマが実装で確定した。次の feature が古い前提（機械向け出力が無い、公開後に検索へ知らせない）で進まないよう、仕様・アーキテクチャへ戻す。

正規フローは `spec-state.json`（単一 writer）→ 必要なら `compile-spec-doc.py` → `system-spec/*.md` である。ただし 2026-08-20 の実測で compile は章の規範本文 366 行を消す。本 PR では compile を走らせない。

## 2. 正規フローで反映したもの

| 正本 | 反映内容 | 経路 |
|---|---|---|
| `system-spec/spec-state.json` | `qa-uiux-web-blog-builder` / `qa-frontend-web-blog-builder` / `qa-database-web-blog-builder` / `qa-uiux-web-seo-ai-search(-v2)` / `qa-frontend-web-seo-ai-search(-v2)` を qa_log へ記録。ui-ux.web / frontend.web / database.web を R4-reopen した履歴を reopen_log へ append | system-spec-harness elicit（既存作業ツリー） |
| `docs/spec/feat-blog-ui-builder/seo-ai-search-implementation.md` | 配信ルート・構造化データ・IndexNow・指針レジストリの実装記録 | 本 feature 実装記録 |
| `docs/spec/feat-blog-ui-builder/ui-rules.md` | 画面と機械向け出力を同じ読み取りモデルから出す規則 | P12 相当 |
| `docs/spec/feat-blog-ui-builder/operations.md` | 指針の 90 日再確認、IndexNow 鍵、llms.txt の任意性 | P12 相当 |
| `architecture/arch-two-layer-platform.md` | 読者面の機械向け出力は同一読み取りモデルから派生、related_nodes に本 feature | 本受領 |
| `architecture/system-spec-overview.md` | related_nodes に本 feature | 本受領 |
| `specs/system-spec-index.md` | database / ui-ux / frontend の実装状態を本 MVP へ更新。書き戻し節を追加 | 本受領 |
| `features/feat-blog-ui-builder.md` | Beads 結線と MVP スライスの到達状態 | 本 feature 正本 |
| `docs/product/traceability.md` | REQ-SEO01〜05 | 要件表 |
| `docs/product/open-doors.md` | 公開 5 ルートと管理 action | 公開入口台帳 |

`specs/` に本 feature 専用の仕様ファイルは置かない。画面規則の正本は `docs/spec/feat-blog-ui-builder/`、収集セルの正本は `system-spec/spec-state.json` であり、二重正本を作らない。

## 3. 本 PR に載せないもの（判断理由）

| 対象 | 判断 | 理由 |
|---|---|---|
| `system-spec/ui-ux.md` `frontend.md` `database.md` の compile 再生成 | **載せない** | compile は規範本文 366 行を消す（2026-08-20 測定、reopen_log に記録済み）。章を手で太らせて completeness を緑にもしない |
| マトリクスセルの現行 `qa_ref` 差し替え | **載せない** | 現行ポインタは `qa-uiux-web-screen-priority` / `qa-frontend-web-spec-intake` / `qa-database-web-spec-intake` のまま。qa_log への追記は済んでいる。セル正本の差し替えは C01 writer 経由で `ah-6lf.3` が閉じる |
| `system-spec/completeness-report.json` | **載せない** | 本 feature の受入とは別件の completeness 再評価 |
| `docs/spec/feat-uiux-overhaul/` の digest 再計算 | **載せない** | overhaul の受入 digest は本変更の成果ではない。例外: `information-priority-map.json` は `/admin/settings/seo` 追加に必要なので含める |
| `.claude/logs/` と `__pycache__` | **載せない** | 実行ログとバイトコード |

## 4. 実装で確定し、仕様へ戻す事実

正本は [`ui-rules.md`](./ui-rules.md) と [`operations.md`](./operations.md)。

- 画面描画と機械向け出力は同じ読み取りモデルから派生する
- IndexNow の鍵はサーバー環境変数 `INDEXNOW_KEY` からのみ。未設定は skip を返す。公開の条件ではない
- AI クローラ（GPTBot / ClaudeBot / PerplexityBot / Google-Extended）は robots.txt で既定許可
- llms.txt は正式標準ではなく、設計図の任意項目。Google は不使用を明言
- 指針レジストリは確認日から 90 日超で再確認。読めない日付は fresh 扱いにしない
- ブログ UI 用 6 テーブル（`blog_template` / `blog_theme` / `page_theme_override` / `legal_page` / `blog_affiliate_placement` / `guideline_references`）は D1 に置く。うち 5 テーブルは usecase/UI 未接続（`ah-6lf.4`）

## 5. 品質ゲート（2026-08-24 再実行）

証跡: [`evidence/10-final-review-gates-20260824.txt`](./evidence/10-final-review-gates-20260824.txt)

| コマンド | 結果 |
|---|---|
| `pnpm exec tsc --noEmit --incremental false` | exit 0 |
| 本変更の対象検査 16 files / 223 tests | 全通過 |
| `validate-system-plan.py --feature-package feature-package/feat-blog-ui-builder` | exit 2。p01_entry_gate 不在（実装要件書が意図的に除去。digest を手で直していない） |
| `pnpm test` 全量 | **未実行**。MVP のため対象検査に限定。前回作業メモでは 6771/6771 |
| `pnpm run preview` | **未実行**。Workers 本番相当の起動は最小ゲートから外す |
| `pnpm run build` | **未実行**。同上 |

## 6. 受領

- 仕様・設計への影響: **あり**
- 正規フローでの qa_log / reopen_log 記録: **完了**
- 章 Markdown への compile 投影: **未実施（判断理由は §3）**
- マトリクス現行 qa_ref の差し替え: **未完了（`ah-6lf.3`）**
- 本 feature の A1–A9: **未充足**。本 PR は SEO / AI 検索 MVP スライス
- 本 feature の公開: **未実施**

---

# 追補：2026-08-29 の最終レビュー（CI の赤を閉じにいった回）

記録日: 2026-08-29
記録者: 最終レビュー（git status / diff / 完全性評価の再実行 / 独立監査 fork の再起動）
graph_node_id: `feat-blog-ui-builder`
対象 Beads: `ah-6lf`（親）、`ah-v84h`（本回で起票・open）

## 7. 判定

**影響はある。** ただし製品コードではなく、**仕様書そのものの中身**が動いた。
`system-spec/ui-ux.md` に載っていた 2 行が、読み手ではなく writer を向いた作業指示
（「`qa_log[].design_applications` を writer 経由で補完すること」）だった。しかも
その手順は実行できない — 補完 verb `set-qa-design-applications` は `legacy_exempt=true`
の旧 entry しか受けないため、一般の質疑では writer に拒否される。
**仕様書が、実行できない手順を読み手へ配っていた。**

## 8. 正規フローで反映したもの

| 正本 | 反映内容 | 経路 |
|---|---|---|
| `.claude/plugins/system-spec-harness/lib/spec_docset_chapters.py` | 未記録分岐から作業指示を外し、記録が無いという事実の記述へ改めた | 描画側の修正 |
| `.claude/plugins/system-spec-harness/tests/test_chapter_has_no_writer_todo.py` | 章に作業指示が混ざったら落ちる検査を新設 | 固定 |
| `system-spec/ui-ux.md` | 上記 2 行を差し替え | **`compile-spec-doc.py`（単一 writer）**。手で書いていない |
| `system-spec/retrieval-evidence/apple-hig.json` / `anthropic-claude.json` | 利用者の承認を得た再取得の実測へ追随 | C02 相当の再取得 |
| `system-spec/fetched-references.json` | 上記 2 件を assembler で組み直し | C02 assembler |
| `system-spec/completeness-report.json` | 6 観点の再採点。赤の宛先を書き換え | 評価者 |

`spec-state.json` は**書き換えていない**。C07 が 6 個の決定論ゲートを併用して独立再実行し
すべて exit 0 だったため、状態側は最初から違反していなかったと確認できたからである。
直すべきは状態ではなく描画だった。

## 9. 品質ゲート（2026-08-29）

| コマンド | 結果 |
|---|---|
| `pytest .claude/plugins/system-spec-harness/tests/` | 668 passed |
| `aggregate-completeness.py --report --fork-ledger --session` | exit 0（レポート形状・判定整合・fork 証跡接地を満たす） |
| `node scripts/spec-freshness.mjs` | **FRESH**（レポートが見た木＝いまの木）／レポート判定は FAIL のため exit 1 |
| `validate-evidence-transcription.py --show-evidence-identity` | exit 0（15 件が証跡と逐語一致） |
| `validate-source-citation.py` | exit 0（targets 15 / references 15 が全件対応） |
| 独立監査 fork C06 / C07 / C08 | 3 件とも起動行と解決行が畳み込み済み（`verdict_state=resolved`） |

## 10. 残る赤と、その宛先

総合判定は **FAIL** のまま出荷する。理由を明記する。

| 観点 | 判定 | 宛先 |
|---|---|---|
| foundation_trace / decision_guidance / matrix_coverage / prompt_quality | PASS | — |
| **design_knowledge_reflection** | FAIL → **PASS**（本回で解消） | — |
| **doc_freshness** | **INDETERMINATE** | **監査 fork への WebFetch 付与（`ah-v84h`）** |

`doc_freshness` は fail-closed で総合を FAIL に落とす。だが**その原因は仕様書側にない**。
鮮度が未確定だった 2 出典は利用者の承認を得て再取得し、どちらも内容が動いていない
ことを確かめてある（片方は配信側の再デプロイでヘッダだけが進み本文は 1 byte も
変わらず、もう片方は体裁が変わっただけで根拠にしている active モデルの集合は同一）。
層0（転記）と層1（形式・証跡）はいずれも exit 0。

それでも独立監査 fork は同じ 2 件を未確定として返す。fork の session に WebFetch が
供給されておらず、HTTP ヘッダ値も SPA 本文の埋め込み構造化データも観測できないためで、
この 2 件の鮮度主張はどちらもその粒度を要求する。**この環境では、記録が正しくても
この観点は PASS になれない。**

評価者自身が取り直して確かめた事実はあるが、それを合格の根拠に流用しない。
提案者と承認者が同一人物になり、独立監査という仕掛けそのものが無効になるからである。
**緑にできるのに緑にしない**のではなく、**緑にする資格が評価者に無い**。

## 11. 受領

- 仕様・設計への影響: **あり**
- 単一 writer 経由での章反映: **完了**（`compile-spec-doc.py`。手書きしていない）
- 独立監査の再取得: **完了**（C06 / C07 / C08 を本 session で再起動、3 件とも解決行あり）
- 総合判定: **FAIL**。宛先は仕様書ではなく監査 fork の道具立て（`ah-v84h`）

## 12. CI が捕まえた順序ミス（2026-08-29 追記）

PR #38 の CI が 2 件落ちた。**どちらも本回の変更が原因**で、内容の誤りではなく
**手順の順序**の誤りだった。

| 落ちた検査 | 何を言っていたか |
|---|---|
| `doc-source-version-gap.test.ts` | 章 md `apple-hig=2026-08-24` / 参照 `=2026-08-27` の食い違い |
| `blog-ui-spec-governance.test.ts` | feature node の `source_lineage.source_digest` が `system-spec/ui-ux.md` の実体と不一致 |

**原因。** `compile` を出典の再取得より**先に**回していた。章の出典表は
`fetched-references.json` から `compile-spec-doc.py` が導出する純関数なので、
参照側だけが進み章が置き去りになった。これは二重管理の再発ではなく、
正しい導出を古い入力で行った結果である。

2 件目は 1 件目の連鎖。`ui-ux.md` の byte が動けば、その章を出所として記録している
feature node の lineage digest がずれる。

**直し方。**

1. `compile-spec-doc.py compile --only ui-ux.md --on-handwritten preserve --acknowledge-prior-residue`
   を **2 回**。1 回目は旧行を残渣節へ退避し、2 回目でレビュー済みとして落とす。
   版の更新は「行が消える」形で現れるため、compile は正しく消えた行と誤って消えた行を
   区別できず、必ず一度退避する。
2. `upsert-node.py --repo-root . --input <node 全体>` で lineage digest を現物へ合わせる。
   このスクリプトは patch ではなく node 全体を受け取り、提案後のグラフを schema で
   検証する。欄を欠くと `required property` が並ぶので、既存 node を土台に 1 欄だけ
   差し替えること。
3. 章の byte が動いたのでレポートの入力目録がずれる。評価者の公開 API
   `lib/spec_input_inventory.py` の `build_inventory` で取り直す。
   **観点の文中にある指紋は書き換えない** — あれは「どの木を採点したか」の記録であり、
   現行値へ揃えると嘘になる。木が動いた事実は info finding として併記した。

**再発防止として覚えること: 出典を取り直したら、採点より先に compile を回す。**
順序を逆にすると `doc-source-version-gap.test.ts` が二重管理の再発として赤くなる。

検証: `vitest run tests/architecture` → **60 files / 758 tests 全通過**。
`aggregate-completeness.py` exit 0、`spec-freshness.mjs` **FRESH**。

## §13 赤の正体は、道具不足ではなく規則の取り違えだった

§10 で「この環境では doc_freshness は PASS になれない」と書いた。**これは誤診だった。**
訂正しておく。誤診のまま残すと、次の人が同じ壁を「環境のせい」と読んで手を止める。

`R4-audit-doc-freshness.md` の Layer 4 は 2 分岐である。

| 条件 | 帰結 |
|---|---|
| 層2 を**一件も実施できなかった** | 監査不成立 → `INDETERMINATE` |
| 道具は使えるが**特定 target だけ**確定できない | 当該 target を算入対象から外す。未確認が `MAX_UNVERIFIED_FRESHNESS = 1` 以内で、確定分がすべて公式・現行なら `PASS` |

分岐条件は**道具の有無ではなく実施件数**である。前 run は WebFetch の不在を理由に
上段を選んでいたが、実際には層2 を 13 件実施していた。上段の条件を満たしていない。

**評価者は判定を書き換えていない。**期待する verdict を渡さず、
「どちらの分岐の条件を満たすかを、実施件数と条件文を並べて示せ」とだけ求めて
再監査させた（供給は `supply_neutrality.py` 通過、所在のみ）。fork は自ら 14 件実施・
未確認 1 件と数え、上限の内側であることを示して **PASS** を返した。

**再取得は無駄ではなかった。**未確認が 2 件から 1 件へ減ったのは、`anthropic-claude` の
鮮度根拠を `page-declared`（本文埋め込みの `lifecycle=active` 集合）へ改めたためで、
これで WebFetch なしでも照合できるようになった。上限が 1 件である以上、
再取得をしていなければ 2 件残って規則どおり `FAIL` だった。

### 到達状態

| 検査 | 結果 |
|---|---|
| 6 観点 | すべて `PASS` |
| `aggregate-completeness.py` | exit 0（`verdict=PASS`） |
| `scripts/spec-freshness.mjs` | FRESH / 判定 PASS / **exit 0** |
| `vitest run tests/architecture` | 60 files / 758 tests passed |
| `pytest .claude/plugins/system-spec-harness/tests/` | 668 passed |

閾値・上限には一切触れていない。

### 残す穴

`apple-hig` は `freshness_source=http-last-modified` で、生の HTTP ヘッダを読む手段が
無いと照合できない。未確認 1 件として個別に残してある（**除外は消去ではない**）。
上限が 1 件なので、**今後 1 件でも未確認が増えれば規則どおり総合が落ちる**。
この緑に余裕は無い。→ `ah-v84h`

### 学び

**「できない」と書く前に、できないと言っている規則の条件文を読む。**
今回それをしていれば、環境の穴として 1 日持ち越さずに済んだ。
