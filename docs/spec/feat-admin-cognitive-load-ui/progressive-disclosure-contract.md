# 段階的開示契約

- 初期表示は「目的・要約・主操作」。履歴、内部 ID、設定詳細、長い説明は既定で閉じる。
- `<details>` の `summary` には内容の種類と件数を含める（例: `変更履歴 4 件`）。「詳細」の一語だけは禁止。
- 閉じた状態でも、異常の有無と主操作の可否は分かるようにする。
- エラー、安全確認、公開・削除・リンク差し替えの影響は閉じない。
- 開閉は keyboard 操作、focus 可視化、読み上げの開閉状態を保つ。

## Route binding

- 全86 routeは `admin-disclosure-contract.ts` で `none` / `foldable` / `dedicated-route` のいずれか1つに分類する。補助情報が無い画面を無理に畳まない。
- 実 `Foldable` は `evidence`、`personas/audiences`、`feedback/[report]`。実pageから抽出した集合と台帳を機械突合する。
- 専用routeは `products`、`content`、`blog/articles`、`sites`、`distribution`、`affiliate`、`feedback` の7画面だけ。送り先は自分自身を禁止し、実際の行リンクとroute metadataの親子関係を機械突合する。
- `personas/audiences` は判断基準・困りごと・信頼条件の総数、`feedback/[report]` は環境・エラー記録の総数をsummaryに含める。`details[open]` の初期値は0。
