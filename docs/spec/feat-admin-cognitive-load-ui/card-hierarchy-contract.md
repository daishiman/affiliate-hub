# カード階層契約

- カード 1 枚は主張 1 つだけを伝える。主見出しは 1、主情報は 1、補助情報は初期表示 4 以下、主操作は 1。
- 同型カードを 4 枚以上並べて列比較させる用途は表へ移す。カード内カードは禁止する。
- 本文は結論→根拠→操作の順。説明が 120 文字を超える場合は結論だけ残し、詳細を明示開示へ移す。
- 状態は文字ラベルで明示し、色・左端の色帯・アイコンだけで伝えない。
- 画面の章をすべてカード化しない。章は borderless な `Section`、個体の判断単位だけを Card とする。

## 実装との結線

- `src/presentation/ui/admin-card-contract.ts` が、台帳で card を主表現にした36 routeを明示列挙する。tableの44 routeは含めない。
- card は「少数の個体を判断する」表現分類であり、route 本文全体を1枚の Card に包まない。36 routeの実 page は、判断単位を `Card`・borderless な `Section`・用途別 `Form` のいずれかで区切る。
- `AdminShell` は見出しと本文の骨格だけを担い、Card を生成しない。これにより複数の章・フォーム・操作を1カードへ押し込めることを防ぐ。
- `Card` は `children` 入力を持たず、`claim`、`main`、`supporting`、`primaryAction` の型で主1・従4以下・主操作1以下・主張120字以下を固定する。実際に Card を使う page は Card の入れ子を持たず、フォームのような複数操作は borderless な Section に置く。
