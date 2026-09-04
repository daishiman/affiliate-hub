# 独立レビュー所見 — 住所層

対象: `data-model.md` / `admin-api-contract.md` / `host-resolution-design.md` と実装。
観点: 依存の向き (AD-1)、正本の一意性、外部障害時の振る舞い、所有境界。

## FIND-1 — 独自ドメインの解決が入口に配線されていない (重大) → **解決済み**

**指摘時**: `resolveSiteSlugByHost` は実装され試験もあったが、`src/middleware.ts` は
`decideHostRouting` (基底ドメインのサブドメインのみ) しか呼んでいなかった。
独自ドメインで届いた要求は `pass` になり、本体の画面として扱われていた。

- 影響: 受入 A3 が端から端まで満たされない。管理画面上は `active` でも、そのホストで
  ブログは開かない。
- 判断: 配線には要求ごとの D1 往復が増える。middleware は edge で走るため、
  キャッシュ方針 (どれだけ古い写しを許すか) を決めずに入れると、取り下げた住所が
  キャッシュの寿命ぶん配信され続ける。**先に方針を決める**。

**解決の形** (`host-resolution-design.md` §配線に詳しい):

1. 判断を純関数のまま分割した。`routeResolvedSite(slug, pathname)` は
   「どのブログか決まったあとの path の判断」で、サブドメイン経路と独自ドメイン経路が
   **同じ 1 本**を通る。これを分けなかったのは、分けると「サブドメインからは管理画面を
   開けないが独自ドメインからなら開ける」という抜け道が片方にだけ作れるためである。
2. 照会は入口側に置いた。`src/infrastructure/domains/resolve-custom-host.ts` が
   寿命 60 秒・上限 512 件の写しを持ち、`src/middleware.ts` は
   `decideHostRouting` が `pass` を返し、かつ `isAlwaysPassPath` が偽のときだけ引く。
   画面の部品 (`/_next/`, `/cdn-cgi/`) は住所表を引く前に落とす。
3. 引き受けた代償: **取り下げが効くまで最大 60 秒遅れる。** 短くするほど D1 への往復が
   増え、長くするほど取り下げが遅れる。運用手順書の「切り離しの反映」に明記した。
4. 引けないときは本体の画面へ倒す。通行証 ([[entry-gate]]) が「確かめられない＝通さない」
   なのに対し、住所は「引けない＝いつもの画面」でなければ、D1 が一瞬落ちただけで
   管理画面まで 404 になる。**向きが逆であることが要点**。

- 試験: `tests/infrastructure/resolve-custom-host.test.ts` (写しの寿命・上限・
  照会失敗時に写さない・ポート番号の除去)、`tests/domain/authoring/site-hostname.test.ts`
  の `routeResolvedSite` / `isAlwaysPassPath`。

## FIND-2 — 公開ページの canonical が住所表を見ていない (中) → **解決済み・当初の見立ては誤り**

**指摘時**: `siteMetadataUrl` は要求の host から絶対 URL を組んでおり、住所表を見ていなかった。
当時は「FIND-1 が解ければ、独自ドメインで来た要求の host がそのまま独自ドメインになるので
結果として canonical も独自ドメインを指す。**FIND-1 に従属する**」と判断した。

**この見立ては誤っていた。** FIND-1 を解いた結果、逆に壊れることが分かった。

- 旧実装の canonical は `<要求 origin>/s/<URL名><path>` である。ところが FIND-1 の配線後、
  `/s/...` はブログの住所からは **404 になる** (`routeResolvedSite` が二重の住所を作らせない)。
  つまり FIND-1 だけを解くと、公開ページが**自分で 404 を指す canonical** を配る。
- さらに、要求 host から組む形では「独自ドメインで来たら独自ドメイン、既定住所で来たら
  既定住所」となり、同じ記事が住所の数だけ別ページとして扱われる。canonical の目的は
  まさにそれを防ぐことなので、要求 host 依存はそもそも canonical の役目を果たしていない。

**解決の形**: 組み立てを純関数 `siteCanonicalUrl` (`src/domain/authoring/site-public-url.ts`)
に出し、優先順位を 独自ドメイン → 既定のサブドメイン → path 形 に固定した。
`siteMetadataUrl` は引数を集めるだけになった。逆向きの照会
`resolveCanonicalHostBySiteSlug` (URL 名 → 正本の住所) を足し、入口と同じ寿命の写しを通す。

- 当初の懸念「公開ページの描画が D1 の可用性に依存する」は、**引けないときは既定の住所へ
  倒す**ことで解消した。既定の住所は正しい答えなので、canonical ごと落とす必要がない。
- 試験: `tests/domain/authoring/site-public-url.test.ts`、
  `tests/presentation/site-metadata.test.ts` の「canonicalは住所の付け方で揺れない」、
  `tests/integration/d1-custom-domain.test.ts` の「正規の住所は逆向きにも引ける」。

## FIND-3 — 切断の確認がブログ名の一致入力ではない (軽微・意図的)

要求 A7 は「切断はブログ名の一致入力なしに完了しない」。実装は**理由の記入必須**である。

- 判断: 取り下げた住所を踏んだ読者はどこにも着かない。あとで「なぜ止めたか」を
  辿れることのほうが、打ち間違いの防止より価値が高いと判断した。理由は行に残り、
  監査記録にも入る。
- 破壊の防止は別の層で効いている: 取り下げは行を消さず、遷移表で `revoked` を終端に
  しているため、誤って取り下げても同じホスト名を新しい行として登録し直せる。
- 記録: `acceptance-report.md` A7 に「要求と異なる形で満たす」として残す。

## FIND-4 — 権限が要求より厳しい (軽微・意図的)

要求は「Publisher 未満の役割から実行できない」。実装は `site.manage` を要求し、
`publisher` 役はこれを持たない (`owner` / `workspace_admin` / `brand_manager` のみ)。

- 判断: 締めておいて後で緩めるほうが、逆より安全である。要求の下限は満たしている。

## 満たされていることの確認

- 依存の向き: 住所層は観測層・改善層・提示層のどれにも依存しない (AD-1)。
- 正本の一意性: 「使う意思」は D1、「検証の事実」は外部。ポートが 2 本に分かれており、
  写しを保存する側 (`applySnapshot`) だけが遷移表を通る。
- 所有境界: あらゆる読み書きが `workspace_id` を述語に持つ
  (`tests/architecture/tenant-scoped-schema.test.ts` が機械で検査)。
- 外部障害: 登録は残る / 取り下げは外部に依存しない。両方に試験がある。
