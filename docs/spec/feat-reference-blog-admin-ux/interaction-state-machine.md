# Interaction state machine

## article save

```text
saved(revision N) --edit--> unsaved --submit--> saving
saving --CAS success--> saved(revision N+1, savedAt)
saving --retryable error--> failed --retry--> saving
saving --revision mismatch--> conflict --reload theirs--> saved
conflict --keep mine/merge--> unsaved --submit with current revision--> saving
any edited state --reload--> restored local draft (explicit notice) --discard/continue--> saved/unsaved
```

| state | 表示 | 許可操作 |
|---|---|---|
| unsaved | `未保存の変更があります` | 保存、差分確認 |
| saving | `保存しています…` | 編集値は保持、二重送信なし |
| saved | `保存済み HH:mm` | preview、次作業 |
| failed | `保存できませんでした`+理由 | 再試行、端末下書き復元 |
| conflict | `別の更新があります` | 相手で再読込、自分の下書きを維持 |

## improvement

`suggested -> previewing -> applied -> undone` の端末内状態とする。`applied`は記事formへ差分を反映しただけで、server保存ではない。保存は必ず記事save state machineへ合流する。

## affiliate preview

`idle -> loading -> ready | partial | duplicate | failed | rejected`。`failed/rejected` でもraw URLと入力値は残し、再試行または手動補正へ進む。`ready/partial/duplicate`だけが明示的な「受信箱に入れる」へ進む。

