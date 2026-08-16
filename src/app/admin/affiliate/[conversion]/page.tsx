import Link from "next/link";
import type { ReactNode } from "react";
import { affiliateNotice, affiliateUseCases, currentActor } from "@/presentation/composition";
import {
  AppShell,
  Callout,
  Card,
  ErrorView,
  Page,
  StubNotice,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 成果 1 件。
 *
 * 取り込んだ額と手で直した額を並べて出す。
 * 上書きしてしまうと、次の取り込みとの差が出せず、誤りに気づけない。
 *
 * 直せないときは、ボタンを消すのではなく理由を出す。
 * 押せないものが黙って消えていると、壊れているのか制限なのか分からない。
 */
export default async function ConversionPage({
  params,
}: {
  readonly params: Promise<{ readonly conversion: string }>;
}) {
  const { conversion: conversionId } = await params;
  const actor = await currentActor();
  const uc = affiliateUseCases();
  const result = await uc.getConversion.execute(actor, { conversionId });

  if (!result.ok) {
    return (
      <Shell title="成果">
        <ErrorView
          title="この成果を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/affiliate">提携と成果へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { view, advertiserName, adjustable, notAdjustableReason } = result.value;

  return (
    <Shell title={`${advertiserName}の成果`}>
      <StubNotice
        what="提携先・提携条件・成果の保存先"
        blockedBy="各 ASP の利用申請と、ご自身による接続情報の登録"
        stubId="persistence:affiliate-sample"
      >
        <span>{affiliateNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>内訳</h2>
        <dl className={styles.criteria}>
          <div>
            <dt>提携先</dt>
            <dd>{view.aspLabel}</dd>
          </div>
          <div>
            <dt>広告主</dt>
            <dd>{advertiserName}</dd>
          </div>
          <div>
            <dt>状態</dt>
            <dd>{view.statusLabel}</dd>
          </div>
          <div>
            <dt>発生日</dt>
            <dd>{view.occurredAt.toLocaleString("ja-JP")}</dd>
          </div>
          <div>
            <dt>取り込んだ額</dt>
            <dd className={styles.numeric}>{view.ingestedLabel}</dd>
          </div>
          <div>
            <dt>手で直した額</dt>
            <dd className={styles.numeric}>{view.adjustedLabel ?? "直していません"}</dd>
          </div>
          <div>
            <dt>実際に使う額</dt>
            <dd className={styles.numeric}>{view.effectiveLabel}</dd>
          </div>
        </dl>
        {view.adjustmentReason === null ? null : (
          <p className={styles.linkNote}>直した理由: {view.adjustmentReason}</p>
        )}
        <p className={styles.sectionLead}>
          手で直しても、取り込んだ額はそのまま残します。
          残しておかないと、次の取り込みとの差が出せず、どちらが正しいか分からなくなるためです。
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>金額を直す</h2>
        {adjustable ? (
          <p className={styles.sectionLead}>
            この成果の金額は直せます。直すときは理由も一緒に残してください。
            直す操作は担当者ご本人が行います。AI からは実行できません。
          </p>
        ) : (
          <Callout
            tone="info"
            title="いまは直せません"
            reason={notAdjustableReason ?? ""}
          />
        )}
      </Card>
    </Shell>
  );
}

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AppShell
      currentPath="/admin/affiliate"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "提携と成果", href: "/admin/affiliate" },
        { label: title },
      ]}
      actions={<Link href="/admin/affiliate">提携と成果へ戻る</Link>}
    >
      <Page title={title} lead="この成果の内訳と、金額を直せるかどうかを見ます。">
        {children}
      </Page>
    </AppShell>
  );
}
