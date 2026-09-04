# 証跡（feat-reference-blog-admin-ux / P01 参照サイト解析）

- machine index: [`index.json`](./index.json)（`verify_evidence_index.py` が digest を検算する）
- 隔離方針: **参照元のホスト・実URL・固有名が置けるのはこのディレクトリだけ**である
  （[`../non-copying-design-system.md`](../non-copying-design-system.md) gate 2）。
- 集約日: 2026-08-30

## なぜ 2 層に分かれているか

参照サイトの解析結果は、同じ事実を**二通りの粒度**で持っている。

| | 置き場 | 持っているもの |
|---|---|---|
| 生証跡 | このディレクトリの `*.raw.json` | 実URL、実ホスト、sitemap の実体 digest |
| 抽象仕様 | [`../reference-url-inventory.json`](../reference-url-inventory.json) など | 件数、分類、抽象パス表記、digest |

**片方だけでは足りない。** 抽象側だけを置くと、1,072 件という数字が本当に観測から
出たのか誰にも確かめられない。生証跡だけを置くと、仕様を読むすべての人が
参照元の URL を読むことになり、構成の抽象化という前提が崩れる。

**両方を無条件に混ぜても駄目だった。** 元は inventory 自身が実URLを持っており、
仕様文書がその URL を代表証跡として引用していた。実URLが仕様の本文へ
染み出す経路がそこにあった。いまは向きが逆で、抽象側が `url_digest` を持ち、
**必要になった人だけ**が digest からこちらを引く。

## ファイル一覧

| ファイル | 内容 | sha256（先頭 16） |
|---|---|---|
| [`sitemap-snapshot.raw.json`](./sitemap-snapshot.raw.json) | root sitemap と 14 part の status / content-type / 実体 sha256 / 所属URL数 | `15df95c5c3e2782c` |
| [`reference-url-inventory.raw.json`](./reference-url-inventory.raw.json) | 重複除外 1,072 件の canonical URL と分類 | `43b4c1fc3d0f42f2` |
| [`reference-site-profile.json`](./reference-site-profile.json) | 収集対象のホストと、サイト固有パスの分類表 | `666f3e0738d412e7` |
| [`index.json`](./index.json) | 全証跡の path / digest / 対応する受入条文 | — |

`reference-site-profile.json` は **script の設定であって、記録ではない**。
`collect_reference_inventory.py` はホストを 1 文字も持たず、`--site-profile` で
これを受け取る。禁止している名前を検査器自身が抱えてしまう状態を避けるためで、
[`../../../../scripts/check-reference-site-reuse.mjs`](../../../../scripts/check-reference-site-reuse.mjs)
が禁止語リストを repo へ置かないのと同じ理由による。

## 抽象側との突き合わせ方

```bash
# 1,072 件の分類が生証跡と一致し、未分類 0 であることの検算
python3 -m pytest scripts/reference-site-analysis/ -q

# index.json に載る全ファイルの digest 検算
python3 scripts/reference-site-analysis/verify_evidence_index.py
```

対応関係は 2 つの digest で取る。

- `url_digest` = `sha256(canonical_url)` … 抽象 1 レコード ↔ 生 1 レコード。
- `inventory_digest` … 1,072 件の `record_digest` を改行で連結した sha256。
  抽象側の `items` から再計算しても
  `sitemap-snapshot.json` の値（`bac24ebe95f012964c6d51f7bfaec1266783e09c9505187925edcdc3c352b288`）に一致する。
  **順序も件数も欠落も、この 1 値で検出できる。**

## ここに置いていないもの

| 項目 | 理由 |
|---|---|
| 参照元の本文・画像・ロゴ・CSS・theme/plugin asset | 収集器が取得しない。`retention_policy` に明記 |
| 参照元の色値 | 測定も復元もしない（`../non-copying-design-system.md`） |
| 取得時の HTTP レスポンス本体 | sitemap XML の sha256 だけを残す。差分検出にはそれで足りる |
