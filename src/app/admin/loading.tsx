import { LoadingView } from "@/presentation/ui";

/**
 * 管理画面の読込中。
 *
 * 画面ごとに書かない。ここ 1 か所に置くと、
 * 「この画面だけ読込中の見た目が違う」が起きなくなる。
 *
 * 文言は「読み込んでいます」で止める。何％まで進んだかを書かないのは、
 * 数えていない進捗を書くと、止まっているのか進んでいるのかを
 * 画面から見分けられなくなるため。
 */
export default function AdminLoading() {
  return <LoadingView label="読み込んでいます" />;
}
