# infrastructure 層 — 道具の実装

`src/application/ports/` で宣言された形を、実際の道具で満たす場所。

## 置いてよいもの

`fetch` / 外部 SDK / Drizzle / Cloudflare のバインディング / 認証情報の取り出し。

## 置いてはいけないもの

**業務の判断。** 次のような文を書き始めたら、それは domain の仕事である。

- 「この商品は上位か」→ `domain/ranking/`
- 「公開してよいか」→ `domain/compliance/publish-gate.ts`
- 「本文が上限を超えているか」→ 判定の基準は `domain/distribution/channel.ts` の能力表

コネクタの `validate` は、能力表の値を読んで文言に直すだけにする。
上限の数値をこちらに書き写すと、2 箇所が食い違う。

## スタブの扱い

たたき台には未実装の差し込み口が多い。**空の成功を返してはならない。**

未実装は `stub-registry.ts` に登録し、呼ばれたら `NOT_IMPLEMENTED` で失敗する。

```ts
const entry = registerStub({
  id: "asp:amazon_associates",
  port: "AspAdapterPort",
  label: "Amazonアソシエイト との連携",
  blockedBy: "PA-API 5.0 の利用資格 (売上実績) と申請が必要",
});
return { searchProducts: () => stubCall(entry, "searchProducts") };
```

`blockedBy` には「時間がなかった」ではなく**前提条件**を書く。
これがそのまま残課題リストの説明になる。

登録された一覧は `listStubs()` で取れる。カバレッジ報告はこの一覧から作るので、
手で数えた数字と実態がずれない。

## フォルダ

| フォルダ | 責務 | 現在の実装を確認する正本 |
| --- | --- | --- |
| `platform/` | ID 生成・ログ・秘密の取り出し・KV・R2・Queue | `src/infrastructure/composition.ts` と `stub-registry.ts` |
| `asp/` | ASP アダプタと登録所 | `src/infrastructure/composition.ts` と各アダプタ |
| `llm/` | 生成 AI アダプタとプロンプト組み立て | `src/infrastructure/composition.ts` と各アダプタ |
| `channels/` | 配信コネクタと書き出し | `src/infrastructure/composition.ts` と各コネクタ |
| `persistence/` | D1 + Drizzle と、未接続時の見本リポジトリ | `src/infrastructure/composition.ts` と `drizzle/` |

実装済み・未接続をこの文書へ手で複製しない。実行時に何を使うかは
`src/infrastructure/composition.ts`、未接続理由は `stub-registry.ts` の登録内容を正本とする。

## 秘密情報

値に触れてよいのは `platform/secret-resolver.ts` だけ。

- ドメインは参照キー（`credentialRef`）しか持たない
- 取り出した値をログ・エラー本文・戻り値へ入れない
- 値の登録は利用者本人が行う。こちらのファイルやコマンド履歴に書かない
