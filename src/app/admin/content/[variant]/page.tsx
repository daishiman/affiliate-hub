import { AdminShell } from "@/presentation/admin/admin-shell";
import Link from "next/link";
import type { ReactNode } from "react";
import { contentUseCases, currentActor, editorialContentNotice } from "@/presentation/composition";
import {
  AiCannotApproveNotice,
  ApprovalBlockedNotice,
  ApprovalFlow,
  Callout,
  Card,
  EmptyView,
  ErrorView,
  Page,
  StubNotice,
  type ApprovalState,
} from "@/presentation/ui";
import styles from "../../admin.module.css";

export const dynamic = "force-dynamic";

/**
 * 記事 1 本の画面。
 *
 * **自動確認の結果を「合格」だけで済ませない。**
 * 実行しなかった項目も理由つきで並べる。
 * 出さないと「17 項目すべて確認済み」と読まれ、
 * 実際には見ていない観点が見落とされる。
 */
export default async function ContentDetailPage({
  params,
}: {
  readonly params: Promise<{ readonly variant: string }>;
}) {
  const { variant: variantId } = await params;
  const actor = await currentActor();
  const result = await contentUseCases().getContent.execute(actor, { variantId });

  if (!result.ok) {
    return (
      <Shell title="記事">
        <ErrorView
          title="この記事を表示できませんでした"
          body={result.error.message}
          suggestedAction={result.error.suggestedAction ?? null}
          action={<Link href="/admin/content">記事の一覧へ戻る</Link>}
        />
      </Shell>
    );
  }

  const { variant, quality, authorName, approvalBlockedReason } = result.value;
  const title = variant.title ?? "（見出し未設定）";
  const errors = quality.issues.filter((i) => i.severity === "error");
  const warnings = quality.issues.filter((i) => i.severity !== "error");

  return (
    <Shell title={title}>
      <StubNotice
        what="記事の保存先"
        blockedBy="content_packages / content_variants / personas テーブルの追加とマイグレーション"
        stubId="persistence:content-editorial-sample"
      >
        <span>{editorialContentNotice()}</span>
      </StubNotice>

      <Card>
        <h2 className={styles.sectionTitle}>いまの段階</h2>
        <ApprovalFlow current={approvalStateOf(variant.status)} />
        {actor.isAiServiceAccount ? (
          <AiCannotApproveNotice action={<Link href="/admin/content">記事の一覧へ</Link>} />
        ) : approvalBlockedReason === null ? null : (
          <ApprovalBlockedNotice
            reason={approvalBlockedReason}
            action={<Link href="/admin/content">ほかの記事を見る</Link>}
          />
        )}
        <p className={styles.sectionLead}>
          書き手: {authorName ?? "未設定"} / 媒体: {variant.channel} / 作成に使った指示:{" "}
          {variant.generationPromptVersion}（{variant.modelId}）
        </p>
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>自動確認の結果</h2>
        <p className={styles.sectionLead}>
          直すべき指摘 {errors.length}件 / 気をつける点 {warnings.length}件 / 確認しなかった項目{" "}
          {quality.skipped.length}件
        </p>

        {quality.issues.length === 0 ? (
          <EmptyView
            title="指摘はありません"
            body="自動で確認できる範囲では問題は見つかりませんでした。人の目での確認は別に必要です。"
          />
        ) : (
          <ul className={styles.linkList}>
            {quality.issues.map((issue, i) => (
              <li key={`${issue.check}-${i}`}>
                <Callout
                  tone={issue.severity === "error" ? "danger" : "warn"}
                  title={CHECK_LABEL[issue.check] ?? issue.check}
                  reason={issue.message}
                />
              </li>
            ))}
          </ul>
        )}

        <h3 className={styles.sectionTitle}>確認しなかった項目</h3>
        {quality.skipped.length === 0 ? (
          <p className={styles.sectionLead}>すべての項目を確認しました。</p>
        ) : (
          <dl className={styles.criteria}>
            {quality.skipped.map((s) => (
              <div key={s.check}>
                <dt>{CHECK_LABEL[s.check] ?? s.check}</dt>
                <dd>{s.reason}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card>
        <h2 className={styles.sectionTitle}>本文</h2>
        <p className={styles.sectionLead}>{variant.summary}</p>
        {variant.body.split("\n").map((line, i) => (
          <p key={`${i}-${line.slice(0, 8)}`}>{line}</p>
        ))}
      </Card>

      {variant.assumptions.length === 0 ? null : (
        <Card>
          <h2 className={styles.sectionTitle}>AI が置いた仮定</h2>
          <p className={styles.sectionLead}>
            これは確かめられた内容ではありません。読者にも仮定として示します。
          </p>
          <ul className={styles.linkList}>
            {variant.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </Card>
      )}
    </Shell>
  );
}

/** 記事の状態を、承認の流れの現在地へ読み替える。 */
function approvalStateOf(status: string): ApprovalState {
  switch (status) {
    case "review":
      return "review";
    case "approved":
      return "approved";
    case "published":
      return "published";
    case "rejected":
      return "archived";
    default:
      return "draft";
  }
}

/** 検査の識別子をそのまま出さない。編集者が読んで直せる言葉にする。 */
const CHECK_LABEL: Readonly<Record<string, string>> = {
  unsourced_number: "根拠のない数値",
  stale_price: "古い価格",
  fabricated_experience: "書ける範囲を超えた体験",
  nonexistent_feature: "登録にない機能名",
  exaggeration: "言い過ぎの表現",
  prohibited_phrase: "この書き手では使わない言葉",
  disclosure_present: "広告表示",
  link_present: "リンクの欠落",
  length_fit: "文字数",
  hashtag_fit: "ハッシュタグの数",
  channel_fit: "媒体のきまりとの不一致",
  duplicate_text: "既存記事との重複",
  brand_fit: "書き手らしさ",
  audience_fit: "読者との合い方",
  cta_overuse: "行動を促す文の多さ",
  missing_drawback: "デメリットの欠落",
  missing_citation: "出典の欠落",
};

function Shell({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <AdminShell
      currentPath="/admin/content"
      breadcrumbs={[
        { label: "ホーム", href: "/admin" },
        { label: "記事", href: "/admin/content" },
        { label: title },
      ]}
      actions={<Link href="/admin/content">記事の一覧へ戻る</Link>}
    >
      <Page title={title} lead="本文と自動確認の結果を見て、次の段階へ進めてよいかを判断します。">
        {children}
      </Page>
    </AdminShell>
  );
}
