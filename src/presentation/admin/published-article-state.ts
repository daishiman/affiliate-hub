export type PublishedArticleFormState = {
  readonly status: "idle" | "done" | "failed";
  readonly message: string;
  readonly field?: string;
};
export const INITIAL_PUBLISHED_ARTICLE_STATE: PublishedArticleFormState = {
  status: "idle",
  message: "",
};
