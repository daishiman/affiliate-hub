# P12 管理画面の情報設計ガイド

この文書を、新しい管理 route と既存管理画面の表示変更で参照する情報表現の正本とする。

## 1. 画面の入口

最初に「誰が、何を判断し、次に何を 1 つするか」を 1 文で決める。主要 action は原則 1 つ。画面の初期表示には、その判断に必要な情報だけを置く。

## 2. 表現の選び方

| 問い | 選ぶ表現 | 禁止 |
| --- | --- | --- |
| 今どうなっているか | SummaryStrip | 同じ重要度の数値カードを大量に並べる |
| 増減・構成・偏りはどうか | BarChart / graph | 正確値を失う装飾図。文字値を必ず併記する |
| A と B のどちらか | comparison | 比較軸のないカード横並び |
| 個別行の検索・操作 | DataTable | div grid や素の table の再実装 |
| 1 対象のまとまり | Card | 章区切りのためだけに全 Section を Card 化する |

詳細規則は `representation-rule-table.md/json` を参照する。

## 3. カード階層

- 1 Card は主張 1 つ。
- 主情報 1 件を最初に置き、従情報 n 件は文字サイズ・余白・順序で従属させる。
- action は主要 1 件。補助 action は link または開示後へ移す。
- padding / gap / font は共通 token のみ。画面固有の魔法の数値を足さない。
- 詳細は `card-hierarchy-contract.md`。

## 4. 表の可読性

- `DataTable` または用途別共通 table component を使う。
- caption、`scope=col`、最初の `scope=row` を必須にする。
- column header は縦 scroll で sticky、primary key は横 scroll で sticky。
- sticky cell 自体に不透明背景と境界を持たせ、背後の文字を透過させない。
- 狭幅で情報を隠さず、table container だけを明示的な横 scroll 領域にする。
- 詳細は `table-readability-contract.md`。

## 5. 段階的開示

初期表示は summary → 状況の意味 → 次の action。正確値の表、監査情報、補助説明は専用 route または明示操作で開く。重要な警告・不可逆操作の確認は隠さない。詳細は `progressive-disclosure-contract.md`。

## 6. Sidebar

icon / label の間隔は `--layout-nav-icon-label-gap` のみ。collapsed 時も accessible name と tooltip / label で識別できること。詳細は `sidebar-spacing-contract.md`。

## 7. 状態とアクセシビリティ

ideal / empty / loading / partial / error / slow の 6 状態を定義する。状態、速報 / 確定、n 不足は、色だけでなく可視テキストと accessible name で示す。375 / 768 / 1280 / 1600、200%、keyboard、focus visible を検査する。

