import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { appearanceOptions, readAppearance } from "@/presentation/appearance";
import { currentActor, settingsNotice, settingsUseCases } from "@/presentation/composition";
import {
  AppearancePicker,
  Callout,
  Card,
  DisclosureNotice,
  EmptyView,
  ErrorView,
  Page,
  StubNotice,
} from "@/presentation/ui";
import styles from "../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 設定。
 *
 * この画面の役目は値を並べることではなく、
 * **「いま何ができない状態か」と「その理由」を同じ場所に出す**こと。
 * 上限・未参加・問い合わせ先の未設定は、どれも後で公開を止める原因になる。
 * 公開直前に初めて知るのでは遅い。
 */
export default async function SettingsPage() {
  const actor = await currentActor();
  const uc = await settingsUseCases();

  const appearance = await readAppearance();
  const options = appearanceOptions();

  const [overview, roles, members, brands, disclosures, audit] = await Promise.all([
    uc.getOverview.execute(actor, {}),
    uc.listRoles.execute(actor, {}),
    uc.listMembers.execute(actor, {}),
    uc.listBrands.execute(actor, {}),
    uc.listDisclosures.execute(actor, {}),
    uc.listAuditLog.execute(actor, { limit: 20 }),
  ]);

  if (!overview.ok) {
    return (
      <Shell>
        <ErrorView
          title="設定を出せませんでした"
          body={overview.error.message}
          suggestedAction={overview.error.suggestedAction ?? null}
          action={<Link href="/admin">ホームへ戻る</Link>}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <StubNotice
        what="作業場所・担当者・ブランド・広告表記・操作の記録の保存先"
        blockedBy="ログインの仕組み（Better Auth と Google ログイン）と、各テーブルの追加"
        stubId="persistence:settings-sample"
      >
        <span>{settingsNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>ログイン</h2>
        <p className={styles.sectionLead}>
          いまは見本の担当者として動いています。Google でのログインをつなぐと、
          許可した人だけが入れる状態になります。
        </p>
        <p className={styles.linkNote}>
          <Link href="/signin">いま誰として動いているかを見る</Link>
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>生成 AI の API キー</h2>
        <p className={styles.sectionLead}>
          記事を書かせるために使う鍵を登録します。鍵が 1 つも入っていないあいだは、下書きの生成が
          呼び出しの手前で止まります。
        </p>
        <p className={styles.linkNote}>
          <Link href="/admin/settings/llm">API キーの登録と状態を見る</Link>
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>画面の見た目</h2>
        <p className={styles.sectionLead}>
          ここでの選択はあなたの手元だけに効きます。ブログの見た目（読者に見える色）は、
          各ブログの設定で決まります。
        </p>
        {/*
          読者向けブログでも同じ部品を使う（明るさだけを出す）。
          管理画面用の見た目切り替えを別に作らないこと。
        */}
        <AppearancePicker
          current={appearance}
          schemeOptions={options.schemeOptions}
          modeOptions={options.modeOptions}
          description="選ぶとすぐ変わります。次に開いたときも同じ見た目になります（この端末のブラウザに覚えさせています）。"
        />
      </Card>

      {overview.value.blockedReason !== null && (
        <Callout
          tone="warn"
          title="いま止まっていること"
          reason={overview.value.blockedReason}
        />
      )}

      <Card>
        <h2 className={styles.sectionTitle}>この作業場所</h2>
        <table className={styles.rankTable}>
          <tbody>
            <tr>
              <th scope="row">名前</th>
              <td>{overview.value.workspaceName}</td>
            </tr>
            <tr>
              <th scope="row">契約の区分</th>
              <td>{overview.value.planLabel}</td>
            </tr>
            <tr>
              <th scope="row">時間帯</th>
              <td>{overview.value.timezone}（公開予約と締めの基準）</td>
            </tr>
            <tr>
              <th scope="row">通貨</th>
              <td>{overview.value.currency}</td>
            </tr>
          </tbody>
        </table>

        <h3 className={styles.sectionTitle}>使用数と上限</h3>
        <table className={styles.rankTable}>
          <thead>
            <tr>
              <th scope="col">種類</th>
              <th scope="col">いま</th>
              <th scope="col">上限</th>
              <th scope="col">状態</th>
            </tr>
          </thead>
          <tbody>
            {overview.value.capacities.map((c) => (
              <tr key={c.label}>
                <th scope="row">{c.label}</th>
                <td className={styles.numeric}>{c.used}</td>
                <td className={styles.numeric}>{c.max}</td>
                <td>{c.full ? "上限に達しています（これ以上増やせません）" : "追加できます"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>担当者</h2>
        {!members.ok ? (
          <ErrorView
            title="担当者を出せませんでした"
            body={members.error.message}
            suggestedAction={members.error.suggestedAction ?? null}
          />
        ) : members.value.rows.length === 0 ? (
          <EmptyView
            title="担当者がいません"
            body={members.value.emptyReason ?? "招待するとここに並びます。"}
          />
        ) : (
          <>
            {members.value.ownerMissing && (
              <Callout
                tone="warn"
                title="運営者が決まっていません"
                reason="運営者がいないと、契約と支払いに関する操作を誰も行えません。"
              />
            )}
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th scope="col">名前</th>
                  <th scope="col">役割</th>
                  <th scope="col">状態</th>
                  <th scope="col">担当の範囲</th>
                </tr>
              </thead>
              <tbody>
                {members.value.rows.map((m) => (
                  <tr key={m.membershipId}>
                    <th scope="row">{m.displayName}</th>
                    <td>{m.roleLabels.join("・")}</td>
                    <td>{m.stateLabel}</td>
                    <td>{m.scopeLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.linkNote}>
              担当者を招く・役割を変える操作は、この画面からはまだ行えません。ログインの仕組みが入ってからになります。
            </p>
          </>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>役割ごとにできること</h2>
        {!roles.ok ? (
          <ErrorView
            title="役割を出せませんでした"
            body={roles.error.message}
            suggestedAction={roles.error.suggestedAction ?? null}
          />
        ) : (
          <>
            <Callout
              tone="info"
              title="人だけが行える操作"
              reason={`${roles.value.humanOnlyNote}。これらは AI からは呼べません。役割の設定に関係なく、機械には渡りません。`}
            />
            <div className={styles.catalogStack}>
              {roles.value.rows.map((r) => (
                <div key={r.role} className={styles.catalogRow}>
                  <h3 className={styles.sectionTitle}>{r.label}</h3>
                  <ul className={styles.linkList}>
                    {r.capabilities.map((c) => (
                      <li key={c.key}>{c.label}</li>
                    ))}
                  </ul>
                  {r.humanOnlyBlocked.length > 0 && (
                    <p className={styles.linkNote}>
                      役割の表には入っていますが、機械には渡していません:{" "}
                      {r.humanOnlyBlocked.join("・")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>ブランド</h2>
        {!brands.ok ? (
          <ErrorView
            title="ブランドを出せませんでした"
            body={brands.error.message}
            suggestedAction={brands.error.suggestedAction ?? null}
          />
        ) : brands.value.rows.length === 0 ? (
          <EmptyView
            title="ブランドがありません"
            body={brands.value.emptyReason ?? "登録するとここに並びます。"}
          />
        ) : (
          <>
            {brands.value.notReadyCount > 0 && (
              <Callout
                tone="warn"
                title={`公開の前に埋める項目が残っています（${brands.value.notReadyCount}件）`}
                reason="運営者の表示名と問い合わせ先が無いと、訂正の連絡先を読者に示せません。この状態では記事を公開できません。"
              />
            )}
            <div className={styles.catalogStack}>
              {brands.value.rows.map((b) => (
                <div key={b.brandId} className={styles.catalogRow}>
                  <h3 className={styles.sectionTitle}>{b.displayName}</h3>
                  <p className={styles.sectionLead}>{b.positioning}</p>
                  <table className={styles.rankTable}>
                    <tbody>
                      <tr>
                        <th scope="row">運営者の表示名</th>
                        <td>{b.legalName ?? "未設定"}</td>
                      </tr>
                      <tr>
                        <th scope="row">問い合わせ先</th>
                        <td>{b.contactEmail ?? "未設定"}</td>
                      </tr>
                      <tr>
                        <th scope="row">文体</th>
                        <td>{b.voiceLabel}</td>
                      </tr>
                      <tr>
                        <th scope="row">使わない言い回し</th>
                        <td>
                          {b.avoidPhrases.length === 0 ? "指定なし" : b.avoidPhrases.join("・")}
                        </td>
                      </tr>
                      <tr>
                        <th scope="row">記事末尾の断り書き</th>
                        <td>{b.disclaimer ?? "未設定"}</td>
                      </tr>
                      <tr>
                        <th scope="row">言語</th>
                        <td>{b.locale}</td>
                      </tr>
                      <tr>
                        <th scope="row">時間帯</th>
                        <td>{b.timeZone}（投稿の予定日時はこの時間帯で読み書きします）</td>
                      </tr>
                      <tr>
                        <th scope="row">標準の行動文言</th>
                        <td>{b.defaultCta}</td>
                      </tr>
                    </tbody>
                  </table>
                  {b.missing.length > 0 && (
                    <p className={styles.linkNote}>
                      公開の前に必要: {b.missing.join("・")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>広告であることの表示</h2>
        {!disclosures.ok ? (
          <ErrorView
            title="広告表記を出せませんでした"
            body={disclosures.error.message}
            suggestedAction={disclosures.error.suggestedAction ?? null}
          />
        ) : disclosures.value.rows.length === 0 ? (
          <EmptyView
            title="広告表記がありません"
            body={disclosures.value.emptyReason ?? "登録するとここに並びます。"}
          />
        ) : (
          <>
            <p className={styles.sectionLead}>
              下の文言は、記事・SNS・AI の回答など次の場所すべてに同じものが出ます。画面ごとに書き換えることはできません。
            </p>
            <ul className={styles.linkList}>
              {disclosures.value.surfaces.map((s) => (
                <li key={s.key}>{s.label}</li>
              ))}
            </ul>
            <div className={styles.catalogStack}>
              {disclosures.value.rows.map((d) => (
                <div key={d.disclosureId} className={styles.catalogRow}>
                  <h3 className={styles.sectionTitle}>
                    {d.relationshipLabel}
                    {d.required ? "（表示が必要）" : "（表示は不要）"}
                  </h3>
                  {/* 読者に出るものと同じ見た目で確かめる。別の書き方を画面用に作らない。 */}
                  <DisclosureNotice message={d.visibleMessage} />
                  <table className={styles.rankTable}>
                    <tbody>
                      <tr>
                        <th scope="row">提供元</th>
                        <td>{d.advertiserOrSupplier ?? "なし"}</td>
                      </tr>
                      <tr>
                        <th scope="row">リンクに付ける印</th>
                        <td>{d.relAttribute}</td>
                      </tr>
                      <tr>
                        <th scope="row">AI を使ったか</th>
                        <td>{d.aiAssisted ? "使った（本文に明記されます）" : "使っていない"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>操作の記録</h2>
        {!audit.ok ? (
          // 権限が無い場合はここに入る。「空」ではなく「見られない理由」を出す。
          <Callout
            tone="info"
            title="操作の記録は表示できません"
            reason={`${audit.error.message}${
              audit.error.suggestedAction === undefined ? "" : ` ${audit.error.suggestedAction}`
            }`}
          />
        ) : audit.value.rows.length === 0 ? (
          <EmptyView
            title="まだ記録がありません"
            body={audit.value.emptyReason ?? "操作を行うとここに並びます。"}
          />
        ) : (
          <>
            <table className={styles.rankTable}>
              <thead>
                <tr>
                  <th scope="col">いつ</th>
                  <th scope="col">誰が</th>
                  <th scope="col">何を</th>
                  <th scope="col">対象</th>
                  <th scope="col">理由</th>
                </tr>
              </thead>
              <tbody>
                {audit.value.rows.map((r) => (
                  <tr key={`${r.occurredAt.toISOString()}-${r.targetLabel}-${r.action}`}>
                    <td>{r.occurredAt.toLocaleString("ja-JP")}</td>
                    <td>{r.byHuman ? r.actorLabel : `${r.actorLabel}・人ではありません`}</td>
                    <th scope="row">{r.action}</th>
                    <td>{r.targetLabel}</td>
                    <td>{r.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={styles.linkNote}>
              この記録は後から書き換えられません。承認が人によるものであることを、あとから確かめるために残しています。
            </p>
          </>
        )}
      </Card>
    </Shell>
  );
}

function Shell({ children }: { readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/settings"
      breadcrumbs={[{ label: "ホーム", href: "/admin" }, { label: "設定" }]}
      actions={<Link href="/admin">ホームへ戻る</Link>}
    >
      <Page
        title="設定"
        lead="この作業場所の契約・担当者・ブランド・広告表記と、これまでの操作の記録を見る画面です。"
      >
        {children}
      </Page>
    </AdminShell>
  );
}
