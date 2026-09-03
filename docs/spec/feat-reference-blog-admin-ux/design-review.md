# P03 独立設計レビュー

- reviewer: root（P02/P05の実装担当とは別）
- reviewed: 2026-08-30
- scope: P02 6文書、現行 `guardedFetch`、article/affiliate/placementの既存正本
- verdict: `PASS — critical 2件とmajor 2件をP02/P04へ反映済み`

## 判定

| 観点 | 判定 | 根拠 |
|---|---|---|
| 認知負荷 | PASS | 1画面1目的、主操作1つ、5状態、preview→適用→取消し、段階的開示がcomponent/state contractで一貫する |
| 情報階層 | PASS | 公開面をheader/body/sidebar/footerと記事リズムへ抽象化し、desktop/mobileの役割を分離している |
| 非模倣 | PASS | 保存対象はURL metadata/digestのみ。文章・写真・ロゴ・色値・CSS/theme assetを採用しない |
| 既存feature境界 | PASS | article/affiliate link/placementを既存table・usecaseへ追加し、改善案は導出read modelとして二重正本を作らない |
| SSRF・画像権利 | PASS | C1/C2/M1をaffiliate preview contractとsecurity fixtureへ反映 |
| A1–A12 trace | PASS | M2をcollector contract testへ反映し、A10/A11をcanonical mappingで固定 |

## 再レビュー結果（2026-08-30）

- C1: productionは固定provider adapterのhost allowlistを正本にするdefault-denyへ変更した。任意hostは取得せずmanual partialへ倒し、redirect/shortenerも各hopで同じpolicyへ戻す。将来resolverを追加する場合のA/AAAA全answer、mixed、0件、失敗、IPv4-mappedのfail-closed条件も契約化した。
- C2: remote imageは`imageDisplayAllowed`、image host allowlist、public HTTPSの全条件を満たす場合だけ表示し、他は`DiagramFallback`とした。proxy/storeは行わない。
- M1: deny優先、環境非依存のdefault-deny、redirect再判定、利用者が手動補正できるpartial fallbackを明記した。
- M2: A1–A12のscreen/data/evidence非空、screen集合、A10=usability、A11=a11yを機械検査し、6/6 PASSを確認した。

P03は設計ゲートとしてPASSとする。P05実装でこの契約から外れた場合はP09/P10で再度FAILへ戻す。

## findings

### C1 DNS解決後のIP再検査が無い

現行 `src/infrastructure/http/guarded-fetch.ts` の `checkHop` はURLのhostname文字列を検査するが、DNS A/AAAAの解決結果を検査しない。公開名がprivate/loopback/link-local/metadata IPを返す場合とDNS rebindingを止められない。要求は入口と各redirectでのDNS/IP再検査である。

完了条件:

- resolverを注入可能なpure boundaryにし、各hopの直前にA/AAAAを全件検査する。
- 1件でもprivate、loopback、link-local、unspecified、multicast、metadata宛ならfetchしない。
- 解決0件、mixed public/private、redirect先、IPv4-mapped IPv6、DNS失敗をfail-closedでテストする。
- WorkersでDNS resolverが使えない場合は、許可済みaffiliate provider adapterだけを使うdefault-denyへ倒し、任意host fetchを有効にしない。

### C2 image URLが管理者ブラウザ経由で内部ネットワークへ到達できる

P02はimage URLのprotocol検査だけを定義している。`http(s)://127.0.0.1`、private hostname、redirectする画像を`img src`へ渡すと、server fetchを通さず管理者ブラウザから内部宛要求が起きる。第三者画像の権利不明時も表示してはいけない。

完了条件:

- image URLはpublic http(s)かつprovider契約/明示allowlistで表示権利が確認できる場合だけ表示する。
- それ以外（内部宛、権利不明、未取得、mixed content）は独自 `DiagramFallback` にする。
- 画像binaryの取得・proxy・永続化は行わない。

### M1 allowlist/denylist契約が曖昧

`guardedFetchのみ`では「任意のpublic hostを許可」と「登録済みproviderだけを許可」のどちらか決まらない。環境別host policy、短縮URL、redirect先の扱いをAPI契約に固定する必要がある。

完了条件:

- default-deny、明示allowlist、denylist優先、redirect先も再判定、手動入力fallbackをcontractへ追記する。
- 拒否理由は秘密情報・URL全文・取得本文を返さず、利用者が次の操作を選べる日本語にする。

### M2 A10/A11のcanonical mappingを固定する回帰テストが必要

初稿でA10（初見成功率90%以上）とA11（a11y/200% zoom/keyboard）が逆転した。P01文書は修正済みだが、IDと意味を文字列で固定しないとP04/P07/P10で再発する。

完了条件:

- traceabilityのA10がusability evidence、A11がa11y evidenceを指すtestを追加する。
- A1–A12すべてにscreen/data/evidenceが1件以上あり、screen IDがscreen inventory集合の部分集合であることを検査する。

## P05への引き継ぎ

上記4 findingの契約反映とRED→GREENを確認したためP05へ進める。実装ではhost policy、画像権利fallback、A10/A11 mappingを緩めない。
