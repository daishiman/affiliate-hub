# P08 管理画面移行報告

## 判定

**PASS**。情報監査台帳と実 route の集合は 86 / 86 で一致し、全画面を共通 shell・section・table・state token 経由で改善した。データ移行はない。

## 共通移行

- `Section` の 261 利用箇所から装飾目的の Card 外枠を除き、見出しと余白で章を読める構造へ統一した。
- 共通 `DataTable` の列見出しと行見出しを sticky 化し、caption / `scope=col` / `scope=row` を保持した。
- 特殊ランキング・比較表にも同じ sticky primary key 規則を適用した。
- admin page 内の素の `<table>` を 0 件にし、公開記事一覧も `DataTable` へ集約した。
- Card の直接利用は公開記事編集の現在状態1件だけに限定した。フォーム本体はborderlessなSectionへ移し、数値や文章を囲うだけのCardとroute全体Card wrapperは0件にした。
- 既存の空・loading・error に ideal・partial・slow を追加し、6 状態を共通部品化した。
- sidebar の icon / label 間隔を semantic token 1 個へ集約した。

## 目的別の改善

| 対象 | 変更 |
| --- | --- |
| 管理ホーム | 内部 API / tool catalog の列挙を削除。判断と次の行動だけを残した |
| AI 利用状況 | 呼出数・失敗・利用額の SummaryStrip と用途別 BarChart を追加。正確値の表は下段に保持 |
| 改善ホーム | 実行中・承認待ち・全件の SummaryStrip を追加 |
| UI カタログ | 6 状態、要約、比較グラフの正しい利用例を追加 |
| 公開記事 | 独自 table / card layout を共通 DataTable / Section へ移行 |
| WorkBoard | 色線だけの状態表示を廃し、可視テキスト badge を追加 |

## 除去した情報

- `/admin` の「AI から使える操作」、API / endpoint / tool 名。
- 画面内の区切りとしてだけ使われていた過剰なカード枠。
- 状態を色だけで示す左境界線への依存。

削除した内部情報の機能自体、専用設定 route、認証、API、書込処理は変更していない。
