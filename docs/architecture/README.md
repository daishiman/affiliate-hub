# アーキテクチャ文書

「あとから変えやすいこと」を仕組みで担保する文書の入口。
新しく参加した人は、この順に読む。

| # | 文書 | 何が書いてあるか | 読む場面 |
| --- | --- | --- | --- |
| 1 | [layers.md](layers.md) | 4 つの層の責務。次に書くコードをどこへ置くか | コードを書く前に必ず |
| 2 | [context-map.md](context-map.md) | 業務領域の分け方と、禁止された参照関係 | 新しい機能の置き場所に迷ったとき |
| 3 | [ubiquitous-language.md](ubiquitous-language.md) | 言葉の辞書。仕様・コード・DB・画面で同じ言葉を使う | 名前を決めるとき |
| 4 | [ui-system.md](ui-system.md) | 見た目・言葉・操作の作法を 1 か所に集める仕組み | 画面を作るとき |
| 5 | [testing-architecture.md](testing-architecture.md) | テストの置き場所・土台の部品・CI の流れ | テストを書くとき / 検査を足すとき |
| 6 | [changeability-scenarios.md](changeability-scenarios.md) | よくある変更で触るファイルの記録 | 設計が崩れていないか点検するとき |
| 7 | [feedback-loop.md](feedback-loop.md) | 改善要望の置き場所・画面の写しの作り方・指示文の組み立て | 改善要望まわりを触るとき |

全体の裁定（二層構造と外部境界）は [二層構造統合仕様](../spec/04-二層構造統合仕様.md) にある。

## 守られていることの確認方法

```bash
pnpm verify      # CI と同じ検査（型 → 静的検査 → テスト+カバレッジ → 契約検査）
```

内訳を個別に回すこともできる。

```bash
pnpm run lint    # 編集中に気づける依存方向の検査
pnpm test        # 全ファイル走査の依存方向検査 + 商業データ遮断の検査
```

`pnpm verify` が通らない変更はマージしない。
規約を文書で呼びかけるのではなく、**通らないようにしてある**。
