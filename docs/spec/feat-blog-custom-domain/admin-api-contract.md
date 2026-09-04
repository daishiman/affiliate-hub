# 管理操作の契約

正本: `src/application/usecases/blog-ops/manage-custom-domains.ts`

## 入力

```ts
type ManageCustomDomainsInput =
  | { action: "read"; siteSlug?: string }            // 省略で workspace 全体
  | { action: "register"; siteSlug: string; hostname: string }
  | { action: "sync"; siteSlug: string; domainId: string }
  | { action: "set_canonical"; siteSlug: string; domainId: string }
  | { action: "revoke"; siteSlug: string; domainId: string; reason: string };
```

## 出力

```ts
type BlogDomainsView = {
  siteSlug: string | null;
  domains: readonly CustomDomain[];
  canonical: { kind: "custom"; hostname } | { kind: "default"; path } | null;
  instructions: readonly DomainVerificationInstruction[];
  notice: string | null;
};
```

`canonical` は workspace 全体を見ているときだけ `null`。正規の住所はブログ 1 本に対して
しか決まらないので、でっち上げない。

## 権限

| 操作 | 必要な権限 | 理由 |
|---|---|---|
| `read` | `content.read` | 記事を書く人も、自分の記事がどの住所で読まれるかを知る必要がある |
| それ以外 | `site.manage` | 読者に見えるものを変える |

## `notice` — 失敗ではないが、済んでいないこと

外部呼び出しの失敗を、そのまま操作全体の失敗にしない。登録の意思は保存できているのに
「失敗しました」と返すと、運用者はもう一度登録を押し、同じドメインで `CONFLICT` を受け取る。

`notice` を返すのは 2 箇所:

1. `register` で外部への申し込みが失敗 — 「登録はできた。外部へは届いていない。
   設定を確かめてから『状態を確認』を押せ」
2. `revoke` で外部の取り消しが失敗 — 「取り下げた (読者には届かない)。ただし外部側の
   登録が残っており課金が続くことがある」

## 各操作の順序

- **register**: 形の検証 → D1 へ保存 → 監査記録 → 外部へ申し込み → 写しを反映。
  外部が落ちても保存は消さない。消すと、鍵が未設定の環境では 1 件も登録できない。
- **sync**: 外部 id が無ければ**申し込みからやり直す**。分けずに `snapshot` だけを呼ぶと、
  登録時に外部が落ちていた行が永久に `pending` のまま取り残される。
- **revoke**: **D1 を先に落としてから**外部を消しに行く。逆順だと外部 API が落ちている間
  取り下げが一切できない。配信先を決めているのは `active` の行だけを見る照会なので、
  D1 を落とした時点で配信は止まる。**止めることを外部の可用性に依存させない。**
  理由が空なら断る (`field: "reason"`)。

## 断り方

対象の住所が見つからないときは `field` を付けない。対象は行の隠し欄から来るので、
画面に直せる入力欄が無い。名前を付けると `FormResult` がその欄の断りを出す約束になり、
断りが正しく作られたまま誰にも見えずに捨てられる。
