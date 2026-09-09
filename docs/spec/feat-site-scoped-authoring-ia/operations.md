# 運用手順 (P12 / SYS-SITE-SCOPED-AUTHORING-IA-P12)

- feature: `feat-site-scoped-authoring-ia`
- 作成日: 2026-09-08
- 消費した成果物: `final-review.md`, `evidence/`
- 対になる文書: [`ia-rules.md`](./ia-rules.md)（規則）

この文書は**手を動かす順序**を書く。なぜそうするかは `ia-rules.md` にある。

各手順は最後に**確かめ方**を持つ。「やった」で終わる手順は書かない。

---

## 1. 書き方の決めごとの雛形を直す

### 1-1. どこを直すか（先に決める）

直したいものが次のどちらかで、触る場所が変わる。

| 直したいもの | 触る場所 | 影響範囲 |
|---|---|---|
| 節の並び・文体の決まりそのもの | 共通の雛形（コード内の定義 1 つ） | **全ブログ** |
| このブログの型で外せない節の印 | 型ごとの重み `pattern-writing-emphasis.ts` | その型のブログだけ |

**ブログ 1 本だけを直す口は無い。** これは設計であって欠落ではない
（`ia-rules.md` §4）。1 本だけ変えたい要望が出たときは、
`final-review.md` §5 の 3 つの決めごとを先に決める。

### 1-2. 手順

```
1. /admin/writing/template を開き、いま共通の雛形が何を言っているかを読む
2. 直す（コード内の定義。この画面と公開前の検査は同じ定義を読んでいる）
3. pnpm run typecheck
4. npx vitest run tests/application/usecases/authoring tests/domain/authoring
5. /admin/sites/<ブログ>/writing を型の違う 2 本で開く
```

### 1-3. 確かめ方

- 手順 5 で、**型の違う 2 本で印の付く節が違う**こと。
  同じなら重み付けが効いていない（`cloneWritingMethodForSite` に型が渡っていない）。
- `/admin/writing/template`（雛形そのもの）と
  `/admin/sites/<ブログ>/writing`（複製）で、**節と文体の決まりが一致する**こと。
  ずれていたら複製が丸ごとコピーになっている。

### 1-4. やってはいけないこと

**手引きを別文書として書かない。** 書いた日から、その文書とコードの定義は
別々に古くなる。「手引きどおりに書いたのに公開前の検査で落ちる」は
この 2 重化からしか起きない。

---

## 2. よく使う画面への近道を編集する

### 2-1. 近道の実体を先に理解する

近道は**独立した帯ではない**。サイドバーに既にある一段目の入口
（`/admin/personas` / `/admin/writing` / `/admin/content`）を消さずに残し、
その行き先を転送の殻にしてある。押すとそのときのブログの配下へ着く。

| サイドバーの項目 | href | 着く先 |
|---|---|---|
| 書き手 | `/admin/personas` | `/admin/sites/<slug>/authors` |
| 書き方の決めごと | `/admin/writing` | `/admin/sites/<slug>/writing` |
| 記事 | `/admin/content` | `/admin/sites/<slug>/articles`（受け皿待ち。§2-4） |

### 2-2. 近道を 1 本足す手順

```
1. src/presentation/ui/admin-route-metadata.ts の該当 route を開く
2. その route が nav(...) で定義されているか確かめる
   - nav(...) … サイドバーに出る（＝近道になれる）
   - child(...) … 出ない（nav: null が固定されている）
3. 近道にしたいなら nav(...) へ移し、group と label と icon を決める
4. 旧 URL からの転送が要るなら LEGACY_SITE_SCOPED_ROUTES に 1 行足す
5. UPDATE_OPEN_DOORS=1 npx vitest run tests/architecture/open-doors.test.ts
6. node scripts/traceability.mjs
7. npx vitest run tests/acceptance tests/ui
```

**手順 5 と 6 を飛ばすと落ちる。** 入口の台帳と生成文書が新しい route を
知らないままになるため。再生成しないと `open-doors` と
`generated-doc-freshness` が赤くなる。

### 2-3. 確かめ方

- サイドバーに出るのは `route.nav !== null && route.label !== null` を
  満たすものだけ。子（`child()`）は `nav: null` が固定なので**出ない**。
  読者像がサイドバーに無いのは畳む前からで、退行ではない。
- 押したとき、**そのときのブログ**へ着くこと。
  サイドバーを描いた時刻ではなく、押した瞬間に 1 回だけ解決される。

### 2-4. `/admin/content` の近道について

現在この入口は**まだ転送していない**。受け皿の `/admin/sites/[site]/articles` が
存在しないためで、存在しない住所へ転送すると旧 URL が今より確実に壊れる。

`feat-blog-scoped-admin-console` が記事画面を置いた時点で、
`LEGACY_SITE_SCOPED_ROUTES` に 1 行足すだけで他の 5 本と同じ形になる。

---

## 3. 新しいブログを足したとき、所属替え済みの配下に収まることを確認する

### 3-1. なぜ確認だけで済むか

**移行作業は無い。** データはワークスペース単位のままで、
site 配下へ移ったのは画面（住所）だけだから（`ia-rules.md` §2-c）。
新しいブログを足した瞬間から、書き手も読者像も書き方も配下に見える。

したがってこの節がやるのは**確認**であって、設定作業ではない。
逆に言えば、確認で何かが空だったら、それは
「データ層を site 単位へ割ってしまった」ことの兆候である。

### 3-2. 手順

```
1. /admin/sites/new で新しいブログを作る（slug を控える）
2. /admin/sites/<新しい slug>/authors          … 書き手が既存と同じ顔ぶれで出るか
3. /admin/sites/<新しい slug>/audience/personas … 読者像が出るか
4. /admin/sites/<新しい slug>/writing          … 節と文体の決まりが出るか
                                                  型に応じた印が付いているか
5. /admin/personas を開く                       … いま選ばれているブログの配下へ飛ぶか
```

### 3-3. 確かめ方（何が出れば正しいか）

| 画面 | 正しい状態 | 違ったら |
|---|---|---|
| `authors` | 既存ブログと**同じ書き手**が並ぶ | データが site 単位に割れている |
| `audience/personas` | 既存ブログと**同じ読者像**が並ぶ | 同上 |
| `writing` | 節と文体は共通、印だけが型で変わる | 雛形が丸ごと複製されている |
| `/admin/personas` | 新しいブログの `authors` へ着く | ブログの解決が押した瞬間に走っていない |

### 3-4. ブログが解決できない住所を踏んだとき

```
/admin/sites/no-such-blog/authors
```

**「見つかりません」が出て、サイドバーにブログ名が並ばないこと**を確認する。
受け先の `not-found.tsx` は `AppShell` を import も描画もしない。
ここでサイドバーが出ると、住所を打つだけで他ワークスペースの
ブログ名の一覧が読み取れてしまう。

「権限がありません」と「ありません」を出し分けないのも同じ理由である。
出し分けると、住所を打つだけでブログの**存否**が読み取れる。

---

## 4. 画面を 1 枚足すときの通し手順（1〜3 の共通土台）

```
1. ia-rules.md §1 と §2 で置き場所を決める
   - 作業の対象物はどれか（5 つのどれか、または group: null）
   - ブログごとに違ってよいか（yes → sites/[site]/ 配下）
2. admin-route-metadata.ts に route を 1 行足す
3. src/app/admin/... に page.tsx を置く
   - sites/[site]/ 配下なら、中身を読む前に resolveSiteOrNotFound
4. 情報台帳・カード契約が要求してきたら足す
   （ledger-contract.test.ts が何が足りないかを名指しする）
5. 再生成
   UPDATE_OPEN_DOORS=1 npx vitest run tests/architecture/open-doors.test.ts
   node scripts/traceability.mjs
   node scripts/acceptance-reconciliation.mjs --write
6. pnpm run typecheck && pnpm run lint
7. npx vitest run tests/ui tests/acceptance
```

**手順 7 で axe が自動的に掛かる。** `tests/ui/route-cases.ts` の管理画面ケースは
`ADMIN_ROUTE_METADATA` からの射影なので、route を 1 本足せば
その画面は自動的に描画と axe（WCAG 2.2 AA + best-practice、違反 0 が条件）の
対象になる。**検査の一覧に足し忘れる**という抜け方ができない。

---

## 5. 手元で画面を見る

```
pnpm dev                                  # http://localhost:3000
http://localhost:3000/signin
  → 「owner@local.test として入る」を押す
```

このボタンは `DEV_SIGNIN_ENABLED=1`（`.dev.vars`）かつ
`NODE_ENV !== "production"` の**両方**が成り立つときだけ出る。
片方でも欠けると 404 になる（403 ではない。開発用の入口があること自体を出さない）。

合言葉は要らない。この経路は利用者を**作らない**——
既に居る `owner@local.test` を引くだけである。

本番相当の姿を見るときは `pnpm run preview`（`http://localhost:8787`）。
こちらは Workers ランタイムで動く。

---

## 6. 規則を破らざるを得なくなったとき

規則は目的のためにあり、目的に反する規則は直す対象である。
ただし**黙って外さない**。次の順で残す。

1. どの規則を、どの画面で、なぜ守れないかを書く
2. 守れないことで何が起きるかを書く（「特に問題ない」なら規則が不要だった証拠）
3. 対応する検査を消さずに、`it.skip` ではなく**理由付きの例外**として通す

`/admin/content/*` を転送していないのは、この形で残してある例である
（`redirect-map-draft.json` の `not_redirected` に理由付きで載っている）。
検査を消して緑にすると、いつ誰が何のために外したかが消える。

- Required evidence: 本ファイル
