# 実装要件定義書: feat-thumbnail-visual-system

> 本書は dev-graph `requirements` verb が、確定 system spec、feature 文書、昇格済み exact-13 package から導出した実装要件である。実装コードは含まない。実装は `task-graph` build へ handoff する。

## スナップショット

- graph snapshot digest: `sha256:c6a9b3c405b1c23842659b80e914c70979f381e221267a16ad8551055cdfe341`
- graph revision: `463`
- scope digest: `sha256:6b23de767cd4ccf3ec082c39c060b08ad737bdb62eccc1fc892c73e287812fdc`
- feature package: `feature-package/feat-thumbnail-visual-system`
- promoted generation digest: `sha256:3495330b8d67c78fac526b7468ec270cb6f15e6e8c07d88d6e80dd526d37109d`
- promoted generation path: `.dev-graph/published/feature-package-feat-thumbnail-visual-system`
- handoff target: `task-graph`
- quality choice: `detailed`
- emitted_at: `2026-09-04T13:00:00Z`

## 目的と到達状態

- 目的: 記事・ブログ・管理画面のどの一覧でも内容を一目で識別できるサムネイルが必ず表示され、画像が無いことによる空白や版面のずれが起きないようにする。
- 到達状態: 記事とブログにサムネイルを登録・自動生成でき、R2 に保存された画像が 16:9 の固有寸法と srcset/sizes つきで配信され、トップページ・記事一覧・カテゴリー・検索結果・関連記事・管理画面の各一覧でサムネイルが表示され、画像が無い場合も版面が崩れない代替表示が出る状態になっている。

## 観測 fact と設計ベースライン

参照サイトの観測 fact は `system-spec/retrieval-evidence/kajetblog-top-analysis.md` に保存済みのものだけを使う。文章・写真・ロゴ・固有名・色値は転用せず、寸法保持という構造上の性質だけを再利用する。

| 出典 | 観測値 | 本 feature での扱い |
|---|---:|---|
| 同 §3 | 記事カードのサムネイルは約 1200x675 (16:9) | 表示用派生の基準比率を 16:9 とする根拠 |
| 同 §4 | img 総数 54 のうち `width`/`height` 54、`sizes` 54、`srcset` 52、`decoding="async"` 54 | サムネイル・代替図版・アイコンへの寸法必須化の根拠 |
| 同 §4 注記 | 全画像に固有寸法を持たせ CLS を構造的に抑えている | 寸法宣言を先、画像実体を後、という順序制約の根拠 |

比較対象サイト (`width`/`height` 7/59、`sizes` 2/59) との差は、寸法宣言の有無が版面の安定に効くことを示す観測であり、目標値そのものではない。数値目標は受入 A4 の CLS 0.1 未満だけを正本とする。

## サムネイル適用対象 8 画面と配信要件

`system-spec/ui-ux.md` および `system-spec/frontend.md` の `qa-request-thumbnail-coverage-v6` は、対象を「記事の一覧が現れる面ではサムネイルが必ず出ること」「画像を持たない記事があってもサムネイルの無い面が生じないこと」と機能の水準で定めている。P01 はこれを route 台帳へ落とす。

| 画面 | 面の種別 | 主目的 | 寸法の型 | 補足 |
|---|---|---|---|---|
| トップページ | 読者 | 今読むべき記事を選ぶ | 読者向け 大 | 題名と対等な重みで置く |
| 記事一覧 | 読者 | 記事を探索する | 読者向け 大 | |
| カテゴリー一覧 | 読者 | 主題から辿る | 読者向け 大 | カテゴリ自身にはサムネイルを与えない |
| タグ一覧 | 読者 | 主題から辿る | 読者向け 大 | |
| 検索結果 | 読者 | 語から辿る | 読者向け 小 | 件数優先の面 |
| 関連記事 | 読者 | 読了後の次を選ぶ | 読者向け 小 | |
| 管理画面ブログ一覧 | 運営 | 対象ブログを見分ける | 運営向け | 行高は読者向けより低い |
| 管理画面記事一覧/プレビュー | 運営 | 編集対象を見分ける | 運営向け | サムネイル列を畳める |

- 読者向けの一覧は「読みたい記事を選ぶ」面であり、サムネイルは記事の内容を想像させる役割を負うため大きく扱う。
- 管理画面の一覧は「編集したい記事を見分ける」面であり、多数の行を一度に見渡せることを優先して小さく扱い、サムネイル表示を運営者が畳める。
- 寸法は面ごとに書き分けず、面をまたいで使える少数の型として 1 か所で定め、各面は型を選ぶだけにする。面ごとの個別寸法の書き分けは 0 件を要求する (P09 の検査対象)。
- アーカイブ面は `system-spec` 側の列挙 (トップ・カテゴリ・タグ・検索結果・関連記事・アーカイブ) に含まれるが、package の 8 画面台帳には独立 route として現れない。**未決**: アーカイブ面を独立 route として持つか記事一覧の一形態として扱うかは P01 の route 台帳で確定する。

## 登録経路の優先順位と決定論的代替図版

サムネイルの出所は次の優先順位で一意に決まる。上位が取得できた時点で下位を評価しない。

| 順位 | 経路 | 決定条件 | 失敗時 |
|---:|---|---|---|
| 1 | 記事編集での明示アップロード | 運営者が画像を保存した | 次順位へ降格し、理由を記録する |
| 2 | アイキャッチ指定 | 記事に featured 指定がある | 次順位へ降格し、理由を記録する |
| 3 | 本文先頭画像からの自動採用 | 本文中に採用可能な画像がある | 次順位へ降格し、理由を記録する |
| 4 | 決定論的代替図版 | 上位が全て無い | 代替表示と理由を出す (A7) |

代替図版の生成規約:

- 入力はタイトル、カテゴリー、ブログ配色トークンに限る。外部サービスへ接続しない。
- 同一入力からは同一の出力バイト列が得られる。P04 は同一入力 2 回実行のバイト一致を対象関数 100% で検証する。
- 版面は記事の題名とサイト名だけを載せた最小構成とし、記事ごとに見分けがつく程度の差 (カテゴリ由来の配色) を与える。
- 自動生成図版が隣接する同じ記事の題名リンクと情報を繰り返すカードでは、図版を空 `alt`、図版側の重複リンクを `aria-hidden` / `tabIndex=-1` とし、題名リンクを一度だけ読み上げる。題名リンクを伴わない単独図版では、記事の題名を含む代替文を付ける。`system-spec/ui-ux.md`・`frontend.md` の章注記「記事カードの図版と題名リンクの読み上げ契約（2026-09-06）」をこの文脈で優先し、画像一般への空alt規則には広げない。
- 生成は記事の保存時に一度だけ行い、表示のたびには行わない。題名の変更を契機に再生成する。
- 書き手が画像を用意した記事では、そちらを優先する (優先順位 1〜3 が代替図版に優先する)。

## R2 保存と 16:9 派生・CLS 要件

- サムネイルの画像そのものは D1 に置かず R2 に置く。D1 には位置と寸法だけを持つ。自動生成の代替図版も同じ扱いとし、書き手が用意した画像と別の場所には持たない。
- 寸法を D1 に持つのは、画面が画像の実体を待たずに版面を確定できるようにするためである。寸法は画像の保存時に機械が測って書き、人が入力する経路を作らない。
- R2 にはオリジナルを保持し、表示用派生として 16:9 crop の複数幅を持つ。命名規約と cache key は P02 が契約として定め、同一画像の派生を二度生成しない (A5)。
- CLS 実装規約は**サムネイル・代替図版・アイコンに限る**。対象要素の全 img は次を満たす。
  - 固有の `width` / `height` を持つ。
  - `srcset` と `sizes` を持つ。
  - `decoding="async"` を持つ。
  - 初期表示外は `loading="lazy"` とする。
- サムネイルを含む画面の CLS 実測値は 0.1 未満とする。計測手順は対象要素をサムネイル・代替図版・アイコンに限定して P04 が定義し、P07/P09 が実測する。
- 記事本文中の画像を含む画面全体の表示品質規約は本 feature が所有しない。

## OGP / Twitter Card 再利用

- OGP と Twitter Card (`summary_large_image`) の画像は、サムネイル正本から生成する。別経路の画像を持たない。
- 画像が無い記事は自動生成の代替図版で埋め、外部共有時も画像が付く状態にする。生成経路は読者向け一覧と同一とし、人間向け版面と機械向け宣言を食い違わせない。
- 自動生成画像は内容を表さないため、外部共有時の情報量は実写に劣る。書き手が画像を用意した記事では実画像を優先する、というトレードオフを受け入れた上での決定である。
- OGP/Twitter Card 画像の到達可能性は P09 の独立 QA で検証する。

## 独自アイコン体系

- グローバルナビ・SNS・状態表示のアイコンを独自 SVG セットとして定義する。
- アイコンはサムネイルと同じ配色トークンに従う。参照サイトのロゴ・アイコン資産は転用しない。
- アイコンも CLS 実装規約の対象であり、固有寸法を持つ。
- アイコン資産の追加・差し替え手順は P12 の icon asset runbook が所有する。

## 失敗時の代替表示と記録

- 画像の取得・生成に失敗しても版面が崩れないこと。寸法は先に宣言済みであるため、失敗しても高さは動かない。
- 失敗時は代替表示と理由を同じ位置に出す。壊れた画像枠を残さない。
- 失敗の理由を記録し、運用が原因を特定できるようにする。境界値として空タイトル、多バイト文字、重複 URL、R2 障害、再生成競合、mobile viewport を扱う。

## データ / API 境界

- サムネイル metadata (位置・寸法・出所経路・生成 digest) は D1 に持ち、画像実体は R2 に持つ。両者の正本を二重化しない。
- R2 アップロードと派生取得の API 境界を P02 が契約化し、P05 が実装する。
- 公開記事の読み取りモデルを単一の正本とし、`generateMetadata` と構造化データは同じヘルパーからサムネイル URL を得る。
- 既存の記事一覧・関連記事コンポーネントと重複する実装を新規に作らない (新規 0 件)。既存分の二重実装解消は P08 が所有する。
- 既存記事のサムネイル未設定データへの backfill は再実行可能とし、件数差 0 を migration report に記録する。

## 責務境界

| 対象 | 所有 feature | 本 feature での扱い |
|---|---|---|
| 記事本文中の画像を含む画面全体の表示品質・a11y 規約 | feat-reader-surface | 侵さない。サムネイル・代替図版・アイコンだけを対象とする |
| トップページの区画構成と表示順 | feat-blog-top-page-composition | 表示順は所与とし、置かれる部品の寸法型と配信規約だけを定める |
| テンプレート・配色の選択 UI | feat-blog-ui-builder | 選択済みの配色トークンを入力として読むだけ |
| 記事本文・本文中図解の AI 生成 | feat-ai-content-studio | 生成しない |
| 外部 EC からの商品画像取得・再配信 | feat-affiliate-inbox / feat-product-intelligence | 扱わない |
| 画像の著作権処理・素材調達の運用 | 本 feature 外 | 扱わない |

`feat-reader-surface` の本文画像責務への越境 0 は P03 の設計ゲートと P09 の独立 QA で検査する。

## 受入条件トレーサビリティ

| ID | 要件要約 | confirmed source | 主phase | 必須証跡 |
|---|---|---|---|---|
| A1 | 登録経路と未登録時の必ず表示 | feature/context A1・ui-ux/frontend `qa-request-thumbnail-coverage-v6` | P01,P02,P04,P05,P07,P08,P11 | 登録優先順位状態機械、acceptance report |
| A2 | 外部接続なしの決定論的代替図版 | feature/context A2・frontend `qa-neutral-ogp-fallback-v6`・goal-spec `no-external-image-service` | P02,P03,P04,P05,P06,P07,P09,P11 | 決定論性テスト、network trace |
| A3 | 8画面すべてでの表示 | feature/context A3・ui-ux/frontend/database `qa-request-thumbnail-coverage-v6` | P01,P02,P04,P05,P07,P08,P09,P11 | 8画面 route 台帳、表示確認 report |
| A4 | 固有寸法・srcset/sizes・CLS 0.1未満 | feature/context A4・frontend §画像の版面確保・観測 fact §4 | P01,P02,P04,P05,P06,P07,P09,P11 | CLS 計測手順と実測値 |
| A5 | R2 派生キャッシュと再生成抑止 | feature/context A5・database `qa-request-thumbnail-coverage-v6` | P02,P04,P05,P06,P08,P09,P11,P12 | 派生命名/cache 契約、再生成 0 件 |
| A6 | OGP/summary_large_image 再利用 | feature/context A6・frontend `qa-frontend-web-fixed-header-seo-aio-v6`・backend OGP 生成責務 | P02,P04,P05,P06,P07,P09,P11 | OGP/Twitter Card 出力検証 |
| A7 | 失敗時の代替表示と理由 | feature/context A7・frontend 取得不可時の同位置提示 | P02,P04,P05,P06,P07,P11,P12 | 失敗系ケース、runbook |

機械可読版は `.dev-graph/handoff/requirements-trace-entries-feat-thumbnail-visual-system.json` を正本とする。受入の文言は `features/feat-thumbnail-visual-system.md#frontmatter.acceptance` にのみ保持し、同じ ID に別の文言を与えない。

## 実行タスク (exact 13)

| phase | graph node | 内容 | depends_on |
|---|---|---|---|
| P01 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P01` | サムネイル適用8画面・登録経路・観測factの要求ベースライン確定 | — |
| P02 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P02` | 登録優先順位・決定論的代替図版・R2派生・CLS/OGP規約の設計 | P01 |
| P03 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P03` | 設計の独立レビューと外部接続なし・決定論性・境界不可侵ゲート | P02 |
| P04 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P04` | A1–A7・CLS・決定論性・OGPのテスト設計 | P03 |
| P05 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P05` | サムネイル登録・代替図版生成・R2配信・全画面表示・SVGアイコンの実装 | P04 |
| P06 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P06` | 単体・結合・CLS・決定論性・OGPテストの実行と緑化 | P05 |
| P07 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P07` | A1–A7のfeature受入 | P06 |
| P08 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P08` | 既存記事一覧・関連記事コンポーネントとの重複解消と移行 | P05 |
| P09 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P09` | CLS・決定論性・外部接続なし・非侵犯境界の独立QA | P07,P08 |
| P10 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P10` | 目的・受入・品質証跡の独立最終レビュー | P09 |
| P11 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P11` | サムネイル・代替図版・アイコン証跡の再現可能な集約 | P07,P09,P10 |
| P12 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P12` | 管理者ガイド・派生再生成runbook・障害対応の確定 | P10,P11 |
| P13 | `SYS-THUMBNAIL-VISUAL-SYSTEM-P13` | development展開・rollback確認・仕様書への書き戻し | P12 |

## readiness matrix

| node scope | confirmation | evaluation | implementation readiness | missing sections |
|---|---|---|---|---|
| `feat-thumbnail-visual-system` | confirmed | pass | complete | なし |
| `arch-system-spec-overview` | confirmed | pass | complete | なし |
| `arch-two-layer-platform` | confirmed | pass | complete | なし |
| `SYS-THUMBNAIL-VISUAL-SYSTEM-P01..P13` | confirmed | pass | complete | なし |

`implementation_readiness=complete` は実行可能な仕様が揃ったことを示し、実装完了を示さない。完了は graph の `completion_evidence` と P07/P10/P11 の証跡で判定する。

## task-graph buildへの制約

- implementation前に、このrepositoryの `node_modules/next/dist/docs/` で対象APIのNext.js現行ガイドを読む。
- 上流 entry gate として `feat-blog-ops-crud` と `feat-ui-foundation` が done または closed であることを P01 着手前に確認する。
- 既存 blog-ops、D1/Drizzle、R2、Cloudflare Workers/OpenNext の境界を維持し、同じ責務のuse case/component/storeを増やさない。
- P04のテストを先に定義し、pixel位置やDOM構造ではなく、可視ラベル、accessible name、状態、API契約、生成バイト列で検証する。
- 代替図版の生成経路に外部サービスへの接続を作らない。静的解析と実行time trace の双方で outbound network call 0 を示す。
- 参照サイトの文章・写真・ロゴ・固有名・色値・CSS を転用しない。再利用するのは寸法保持という構造上の性質だけとする。
- 本番公開、破壊的移行は別の明示承認がない限り行わない。移行は P08 の dry-run と rollback 証跡なしに実行しない。
- 本書と handoff package は実装コードではない。各taskのwrite_scopeとVerification and evidenceを実装authorityとする。

## handoff

- target: `task-graph`
- trace entries: `.dev-graph/handoff/requirements-trace-entries-feat-thumbnail-visual-system.json`
- implementation code generated by this verb: `0`
