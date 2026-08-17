# アーキテクチャ文書

「あとから変えやすいこと」を仕組みで担保するための 4 枚。
新しく参加した人は、この順に読む。

| # | 文書 | 何が書いてあるか | 読む場面 |
| --- | --- | --- | --- |
| 1 | [layers.md](layers.md) | 4 つの層の責務。次に書くコードをどこへ置くか | コードを書く前に必ず |
| 2 | [context-map.md](context-map.md) | 9 つの業務領域の分け方と、禁止された参照関係 | 新しい機能の置き場所に迷ったとき |
| 3 | [ubiquitous-language.md](ubiquitous-language.md) | 言葉の辞書。仕様・コード・DB・画面で同じ言葉を使う | 名前を決めるとき |
| 4 | [changeability-scenarios.md](changeability-scenarios.md) | よくある変更で触るファイルの記録 | 設計が崩れていないか点検するとき |

全体像（二層構造と外部境界）は `architecture/arch-two-layer-platform.md` にある。

## 守られていることの確認方法

```bash
pnpm run lint    # 編集中に気づける依存方向の検査
pnpm test        # 全ファイル走査の依存方向検査 + 商業データ遮断の検査
```

この 2 つが通らない変更はマージしない。
規約を文書で呼びかけるのではなく、**通らないようにしてある**。
