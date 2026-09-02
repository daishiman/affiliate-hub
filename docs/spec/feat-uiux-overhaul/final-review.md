# 最終レビュー（feat-uiux-overhaul / P10）

判定日: 2026-08-22
対象: P01 〜 P09 の成果を通して見た、feature 全体としての目的達成。

phase ごとの判定は、その phase の中でだけ辻褄が合っていれば通ってしまう。
ここでは **feature の goal に対して**、9 つの phase の成果を並べて判定する。

入力:
[`requirements-baseline.md`](./requirements-baseline.md)（A1〜A10 の述語）/
[`acceptance-report.md`](./acceptance-report.md)（P07 の受入判定）/
[`migration-report.md`](./migration-report.md)（P08 の移行実測）/
[`quality-report.md`](./quality-report.md)（P09 の品質実測）

<!-- acceptance-reconciliation {"implementation_status":"pass","release_status":"unpublished","tracking_status":"active","evaluated_digest":"sha256:bf0c9e8d62b743f11eecb01cdb743d5b5888ddc1460b3c713554ab3b6da9b035","acceptance_ids":["A1","A2","A3","A4","A5","A6","A7","A8","A9","A10"]} -->

> この文書は 2026-08-22 の P10 履歴である。現在の状態は
> **実装受入は合格 / 未公開 / tracking は active** の3軸で表す。
> 当時の残課題・失敗件数を現在値として扱わず、現在のjoinとdigestは
> [`acceptance-reconciliation.json`](./acceptance-reconciliation.json) で判定する。

---

## 1. 通しの再実行

```
npx vitest run tests/ui/uiux-*.test.ts tests/ui/uiux-*.test.tsx
→ Test Files 8 passed (8) / Tests 273 passed (273)
```

A1〜A10 に対応する検査 8 群を、P09 完了後の木で通しで再実行した。
**273 件すべて通過。** P07 の判定以降に退行していない。

## 2. goal に対する判定

feature の goal を 7 つの述語に割って、それぞれ何で確かめたかを並べる。

| goal の述語 | 判定 | 何で確かめたか |
|---|---|---|
| 全画面が単一用途に分割されている | 達成 | 49 画面。状態を変えるフォームが 2 つ以上ある画面 0 枚（A1） |
| 管理対象に一覧・新規作成・編集・削除と API が揃っている | 達成 | 4 対象 × 4 操作 = 16 組。(a) 画面上の操作 / (b) API / (c) 権限の 3 つすべてを照合（A2 §4） |
| カード間隔・文章量・サイドバーが最適化されている | 達成 | `lead` 上限超 0 画面（P01 は 21）、常時表示 `Callout` 上限超 0 画面（P01 は 14）（A8） |
| 各サイト・SNS への投稿状態が画面へ反映されている | 達成 | 失敗理由まで含めて出る（A3） |
| 1 商品から複数ブログへコンセプト別の文章を作れる | 達成 | 導線・ブログ数分の対象・設計図由来の切り口・上書きの 4 点（A5） |
| 新しい SNS をプロバイダ追加のみで拡張できる | **条件付き達成** | 画面側は **0 行**の編集で広がる。ただし接続実装は別途要る（§3） |
| 重複実装が無く、ブログ別の部品を作れる | 達成（測り方に穴が残る） | A6 / A7 は緑。ただし A6 の走査範囲が狭い（§4-1） |

7 つのうち 6 つは無条件で達成。残る 1 つの中身を次に書く。

## 3. 「プロバイダ追加のみで拡張できる」の実測結果

P09 で実際に出し先を 1 件足して測った（[`quality-report.md`](./quality-report.md) §6）。

- `src/app/admin/**`、`src/presentation/**` の要編集行数: **0 行**
- UI 系テスト 80 ファイル 2514 件: 全通過。新しい出し先が選択肢へ自動で並んだ
- 型エラー: **1 件だけ** — `src/infrastructure/channels/channel-registry.ts(78,7)`

**「記述を足すだけ」が成り立つのは画面まで。** 接続実装（コネクタ）は自動では生えない。

これは欠陥ではなく、そう設計されている。`channel-registry.ts` が
`Readonly<Record<ChannelKind, ConnectorFactory>>` を要求しているので、
投稿手段を書かないと**コンパイルが通らない**。
もしここが緩ければ、画面から選べるのに押した瞬間に失敗する出し先が作れてしまう。

受入条件 A4 の文言は「プロバイダ追加のみ」なので、
**「画面の変更は不要／接続実装は必要」** を A4 の正確な意味として確定する。
文言の側は P13 の書き戻しで直す（§5）。

## 4. 当時の残課題（履歴）

通しで見て残ったものを、逃げ道を作らずに全部並べる。

### 4-1. 測り方に穴が残っているもの

| 課題 | bd | 内容 |
|---|---|---|
| A6 の走査範囲 | **`ah-brd`**（新規） | 重複実装の検査が `src/app` の `.tsx` しか見ていない。P08 の実測では未移行の生 `<form>` 14 件が**すべて `src/presentation/admin`** にあり、検査の外だった。重複でも同じ穴が空いている可能性が高い |
| `.sectionLead` の置き場所 | **`ah-jbj`**（新規） | 同じ役割の `.pageLead` が `ui.module.css` にあるのに、`.sectionLead` だけ `admin.module.css` に残る。移せない直接の理由は、検査が css ファイルを名指ししていること |

この 2 件は P07 で見つかった 2 つの穴（A2・A10）と**同じ形**である。

> 「0 件だ」と言う検査には、0 でないはずの母集団の床が同居していなければならない。
> 母集団の作られ方を測っていない検査は、対象が範囲の外へ移った日に空振りで緑のまま残る。

A2 は述語 3 つのうち 2 つしか見ていなかった。A10 は表の側からだけ見ていた。
A6 は走査範囲の側を見ていない。**同じ間違いが 3 回起きている。**
これは個別の不具合ではなく、検査の書き方の癖として残課題に挙げる。

### 4-2. 測っていないもの

| 課題 | bd | 状態 |
|---|---|---|
| アクセシビリティの自動検査 | `ah-9pk` | axe が見ていない領域がある。個別に塞ぐやり方が 3 回続いた |
| 見た目の崩れの自動検出 | `ah-h57` | 基準画像を 5 枚置いた段階。差分検出の常時実行は無い |
| 応答性能 | 未起票 | 未計測。この feature の受入条件に性能の述語が無いため、条件としては欠けていない |
| 実ブラウザでの動作確認 | 未起票 | 型と単体検査までしか見ていない（P08 §6） |

「問題なし」ではなく「測っていない」。ここを混ぜないために分けて書く。

### 4-3. 既知 blocker（この feature の外に根がある）

| bd | 件数 | 内容 |
|---|---:|---|
| `ah-a0o` | 51 | `system-spec/*.md` 5 ファイルの章再生成退行 |
| `ah-v6n` | 1 | まとめ節に紐付かない束が上限より 1 つ多い |

この 52 件は P01 の着手前から赤く、本 feature の作業で **1 件も増減していない**。
`ah-a0o` は **A**（HEAD へ戻す）か **B**（`compile-spec-doc.py` を直して再コンパイル）で、
どちらを採るかは人が決める。**C（床を下げて緑にする）は採らない。**

## 5. P13 へ引き継ぐ書き戻し

| 対象 | 現状 | 直す向き |
|---|---|---|
| 仕様書の `src/app/api/admin` | その階層は実在しない（実体は `src/app/api`） | **仕様書を実装へ合わせる**。実装を仕様書へ合わせると経路が二重になる |
| A4 の文言「プロバイダ追加のみ」 | 画面は 0 行だが接続実装は要る | 「画面の変更不要／接続実装は必要」と書き分ける |

## 6. write_scope からの逸脱（P01〜P10 の集約）

各 phase の write_scope の外へ書いたものを、ここに一度まとめる。
個々の phase の報告に散らしたままだと、全体でどれだけ外へ出たかが誰にも見えない。

| phase | 逸脱先 | 理由 |
|---|---|---|
| P07 | `delete-form-action.ts` / `delete-confirm.tsx` / `distribution/[publication]/page.tsx` / 検査 2 群 / `information-priority-map.json` | A2・A10 の穴を残したまま合格と書けないため |
| P08 | `src/presentation/admin/*.tsx` 5 ファイル / `src/app/signin/page.tsx` / `uiux-form-declaration.test.ts` / `required-test-types-report.md`（自動更新） | 移行対象の実体が write_scope の外にあった |
| P09 | `tests/ui/admin-edit-forms.test.tsx`（新規）/ `tests/infrastructure/product-sample-repository.test.ts`（新規）/ `tests/ui/catalog-and-signin-clients.test.tsx`（新規）/ `src/presentation/admin/product-form.tsx`（欠陥修正 1 行）/ `docs/product/coverage.md`（自動更新） | 層別カバレッジの床を、床を下げずに満たすため |
| P09（前半） | `tests/infrastructure/d1-product-repository.test.ts` / `tests/application/edit-sites.test.ts` / `tests/presentation/admin-edit-actions.test.ts` / `tests/ui/uiux-spacing-and-copy.test.ts` / `tests/architecture/open-doors.test.ts` / `docs/product/open-doors.md` / `tests/visual/__baseline__/*`（5 枚）/ `tests/application/concept-drafts.test.ts` | 同上 |
| P10 | なし（本ファイルのみ） | — |

**共通する形**: write_scope が「成果物の置き場所」で切られているのに対し、
実際に直す必要があるものは「欠陥の在り処」で決まる。
逸脱が 3 phase 続いたので、これは個々の判断ミスではなく、
write_scope の切り方が実作業と合っていない。P12（運用手順）で扱う。

## 7. 動かしていないもの

カバレッジの下限、`required-test-types.mjs` の上限、章の床、
`KNOWN_STALE_MAX`、`UNREFERENCED_BUNDLE_MAX`、`baseline_totals`。

**穴が見つかったとき、床を下げて緑にしていない。**
実装を足し、検査を足して、条件を実際に満たしてから合格にしている。

## 8. 当時の実装受入判定

**受入 10 件すべて合格。feature の実装 goal は達成。**

これは公開完了またはtracking完了を意味しない。公開は未実施、feature tracking は active である。

ただし次の 2 つを、合格の但し書きとして明記して次 phase へ渡す。

1. A4 の「プロバイダ追加のみ」は**画面までの話**である（接続実装は要る）。
2. A6 の緑は、**走査範囲が狭い状態での緑**である（`ah-brd`）。

「合格」とだけ書いて渡すと、この 2 つは次に誰かが同じ場所を触るまで見えない。
