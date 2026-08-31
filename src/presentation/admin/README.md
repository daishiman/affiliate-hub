# 管理画面の部品の置き場

サブディレクトリの名前は**発明していない**。分類の正本は
`src/presentation/ui/admin-route-metadata.ts` の `ADMIN_NAV_GROUP_LABELS` で、
サイドバーの分類と同じ 6 つをそのまま使う。

| ディレクトリ | サイドバー上の名前 |
| --- | --- |
| `material/` | 素材 |
| `write/` | 書く |
| `publish/` | 出す |
| `earn/` | 稼ぐ |
| `observe/` | 見る |
| `maintain/` | 整える |

`admin-route-metadata.ts` の冒頭が言っているのは
「画面ファイル・実 URL・親子関係・パンくず・サイドバー・分類を別々の表へ
書き写さない」ことである。ここもその射影の 1 つで、**置き場は分類の写しではなく、
分類から決まる**。route を 1 件足して group を決めれば、その画面が使う部品の
置き場も同時に決まる。

## 振り分けの決め方

部品ではなく**画面**から決める。`src/app/admin/**/page.tsx` から
（`src/presentation/` を経由して）辿り着ける経路を実際に辿り、
その画面の route が属する group を集める。

- group が 1 つに定まる → その group のディレクトリへ置く。
- group が 2 つ以上ある → **`admin/` 直下に残す。** 無理に寄せない。

例外は 1 つだけある。`/admin/ui-catalog`（見本帳）は部品を並べて見せるだけの
画面なので、**所有者の証拠にしない**。見本帳に載っていることだけを根拠に
`maintain` へ寄せると、部品の置き場が「どの業務のものか」ではなく
「見本帳に載せたか」で決まってしまう。

## `admin/` 直下に残したもの

| ファイル | 残した理由 |
| --- | --- |
| `admin-shell.tsx` | 全 group の画面の外枠。ホーム (`/admin`) を含む全画面が使う |
| `feedback-action.ts` / `feedback-state.ts` | 上の外枠が持つ「使い勝手を直す」入口。したがって全画面から使われる |
| `use-case-result.ts` | action の返値の型と共通の失敗の作り方。6 group すべてが読む |
| `non-empty-lines.ts` | 1 行 1 件の入力欄のパーサ。`material` / `write` / `publish` / `earn` / `maintain` が読む |
| `delete-confirm.tsx` / `delete-form-action.ts` / `delete-form-state.ts` | 論理削除の確認と action。`material` / `write` / `publish` / `earn` が読む |
| `copy-button.tsx` | 値を写すだけの純表示部品。`publish`（配信）と `maintain`（指摘）が読む |
| `admin-operation-manifest.ts` | 商品・記事・サイト・配信の操作を 1 枚に並べた表。`material` / `write` / `publish` にまたがる |
| `schedule-publication-action.ts` / `-form.tsx` / `-state.ts` | 公開予約。`write`（公開までの進み具合）と `publish`（配信を作る）の両方から入る |
| `admin-screen-task-manifest.ts` | 全画面の Server Action 実行地点のマニフェスト。特定の group の部品ではない |
| `quality-check-labels.ts` | 品質検査の表示名。いまどの画面からも辿れておらず、group を決める根拠が無い |

`README.md` は `.ts` / `.tsx` を見る検査（`tests/ui/ui-layers.test.ts`、
`tests/architecture/admin-component-orphans.test.ts` など）の母集団には入らない。
