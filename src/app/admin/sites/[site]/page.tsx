import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { currentActor, platformUseCases, siteSampleNotice } from "@/presentation/composition";
import {
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
  StubNotice,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * ブログ 1 本の設計図。
 *
 * 「このブログだけ特別扱いする」ための画面ではない。
 * ここに出ている項目がブログの違いのすべてであり、
 * 足りない項目があれば設計図に欄を足す。画面に分岐を足さない。
 */
export default async function SiteDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly site: string }>;
}) {
  const { site: siteSlug } = await params;
  const actor = await currentActor();
  const result = await (await platformUseCases()).getSite.execute(actor, { siteSlug });

  if (!result.ok) {
    return (
      <Shell title="ブログ">
        <ErrorView
          title="このブログを表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/sites">ブログの一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { summary, blueprint, routes, axes } = result.value;
  const emptyAxes = axes.filter((a) => a.value.trim() === "");

  return (
    <Shell title={summary.name}>
      <StubNotice
        what="ブログの設計図の保存先"
        blockedBy="site_blueprints テーブルの追加とマイグレーション"
        stubId="persistence:site-sample"
      >
        <span>{siteSampleNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>このブログの位置づけ</h2>
        <p className={styles.sectionLead}>{blueprint.purpose}</p>
        <dl className={styles.criteria}>
          <div>
            <dt>型</dt>
            <dd>{summary.patternLabel}</dd>
          </div>
          <div>
            <dt>扱う分野</dt>
            <dd>{blueprint.genre}</dd>
          </div>
          <div>
            <dt>収益の形</dt>
            <dd>{summary.revenueModelLabel}</dd>
          </div>
          <div>
            <dt>色の組み合わせ</dt>
            <dd>{blueprint.theme.brandTheme}</dd>
          </div>
          <div>
            <dt>余白の詰め方</dt>
            <dd>{blueprint.theme.density === "compact" ? "詰める" : "ゆったり"}</dd>
          </div>
          <div>
            <dt>角の丸み</dt>
            <dd>{blueprint.theme.radius}</dd>
          </div>
          <div>
            <dt>明暗の切り替え</dt>
            <dd>{blueprint.theme.colorScheme}</dd>
          </div>
          <div>
            <dt>AI 向けの案内ファイル</dt>
            <dd>{blueprint.emitLlmsTxt ? "出す" : "出さない"}</dd>
          </div>
        </dl>
      </Card>

      {summary.launchBlockedReason === null ? (
        <Callout
          tone="info"
          title="公開に必要な固定ページは揃っています"
          reason="広告の扱い・訂正の履歴・問い合わせ先など、読者が確かめる先がすべてあります。"
        />
      ) : (
        <Callout
          tone="warn"
          title="いまは公開できません"
          reason={summary.launchBlockedReason}
        />
      )}

      <Card>
        <h2 className={styles.sectionTitle}>ほかのブログとの違い（10 個の観点）</h2>
        {emptyAxes.length > 0 ? (
          <Callout
            tone="warn"
            title={`${emptyAxes.length}個の観点が空欄です`}
            reason={`空欄のまま記事を作ると、ほかのブログの言い換えになります（${emptyAxes
              .map((a) => a.label)
              .join(" / ")}）。`}
          />
        ) : null}
        <dl className={styles.criteria}>
          {axes.map((axis) => (
            <div key={axis.key}>
              <dt>{axis.label}</dt>
              <dd>{axis.value.trim() === "" ? "未記入" : axis.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>カテゴリー（{blueprint.categories.length}件）</h2>
        {blueprint.categories.length === 0 ? (
          <EmptyView
            title="カテゴリーがありません"
            body="読者の入口が無い状態です。少なくとも 1 件は必要です。"
          />
        ) : (
          <ul className={styles.linkList}>
            {blueprint.categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/s/${encodeURIComponent(summary.slug)}/categories/${c.slug}`}>
                  {c.name}
                </Link>
                <span className={styles.linkNote}>
                  {c.oneLine} / 最初に作る記事: {c.initialArticleTypes.join("・")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>出す画面（{routes.length}種類）</h2>
        <p className={styles.sectionLead}>
          どこから来るかを必ず書いています。どこからも辿り着けない画面を作らないためです。
        </p>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">画面</th>
              <th scope="col">住所</th>
              <th scope="col">どこから来るか</th>
              <th scope="col">広告表示</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((route) => (
              <tr key={route.key}>
                <th scope="row">{route.label}</th>
                <td>{route.path}</td>
                <td>{route.reachedFrom}</td>
                <td>{route.requiresDisclosure ? "必要" : "不要"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/sites"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "サイト", href: "/admin/sites" },
        { label: title },
      ]}
      actions={<Link href="/admin/sites">ブログの一覧へ戻る</Link>}
    >
      <Page title={title} lead="このブログの設計図です。ほかのブログとの違いはここに書いてある内容がすべてです。">
        {children}
      </Page>
    </AdminShell>
  );
}
