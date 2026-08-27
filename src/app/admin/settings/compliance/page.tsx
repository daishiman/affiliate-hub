import { AdminShell } from "@/presentation/admin/admin-shell";
import {
  POLICY_CHANNEL_LABEL,
  POLICY_DOMAIN_LABEL,
  POLICY_SEVERITY_LABEL,
} from "@/presentation/admin/compliance-labels";
import {
  AddPolicyRuleForm,
  EditDisclosureForm,
  StopPolicyRuleForm,
} from "@/presentation/admin/compliance-forms";
import { currentActor, settingsUseCases } from "@/presentation/composition";
import {
  Callout,
  DataTable,
  DisclosureNotice,
  EmptyView,
  ErrorView,
  Note,
  Prose,
  Section,
  SubSection,
  TextLink,
} from "@/presentation/ui";

export const dynamic = "force-dynamic";

/**
 * 広告表記と表記のきまりを、いま効いている形に直す。
 *
 * --- 隣の「この作業場所」と何が違うか ---
 * あちらは**確かめる**画面で、広告表記は他の設定と並んで読むだけである。
 * ここは**変える**画面で、変えたことが操作の記録に残る。読むのと変えるのを
 * 同じ画面に混ぜると、契約や上限を見に来た人の前に変更の口が並ぶ。
 *
 * --- 2 つを 1 枚に置いている理由 ---
 * 広告表記と表記のきまりは、どちらも「この記事を出してよいか」を決める。
 * 別々の画面にすると、片方だけ直して公開が止まったときに、
 * 止めた理由がもう一方の画面にある状態になる。
 */
export default async function ComplianceSettingsPage() {
  const actor = await currentActor();
  const uc = await settingsUseCases();

  const [disclosures, rules] = await Promise.all([
    uc.listDisclosures.execute(actor, {}),
    uc.listPolicyRules.execute(actor, {}),
  ]);

  return (
    <AdminShell
      routeId="settings/compliance"
      title="広告表記と表記のきまり"
      lead="読者に出す広告の断りと、記事の表現を止めるきまりを直します。"
      actions={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
    >
      <Section title="広告であることの表示">
        <Prose>
          ここで決めた文は、記事の冒頭・SNS の本文・購入ボタンの近く・AI の回答など、表示が必要な場所すべてに同じものが出ます。画面ごとに書き換えることはできません。
        </Prose>

        {!disclosures.ok ? (
          <ErrorView
            title="広告表記を出せませんでした"
            body={disclosures.error.message}
            suggestedAction={disclosures.error.suggestedAction ?? null}
            action={<TextLink href="/admin/settings">設定へ戻る</TextLink>}
          />
        ) : (
          <>
            {disclosures.value.rows.length === 0 ? (
              <EmptyView
                title="広告表記がありません"
                body={
                  disclosures.value.emptyReason ??
                  "下の欄で登録すると、読者に出る文がここに並びます。"
                }
              />
            ) : (
              disclosures.value.rows.map((d) => (
                <SubSection
                  key={d.disclosureId}
                  title={`${d.relationshipLabel}${d.required ? "（表示が必要）" : "（表示は不要）"}`}
                >
                  {/* 読者に出るものと同じ見た目で確かめる。画面用の書き方を別に作らない。 */}
                  <DisclosureNotice asLandmark={false} message={d.visibleMessage} />
                  <EditDisclosureForm
                    disclosureId={d.disclosureId}
                    defaults={{
                      relationshipType: d.relationshipType,
                      advertiserOrSupplier: d.advertiserOrSupplier ?? "",
                      editorialInfluence: d.editorialInfluence,
                      aiAssisted: d.aiAssisted,
                    }}
                  />
                </SubSection>
              ))
            )}

            <SubSection title="広告表記を足す">
              <EditDisclosureForm />
            </SubSection>
          </>
        )}
      </Section>

      <Section title="表記のきまり">
        {!rules.ok ? (
          <ErrorView
            title="表記のきまりを出せませんでした"
            body={rules.error.message}
            suggestedAction={rules.error.suggestedAction ?? null}
          />
        ) : (
          <>
            {rules.value.rows.length === 0 ? (
              /*
                空は「これから」ではない。初期の 13 件が常に効いているはずなので、
                0 件は全部止めたか読み出しが壊れているかである。断りの文言は
                ユースケースが持っている（画面ごとに言い方を変えない）。
              */
              <Callout
                tone="warn"
                title="いま、記事の表現は何も確認されません"
                reason={rules.value.emptyReason ?? ""}
              />
            ) : (
              <>
                <DataTable
                  caption="いま効いているきまり。止めたものはここに出ません。"
                  columns={[
                    { key: "name", label: "きまり" },
                    { key: "domain", label: "分野" },
                    { key: "channel", label: "出し先" },
                    { key: "severity", label: "当たったとき" },
                    { key: "basis", label: "根拠" },
                  ]}
                  rows={rules.value.rows.map((r) => ({
                    key: r.ruleId,
                    cells: [
                      r.name,
                      POLICY_DOMAIN_LABEL[r.domainScope],
                      POLICY_CHANNEL_LABEL[r.channelScope],
                      POLICY_SEVERITY_LABEL[r.severity],
                      r.basis,
                    ],
                  }))}
                />
                <Note>
                  代わりの書き方は、記事の確認結果に出ます。ここでは根拠だけを並べています。
                </Note>

                {rules.value.rows.map((r) => (
                  <SubSection key={`stop-${r.ruleId}`} title={r.name} lead={r.suggestion}>
                    <StopPolicyRuleForm name={r.name} ruleId={r.ruleId} />
                  </SubSection>
                ))}
              </>
            )}

            <SubSection title="きまりを足す">
              <AddPolicyRuleForm />
            </SubSection>
          </>
        )}
      </Section>
    </AdminShell>
  );
}
