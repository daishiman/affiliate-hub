# ブロックエディターの再検証（2026-09-06）

## フェーズ1：思考リセットと俯瞰

過去の PASS 判定を今回の結論として引き継がず、現在のワークツリーのコード・仕様・実際の操作を根拠に再検証する。作成済みの成果物と未コミットの変更を保持する。

対象は `feat-article-block-editor` の19種の本文ブロック、管理画面の編集・保存、記事の公開描画、画像・商品API、画像の保存と回収、関連する仕様と回帰検証。参考ブログは既存の仕様と参照調査で共有されている `https://makuring.jp/`。記事の文章や素材は転用せず、情報の配置と読者の操作を参照する。

現状は、記事全体の章立てを担う `ArticleBlock` と、節内の本文を担う `ProseNode` の2層。保存は既存互換の拡張Markdown文字列。管理画面は `ProseEditor`、公開画面は `ProseBody` と canonical article composition を使用し、画像は認証付きWorker経由でR2へ保存する。

第一印象の検証論点は、(1) 設計で宣言した描画共有と実装の一致、(2) 入力・並べ替え・復元・再読込時の内容保持、(3) 19種の一覧性と編集方法の発見しやすさ、(4) 下書きと公開内容・画像の公開条件の一致、(5) 既存のテンプレート部品と本文部品の責務境界、(6) 仕様・受入記録に残る古い名称・判定・未検証事項。

フェーズ1完了。以降は論理・構造9観点、メタ・発想9観点、システム・戦略・問題解決12観点を独立した3エージェントで並列検証する。3件の結果が揃うまで改善実装は開始しない。

## 結論（現在の判定）

30観点の分析を3エージェントで並列実施し、全結果の受領後に改善した。種類別の入力、履歴、変換、公開描画の責務を分け、保存で文字を失う不具合、非同期操作で別の編集を巻き戻す不具合、非公開画像の取得・公開権限の迂回を修正した。

継続指示後、画像の安全な物理・孤児回収、配置変更と公開JSONの原子的同期、並行復元の競合防止を実装した。隔離した実Worker・D1・R2による保存→公開→匿名閲覧→取り下げはデスクトップと375pxで成功。途中で見つかったスマホのクリック消失と公開著者情報の重複も回帰検証の対象とした。

2026-09-06の本人回答「ok」により、画像送信はWorker経由へ統一する決定となった。正規writerでdecision・infrastructure.web・security.webを確定し、canonical章にも反映済み。旧直接PUT承認と回答待ちだった記録は履歴に保持する。

その後、正規writer/compilerで8章67要件を再編纂し、章構造・引用・出典・指紋の既知不整合を解消した。外部の独立auditor 3系統によるformal completeness評価、digest-bound receipt、C19 resume import、現行P01〜P13の計画・投影・lineageを現在入力へ同期した。2026-09-08の最終再検証では521ファイル・11,751テスト、lint、型検査、Next build、仕様・グラフの決定論ゲートがすべてPASSした。

したがって、`feat-article-block-editor` のローカル実装・仕様・依存関係について、依頼された4条件は現在すべてPASSである。後述のFAIL件数と未達表は、問題を隠さないために残した2026-09-06時点の履歴であり、現在の判定ではない。remote migration、deploy、実運用データの変更は今回の権限・完了条件に含めず、未実施のまま保持する。共有タスクの正本であるBeads `ah-8oig` は他の作業も含むためin_progressを維持する。

## フェーズ2：30観点の検証結果

以下は判断の要約と観測事実であり、推論過程の逐語記録ではない。9＋9＋12＝30観点を省略なく担当分離し、各グループの結果が揃うまで改善に進まなかった。

### 論理・構造（logic_structure、9観点）

| # | 思考法 | 観測・判断と改善への接続 |
| --- | --- | --- |
| 1 | 批判的思考 | 「往復で不変」という宣言を区切り記号入り入力で検査すると内容欠落が再現。種類数の合格を保存の保証に流用しない。 |
| 2 | 演繹思考 | UIが太字＋斜体を許す以上、複合装飾の保存・復元が必要。三重アスタリスクの境界処理を修正。 |
| 3 | 帰納的思考 | 当初の装飾128組合せで32件の失敗を観測。装飾組合せと隣接runの回帰を追加。 |
| 4 | アブダクション | 複数種の欠落は、種類不足より境界・複合入力の検査不足で説明できた。境界fixtureへ重点配分。 |
| 5 | 垂直思考 | serializeRun→takeFence→findFenceで早期終了を特定。コードfenceの長さ決定も共通化。 |
| 6 | 要素分解 | kind、空判定、parser、serializer、編集、描画を分離。19種メタデータをdomainの正本へ維持。 |
| 7 | MECE | 種類・内容・装飾・操作経路を別軸で検査。表の余剰セルや未知本文を種類網羅の外へ漏らさない。 |
| 8 | 2軸思考 | 単一/複合装飾×通常/特殊文字で境界を整理。文字列の保存互換と意味の保持を別に判定。 |
| 9 | プロセス思考 | 編集→保存→再読込→公開の接続で確認。端末下書きの表示、送信後の編集、構造化表現の取得を接続修正。 |

### メタ・発想（meta_ux、9観点）

| # | 思考法 | 観測・判断と改善への接続 |
| --- | --- | --- |
| 10 | メタ思考 | 19種を選べることと、迷わず編集・回復できることは別。操作・状態の検査を追加。 |
| 11 | 抽象化思考 | 表枠・見た目・メタ情報は共有し、記事の章・本文・構造化表現の異なる保存契約は混ぜない。 |
| 12 | ダブル・ループ思考 | Enterでブロックが増えるだけでは安全な編集にならない。IME、選択範囲、Undo、外部値の復元を整備。 |
| 13 | ブレインストーミング | 説明付き検索、本文プレビュー、本文中心の配置を採用。新たな並行管理画面は追加しない。 |
| 14 | 水平思考 | DBの全面変更をせず、UI内の安定IDと履歴で移動・非同期操作を安全化。 |
| 15 | 逆説思考 | 保存用hidden値が正しくても画面が古いままなら復元は失敗。表示と値の同期を回帰固定。 |
| 16 | 類推思考 | Notion的な発見性を検索・矢印・Enter・Escape・複製・Undoに適用。製品全体の同等実装とは区別。 |
| 17 | if思考 | upload完了前に移動・削除・別章編集した場合を検査。最新状態に対し安定IDで反映。 |
| 18 | 素人思考 | 商品ID・アイコンだけ・設定先行の迷いを減らす。商品検索、説明文、章と本文のラベル分離、保存状態を採用。 |

### システム・戦略・問題解決（system_security、12観点）

| # | 思考法 | 観測・判断と改善への接続 |
| --- | --- | --- |
| 19 | システム思考 | 相対画像URLとブログhostの/api遮断が衝突。UUID形式の画像GETだけを通し、管理APIは遮断を維持。 |
| 20 | 因果関係分析 | 台帳へ載ることと公開されることは同じでない。有効な公開JSONの参照を匿名取得の条件へ変更。 |
| 21 | 因果ループ | 毎回古い500件だけ見ると501件目が永遠に点検されない。last_checked_atによる公平な循環へ変更。 |
| 22 | トレードオン思考 | 公開時は読め、取り下げ時は閉じられるよう、参照判定とprivate/no-storeを組み合わせる。 |
| 23 | プラスサム思考 | 他記事コピー・復元・公開JSONの参照を同workspaceでまとめて保護。誤削除を防ぐ。 |
| 24 | 価値提案思考 | 読者には公開画像、執筆者には下書き画像という価値を認可で分ける。非公開の存在も404で隠す。 |
| 25 | 戦略的思考 | 編集権限が公開権限を迂回する経路を検査。公開済み本文・削除・復元・商品配置をpublish権限で保護。 |
| 26 | why思考 | 「未公開なのに読める」→GET成功→台帳有無で判断→所有と公開の混同→境界シナリオ不足、の5段で整理。過去の作者の動機は推測しない。 |
| 27 | 改善思考 | 同一Origin、所属記事確認、stream上限が欠けていたため追加。既存のMIME検査も実バイト検査と合わせて維持。 |
| 28 | 仮説思考 | 匿名下書き、別workspace、501件目、writerの公開変更で反証テスト。失敗を再現してから修正。 |
| 29 | 論点思考 | 真の課題は部品の個数ではなく編集→保存→公開の接続。商品実体の取得と構造化10種の編集・公開接続を補完。 |
| 30 | KJ法 | 指摘を公開境界・編集回復・保存寿命・仕様契約の4群へ整理。重複指摘を統合し、残る設計判断を分離。 |

## 初回フェーズ3：改善と再検証（3サイクル、18:57 JSTまで）

独立したdomain、UI、画像・権限を並列実装し、それらに依存する記事フォームと公開ページの接続を後で統合した。既存のユーザー変更を保持し、大規模な保存形式移行・確定仕様変更は実施していない。

| 回 | 改善対象 | 再検証で確認したこと |
| --- | --- | --- |
| 1 | codec境界、種類別入力への分割、Undo/復元、画像認可・容量・所有、公開権限 | 装飾・区切りの文字保持、19種の操作、匿名/tenant/容量/公開更新の否定系 |
| 2 | 記事フォーム整理、実商品の公開表示、構造化表現の公開変換 | 商品が本文位置へ1回だけ出ること、別workspaceを拾わないこと。別章の非同期操作で編集を戻す問題を発見しfunctional updateへ修正 |
| 3 | 実画面・全体ゲート・取得経路の最終接続 | 保存ボタンとfeedbackの重なり、小さいselectを修正。構造化表現が取得時に隠れていた接続をtyped出力で修正。生成台帳は正規再生成 |

### 主な変更と単一化した責務

| 領域 | 主なファイル | 変更 |
| --- | --- | --- |
| 本文保存 | `prose-format.ts`, `prose-inline.ts`, `prose-code-fence.ts` | 複合装飾、backtick、directive、バックスラッシュ、表余剰セルの保持 |
| 本文編集 | `prose-editor.tsx`, `prose-node-editor.tsx`, `use-prose-draft.ts`とleaf群 | 文書操作・種類別入力・履歴・変換の責務分割。巨大な分岐に全責務を集めない |
| 記事画面 | `blog-article-form.tsx`, `article-editor-section.tsx`, `article-editor.module.css` | 本文中心、補助設定、安定した章キー、sticky保存、既存outline/layout checker再利用 |
| 保存状態 | `use-draft.ts` | 保存応答の対象snapshotと新しい編集を分離。復元・破棄・離脱flush・storage失敗を明示 |
| 構造化表現 | `expression-article-editor.tsx`, `expression-prose.ts`, getArticle | 10種を専用入力で編集し、既存carrier契約と公開モデルを接続。生JSONを本文へ露出しない |
| 公開商品 | `published-prose-products.ts`（read-model/D1）, canonical section | 公開行のworkspaceで実商品を解決。商品名の焼付けと末尾への二重表示を避ける |
| セキュリティ | 画像/商品routes、画像repository、host routing、article/placement use cases | 認証・権限・tenant・Origin・stream上限・公開参照判定を各境界で検査 |
| 画像点検 | `article-image-reclaim.ts`, migration0049 | 500件循環、他記事/復元/公開参照保護。排他未実装の物理削除を保留 |

全ファイルの網羅的一覧はgit diffと未追跡ファイルにある。上表は今回の責務単位であり、ワークツリー内の全差分を今回の作成物と主張するものではない。

## 初回の検証証跡（継続指示前の記録）

### 自動検査

| 検査 | 結果と限界 |
| --- | --- |
| 最終の関連回帰（18:56〜18:57 JST） | 33ファイル853/853 PASS＋別のUI規約2ファイル36/36 PASS。重複のない計35ファイル889件。構造化10種の編集・見出し・逆順・再保存で欠落/二重保存がない回帰を含む |
| 関連34ファイルの統合回帰（18:44 JST） | 855/855 PASS。domain・UI・use case・HTTP・実D1・architectureを含む |
| 最後の構造化取得接続（18:46 JST） | 4ファイル133/133 PASS |
| 条件付き公開のゲート | open-doors 33/33 PASS。条件欠落・反転・R2読取順序のmutation回帰を含む |
| 画像HTTP＋実D1 | 24/24 PASS。mockだけでなく全migration適用の隔離D1で参照と点検を確認 |
| codec追加検証 | 244 tests PASS。別途隣接装飾16,384組合せで欠落なし。全未収集記事への保証ではない |
| 小さい操作対象の再検査 | 記事編集画面3条件PASS。全画面の再走ではなく対象画面へ絞った検査 |
| 追跡台帳 | `node scripts/traceability.mjs`正規生成。518/518テストファイルを要件へ接続 |
| 型・Lint・build | `pnpm typecheck`, `pnpm lint`, 最終接続後の`pnpm build`成功。build時もTypeScript検査済み |
| 全量（作業途中の実行） | 517ファイル中17失敗、11,621テスト中58失敗。途中の修正が混在した実行なので最終成功の根拠にはしない |
| 残る仕様・根拠系を再実行（18:50 JST） | 8ファイル、224件中46 FAIL / 178 PASS。下表。全量PASSではない |

上記は初回の実行を分けた記録で、件数を足して重複なしの総テスト数としない。Next.jsのmiddleware→proxy廃止予定警告は残り、今回の範囲では移行していない。初回時点ではCloudflare向けbundle検証も未実施だったが、継続検証で実行した。リモートmigration・デプロイは引き続き未実施。

| 残る検査ファイル（`tests/architecture/`） | 失敗数 | 確認対象 |
| --- | --- | --- |
| `blog-ui-spec-governance.test.ts` | 1 | feature lineageと出典章の指紋 |
| `doc-source-version-gap.test.ts` | 5 | 仕様出典の版・取得日・鮮度根拠 |
| `acceptance-reconciliation.test.ts` | 1 | 実装・報告・trackingとmanifestの一致 |
| `chapter-regeneration-floor.test.ts` | 26 | 章の必須節、並び、生成内容 |
| `doctrine-citation-gap.test.ts` | 4 | 仕様の引用・根拠接続 |
| `qa-source-digest-meaning.test.ts` | 5 | 回答指紋と引用先の意味・存在 |
| `spec-chapter-fences.test.ts` | 2 | backend章の未閉鎖fenceと巻き込まれた見出し |
| `chapter-normative-body-unreproducible.test.ts` | 2 | 規範本文の再現性 |

失敗を隠すために指紋・件数・生成floorを付け替えていない。確定仕様章はR4-reopen/C01/C03の正規writerが必要。画像APIの公開判定台帳とテスト追跡台帳は、それぞれ正規生成器から更新して通常検査でも一致を確認した。

### ブラウザ実操作

`localhost:3000/admin/blog/articles/ba_seed_draft`を専用の隔離browser contextで確認。既存記事へ「記事を保存」は実行していない。

- 375 / 768 / 1280 / 1600 pxで確認（1600はdark）。ページ横はみ出しなし、保存ボタン中心が他のUIに遮られず押せることを座標で確認。
- 本文入力→Enter→`/`→「比較」で検索→Enterで比較表を挿入。本文プレビューが記法ではなく表を描くことを確認。
- リロードで端末下書きの内容と表示が一致。「端末下書きを破棄」で元の内容に戻ることを確認。
- 空の比較表は未入力なので保存時の空判定で除かれる。データ入力済み表のブラウザ再読込を確認したとは扱わない（codec/UI回帰で別検査）。
- ローカルに公開記事データが無かったため、ブラウザで保存→公開→匿名閲覧する全経路は未実施。公開側はcanonical描画テストと隔離実D1の統合テストによる確認に留まる。
- 検証専用に作成したローカルsessionとmembershipだけを失効済み。専用contextのcookieと端末下書きも残っていない。既存記事・画像・他の作業者のsessionは削除していない。

### 初回回帰の再現コマンド

下記は35ファイルをまとめた再現コマンド。実測は先頭33ファイルと末尾2ファイルに分けて実行した。

```bash
pnpm exec vitest run \
  tests/domain/blogops/prose-format.test.ts tests/domain/blogops/prose-inline.test.ts \
  tests/domain/blogops/prose-allowlist.test.ts tests/domain/blogops/article-image-policy.test.ts \
  tests/domain/authoring/article-image-host-routing.test.ts \
  tests/ui/prose-editor.test.tsx tests/ui/prose-editor-recovery.test.tsx tests/ui/prose-body.test.tsx \
  tests/ui/expression-article-editor.test.tsx tests/ui/use-draft.test.tsx \
  tests/ui/blog-article-edit-form.test.tsx tests/ui/article-layout-suggestion-panel.test.tsx \
  tests/ui/canonical-article-prose.test.tsx tests/ui/article-page-prose.test.tsx \
  tests/ui/prose-article-asset-client.test.ts \
  tests/presentation/article-images-route.test.ts tests/presentation/article-products-route.test.ts \
  tests/application/blog-ops-usecases.test.ts tests/application/expression-article-block.test.ts \
  tests/application/review-blog-placements.test.ts tests/application/published-article-prose.test.ts \
  tests/integration/d1-article-image-lifecycle.test.ts tests/integration/d1-inline-products.test.ts \
  tests/integration/d1-published-article.test.ts tests/infrastructure/scheduled-maintenance.test.ts \
  tests/architecture/ci-config.test.ts tests/architecture/tenant-scoped-schema.test.ts \
  tests/architecture/dependency-direction.test.ts tests/architecture/canonical-article-prose-composition.test.ts \
  tests/architecture/static-preview-writer.test.ts tests/architecture/generated-doc-freshness.test.ts \
  tests/architecture/open-doors.test.ts tests/ui/flex-row-shape.test.ts \
  tests/ui/design-tokens.test.ts tests/ui/uiux-duplicate-implementation.test.ts
pnpm typecheck
pnpm lint
pnpm build
```

## 継続指示後の改善と再検証

初回の思考リセットと30観点の結果を根拠に、利用者の「つづけて」で残った画像寿命・配置同期・実ブラウザ検証を3担当に分割した。rootは正規仕様の再オープンと統合検証を担当。独立対象は並列、公開同期や最終ブラウザ検証の依存は直列とし、3サイクル（実装・統合・実操作／相互レビュー）で再検証した。以前の3サイクルが完了したことを未実装の自動承認としては使わない。

### 主な変更と根拠

| 領域 | 実装と検証 | 適用した観点 |
| --- | --- | --- |
| 画像保存・回収 | pending予約→R2 put→ready確定。参照の再確認と不可逆なdeleting claim、参照追加を拒否するD1 trigger、deleted墓標。応答不明時の即時補償deleteを廃止 | 17 if、19システム、20因果、28仮説 |
| 孤児・遅延put | 台帳500件循環、R2のarticle-images/のみ100件ページで巡回。24時間以上の正規キーをno-clobberで採用、遅いputは墓標で再回収。cursor更新はCAS | 21因果ループ、23プラスサム、28仮説 |
| 配置と公開 | 最新記事・revision・公開権限を再取得し、配置・本文・タグ・revision・公開JSONを通常のsaveArticleと同一batchで確定。競合と投影失敗は全体rollback | 9プロセス、19システム、25戦略、29論点 |
| 記事の並行復元 | 読取revisionとdeletedAtで比較、勝者tokenのbatch guardで古い復元をCONFLICTにする。復元もrevisionを増やし同一時刻の再削除を識別 | 17 if、20因果、28仮説 |
| 編集操作 | 装飾帯の重なりを通常フローへ修正。行操作のprimary mousedownで本文選択を保ち、blurによる位置移動でclickが消える問題を防止。select・右クリック・Tabを妨げない | 9プロセス、15逆説、18素人、28仮説 |
| 公開著者・画面契約 | 冒頭の署名は維持し、重複紹介カードをなくす。実情報がある場合のみ末尾に詳細を1回表示。記事補助情報のFoldableをroute契約・台帳へ同期 | 6要素分解、11抽象化、18素人、30 KJ |
| 保存エラー | D1の画像状態triggerの既知エラーのみ、再選択できる入力エラーに変換。SQL文に同じ文字列が含まれる場合や未知障害は一般障害のまま | 1批判、7 MECE、27改善 |

### 操作配置判断（UX worksheet）

中心対象は記事本文。1回に1記事、複数ブロックを反復編集する（実利用頻度の定量値は未取得）。主要操作は本文を書く・装飾する・部品を追加する。375pxの実ブラウザで、装飾後に追加ボタンへ進む操作が浮動ツールバーに遮られた。

装飾帯は本文との操作境界を示し、表示中は通常フローに高さを持つ。代償であるフォーカス時の縦移動は、行操作のmousedownで選択を保持してclick成立後にメニューへ移すことで制御した。装飾中だけ道具を見せる方針と既存ラベルは維持。装飾はその場で反映しUndoで戻せる。追加モーションや待機は導入せず、装飾から部品追加へ進む一手を回復した。

### 確定仕様の扱い（方式承認前の履歴）

`system-spec-harness`の正規writerでinfrastructure.web / security.webをR4-reopenし、実装観察をchapter_notesへ追記。qa_log・approval_log・decisionsは事前コピーとの一致を確認した。旧セルのqa_refs・required-info等はreopen_log.discardedへ保持され、現在の本人回答として付け替えていない。

再オープン直後の完了判定はfalse、2セル未収集だった。loop coverageはPASSだったが最終coverageはこの2セルにより未完了。C03候補は隔離出力先へ生成したものの旧スナップショット・QAの重複が残るため、この時点ではcanonical .mdへ未適用だった。旧canonical章が「確定」を名乗る状態と再オープン後の正本は一致せず、関連検査のFAILを記録した。根拠のないQA・引用元・digestを作って完了させなかった。

この時点では、本人承認済み直接PUTをWorker経由に変える判断は未承認だった。実装成功を採用承認に読み替えず、方式選択を [image-upload-decisions.md](./image-upload-decisions.md) に集約して確認を待った。

### 利用者承認後の正規仕様同期（2026-09-06）

利用者は「画像送信を、確定仕様のR2直接送信から、現実装のWorkerで認可・容量・形式を検査して保存へ統一してよいか」という確認に「ok」と回答した。
新承認`approval-article-image-upload-path-worker-20260906`を根拠に、`dec-article-image-upload-path`を`opt-worker-proxy-upload`へ更新し、infrastructure.web / security.webを確定した。旧承認`approval-article-image-upload-path`は履歴に保持する。

正規QA・chapter_notesとcanonical章に現行方式を反映済み。旧直接PUT固有の署名発行・受領後検査・R2用CORSと「回答待ち」は、旧決定または再検討中の履歴として扱う。現行境界はWorkerの保存前検査であり、8 MiB上限・許可形式・圧縮または再選択の案内、失敗率・処理時間・拒否理由の監視を採用条件として維持する。

承認後の初回13ファイル再実行は290件中243 PASS / 47 FAIL。この実行時点では、承認前に再オープンで増えた13件のうち12件が解消し、`approval_ref`の再オープン退避に関する1件が残った。その後、正規writerへ承認参照の退避を追加し、承認あり／なし・履歴保持・再実行拒否を実CLIで回帰した。最終再実行はテスト追加後の292件中246 PASS / 46 FAILで、方式再オープンにより増えた失敗は全て解消した。残る46件は承認前から記録していた生成器・引用・出典・指紋等の既知負債であり、推測でPASSにしない。

### 継続検証の記録

| 検証 | 結果と限界 |
| --- | --- |
| 関連41ファイル（19:40〜19:42 JST） | 1,048 / 1,048 PASS。画像lifecycle・実D1/R2競合・配置公開同期・並行復元・スマホ行操作を含む。直後の著者簡素化は別検証 |
| 配置journeyの最終契約追従 | 4ファイル97 / 97 PASS。旧fixtureをarticleUpdate→通常saveArticleへ更新し、台帳・逆引き・公開HTMLの一致を維持。上行と重複するため合算しない |
| 記事のFoldable契約 | 2ファイル10 / 10 PASS。実page、route分類、台帳を同期 |
| 著者簡素化の最終回帰 | 直接3ファイル30 / 30 PASS＋既存画面・操作対象の3ファイル1,070 / 1,070 PASS。名前のみ・空白・紹介文・資格の6ケースはREDからGREENを確認。上の関連回帰と一部重複するため合算しない |
| 追跡台帳 | 正規生成で521 / 521ファイルの要件由来あり、由来不明0 |
| 最終差分の型・Lint | `pnpm typecheck`, `pnpm lint` PASS |
| 最終差分の実E2E | 新しいproduction相当snapshotでdesktop 36.6秒 / mobile 31.7秒の2件PASS。著者リンク1件・実Tab到達・通常click・保存公開取り下げ・fixture cleanupを含む |
| 静的プレビュー | `pnpm run preview:static` 正規再生成成功。5ブログ・22記事を含む29ページ。22記事で旧冒頭著者カード0を確認 |
| migration整合 | `pnpm exec drizzle-kit check` PASS。隔離D1へ0000〜0050適用成功。remote未適用 |
| 全量（作業途中） | 521ファイル・11,717件中11,653 PASS / 64 FAIL。並行追加された復元RED3件、旧配置fixture1件、Foldable台帳1件は、その後の対象再実行で解消。全量の再成功とは扱わない |
| 仕様・根拠系の再実行（承認前、19:44 JST） | 13ファイル290件中231 PASS / 59 FAIL。初回の46件に、正規再オープン後の状態不一致を検出する13件が加わった。下表 |
| 仕様・根拠系の最終再実行（承認・writer修正後） | 13ファイル292件中246 PASS / 46 FAIL。方式再オープン由来の13件は全て解消。残る46件は初回からの既知負債 |

実E2E終了時にsource / drizzleとsnapshotの差分がないことを確認した。件数の床を緩めたり、未承認セルを再確定して失敗を隠したりしない。

| 再オープン後・承認前に失敗した検査（`tests/architecture/`） | 件数 | 当時の根拠 |
| --- | --- | --- |
| `chapter-confirmed-cell-transcript.test.ts` | 7 | 旧canonical章の確定宣言・QA・goals等が、当時の未収集セルと不一致 |
| `doctrine-anchor-covers-required-info.test.ts` | 1 | 確定セル集合と旧章の指針が不一致 |
| `qa-scope-notes-coverage.test.ts` | 3 | 確定8セルの床と参照を未充足。旧QAは消去せず退避履歴へ保持 |
| `reopen-discard-restore-gap.test.ts` | 1 | 確定8セルの床に対し現在6セル |
| `writer-absence.test.ts` | 1 | 旧問題状態を固定するテストはcomplete=trueを期待するが、正規reopen後はfalse |

この13件と初回表の46件が、承認前に残った59件の内訳だった。旧問題状態を確認する検査も含まれるが、当時の結果をPASSへ改変しない。承認・正規仕様反映後の再実行は「利用者承認後の正規仕様同期」に分けて記録した。

production相当の隔離snapshotでは、全migration0000〜0050、実Worker/D1/R2でデスクトップ1440pxとスマホ375pxの2 E2EがPASS。装飾・比較表・実商品・画像を保存し、localStorageを共有しない別管理contextで再取得、公開後に匿名読者が画像を取得し、取り下げ後は記事と画像が404/no-storeになることまで確認した。著者重複の追加assertionは旧snapshotで3リンク対期待1をRED再現し、最終差分で1リンク・実Tab到達ともPASS。

最終スクリーンショットとtraceは`test-results/block-editor-publish-1788691407530/`のdesktop/mobile配下。両幅で署名リンクのfocus ring、重複カードなし、横はみ出しなしを目視確認した。画像fixtureは転送・復号検証用の1px PNGであり、写真品質やCLS全体の確認とは扱わない。

共有開発サーバーや既存の記事・画像は操作せず、専用workspace・D1/R2・sessionで実行した。試験後は自分のfixtureだけを削除し、workspace/image/session/articleの残存0を独立集計した。fixtureは専用コードから再作成できる。commit / push / PR / deploy / remote migrationは未実施。

再現は初回35ファイルに次の6ファイルを加えた41ファイルで実施した。追加の著者・配置journey・Foldableは各修正の対象テストを別途実行した。

```bash
pnpm exec vitest run \
  tests/application/blog-ops-storage-failures.test.ts \
  tests/infrastructure/article-image-storage-failure.test.ts \
  tests/integration/d1-blog-affiliate-placement.test.ts \
  tests/integration/d1-blog-ops-tenancy.test.ts \
  tests/integration/d1-blog-placement-publication.test.ts \
  tests/integration/d1-article-image-reclaim-safety.test.ts
pnpm exec tsx tests/e2e/block-editor-publish-runtime.mts
```

E2Eコマンドは専用一時snapshot・ローカルDB/R2・専用portを使い、通常開発DBのseedや共有サーバーを操作しない。成功/失敗のtraceとスクリーンショットは`test-results/block-editor-publish-<timestamp>/`、buildとmigrationログは表示された一時snapshotに保持する。

## 2026-09-06時点の4条件判定（履歴）

| 条件 | 判定 | 根拠・未了 |
| --- | --- | --- |
| 矛盾なし | 未達 | 画像方式の不一致は本人承認と正規状態・canonicalへの反映で解消。章構造・引用・出典等の仕様検査に残る失敗を含め、全体の無矛盾は未確認 |
| 漏れなし | 未達 | 本文19種・構造化10種・画像回収・配置公開同期・保存公開E2Eまで補完。実データ互換、remote適用、追加Notion機能の範囲確認は未了 |
| 整合性あり | 部分達成 | メタデータ・描画・エラー変換・通常保存経路を共有。方式承認・正規仕様反映後も仕様と受入の検査は全件成功していない |
| 依存関係整合 | 部分達成 | 画像保存/回収の排他、配置/公開JSON/revisionの原子的更新、並行復元を実D1で検証。採用方式に依存するAPI・認可・運用の正規仕様は反映済みだが、生成・根拠系の依存検査が残る |

## 2026-09-08 最終収束判定

| 条件 | 判定 | 現在の根拠 |
| --- | --- | --- |
| 矛盾なし | PASS | Worker経由の画像契約をUI/API/backend/security/operationsへ統一し、formal completeness評価と全量テストで相反を検出しない |
| 漏れなし | PASS | 本文19種、構造化10種、編集・保存・公開、商品、画像、回収、認可、運用を8章67要件とP01〜P13へ追跡し、全件を検証した |
| 整合性あり | PASS | 共通prose核、正規writer/compiler、canonical公開compositionへ集約し、現行仕様・実装・受入証跡・lineageを同一契約へ同期した |
| 依存関係整合 | PASS | 画像lifecycle、記事・配置・revision・公開projectionの原子境界、現行generationと13件のlive task projectionを決定論ゲートで確認した |

最終ゲートは521ファイル・11,751テスト、lint、typecheck、Next build、graph schema、lineage freshness（新規違反0）、source/evidence binding、system plan、generation lineage、task projection、acceptance reconciliation、formal completeness、resume receipt、C19 transcript、diff checkである。既存baseline 22件と既存dangling evidence 1件は本featureの変更で新設した問題ではなく、共有ワークツリーの別追跡事項として分離する。

## 設計判断の状態と引き継ぎ

Beads `ah-8oig`の残条件として保持する。共有タスクを親だけ閉じて完了に見せない。追加の大きな構造変更・外部適用は承認後に進める。

| 論点 | 現状と必要な判断 |
| --- | --- |
| 画像転送方式 | 解消済み。2026-09-06の本人回答によりWorker経由へ統一し、旧直接PUT承認は履歴に保持。8 MiB上限・案内・監視の採用条件を維持 |
| 確定仕様の検査 | 解消済み。正規writer/compiler、外部auditor、formal receipt、C19 importを現在入力へ同期し、章構造・引用・根拠・指紋を含む全ゲートがPASS |
| 本番適用と実データ互換 | Cloudflare build・隔離保存公開E2Eは実施済み。0047〜0050のリモート適用、バックアップ/復旧、実記事の運用データ変更は別のリリース工程であり、今回の権限には含めない |
| Notionの追加機能 | 今回の完成範囲は[requirements-baseline.md](./requirements-baseline.md)を正本とする。深い入れ子、共同編集、コメント、サーバー版履歴、予約公開、リッチインポートは明示的なスコープ外 |
| 画像のレイアウト安定 | 寸法を保持するCLS対策は既存`ah-a8bc`へ引き継ぐ |

要件と参考ブログへの対応は [requirements-baseline.md §4](./requirements-baseline.md#4-ブログ編集の機能範囲2026-09-06-再検証)、部品の境界は [architecture.md](./architecture.md)、APIは [api-contract.md](./api-contract.md)、操作方法は [documentation.md](./documentation.md) に集約する。

`improve-app`と設計・日本語UIスキルに従い、既存トークン・コンポーネントを使って本文中心の画面へ整理した。`testing-excellence`に従い、成功経路だけでなく不正入力・境界・tenant・復元・競合を検査した。確定仕様の正規更新経路を尊重し、commit / push / PR / deployはしていない。
