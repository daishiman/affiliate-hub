# 住所の状態遷移

正本: `src/domain/domains/custom-domain.ts` (`ALLOWED_TRANSITIONS` / `canTransition`)

## 状態

| 値 | 画面の文言 | 意味 |
|---|---|---|
| `pending` | DNS 設定待ち | 登録しただけ。DNS に設定が置かれるのを待っている |
| `verifying` | 所有権を確認中 | 外部が所有権と証明書を確認している最中 |
| `active` | 配信中 | 所有権が検証され、配信してよい |
| `failed` | 確認できませんでした | 検証が通らなかった |
| `revoked` | 取り下げ済み | 運用者が意図して止めた |

証明書の状態 (`none` / `pending` / `issued` / `expired` / `error`) は**別の列**に持つ。
1 列にまとめると「所有権は OK だが証明書が未発行」を表せず、運用者が待つべきか
直すべきかを判断できない。

## 遷移表

```
pending   → verifying | failed | revoked
verifying → active    | failed | revoked
active    → failed    | revoked
failed    → pending   | revoked
revoked   → (なし)
```

同じ状態への遷移は常に許す。外部の写し取りは同じ結果を何度も運ぶため、
ここで弾くと定期同期が毎回エラーを積む。

## なぜこの形か

- **`revoked` に出口が無い。** 運用者が取り下げた住所を、外部の写し取りが `active` へ
  戻せてしまうと取り下げが効かない。同じドメインを使い直すときは、この行を復活させず
  **新しい行として登録し直す** (`pending` から始まる)。部分ユニーク索引が `revoked` を
  除外しているのはこのためである。
- **`active → failed` を許す。** 証明書の期限切れや外部での取り消しを写し取る経路が要る。
  塞ぐと失効に気づけない。
- **`active → pending` は無い。** 一度所有権が確認できた住所を「DNS 設定待ち」へ戻すのは、
  失効の表現として後退でしかない。
- **`failed → verifying` は無い。** 再確認を始めるのは外部であって、当方は要求を出すだけ。

## 遷移表を通る経路

外部の写し取り (`applySnapshot`) と運用者の操作の**両方**が `canTransition` を通る。
片方だけが遷移表を持つと、写し取りが取り下げを上書きする。保存側 (D1 リポジトリ) でも
書き込み前に再度通しており、呼び出し順序に依存しない。
