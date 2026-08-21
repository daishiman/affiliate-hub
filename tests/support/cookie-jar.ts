/**
 * テスト中の cookie 置き場。
 *
 * `next/headers` の差し替え（tests/setup.ts）から参照される。
 * 差し替えの中に直接書かないのは、`vi.mock` の中身が巻き上げられて
 * 外側の変数を掴めないためで、**別のファイルに置くのが唯一の確実な方法**になる。
 *
 * 見た目の設定（配色・明暗）は cookie に入っているので、
 * 「暗い表示のときの画面」を確かめるには、ここに値を入れてから描く。
 */
export const cookieJar = new Map<string, string>();

/** テストの中で cookie を 1 つ置く。 */
export function setTestCookie(name: string, value: string): void {
  cookieJar.set(name, value);
}

/**
 * cookie を空に戻す。
 *
 * これを忘れると、前のテストが置いた配色のまま次のテストが描かれ、
 * **単体では通るのに全部走らせると落ちる**という最も追いにくい壊れ方になる。
 */
export function resetTestCookies(): void {
  cookieJar.clear();
}
