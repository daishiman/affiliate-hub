# テスト計画 — 住所層

## 何を、どの層で確かめるか

| 層 | 何を確かめるか | 置き場所 |
|---|---|---|
| 純関数 (domain) | ホスト名の正規化と拒否、遷移表、正規住所の決定 | `tests/domain/entity-invariants.test.ts` ほか |
| ユースケース (application) | 外部障害時の振る舞い、順序、権限、監査 | `tests/application/manage-custom-domains.test.ts` |
| 保存 (integration, workerd 実機) | 部分ユニーク索引、遷移表の施行、所有境界 | `tests/integration/d1-custom-domain.test.ts` |
| 構造 (architecture) | 全クエリが `workspace_id` を持つ、ポートの形 | `tests/architecture/tenant-scoped-{schema,ports}.test.ts` |
| 画面 (ui) | form の意図の区別、失敗理由の掲出 | `tests/ui/blog-ops-console-forms.test.tsx` |

## 方針

**索引と遷移表は実機で確かめる。** 部分ユニーク索引 (`WHERE status <> 'revoked'`) は
SQLite の機能であり、模造の保存先では再現できない。`tests/integration/d1-*.test.ts` は
`getPlatformProxy` で workerd の子プロセスを立てて走る (`vitest.projects.mjs` の
`worker-runtime` プロジェクト、ファイル間は直列)。

**外部は模造で置く。** Cloudflare for SaaS を実際に叩く試験は置かない。確かめたいのは
「外部が落ちたときにこちらがどう振る舞うか」であり、外部が正しく動くことではない。
模造は `request` / `snapshot` / `release` のそれぞれで失敗を返せる形にする。

**時刻は注入する。** `now: () => Date` を依存として受け取り、壁時計を読まない。

## 網羅の下限

`invariant-checklist.md` の INV-1..INV-12 に、それぞれ 1 件以上の失敗しうる試験を対応させる。
対応表は `test-cases.md`。
