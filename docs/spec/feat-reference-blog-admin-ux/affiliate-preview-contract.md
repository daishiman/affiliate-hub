# Affiliate URL preview contract

## 9項目

1. raw URL / canonical URL。
2. 商品名またはlink名。自動値は要確認。
3. 販売元/提携先。
4. 権利とhost policyの両方を満たすremote image URL、それ以外は独自図解fallback。imageはproxy/再配信しない。
5. 価格、通貨、取得時刻。「現在価格を保証しない」を表示。
6. 取得元hostと方法 (`json-ld`, `open-graph`, `html-meta`, `manual`)。
7. original/canonical/product の重複候補。
8. `ready | partial | duplicate | failed | rejected` と失敗理由。
9. 保存後は site/page/block 配置と差替えが利用可能になる方針。

## 抽出値の扱い（表示専用）

抽出した `productName` / `merchantName` / `oneLine` / `price` は**表示専用**で、`ProductSnapshot` の入力にしない。写しの正本は操作者が見ている ASP の画面であり、登録フォームの手入力欄がその写しを受け取る。自動抽出値を保存すると「登録した日の写し」が誰の見た表記か分からなくなり、表記の責任者を後から辿れない（`src/domain/monetization/product-snapshot.ts`、`docs/product/design-decisions.md §2`）。保存経路が無いのは欠陥ではなく意図である。プレビューは検証支援として自己完結し、足りない値は `partial` と手入力誘導で閉じる。

表示面の境界: 金額を出すため、確認カードは管理面限定の部品 `src/presentation/admin/earn/affiliate-preview-card.tsx` が持ち、読者面の共有 export (`src/presentation/ui`) からは出さない。貼り付けた URL 全体を出せるのは貼り付け直後の本人に対してだけで、保存後の一覧では出さない。

## extraction priority

JSON-LD Product/Offer→Open Graph→canonical/meta/titleの順。不明値を推測しない。商品名が無い場合もpartial previewを出し、手動入力へ進む。

## security

- host policyは `default-deny`。明示的なprovider adapterの `fetchHosts` だけをallowlistとし、denylistを常に優先する。短縮URLとredirect先も同じ判定へ戻す。
- 取得はprovider policyを通した後の `guardedFetch` のみ。HTTP(S)、redirect毎のprivate/loopback/link-local/unspecified/multicast/metadata deny、IPv4-mapped IPv6 deny、最大5redirect、10s、2MB。
- DNS A/AAAAを安全に再検査できるresolverが無いWorkers環境では任意host fetchを無効にし、固定hostの信頼済みprovider adapterだけを許可する。resolverを導入する場合は各hop直前にA/AAAA全件を検査し、解決0件、mixed public/private、DNS失敗をfail-closedにする。
- parse対象はHTML/XHTMLのみ。scriptを実行しない。JSON-LDはJSON parseだけ。
- raw/final/canonicalは表示前にprotocol/host policyを検査。imageは `imageDisplayAllowed=true`かつ `imageHosts` allowlistのpublic HTTPSだけを表示する。内部宛、HTTP mixed content、権利不明、対象外host、未取得は `DiagramFallback`。画像バイナリは取得/保存しない。
- 本文とaffiliate URL全体をaudit/logに書かない。
