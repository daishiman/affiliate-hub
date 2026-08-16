import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import type { SiteWizardStep } from "@/domain/authoring";
import { SITE_WIZARD_STEPS } from "@/domain/authoring";
import { startSiteDraftAction } from "@/presentation/admin/site-wizard-action";
import { SiteWizardStepForm } from "@/presentation/admin/site-wizard-form";
import {
  currentActor,
  siteBuilderUseCases,
  siteDraftSampleNotice,
} from "@/presentation/composition";
import {
  Button,
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
 * ブログ作成ウィザード (§16.2)。
 *
 * **この画面が示したいのは「ブログを 1 本増やすのにコードを書かない」こと。**
 * 13 の質問に答えると設計図のデータができ、読者向けの画面
 * (`/s/<URL名>`) はすでにあるものがそのまま使われる。
 *
 * 段階は 1 画面 1 段階にしている。13 個を 1 画面に並べると、
 * どこまで答えたか分からなくなり、途中で離脱したときに続きから戻れない。
 */
export default async function NewSitePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ draftId?: string; step?: string; error?: string }>;
}) {
  const params = await searchParams;
  const actor = await currentActor();
  const uc = siteBuilderUseCases();

  if (params.draftId === undefined) {
    return <DraftListView error={params.error} />;
  }

  const step = SITE_WIZARD_STEPS.find((s) => s === params.step) as SiteWizardStep | undefined;
  const found = await uc.getDraft.execute(actor, { draftId: params.draftId, step });

  if (!found.ok) {
    return (
      <Shell>
        <ErrorView
          title="この下書きを開けませんでした"
          body={found.error.message}
          suggestedAction={found.error.suggestedAction ?? null}
          action={<Link href="/admin/sites/new">作りかけの一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const draft = found.value;
  const current = draft.steps.find((s) => s.step === draft.currentStep);

  return (
    <Shell>
      <StubNotice
        what="ブログ作成の下書きの保存先"
        blockedBy="site_drafts / site_blueprints テーブルの追加と D1 への接続"
        stubId="persistence:site-draft-memory"
      >
        <span>{siteDraftSampleNotice()}</span>
      </StubNotice>

      <Card>
        {/* 現在地は常に出す。13 段階のどこにいるか分からない状態を作らない。 */}
        <p className={styles.sectionLead}>
          {current?.position ?? 1} / {draft.totalSteps} 段階目（{draft.doneCount} 段階まで入力済み）
        </p>
        <h2 className={styles.sectionTitle}>{current?.label ?? "作る"}</h2>
        <p className={styles.sectionLead}>{current?.question ?? ""}</p>

        <SiteWizardStepForm draft={draft} />
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>13 段階の進み具合</h2>
        <p className={styles.sectionLead}>
          好きな段階へ戻れます。順番どおりに答えなくても構いません。
        </p>
        <ol className={styles.linkList}>
          {draft.steps.map((s) => (
            <li key={s.step}>
              <Link href={`/admin/sites/new?draftId=${draft.draftId}&step=${s.step}`}>
                {s.position}. {s.label}
              </Link>
              {" — "}
              {s.done ? "入力済み" : "まだ入力していません"}
              {s.step === draft.currentStep ? "（いま開いています）" : ""}
            </li>
          ))}
        </ol>
      </Card>
    </Shell>
  );
}

/**
 * 作りかけの一覧。
 *
 * 下書きが 0 件のときも「始める」ボタンだけの画面にしない。
 * ここで何が起きるのか（13 の質問に答えると 1 本できる）を先に書く。
 */
async function DraftListView({ error }: { readonly error?: string }) {
  const actor = await currentActor();
  const listed = await siteBuilderUseCases().listDrafts.execute(actor, {});

  return (
    <Shell>
      <StubNotice
        what="ブログ作成の下書きの保存先"
        blockedBy="site_drafts / site_blueprints テーブルの追加と D1 への接続"
        stubId="persistence:site-draft-memory"
      >
        <span>{siteDraftSampleNotice()}</span>
      </StubNotice>

      {error === undefined ? null : <Callout tone="warn" reason={error} />}

      <Card>
        <h2 className={styles.sectionTitle}>新しいブログを始める</h2>
        <p className={styles.sectionLead}>
          13 の質問に答えると、ブログが 1 本できます。答えた内容は設計図として保存され、
          読者に見える画面は既にあるものがそのまま使われます。作るまで公開されません。
        </p>
        <form action={startSiteDraftAction}>
          <Button type="submit" tone="primary">
            13 の質問を始める
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>作りかけのブログ</h2>
        {!listed.ok ? (
          <ErrorView
            title="作りかけの一覧を出せませんでした"
            body={listed.error.message}
            suggestedAction={listed.error.suggestedAction ?? null}
            action={<Link href="/admin/sites">ブログの一覧へ戻る</Link>}
          />
        ) : listed.value.total === 0 ? (
          <EmptyView
            title="作りかけはありません"
            body={listed.value.emptyReason ?? "作りかけのブログはありません。"}
          />
        ) : (
          <ul className={styles.linkList}>
            {listed.value.items.map((d) => (
              <li key={d.draftId}>
                <Link href={`/admin/sites/new?draftId=${d.draftId}`}>
                  {d.name === "" ? "名前がまだ決まっていない下書き" : d.name}
                </Link>
                {" — "}
                {d.doneCount} / {d.totalSteps} 段階まで入力済み
                {d.createdSiteSlug === null ? "（まだ公開されていません）" : "（作成済み）"}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/sites"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "サイト", href: "/admin/sites" },
        { label: "新しいブログ" },
      ]}
      actions={<Link href="/admin/sites">ブログの一覧へ戻る</Link>}
    >
      <Page
        title="新しいブログを作る"
        lead="13 の質問に答えると、ブログが 1 本できます。増えるのは設計図のデータだけで、画面のコードは共通のまま使います。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
