import type { ArticleBlockKind } from "@/domain/blogops";

/**
 * 記事 1 本の中で、画面が持ち回る部品 1 件の下書き値。
 *
 * 編集フォームと版面チェックの両方が同じ形を読む。片方に置くと、もう片方が
 * それを読むために逆向きの import を作ることになるので、型だけを別に置く。
 * `id` が空文字なのは「まだ保存していない部品」で、保存時に採番される。
 */
export type ArticleBlockDraft = {
  readonly id: string;
  readonly kind: ArticleBlockKind;
  readonly heading: string;
  readonly body: string;
};
