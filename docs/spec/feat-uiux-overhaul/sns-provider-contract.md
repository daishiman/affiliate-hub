# SNS プロバイダ抽象の契約: feat-uiux-overhaul

- graph node: `SYS-UIUX-OVERHAUL-P02`
- 受入条件: A4 — 新しい SNS の追加がプロバイダ実装の追加のみで完了し、既存画面の改修を要しない
- 現行の正本: `src/domain/distribution/channel.ts` (`ChannelKind`, `CHANNEL_CAPABILITIES`, `supportsDirectPublish`)

## スコープ境界 (重要)

feature の scope_out に「SNS 実配信の実行系」がある。本 feature が触れる範囲を明示する。

| 責務 | 所有 | 本 feature |
|---|---|---|
| プロバイダの**記述** — ラベル・投稿方式・文字数上限・リンク可否・広告表記の置き場 | 本 feature | **持つ** |
| 記述を画面へ投影する部品 (`ChannelBadge` 等) | 本 feature | **持つ** |
| 配信状態の**表示** (未着手 / 予約済み / 送信中 / 完了 / 失敗 + 理由) | 本 feature | **持つ** |
| 追加が 1 箇所で済む形への構造変更 | 本 feature | **持つ** |
| 実際に外部 API へ送信する処理・認証フロー・再送 | `feat-distribution-hub` | **持たない** |
| 送信結果を状態へ書き戻す処理 | `feat-distribution-hub` | **持たない** |

**`src/infrastructure/sns/` に本 feature が置くのは記述だけ**とする。送信の実装をここに置かない。プロバイダを 1 つ足したとき、本 feature の範囲では「画面に選択肢として現れ、制約が正しく表示され、状態が表示できる」までが完成で、実際に送信できるかは `feat-distribution-hub` の完成度に依存する。

この境界は独立評価 (`uiux-plan-evaluator`) が P05 について medium severity で指摘した曖昧さへの回答である。

## 現状の評価

`CHANNEL_CAPABILITIES` は既に良い抽象で、次を満たしている。

- 「どこへ出せるか」が 1 つの表にある。画面が独自に配信先を生やせない
- `publishMode` で `manual_export` (公式 API が無い) を区別し、`supportsDirectPublish()` が画面の挙動を表から決める
- 制約に `basisNote` (根拠) が付いていて、規約変更時に確認先が分かる
- 認証情報は `credentialRef` (保管先の参照) だけを持ち、値を持たない。値らしき文字列は `createChannelConnection` が形で弾く

**A4 を満たしていないのは 2 点だけ。**

### 障害 1: `ChannelKind` を手書きしている

```ts
export type ChannelKind = "own_site" | "x" | "instagram" | ... ;
export const CHANNEL_CAPABILITIES: Readonly<Record<ChannelKind, ChannelCapability>> = { ... };
```

Facebook を足すには **union と表の 2 箇所**を直す。A4 の述語は「変更が必要なファイルがプロバイダ実装ファイルと登録 1 箇所のみ」なので、同一ファイル内とはいえ 2 箇所は「1 エントリ追加」ではない。

**向きを反転させる。**

```ts
export const CHANNEL_CAPABILITIES = { own_site: {...}, x: {...}, ... } as const satisfies Record<string, ChannelCapability>;
export type ChannelKind = keyof typeof CHANNEL_CAPABILITIES;
```

表に 1 エントリ足すと型が自動で広がる。`satisfies` を使うのは、`Record<string, …>` にすると各エントリの `kind` フィールドの型が緩むため。

**表のキーと `kind` フィールドが一致することを型で強制する。** 一致しないと、表から引いた記述と画面が表示するものがずれる。

### 障害 2: 画面が `ChannelKind` で分岐する余地がある

A4 の境界に「表そのものが SNS ごとの分岐 (switch/if) を持つ実装は本条件を満たさない」とある。現状 `src/app/admin/**` に分岐は無いが、**構造的に防いでいない**。

**表示に要る値をすべて記述に持たせ、画面は記述を受け取るだけにする。**

## プロバイダ記述の形

既存 `ChannelCapability` に、画面が要る 3 項目を足す。

| 追加項目 | 型 | なぜ要るか |
|---|---|---|
| `iconName` | `string` | `ChannelBadge` が絵柄を引く。画面が `kind` から絵柄を決めると分岐になる |
| `accentToken` | `string` | 配信先の識別色。トークン名で持ち、生の色値は持たない |
| `statusLabels` | `Record<PublishState, string>` | 「送信中」の言い方が方式で変わる。`manual_export` は「書き出し済み」で、送信していない |

`statusLabels` が要る理由が最も重い。`manual_export` のチャネルに「送信中」と出すと嘘になる — 人が貼り付けるまで何も起きていない。状態の言い方をチャネル記述に持たせれば、画面は `statusLabels[state]` を引くだけで済み、`if (kind === "note")` が要らなくなる。

## 追加の手順 (A4 の検証シナリオ)

Facebook を 1 つ足すとき、変更するファイルは次だけになる。

```
src/domain/distribution/channel.ts   ← CHANNEL_CAPABILITIES に 1 エントリ
```

送信を実装する場合は `src/infrastructure/sns/<provider>.ts` が加わるが、それは `feat-distribution-hub` の範囲。

**変更してはならない場所**:

- `src/app/admin/**` — 差分 0 行
- `src/presentation/ui/**` — 差分 0 行

P09 が実際に 1 プロバイダを追加した git diff のパス集合で機械判定する。

## 画面側の契約

| 部品 | 受け取るもの | 受け取らないもの |
|---|---|---|
| `ChannelBadge` | `ChannelCapability` 1 件 | `ChannelKind` の文字列だけ |
| `ChannelStatusList` | 配信先ごとの `{capability, state, failureReason}` | チャネル種別による分岐 |

`ChannelBadge` が `ChannelKind` ではなく記述そのものを受け取るのは、**受け取れる情報を絞ると分岐が生えるため**。種別だけ渡すと、部品の中で表を引き直すか `switch` するかのどちらかになる。

## 状態の表示 (A3)

配信状態は 5 つ。**取得は `feat-distribution-hub` の責務**で、本 feature は取得済み状態の表示に責任を持つ。

| 状態 | api_publish / api_schedule | manual_export |
|---|---|---|
| `not_started` | 未着手 | 未着手 |
| `scheduled` | 予約済み | 書き出し待ち |
| `sending` | 送信中 | 書き出し済み (貼り付け待ち) |
| `done` | 完了 | 掲載済み (手動記録) |
| `failed` | 失敗 + **理由** | 書き出し失敗 + **理由** |

言い方の対応は `statusLabels` が持つ。**失敗理由は必ず併記する** — 理由の無い失敗表示は、利用者に何もできることを与えない。

表示先は記事の一覧と詳細の両方 (A3 の述語)。

## 規約変更への備え

`basisNote` は既にあるが、**いつ確認したか**が無い。規約は変わるので、確認日を持たせる。

| 追加項目 | 型 | 用途 |
|---|---|---|
| `basisCheckedAt` | `string` (ISO 日付) | 画面に「最終確認: 2026-08-21」と出す |

古い制約で投稿を組み立てると、文字数超過や規約違反で失敗する。確認日が見えれば、失敗したとき最初に疑う先が分かる。

## この文書が決めていないこと

- 各プロバイダのアイコン絵柄と識別色の具体値 — 実装時に選ぶ
- 送信・認証・再送の実装 — `feat-distribution-hub` が所有する
- 接続設定 (`ChannelConnection`) の管理画面 — `/admin/settings/integration-access` の範囲であり、本 feature では表示情報の整理のみ
