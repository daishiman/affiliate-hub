# API / action contract

Next 16 の mutation は既存 Server Action を拡張する。全actionは入力を読む前に `signedInActor()`、usecase内でcapabilityとworkspaceを再確認する。

| contract | input | output | failure |
|---|---|---|---|
| collect inventory CLI | root sitemap, timeout, capturedAt, outputDir | snapshot + dedup inventory + digest | network/XML errorでexit 1、旧outputを書き換えない |
| `manageBlogArticleAction:update` | articleId, expectedRevision, fields, blocks, tags | status, message, revision, savedAt | validation/permission/not found/storage/conflict。入力はclient draftに残る |
| `previewAffiliateUrlAction` | raw URL | `AffiliatePreview` 9項目 | rejected/failed/partialを同じcardで返す。例外・HTML本文を返さない |
| `submitAffiliateUrlAction` | raw URL, note | 受信箱ID/duplicate/message | previewとは別。明示送信時だけ保存 |
| `advanceLinkIngestionAction:register` | ingestionId + confirmed snapshot fields | affiliate link id/message | matched未満、duplicate、同URL、permissionを拒否 |
| list affiliate links | actor + filter | snapshot/state/last checked/placement count/placements | permission/storage failure |

`previewAffiliateUrlAction` は non-mutation RPC であり、previewと登録は意図的に分離する。取得本文はactionの戻り値とlog/auditに残さない。

## host policy

- production/developmentとも `default-deny`。`AFFILIATE_PREVIEW_PROVIDER_POLICIES` に登録したprovider adapterの `fetchHosts` 以外は取得しない。
- denylistがallowlistより常に優先。private/loopback/link-local/unspecified/multicast/metadata、IPv4-mapped IPv6は拒否。
- Workers runtimeで信頼できるA/AAAA resolverが利用できない間は、任意public hostを許可しない。信頼済みproviderの固定hostだけをadapterが取得する。
- 短縮URLは専用provider policyに明示されたものだけ。redirect先も同じdeny/allow判定へ戻し、対象外hostへ移ったら停止。
- 対象外URLは「この提携先は自動取得に未対応です」と返し、本文やURL全体なしで手動補正へ進める。
