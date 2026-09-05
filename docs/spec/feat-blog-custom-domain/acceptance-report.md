# 受入判定 — ブログ独自ドメイン

判定日: 2026-09-04 / 対象: `features/feat-blog-custom-domain.context.json` の受入条件 10 件

| id | 受入条件 | 判定 | 根拠 |
|---|---|---|---|
| A1 | 所有権が検証されるまで `active` にならず、未検証ホストで配信されない | **満たす** | 登録直後は `pending` (`register` の既定値)。公開照会 `resolveSiteSlugByHost` / `findActiveByHostname` は `status = 'active'` を述語に持つ。試験「登録直後は pending で、正規の住所にはなっていない」「配信中の住所だけがブログへ解決する」 |
| A2 | `hostname` に UNIQUE 制約があり、同じホスト名を 2 つのブログへ同時に繋げない | **満たす** | 部分ユニーク索引 `site_custom_domain_hostname_idx`。衝突は `CONFLICT` へ変換して業務上の答えとして返す。試験「同じ住所を生きたまま 2 度登録することはできない」 |
| A3 | active な独自ドメインへのアクセスが当該ブログを 200 で返す | **満たす** | `src/middleware.ts` が `decideHostRouting` の `pass` を受けたときだけ住所表を引き (`resolveCustomHostSlug` + `lookupCustomHostInD1`)、引けたら `routeResolvedSite` でサブドメイン経路と同じ判断へ合流させる。試験「配信中の住所だけがブログへ解決する」(D1 側) と `tests/infrastructure/resolve-custom-host.test.ts` (写しの規則)、`routeResolvedSite` の 4 件。→ FIND-1 解決済み |
| A4 | 独自ドメインが active の間も既定住所が 200 を返す | **満たす** | 既定住所は住所表の行に依存しない (`defaultHostPath` は URL 名だけから作る)。試験「1 件も登録していないブログは行を持たない（既定住所は行ではない）」 |
| A5 | active の間 canonical が独自ドメインを指し、非 active へ戻ると既定住所へ戻る | **満たす** | 管理画面側は `resolveCanonicalHost`、公開ページ側は `siteCanonicalUrl` (独自ドメイン → 既定サブドメイン → path 形の優先順位) が担う。`active` から落ちると行の canonical が降り、逆向き照会 `resolveCanonicalHostBySiteSlug` も `null` を返して既定住所へ戻る。試験「正規の住所は逆向きにも引ける（canonical を組むため）」「canonicalは住所の付け方で揺れない」3 件。→ FIND-2 解決済み |
| A6 | 切断しても行が削除されず `revoked` として残り、hostname の履歴が追える | **満たす** | `revoke` は行を消さず状態を変える。遷移表で `revoked` は終端。試験「取り下げた後に外部が active を運んできても復活しない」「新しい行として登録し直せる」 |
| A7 | 接続・切断が Publisher 未満から実行できず、切断は一致入力なしに完了しない | **要求と異なる形で満たす** | 権限は要求より**厳しい** — `site.manage` を要求し `publisher` 役も実行できない (FIND-4)。確認入力は**ブログ名の一致ではなく理由の記入必須** (FIND-3)。試験「記事を書く人は住所を登録できない」「理由の無い取り下げは受け付けない」 |
| A8 | 接続・検証・切断の各操作が `audit_logs` に残る | **満たす** | `blog_domain.registered` / `.synced` / `.canonical_changed` / `.revoked` の 4 種。記録に失敗した操作は成功として返さない。試験「監査に書けないと失敗として返る」「成功した操作は記録に残る」 |
| A9 | provider 側の検証失敗・証明書失敗が failure_reason として管理画面に文言で出る | **満たす (試験は無い)** | `last_error` 列に保存し、`BlogDomainRow` が「直近の失敗: …」として行に出す。ただし失敗理由入りの行を描く試験は無い (`test-cases.md` 覆えていないもの) |
| A10 | 同じ hostname で接続を二度実行しても custom hostname が重複登録されない | **満たす** | 2 度目は D1 の部分ユニーク索引で止まり、外部への申し込みへ到達しない (保存が先、申し込みが後の順序による)。写し取りの繰り返しも冪等。試験「同じ状態を何度写し取っても結果は変わらない」 |

## 総合

- 満たす: A1 / A2 / A3 / A4 / A5 / A6 / A8 / A9 / A10 (9 件)
- 要求と異なる形で満たす: A7 (1 件) — 判断と理由を FIND-3 / FIND-4 に記録

**受入 10 件すべてが判定と証跡参照を持つ。** A7 は要求文と実装が異なる形で、
権限は要求より厳しく (`publisher` 役も不可)、確認入力はブログ名の一致ではなく
理由の記入必須である。どちらも意図した判断で、`design-review-findings.md`
FIND-3 / FIND-4 に理由を残した。

**引き受けた代償を 2 つ明記する** (どちらも欠陥ではなく設計上の選択で、
`operations-runbook.md` に運用上の見方を書いた):

- 取り下げてから配信が止まるまで**最大 60 秒**かかる (入口の写しの寿命)。
- canonical を降ろしてから宣言が変わるまで**最大 60 秒**かかる (同じ寿命)。
  こちらは読者の転送ではなく検索エンジンへの宣言なので、遅れの害はより小さい。

**試験の無い受入が 1 件残る**: A9 (失敗理由の文言表示) は実装済みだが、
失敗理由入りの行を描く画面試験が無い。`test-cases.md` の「覆えていないもの」に記録。
