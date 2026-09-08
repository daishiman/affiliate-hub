"use client";

import Link from "next/link";
import { useActionState, useState, type ComponentProps } from "react";
import type { ArticleSummary } from "@/application/read-models/published-article";
import { articleHref } from "@/application/read-models/published-article";
import type { SelectedBlogHomeArticle } from "@/application/usecases/blog-ops/manage-blog-home-featured";
import { MAX_FEATURED_ARTICLES } from "@/domain/blogops";
import {
  Button,
  Callout,
  EmptyView,
  FormResult,
  FormValue,
  Row,
  Select,
  SeeAlso,
  Stack,
  ToolForm,
} from "@/presentation/ui";
import { siteHref } from "@/presentation/site/view-model";
import { manageBlogFeaturedArticlesAction } from "./blog-layout-action";
import { INITIAL_BLOG_OPS_STATE } from "./blog-ops-state";

/** 対象ブログが変わったら、送信先と編集下書きを一緒に切り替える。 */
export function BlogFeaturedArticlesForm(props: ComponentProps<typeof FeaturedArticlesFields>) {
  return <FeaturedArticlesFields key={props.siteSlug} {...props} />;
}

/**
 * トップのおすすめ記事を、記事名を見ながら並べる編集欄。
 *
 * 数値の position は見せない。画面内の上下移動は未保存の下書きで、
 * 「並びを保存」を押したときだけ順序付き relation 全体を置き換える。
 */
function FeaturedArticlesFields({
  siteSlug,
  selectedArticles: initialSelected,
  candidateArticles,
}: {
  readonly siteSlug: string;
  readonly selectedArticles: readonly SelectedBlogHomeArticle[];
  readonly candidateArticles: readonly ArticleSummary[];
}) {
  const [state, action, pending] = useActionState(
    manageBlogFeaturedArticlesAction,
    INITIAL_BLOG_OPS_STATE,
  );
  const [selectedArticles, setSelectedArticles] = useState<readonly SelectedBlogHomeArticle[]>(
    initialSelected,
  );
  const [candidateSlug, setCandidateSlug] = useState("");
  const knownArticles = [
    ...initialSelected.flatMap((row) => (row.article === null ? [] : [row.article])),
    ...candidateArticles,
  ];
  const selectedSlugs = new Set(selectedArticles.map((row) => row.articleSlug));
  const availableCandidates = knownArticles.filter((article) => !selectedSlugs.has(article.slug));
  const full = selectedArticles.length >= MAX_FEATURED_ARTICLES;

  const move = (at: number, delta: -1 | 1) => {
    const to = at + delta;
    if (to < 0 || to >= selectedArticles.length) return;
    const next = [...selectedArticles];
    const current = next[at];
    const target = next[to];
    if (current === undefined || target === undefined) return;
    next[at] = target;
    next[to] = current;
    setSelectedArticles(next);
  };

  const remove = (articleSlug: string) => {
    setSelectedArticles(selectedArticles.filter((row) => row.articleSlug !== articleSlug));
  };

  const add = () => {
    if (full || candidateSlug === "") return;
    const article = availableCandidates.find((candidate) => candidate.slug === candidateSlug);
    if (article === undefined) return;
    setSelectedArticles([...selectedArticles, { articleSlug: article.slug, article }]);
    setCandidateSlug("");
  };

  return (
    <ToolForm
      action={action}
      toolName="replace_blog_home_featured_articles"
      toolDescription="ブログトップのおすすめ記事を、画面に並んだ順で保存する"
    >
      <FormValue name="siteSlug" value={siteSlug} />
      {selectedArticles.map((row) => (
        <FormValue key={row.articleSlug} name="articleSlugs" value={row.articleSlug} />
      ))}

      {selectedArticles.length === 0 ? (
        <EmptyView
          title="おすすめ記事はまだ選ばれていません"
          body={`公開済みの記事から、最初に読んでほしいものを${MAX_FEATURED_ARTICLES}件まで選べます。`}
        />
      ) : (
        <ol>
          {selectedArticles.map((row, index) => {
            const label = row.article?.title ?? row.articleSlug;
            return (
              <li key={row.articleSlug}>
                <Stack>
                  {row.article === null ? (
                    <p>{label}</p>
                  ) : (
                    <SeeAlso>
                      <Link href={siteHref(siteSlug, articleHref(row.article))}>{label}</Link>
                    </SeeAlso>
                  )}
                  {row.article === null ? (
                    <Callout tone="warn" reason="この選択は現在公開されていません。再公開すれば同じ位置へ戻ります。" />
                  ) : null}
                  <Row>
                    <Button
                      type="button"
                      disabled={pending || index === 0}
                      onClick={() => move(index, -1)}
                      aria-label={`${label}を1つ上へ`}
                    >
                      上へ
                    </Button>
                    <Button
                      type="button"
                      disabled={pending || index === selectedArticles.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label={`${label}を1つ下へ`}
                    >
                      下へ
                    </Button>
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={() => remove(row.articleSlug)}
                      aria-label={`${label}をおすすめから外す`}
                    >
                      外す
                    </Button>
                  </Row>
                </Stack>
              </li>
            );
          })}
        </ol>
      )}

      <Select
        label="追加する公開済み記事"
        name="featuredCandidate"
        value={candidateSlug}
        onValueChange={setCandidateSlug}
        options={availableCandidates.map((article) => ({
          value: article.slug,
          label: article.title,
        }))}
        placeholder="記事を選ぶ"
        disabled={pending || full || availableCandidates.length === 0}
        hint={
          full
            ? `おすすめ記事は${MAX_FEATURED_ARTICLES}件までです。`
            : "現在公開中の記事だけを選べます。"
        }
        error={state.field === "articleSlugs" ? state.message : null}
        toolParamDescription="おすすめへ追加する公開済み記事"
      />
      <Button type="button" onClick={add} disabled={pending || full || candidateSlug === ""}>
        おすすめに追加
      </Button>

      <Button type="submit" busy={pending} busyLabel="おすすめ記事を保存しています">
        おすすめ記事の並びを保存
      </Button>
      <FormResult state={state} />
    </ToolForm>
  );
}

