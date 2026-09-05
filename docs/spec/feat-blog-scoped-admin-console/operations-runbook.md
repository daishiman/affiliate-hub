# 運用の手引き — ブログごとの管理画面 (feat-blog-scoped-admin-console)

P10 の成果物。

## 運営者の 1 日

```
/admin/sites            どのブログを見るか選ぶ
  └ /admin/sites/<slug>   このブログの状態を確かめる
      ├ domains           読者に届く住所があるか
      ├ audience          誰がどこを読んでいるか
      ├ revenue           どの記事が稼いでいるか
      ├ seo               検索から届かない原因
      └ aeo               回答エンジンに引用される形か
```

**必ず `/admin/sites` から入る。**

`/admin/analytics` はブログをまたぐ画面で、
ブログ 1 本の話をするところではない。

## 画面を 1 つ足すとき

順番がある。

### 1. route metadata に足す

`src/presentation/ui/admin-route-metadata.ts`:

```ts
"sites/[site]/xxx": child("sites/[site]", "画面の名前"),
```

### 2. 画面ファイルを作る

`src/app/admin/sites/[site]/xxx/page.tsx`

### 3. task manifest に目的を書く

`src/presentation/admin/admin-screen-task-manifest.ts`:

```ts
"sites/[site]/xxx": "○○を確かめ、△△を決める",
```

**「見る」で終わらせない。次の行動まで書く。**

### 4. priority map に足す

`docs/spec/feat-uiux-overhaul/information-priority-map.json`

### 5. `/admin/sites/[site]` の `actions` に足す

```
ブログ運営コンソールの 4 層（住所・観測・改善）への口。
**足したら同時にここへ出す。**
```

**ここを忘れると誰も辿り着けない。**

機械は検出しない。

### 6. 検査

```bash
npx vitest run --project normal tests/ui/uiux-screen-single-purpose.test.ts
npx vitest run --project normal tests/ui/app-shell-nav.test.tsx
npx vitest run --project normal tests/ui/uiux-spacing-and-copy.test.ts
```

1〜4 のどれかが抜けると
「86 件で 1 対 1」が落ちる。

**5 が抜けても落ちない。**

## 説明文が上限を超えたとき

```
xxx の説明文が 52 字あります（上限 40 字）
```

短くする。上限を上げない。

40 字で説明できないのは、
**画面の目的が 1 つに絞れていない**合図。

節を別の画面へ移すことを先に考える。

## 注意書きが 3 つ目になったとき

```
xxx に常時表示の注意書きが 3 個あります（上限 2 個）
```

判断は 3 通り。

| 内容 | どうするか |
|---|---|
| 金銭・秘密・公開に関わる | 押す物の隣へ移す（枠に数えない） |
| いま解けなかった | 地の文（`Prose`）で書く |
| どちらでもない | 消す |

`/admin/sites/[site]` は
配色が解けなかった断りを地の文にした。

## 数字が出ないとき

画面が言っている内容で切り分ける。

| 画面の文言 | 原因 | 対処 |
|---|---|---|
| 保存先につながっていない | D1 バインドが無い | 環境設定 |
| まだ記録が無い | イベントが届いていない | 計測の配線 |
| 該当が無い | 記録はあるが条件に合わない | 期間を広げる |
| 読み方を伏せている | 30 件未満 | 待つ |

**4 つ目は障害ではない。**

`MIN_EVIDENCE_SAMPLES = 30` の足切りで、
数字は出ている。

## 日次の集計が壊れたとき

`audience` / `revenue` の画面に
やり直しのフォームがある
（`RebuildDailyMetricsForm`）。

```
残すのは集計のやり直し (`metrics_rollup.rebuilt`) の側で、
そちらは人が「この日が壊れている」と判断して呼んだ回だけが行になる。
```

**やり直しは操作の記録に残る。**

生の観測（`reader_interaction_event`）は
90 日で消えるので、
それより前の日はやり直せない。

## 幅の絞り込みが効かないとき

URL の `viewport` に知らない値が入っている。

```
知らない幅を URL で渡されても、絞らずに描く
```

**エラーにならず、絞らないだけ。**

絞りたい値は画面の切り替えリンクから選ぶ。
手で URL を書かない。

## 読者に見えている配色を確かめる

`/admin/sites/[site]` の
「読者に出ている配色」の節を見る。

**設計図の値ではない。**

`（設計図）` と書いてある行だけが設計図由来
（余白と角丸）。

解けていなければ、その旨が地の文で出る。

## ブログを消すとき

`/admin/sites/[site]` の末尾に
`DeleteConfirm` がある。

**設計図を全部読んだ後にしか届かない。**

`/admin/sites/[site]/delete` は存在しない
（`uiux-screen-single-purpose.test.ts`
「末尾が delete の route が無い」）。

## サイドバーから「サイト」が消えたとき

`content.read` の権限が無い。

子の URL は開けるが、
開いた先で `entry.ready` が `false` になり
理由が出る。

**権限の判定はユースケース側にある。**
ナビから消すのは見やすさの話。
